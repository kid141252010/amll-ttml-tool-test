import { atomWithStorage } from "jotai/utils";

export const showTranslationLinesAtom = atomWithStorage(
	"showTranslationLines",
	false,
);
export const showRomanLinesAtom = atomWithStorage("showRomanLines", false);
export const showAnnotationLinesAtom = atomWithStorage(
	"showAnnotationLines",
	false,
);
export const hideObsceneWordsAtom = atomWithStorage("hideObsceneWords", false);
export const lyricWordFadeWidthAtom = atomWithStorage(
	"lyricWordFadeWidth",
	0.5,
);

// 字体设置
export const fontScaleAtom = atomWithStorage("fontScale", 100); // 字号倍率 25-400%
export const originalFontAtom = atomWithStorage("originalFont", ""); // 原文字体
export const translationFontAtom = atomWithStorage("translationFont", ""); // 翻译字体
export const romanFontAtom = atomWithStorage("romanFont", ""); // 音译字体
export const annotationFontAtom = atomWithStorage("annotationFont", ""); // 标注字体

// 布局设置
export const alignPositionAtom = atomWithStorage("alignPosition", 35); // 垂直对齐位置 0-100%
export const bgLineOpacityAtom = atomWithStorage("bgLineOpacity", 40); // 背景行透明度 0-100%
