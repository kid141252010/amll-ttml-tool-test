/**
 * @description 波形图渲染 Worker（纯 JS 实现）
 *
 * 与频谱图 Worker 的差异：
 * - 不需要 WASM/FFT，仅按列取代表采样点，计算量极小；
 * - 渲染时用 Canvas 2D 路径连接相邻采样点形成折线波形，用 createLinearGradient
 *   垂直渐变着色（中线高响度色 → 边缘低响度色）；
 * - 与频谱图共用相同的色板协议（256 色 RGBA Uint8Array LUT）；
 * - 同样使用 OffscreenCanvas + transferToImageBitmap 实现零拷贝回传。
 */
import type { WaveformWorkerScope } from "$/modules/waveform/workers/types";

const ctx: WaveformWorkerScope = self as WaveformWorkerScope;

let fullAudioData: Float32Array | null = null;
let audioSampleRate = 0;
let currentPalette: Uint8Array | null = null;

/**
 * @description 生成单瓦片的折线波形图
 *
 * 算法（折线连接 + 垂直渐变着色）：
 * 1. 按像素列分窗，每列取中间样本作为代表采样点。
 * 2. 相邻列的代表采样点用直线连接，形成折线波形。
 * 3. 用 createLinearGradient 创建垂直渐变作为 strokeStyle：
 *    中线 (dist=0) → palette[255]（高响度色），边缘 (dist=1) → palette[0]（低响度色）。
 *
 * 性能：相比柱状条方案，像素写入量从 "每列 × 柱高" 降低到 "每列 × 线宽"，
 * 在 Canvas 2D 路径绘制下开销更低；垂直渐变只需一次创建，无额外查表。
 */
function generateWaveformImage(
	audioSlice: Float32Array,
	palette: Uint8Array,
	tileWidthPx: number,
	height: number,
	gain: number,
): ImageBitmap {
	const sliceLength = audioSlice.length;
	const canvas = new OffscreenCanvas(tileWidthPx, height);
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("OffscreenCanvas context 失败");

	if (sliceLength === 0) {
		return canvas.transferToImageBitmap();
	}

	const centerY = height / 2;
	const maxBarHalfHeight = height / 2;

	// 垂直渐变着色（与柱状条方案一致，方向反转）
	// 中线 (dist=0) → palette[255]（高响度色），边缘 (dist=1) → palette[0]（低响度色）
	const gradient = ctx.createLinearGradient(0, 0, 0, height);
	const colorStops = 64;
	for (let i = 0; i <= colorStops; i++) {
		const t = i / colorStops;
		const y = t * height;
		const dist = Math.abs(y - centerY) / maxBarHalfHeight;
		const clamped = dist > 1 ? 1 : dist;
		const colorIdx = ((1 - clamped) * 255) | 0;
		const offset = colorIdx * 4;
		const r = palette[offset];
		const g = palette[offset + 1];
		const b = palette[offset + 2];
		const a = palette[offset + 3];
		gradient.addColorStop(t, `rgba(${r},${g},${b},${a / 255})`);
	}

	ctx.strokeStyle = gradient;
	ctx.lineWidth = 1.5;
	ctx.lineJoin = "round";
	ctx.lineCap = "round";
	ctx.beginPath();

	const samplesPerColumn = sliceLength / tileWidthPx;
	let firstPoint = true;

	for (let col = 0; col < tileWidthPx; col++) {
		const startSample = Math.floor(col * samplesPerColumn);
		const endSample = Math.floor((col + 1) * samplesPerColumn);

		// 取该列的代表采样点（中间样本）
		let sample = 0;
		if (endSample > startSample) {
			const midSample = (startSample + endSample) >> 1;
			sample = midSample < sliceLength ? audioSlice[midSample] : 0;
		} else if (startSample < sliceLength) {
			// 列数多于样本数（极致放大），取最近样本
			sample = audioSlice[startSample];
		}

		const amplified = sample * gain;
		const clamped =
			amplified > 1 ? 1 : amplified < -1 ? -1 : amplified;
		const y = centerY - clamped * maxBarHalfHeight;

		if (firstPoint) {
			ctx.moveTo(col, y);
			firstPoint = false;
		} else {
			ctx.lineTo(col, y);
		}
	}
	ctx.stroke();

	return canvas.transferToImageBitmap();
}

ctx.onmessage = (event) => {
	const msg = event.data;

	switch (msg.type) {
		case "INIT":
			fullAudioData = msg.audioData;
			audioSampleRate = msg.sampleRate;
			currentPalette = null;
			ctx.postMessage({ type: "INIT_COMPLETE" });
			break;
		case "SET_PALETTE":
			currentPalette = msg.palette;
			break;
		case "GET_TILE": {
			const { reqId, params } = msg;

			if (!fullAudioData || !audioSampleRate || !currentPalette) {
				ctx.postMessage({
					type: "ERROR",
					reqId,
					message: "Worker not ready",
				});
				return;
			}

			const { startTime, endTime, gain, tileWidthPx, height } = params;

			const startSample = Math.floor(startTime * audioSampleRate);
			const endSample = Math.ceil(endTime * audioSampleRate);

			if (startSample >= fullAudioData.length) {
				ctx.postMessage({
					type: "ERROR",
					reqId,
					message: "Out of bounds",
				});
				return;
			}

			const audioSlice = fullAudioData.subarray(
				startSample,
				Math.min(endSample, fullAudioData.length),
			);

			try {
				const imageBitmap = generateWaveformImage(
					audioSlice,
					currentPalette,
					tileWidthPx,
					height,
					gain,
				);
				ctx.postMessage(
					{
						type: "TILE_READY",
						reqId,
						imageBitmap,
					},
					[imageBitmap],
				);
			} catch (e) {
				ctx.postMessage({
					type: "ERROR",
					reqId,
					message: (e as Error).message,
				});
			}
			break;
		}
	}
};
