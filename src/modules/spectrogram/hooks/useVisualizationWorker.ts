import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioVisualizationMode } from "$/modules/audio/states";
import { LRUCache } from "$/modules/spectrogram/utils/lru-cache";
import type {
	SpectrogramWorker,
	TileGenerationParams,
	WorkerResponse,
} from "$/modules/spectrogram/workers/types";

const MAX_CACHED_TILES = 70;

export type TileEntry = {
	bitmap: ImageBitmap;
	width: number;
	height: number;
	gain: number;
	paletteId: string;
	mode: AudioVisualizationMode;
	startTime: number;
};

/**
 * @description 通用可视化 Worker 客户端
 *
 * 频谱图 Worker（WASM/FFT）与波形图 Worker（纯 JS）共享完全相同的消息协议：
 * INIT / SET_PALETTE / GET_TILE / TILE_READY / ERROR。
 * 因此一个泛型客户端即可驱动两者，只需传入不同的 Worker 脚本 URL。
 */
class VisualizationWorkerClient {
	private worker: SpectrogramWorker;
	private reqIdCounter = 0;
	private pendingRequests = new Map<
		number,
		{
			resolve: (bmp: ImageBitmap) => void;
			reject: (err: Error) => void;
		}
	>();

	constructor(workerUrl: URL) {
		this.worker = new Worker(workerUrl, { type: "module" });
		this.worker.onmessage = this.handleMessage.bind(this);
	}

	private handleMessage(event: MessageEvent<WorkerResponse>) {
		const msg = event.data;
		if (msg.type === "TILE_READY") {
			const request = this.pendingRequests.get(msg.reqId);
			if (request) {
				request.resolve(msg.imageBitmap);
				this.pendingRequests.delete(msg.reqId);
			} else {
				msg.imageBitmap.close();
			}
		} else if (msg.type === "ERROR") {
			const request = this.pendingRequests.get(msg.reqId);
			if (request) {
				console.warn(`Worker Error req ${msg.reqId}:`, msg.message);
				request.reject(new Error(msg.message));
				this.pendingRequests.delete(msg.reqId);
			}
		}
	}

	public getTile(params: TileGenerationParams): Promise<ImageBitmap> {
		const reqId = this.reqIdCounter++;
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(reqId, { resolve, reject });
			this.worker.postMessage({
				type: "GET_TILE",
				reqId,
				params,
			});
		});
	}

	public initAudio(audioData: Float32Array, sampleRate: number) {
		this.worker.postMessage({ type: "INIT", audioData, sampleRate }, [
			audioData.buffer,
		]);
	}

	public setPalette(palette: Uint8Array) {
		this.worker.postMessage({ type: "SET_PALETTE", palette });
	}

	public terminate() {
		this.worker.terminate();
		this.pendingRequests.clear();
	}
}

function getWorkerUrl(mode: AudioVisualizationMode): URL {
	if (mode === "waveform") {
		// spectrogram/hooks/ → spectrogram/ → modules/ → waveform/workers/
		return new URL("../../waveform/workers/waveform.worker.ts", import.meta.url);
	}
	return new URL("../workers/spectrogram.worker.ts", import.meta.url);
}

/**
 * @description 统一可视化渲染 Hook
 *
 * 根据 mode 创建对应的 Worker（频谱图 WASM / 波形图 纯 JS），对外暴露与
 * 原 useSpectrogramWorker 完全一致的接口。
 *
 * 切换模式时：
 * - 终止旧 Worker、创建新 Worker；
 * - 清空 LRU 缓存与活跃请求集合；
 * - 在新 Worker 中重新初始化音频与色板；
 * - 使用 modeRef 丢弃切换前已发出的过期 bitmap，防止错误缓存。
 */
