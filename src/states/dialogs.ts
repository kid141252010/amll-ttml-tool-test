import { atom } from "jotai";

export const importFromTextDialogAtom = atom(false);
export const metadataEditorDialogAtom = atom(false);
export const vocalTagsEditorDialogAtom = atom(false);
export const metaSuggestionManagerDialogAtom = atom(false);
export const storageManagerDialogAtom = atom(false);
export const settingsDialogAtom = atom(false);
export const settingsTabAtom = atom("common");
export const latencyTestDialogAtom = atom(false);
export const submitToAMLLDBDialogAtom = atom(false);
export const agentManagerDialogAtom = atom(false);
export const splitWordDialogAtom = atom(false);
export const replaceWordDialogAtom = atom(false);
export const advancedSegmentationDialogAtom = atom(false);
export const timeShiftDialogAtom = atom(false);
export const distributeRomanizationDialogAtom = atom(false);
export const notificationCenterDialogAtom = atom(false);
export type AddLanguageDialogTarget =
	| "translation"
	| "romanization";
export const addLanguageDialogAtom = atom<{
	open: boolean;
	target: AddLanguageDialogTarget;
	// 原文行内容
	originalLines: string[];
	// 初始翻译/音译内容（用于编辑模式）
	initialContent?: string;
	onSubmit?: (lang: string, contentLines: string[]) => void;
}>({
	open: false,
	target: "translation",
	originalLines: [],
});

export type EditLanguageDialogTarget =
	| "primary"
	| "translation"
	| "romanization"
	| "word-romanization";

export const editLanguageDialogAtom = atom<{
	open: boolean;
	target: EditLanguageDialogTarget;
	currentLang: string;
	// 原文行内容
	originalLines: string[];
	// 当前翻译/音译内容
	currentContent?: string;
	onSubmit?: (newLang: string, contentLines: string[]) => void;
}>({
	open: false,
	target: "primary",
	currentLang: "",
	originalLines: [],
});
export const confirmDialogAtom = atom<{
	open: boolean;
	title: string;
	description: string;
	onConfirm?: (value?: string) => void;
	onCancel?: () => void;
	input?: {
		placeholder?: string;
		defaultValue?: string;
		validate?: (value: string) => string | null;
	};
}>({
	open: false,
	title: "",
	description: "",
});
export const riskConfirmDialogAtom = atom<{
	open: boolean;
	onConfirmed?: () => void;
}>({
	open: false,
});
export const historyRestoreDialogAtom = atom(false);
export const importFromLRCLIBDialogAtom = atom(false);
export const reviewReportDialogAtom = atom<{
	open: boolean;
	prNumber: number | null;
	prTitle: string;
	report: string;
	draftId: string | null;
}>({
	open: false,
	prNumber: null,
	prTitle: "",
	report: "",
	draftId: null,
});

// 歌曲 ID 重复警告对话框
export const duplicateSongIdDialogAtom = atom<{
	open: boolean;
	existingIds: { type: string; id: string }[];
	onConfirm?: () => void;
	onCancel?: () => void;
}>({
	open: false,
	existingIds: [],
});

// 使用元数据重命名对话框
export const metadataRenameDialogAtom = atom<{
	open: boolean;
}>({
	open: false,
});

// 消减卡顿对话框
export const reduceStutterDialogAtom = atom<{
	open: boolean;
}>({
	open: false,
});
