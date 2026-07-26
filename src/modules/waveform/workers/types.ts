/**
 * @description 波形图 Worker 通信类型定义
 *
 * 与频谱图保持一致的协议：INIT -> SET_PALETTE -> GET_TILE -> TILE_READY
 * 区别在于 GET_TILE 不需要 FFT，仅按列计算峰值幅度。
 */
export interface WaveTileGenerationParams {
	tileIndex: number;
	startTime: number;
	endTime: number;
	gain: number;
	height: number;
	tileWidthPx: number;
	paletteId: string;
}

export type WaveformWorkerRequest =
	| { type: "INIT"; audioData: Float32Array; sampleRate: number }
	| { type: "SET_PALETTE"; palette: Uint8Array }
	| { type: "GET_TILE"; reqId: number; params: WaveTileGenerationParams };

export type WaveformWorkerResponse =
	| { type: "INIT_COMPLETE" }
	| { type: "TILE_READY"; reqId: number; imageBitmap: ImageBitmap }
	| { type: "ERROR"; reqId: number; message: string };

export interface WaveformWorker extends Omit<Worker, "postMessage"> {
	postMessage(
		message: WaveformWorkerRequest,
		transfer?: Transferable[],
	): void;
}

export type WaveformWorkerScope = Omit<
	DedicatedWorkerGlobalScope,
	"postMessage" | "onmessage"
> & {
	postMessage(
		message: WaveformWorkerResponse,
		transfer?: Transferable[],
	): void;
	onmessage:
		| ((
				this: WaveformWorkerScope,
				ev: MessageEvent<WaveformWorkerRequest>,
		  ) => void)
		| null;
};