export const useVisualizationWorker = (
	audioBuffer: AudioBuffer | null,
	paletteData: Uint8Array,
	mode: AudioVisualizationMode,
) => {
	const clientRef = useRef<VisualizationWorkerClient | null>(null);
	const tileCache = useRef<LRUCache<string, TileEntry>>(
		new LRUCache(MAX_CACHED_TILES, (_key, entry) => {
			entry.bitmap.close();
		}),
	);
	const activeRequests = useRef<Set<string>>(new Set());
	const [lastTileTimestamp, setLastTileTimestamp] = useState(0);

	const paletteDataRef = useRef(paletteData);
	useEffect(() => {
		paletteDataRef.current = paletteData;
		if (clientRef.current) {
			clientRef.current.setPalette(paletteData);
		}
	}, [paletteData]);

	const audioBufferRef = useRef(audioBuffer);
	useEffect(() => {
		audioBufferRef.current = audioBuffer;
	}, [audioBuffer]);

	const modeRef = useRef(mode);
	useEffect(() => {
		modeRef.current = mode;
	}, [mode]);

	// 模式切换时重建 Worker
	useEffect(() => {
		const client = new VisualizationWorkerClient(getWorkerUrl(mode));
		clientRef.current = client;

		// 清空旧模式的缓存与请求
		tileCache.current.clear();
		activeRequests.current.clear();

		// 在新 Worker 中重新初始化音频与色板
		const buf = audioBufferRef.current;
		if (buf) {
			const channelData = buf.getChannelData(0);
			const channelDataCopy = channelData.slice();
			client.initAudio(channelDataCopy, buf.sampleRate);
		}
		if (paletteDataRef.current) {
			client.setPalette(paletteDataRef.current);
		}

		setLastTileTimestamp(Date.now());

		return () => client.terminate();
	}, [mode]);

	// 音频变化时重新初始化
	useEffect(() => {
		if (audioBuffer && clientRef.current) {
			tileCache.current.clear();
			activeRequests.current.clear();

			const channelData = audioBuffer.getChannelData(0);
			const channelDataCopy = channelData.slice();

			clientRef.current.initAudio(channelDataCopy, audioBuffer.sampleRate);

			if (paletteDataRef.current) {
				clientRef.current.setPalette(paletteDataRef.current);
			}

			setLastTileTimestamp(Date.now());
		}
	}, [audioBuffer]);

	const requestTileIfNeeded = useCallback(
		async (params: TileGenerationParams) => {
			if (!clientRef.current) return;

			const currentMode = modeRef.current;
		const cacheKey = `tile-${params.tileIndex}`;
		const requestFingerprint = `${params.tileIndex}-s${params.startTime}-w${params.tileWidthPx}-h${params.height}-g${params.gain}-p${params.paletteId}-m${currentMode}`;

		const cacheEntry = tileCache.current.get(cacheKey);

		const isStale =
			!cacheEntry ||
			cacheEntry.startTime !== params.startTime ||
			cacheEntry.width < params.tileWidthPx ||
			cacheEntry.height !== params.height ||
			cacheEntry.gain !== params.gain ||
			cacheEntry.paletteId !== params.paletteId ||
			cacheEntry.mode !== currentMode;

			if (isStale && !activeRequests.current.has(requestFingerprint)) {
				activeRequests.current.add(requestFingerprint);

				try {
					const bitmap = await clientRef.current.getTile(params);

					// 模式可能已在 await 期间切换，丢弃过期 bitmap
					if (modeRef.current !== currentMode) {
						bitmap.close();
						return;
					}

					tileCache.current.set(cacheKey, {
						bitmap,
						width: params.tileWidthPx,
						height: params.height,
						gain: params.gain,
						paletteId: params.paletteId,
						mode: currentMode,
						startTime: params.startTime,
					});

					setLastTileTimestamp(Date.now());
				} catch (err) {
					console.error("生成可视化瓦片失败", err);
				} finally {
					activeRequests.current.delete(requestFingerprint);
				}
			}
		},
		[],
	);

	return { tileCache, requestTileIfNeeded, lastTileTimestamp };
};
