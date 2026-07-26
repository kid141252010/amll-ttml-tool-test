import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const audioBufferAtom = atom<AudioBuffer | null>(null);

/**
 * @description 底部音频可视化模式：频谱图 / 波形图
 *
 * 控制 AudioControls 面板展开时显示哪种可视化，用户偏好持久化。
 */
export type AudioVisualizationMode = "spectrogram" | "waveform";
export const audioVisualizationModeAtom = atomWithStorage<AudioVisualizationMode>(
	"settings_audioVisualizationMode",
	"spectrogram",
);

export const volumeAtom = atomWithStorage("volume", 0.5);
export const playbackRateAtom = atomWithStorage("playbackRate", 1);
export const audioPlayingAtom = atom(false);
export const loadedAudioAtom = atom(new Blob([]));
export const currentTimeAtom = atom(0);
export const currentDurationAtom = atom(0);
export const auditionTimeAtom = atom<number | null>(null);

export interface AudioTaskState {
	type: AudioTaskType;
	/**
	 * 转码进度，0 ~ 1 之间的浮点数
	 */
	progress: number;
}
export type AudioTaskType = "TRANSCODING" | "LOADING";
export const audioTaskStateAtom = atom<AudioTaskState | null>(null);
export const audioErrorAtom = atom<string | null>(null);
