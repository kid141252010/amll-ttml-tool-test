import { open } from "@tauri-apps/plugin-shell";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom, withImmer } from "jotai-immer";
import ToJyutping from "to-jyutping";
import { pinyin } from "pinyin-pro";
import { romanize } from "koroman";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import saveFile from "save-file";
import { uid } from "uid";
import { useFileOpener } from "$/hooks/useFileOpener.ts";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import {
	distributeRomanizationByCharCount,
	distributeRomanizationBySpace,
} from "$/modules/segmentation/utils/Transliteration/distributor";
import { applyRomanizationWarnings } from "$/modules/segmentation/utils/Transliteration/roman-warning";
import {
	segmentLyricLines,
	segmentWord,
} from "$/modules/segmentation/utils/segmentation";
import { useSegmentationConfig } from "$/modules/segmentation/utils/useSegmentationConfig";
import {
	advancedSegmentationDialogAtom,
	confirmDialogAtom,
	distributeRomanizationDialogAtom,
	historyRestoreDialogAtom,
	latencyTestDialogAtom,
	metadataEditorDialogAtom,
	settingsDialogAtom,
	submitToAMLLDBDialogAtom,
	timeShiftDialogAtom,
	vocalTagsEditorDialogAtom,
	duplicateSongIdDialogAtom,
} from "$/states/dialogs.ts";
import { checkSongIdsExist } from "$/services/raw-lyrics-index-db";
import {
	keyDeleteSelectionAtom,
	keyNewFileAtom,
	keyOpenFileAtom,
	keyRedoAtom,
	keySaveFileAtom,
	keySelectAllAtom,
	keySelectInvertedAtom,
	keySelectWordsOfMatchedSelectionAtom,
	keyUndoAtom,
} from "$/states/keybindings.ts";
import {
	isDirtyAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	redoLyricLinesAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	undoableLyricLinesAtom,
	undoLyricLinesAtom,
} from "$/states/main.ts";
import { type LyricWord, type LyricWordBase, newLyricWord } from "$/types/ttml";
import { error, log } from "$/utils/logging.ts";

export const useTopMenuActions = () => {
	const { t } = useTranslation();
	const [saveFileName, setSaveFileName] = useAtom(saveFileNameAtom);
	const newLyricLine = useSetAtom(newLyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	// 缓存 kuroshiro 实例
	const kuroshiroRef = useRef<unknown>(null);
	const kuroshiroInitializingRef = useRef<Promise<unknown> | null>(null);

	// 获取或初始化 kuroshiro（动态导入，减少初始加载）
	const getKuroshiro = useCallback(async () => {
		if (kuroshiroRef.current) {
			return kuroshiroRef.current;
		}

		if (kuroshiroInitializingRef.current) {
			return kuroshiroInitializingRef.current;
		}

		const initPromise = (async () => {
			// 动态导入 kuroshiro 和 kuromoji analyzer
			const [{ default: Kuroshiro }, { default: KuromojiAnalyzer }] =
				await Promise.all([
					import("kuroshiro"),
					import("kuroshiro-analyzer-kuromoji"),
				]);

			const kuroshiro = new Kuroshiro();
			// 在浏览器环境中使用 /kuromoji-dict 路径
			const dictPath =
				typeof window !== "undefined" ? "/kuromoji-dict" : undefined;
			await kuroshiro.init(new KuromojiAnalyzer({ dictPath }));
			kuroshiroRef.current = kuroshiro;
			return kuroshiro;
		})();

		kuroshiroInitializingRef.current = initPromise;
		return initPromise;
	}, []);
	const setMetadataEditorOpened = useSetAtom(metadataEditorDialogAtom);
	const setVocalTagsEditorOpened = useSetAtom(vocalTagsEditorDialogAtom);
	const setSettingsDialogOpened = useSetAtom(settingsDialogAtom);
	const undoLyricLines = useAtomValue(undoableLyricLinesAtom);
	const store = useStore();
	const isDirty = useAtomValue(isDirtyAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const setDuplicateSongIdDialog = useSetAtom(duplicateSongIdDialogAtom);
	const setHistoryRestoreDialog = useSetAtom(historyRestoreDialogAtom);
	const setAdvancedSegmentationDialog = useSetAtom(
		advancedSegmentationDialogAtom,
	);
	const setTimeShiftDialog = useSetAtom(timeShiftDialogAtom);
	const { openFile } = useFileOpener();
	const setProjectId = useSetAtom(projectIdAtom);
	const setDistributeRomanizationDialog = useSetAtom(
		distributeRomanizationDialogAtom,
	);
	const { config: segmentationConfig } = useSegmentationConfig();
	const newFileKey = useAtomValue(keyNewFileAtom);
	const openFileKey = useAtomValue(keyOpenFileAtom);
	const saveFileKey = useAtomValue(keySaveFileAtom);
	const undoKey = useAtomValue(keyUndoAtom);
	const redoKey = useAtomValue(keyRedoAtom);
	const selectAllLinesKey = useAtomValue(keySelectAllAtom);
	const selectInvertedLinesKey = useAtomValue(keySelectInvertedAtom);
	const selectWordsOfMatchedSelectionKey = useAtomValue(
		keySelectWordsOfMatchedSelectionAtom,
	);
	const deleteSelectionKey = useAtomValue(keyDeleteSelectionAtom);
	const selectedLineIds = useAtomValue(selectedLinesAtom);

	const buildRubySegments = useCallback(
		(text: string, baseWord: LyricWordBase) => {
			const sourceWord: LyricWord = {
				...newLyricWord(),
				word: text,
				startTime: baseWord.startTime,
				endTime: baseWord.endTime,
				emptyBeat: 0,
			};
			const segments = segmentWord(sourceWord, segmentationConfig);
			if (segments.length === 0) {
				return [
					{
						word: text,
						startTime: baseWord.startTime,
						endTime: baseWord.endTime,
					},
				];
			}
			return segments.map((segment) => ({
				word: segment.word,
				startTime: segment.startTime,
				endTime: segment.endTime,
			}));
		},
		[segmentationConfig],
	);

	const onNewFile = useCallback(() => {
		const action = () => {
			newLyricLine();
			setProjectId(uid());
			setSaveFileName("lyric.ttml");
		};

		if (isDirty) {
			setConfirmDialog({
				open: true,
				title: t("confirmDialog.newFile.title", "确认新建文件"),
				description: t(
					"confirmDialog.newFile.description",
					"当前文件有未保存的更改。如果继续，这些更改将会丢失。确定要新建文件吗？",
				),
				onConfirm: action,
			});
		} else {
			action();
		}
	}, [
		isDirty,
		newLyricLine,
		setConfirmDialog,
		t,
		setProjectId,
		setSaveFileName,
	]);

	const onOpenFile = useCallback(() => {
		const inputEl = document.createElement("input");
		inputEl.type = "file";
		inputEl.accept = ".ttml,.lrc,.qrc,.eslrc,.lys,.yrc,*/*";
		inputEl.addEventListener(
			"change",
			() => {
				const file = inputEl.files?.[0];
				if (!file) return;
				openFile(file);
			},
			{
				once: true,
			},
		);
		inputEl.click();
	}, [openFile]);

	const onOpenFileFromClipboard = useCallback(async () => {
		try {
			const ttmlText = await navigator.clipboard.readText();
			const file = new File([ttmlText], "lyric.ttml", {
				type: "application/xml",
			});
			openFile(file);
		} catch (e) {
			error("Failed to parse TTML file from clipboard", e);
		}
	}, [openFile]);

	const onSaveFile = useCallback(async () => {
		try {
			const lyric = store.get(lyricLinesAtom);

			// 检查歌曲 ID 是否已存在
			const { exists, existingIds } = await checkSongIdsExist(lyric.metadata);
			if (exists) {
				setDuplicateSongIdDialog({
					open: true,
					existingIds,
					onConfirm: () => {
						// 用户确认后执行保存
						const ttmlText = exportTTMLText(lyric);
						const b = new Blob([ttmlText], { type: "text/plain" });
						saveFile(b, saveFileName).catch(error);
					},
				});
				return;
			}

			const ttmlText = exportTTMLText(lyric);
			const b = new Blob([ttmlText], { type: "text/plain" });
			saveFile(b, saveFileName).catch(error);
		} catch (e) {
			error("Failed to save TTML file", e);
		}
	}, [saveFileName, store, setDuplicateSongIdDialog]);

	const onOpenHistoryRestore = useCallback(() => {
		setHistoryRestoreDialog(true);
	}, [setHistoryRestoreDialog]);

	const onSaveFileToClipboard = useCallback(async () => {
		try {
			const lyric = store.get(lyricLinesAtom);

			// 检查歌曲 ID 是否已存在
			const { exists, existingIds } = await checkSongIdsExist(lyric.metadata);
			if (exists) {
				setDuplicateSongIdDialog({
					open: true,
					existingIds,
					onConfirm: async () => {
						// 用户确认后执行保存到剪切板
						const ttml = exportTTMLText(lyric);
						await navigator.clipboard.writeText(ttml);
					},
				});
				return;
			}

			const ttml = exportTTMLText(lyric);
			await navigator.clipboard.writeText(ttml);
		} catch (e) {
			error("Failed to save TTML file into clipboard", e);
		}
	}, [store, setDuplicateSongIdDialog]);

	const onSubmitToAMLLDB = useCallback(() => {
		store.set(submitToAMLLDBDialogAtom, true);
	}, [store]);

	const onOpenMetadataEditor = useCallback(() => {
		setMetadataEditorOpened(true);
	}, [setMetadataEditorOpened]);

	const onOpenVocalTagsEditor = useCallback(() => {
		setVocalTagsEditorOpened(true);
	}, [setVocalTagsEditorOpened]);

	const onOpenSettings = useCallback(() => {
		setSettingsDialogOpened(true);
	}, [setSettingsDialogOpened]);

	const onOpenLatencyTest = useCallback(() => {
		store.set(latencyTestDialogAtom, true);
	}, [store]);

	const onOpenGitHub = useCallback(async () => {
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open("https://github.com/Steve-xmh/amll-ttml-tool");
		} else {
			window.open("https://github.com/Steve-xmh/amll-ttml-tool");
		}
	}, []);

	const onOpenWiki = useCallback(async () => {
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open("https://github.com/Steve-xmh/amll-ttml-tool/wiki");
		} else {
			window.open("https://github.com/Steve-xmh/amll-ttml-tool/wiki");
		}
	}, []);

	const onUndo = useCallback(() => {
		store.set(undoLyricLinesAtom);
	}, [store]);

	const onRedo = useCallback(() => {
		store.set(redoLyricLinesAtom);
	}, [store]);

	const onUnselectAll = useCallback(() => {
		const immerSelectedLinesAtom = withImmer(selectedLinesAtom);
		const immerSelectedWordsAtom = withImmer(selectedWordsAtom);
		store.set(immerSelectedLinesAtom, (old) => {
			old.clear();
		});
		store.set(immerSelectedWordsAtom, (old) => {
			old.clear();
		});
	}, [store]);

	const onSelectAll = useCallback(() => {
		const lines = store.get(lyricLinesAtom).lyricLines;
		const selectedLineIds = store.get(selectedLinesAtom);
		const selectedLines = lines.filter((l) => selectedLineIds.has(l.id));
		const selectedWordIds = store.get(selectedWordsAtom);
		const selectedWords = lines
			.flatMap((l) => l.words)
			.filter((w) => selectedWordIds.has(w.id));
		if (selectedWords.length > 0) {
			const tmpWordIds = new Set(selectedWordIds);
			for (const selLine of selectedLines) {
				for (const word of selLine.words) {
					tmpWordIds.delete(word.id);
				}
			}
			if (tmpWordIds.size === 0) {
				store.set(
					selectedWordsAtom,
					new Set(selectedLines.flatMap((line) => line.words.map((w) => w.id))),
				);
				return;
			}
		} else {
			store.set(
				selectedLinesAtom,
				new Set(store.get(lyricLinesAtom).lyricLines.map((l) => l.id)),
			);
		}
		const sel = window.getSelection();
		if (sel) {
			if (sel.empty) {
				sel.empty();
			} else if (sel.removeAllRanges) {
				sel.removeAllRanges();
			}
		}
	}, [store]);

	const onSelectInverted = useCallback(() => {}, []);

	const onSelectWordsOfMatchedSelection = useCallback(() => {}, []);

	const onDeleteSelection = useCallback(() => {
		const selectedWordIds = store.get(selectedWordsAtom);
		const selectedLineIds = store.get(selectedLinesAtom);
		log("deleting selections", selectedWordIds, selectedLineIds);
		if (selectedWordIds.size === 0) {
			editLyricLines((prev) => {
				prev.lyricLines = prev.lyricLines.filter(
					(l) => !selectedLineIds.has(l.id),
				);
			});
		} else {
			editLyricLines((prev) => {
				for (const line of prev.lyricLines) {
					line.words = line.words.filter((w) => !selectedWordIds.has(w.id));
				}
			});
		}
		store.set(selectedWordsAtom, new Set());
		store.set(selectedLinesAtom, new Set());
	}, [store, editLyricLines]);

	const onAutoSegment = useCallback(() => {
		editLyricLines((draft) => {
			draft.lyricLines = segmentLyricLines(
				draft.lyricLines,
				segmentationConfig,
			);
		});
	}, [editLyricLines, segmentationConfig]);

	const onRubySegment = useCallback(() => {
		const selectedWordIds = store.get(selectedWordsAtom);
		const hasSelection = selectedWordIds.size > 0;
		editLyricLines((state) => {
			for (const line of state.lyricLines) {
				for (const word of line.words) {
					if (hasSelection && !selectedWordIds.has(word.id)) continue;
					if (!word.ruby || word.ruby.length === 0) continue;
					const nextRuby: LyricWordBase[] = [];
					for (const rubyWord of word.ruby) {
						const parts = rubyWord.word.split("|");
						const nextSegments = buildRubySegments(parts[0] ?? "", rubyWord);
						const fallbackBase = {
							word: "",
							startTime: word.startTime,
							endTime: word.endTime,
						};
						const extraSegments = parts
							.slice(1)
							.flatMap((part) => buildRubySegments(part, fallbackBase));
						nextRuby.push(...nextSegments, ...extraSegments);
					}
					word.ruby = nextRuby;
				}
			}
		});
	}, [buildRubySegments, editLyricLines, store]);

	const onOpenTimeShift = useCallback(() => {
		setTimeShiftDialog(true);
	}, [setTimeShiftDialog]);

	const onSyncLineTimestamps = useCallback(() => {
		const action = () => {
			editLyricLines((draft) => {
				for (let i = 0; i < draft.lyricLines.length; i++) {
					const line = draft.lyricLines[i];
					if (line.words.length === 0) continue;

					let startTime = line.words[0].startTime;
					let endTime = line.words[line.words.length - 1].endTime;

					if (i + 1 < draft.lyricLines.length) {
						const nextLine = draft.lyricLines[i + 1];
						if (nextLine.isBG && nextLine.words.length > 0) {
							const nextLineStart = nextLine.words[0].startTime;
							const nextLineEnd =
								nextLine.words[nextLine.words.length - 1].endTime;
							startTime = Math.min(startTime, nextLineStart);
							endTime = Math.max(endTime, nextLineEnd);
						}
					}

					line.startTime = startTime;
					line.endTime = endTime;
				}
			});
		};

		setConfirmDialog({
			open: true,
			title: t("confirmDialog.syncLineTimestamps.title", "确认同步行时间戳"),
			description: t(
				"confirmDialog.syncLineTimestamps.description",
				"此操作将根据每行单词的时间戳自动同步所有行的起始和结束时间为第一个和最后一个音节的开始和结束时间。确定要继续吗？",
			),
			onConfirm: action,
		});
	}, [editLyricLines, setConfirmDialog, t]);

	const onAlignEndTimestamps = useCallback(() => {
		const hasSelection = selectedLineIds.size > 0;

		const action = () => {
			editLyricLines((draft) => {
				// 确定要处理的行：如果有选中行就处理选中行，否则处理所有行
				const linesToProcess = hasSelection
					? draft.lyricLines.filter((line) => selectedLineIds.has(line.id))
					: draft.lyricLines;

				for (const line of linesToProcess) {
					if (line.words.length === 0) continue;

					// 将行内最后一个音节的结束时间设置为行结束时间
					const lastWord = line.words[line.words.length - 1];
					lastWord.endTime = line.endTime;
				}
			});
		};

		setConfirmDialog({
			open: true,
			title: t("confirmDialog.alignEndTimestamps.title", "确认对齐尾部时间戳"),
			description: hasSelection
				? t(
						"confirmDialog.alignEndTimestamps.descriptionWithSelection",
						"此操作将把选中行的最后一个音节结束时间设置为行结束时间。确定要继续吗？",
					)
				: t(
						"confirmDialog.alignEndTimestamps.description",
						"此操作将把每行的最后一个音节结束时间设置为行结束时间。确定要继续吗？",
					),
			onConfirm: action,
		});
	}, [editLyricLines, setConfirmDialog, t, selectedLineIds]);

	const onOpenDistributeRomanization = useCallback(() => {
		setDistributeRomanizationDialog(true);
	}, [setDistributeRomanizationDialog]);

	const onCheckRomanizationWarnings = useCallback(() => {
		editLyricLines((draft) => {
			for (const line of draft.lyricLines) {
				applyRomanizationWarnings(line.words);
			}
		});
	}, [editLyricLines]);

	const onDistributeRomanizationBySpace = useCallback(() => {
		editLyricLines((draft) => {
			for (const line of draft.lyricLines) {
				const fullRoman = line.romanLyric || "";
				if (line.words.length > 0 && fullRoman.trim() !== "") {
					try {
						const results = distributeRomanizationBySpace(
							line.words,
							fullRoman,
						);
						line.words.forEach((word, wordIndex) => {
							if (results[wordIndex]) {
								word.romanWord = results[wordIndex];
							}
						});
						applyRomanizationWarnings(line.words);
						// 分配完成后清除行音译和对应的多语言行音译
						let targetLang: string | undefined;
						if (line.romanLyricByLang) {
							// 找到与当前行音译匹配的语言
							Object.entries(line.romanLyricByLang).forEach(([key, value]) => {
								if (value === fullRoman) {
									targetLang = key;
									delete line.romanLyricByLang?.[key];
								}
							});
						}
						// 将逐字音译保存到对应语言
						if (targetLang) {
							line.wordRomanizationByLang ??= {};
							line.wordRomanizationByLang[targetLang] = line.words
								.filter((word) => word.romanWord.length > 0)
								.map((word) => ({
									startTime: word.startTime,
									endTime: word.endTime,
									text: word.romanWord,
								}));
						}
						// 如果还有其他语言的行音译，切换到第一个可用的语言
						const remainingLangs = Object.keys(line.romanLyricByLang ?? {});
						if (remainingLangs.length > 0) {
							line.romanLyric =
								line.romanLyricByLang?.[remainingLangs[0]] ?? "";
						} else {
							line.romanLyric = "";
						}
					} catch (e) {
						console.error(
							`Failed to distribute romanization by space for line`,
							e,
						);
					}
				}
			}
		});
	}, [editLyricLines]);

	const onDistributeRomanizationByCharCount = useCallback(() => {
		editLyricLines((draft) => {
			for (const line of draft.lyricLines) {
				const fullRoman = line.romanLyric || "";
				if (line.words.length > 0 && fullRoman.trim() !== "") {
					try {
						const results = distributeRomanizationByCharCount(
							line.words,
							fullRoman,
						);
						line.words.forEach((word, wordIndex) => {
							if (results[wordIndex]) {
								word.romanWord = results[wordIndex];
							}
						});
						applyRomanizationWarnings(line.words);
						// 分配完成后清除行音译和对应的多语言行音译
						let targetLang: string | undefined;
						if (line.romanLyricByLang) {
							// 找到与当前行音译匹配的语言
							Object.entries(line.romanLyricByLang).forEach(([key, value]) => {
								if (value === fullRoman) {
									targetLang = key;
									delete line.romanLyricByLang?.[key];
								}
							});
						}
						// 将逐字音译保存到对应语言
						if (targetLang) {
							line.wordRomanizationByLang ??= {};
							line.wordRomanizationByLang[targetLang] = line.words
								.filter((word) => word.romanWord.length > 0)
								.map((word) => ({
									startTime: word.startTime,
									endTime: word.endTime,
									text: word.romanWord,
								}));
						}
						// 如果还有其他语言的行音译，切换到第一个可用的语言
						const remainingLangs = Object.keys(line.romanLyricByLang ?? {});
						if (remainingLangs.length > 0) {
							line.romanLyric =
								line.romanLyricByLang?.[remainingLangs[0]] ?? "";
						} else {
							line.romanLyric = "";
						}
					} catch (e) {
						console.error(
							`Failed to distribute romanization by char count for line`,
							e,
						);
					}
				}
			}
		});
	}, [editLyricLines]);

	const onOpenAdvancedSegmentation = useCallback(() => {
		setAdvancedSegmentationDialog(true);
	}, [setAdvancedSegmentationDialog]);

	const onAutoTransliterationPinyin = useCallback(() => {
		editLyricLines((draft) => {
			for (const line of draft.lyricLines) {
				// 获取主要歌词内容
				const content = line.words.map((w) => w.word).join("");

				// 分离中文和非中文部分
				const segments: Array<{ text: string; isChinese: boolean }> = [];
				let currentSegment = "";
				let isCurrentChinese = false;

				for (const char of content) {
					// 判断是否为中文字符（CJK Unified Ideographs 范围）
					const code = char.charCodeAt(0);
					const isChinese =
						(code >= 0x4e00 && code <= 0x9fff) ||
						(code >= 0x3400 && code <= 0x4dbf) ||
						(code >= 0x20000 && code <= 0x2a6df) ||
						(code >= 0x2a700 && code <= 0x2b73f) ||
						(code >= 0x2b740 && code <= 0x2b81f) ||
						(code >= 0x2b820 && code <= 0x2ceaf);

					if (currentSegment === "") {
						currentSegment = char;
						isCurrentChinese = isChinese;
					} else if (isCurrentChinese === isChinese) {
						currentSegment += char;
					} else {
						segments.push({
							text: currentSegment,
							isChinese: isCurrentChinese,
						});
						currentSegment = char;
						isCurrentChinese = isChinese;
					}
				}

				if (currentSegment !== "") {
					segments.push({ text: currentSegment, isChinese: isCurrentChinese });
				}

				// 转换中文部分并重新组合
				const convertedSegments = segments.map((segment) => {
					if (segment.isChinese) {
						return pinyin(segment.text);
					}
					return segment.text;
				});

				const pinyinText = convertedSegments.join("");

				// 如果转换结果为空或与原文相同，跳过
				if (!pinyinText || pinyinText === content) {
					continue;
				}

				// 设置行音译，语言代码为 zh-Latn（汉语拉丁化）
				line.romanLyricByLang = line.romanLyricByLang || {};
				line.romanLyricByLang["zh-Latn-pinyin"] = pinyinText;

				// 如果没有设置主要的 romanLyric，则使用这个
				if (!line.romanLyric) {
					line.romanLyric = pinyinText;
				}
			}
		});
	}, [editLyricLines]);

	const onAutoTransliterationJyutping = useCallback(() => {
		editLyricLines((draft) => {
			for (const line of draft.lyricLines) {
				// 获取主要歌词内容
				const content = line.words.map((w) => w.word).join("");

				// 使用 to-jyutping 获取粤拼文本
				const jyutping = ToJyutping.getJyutpingText(content);

				// 如果转换结果为空或与原文相同，跳过
				if (!jyutping || jyutping === content) {
					continue;
				}

				// 设置行音译，语言代码为 yue（粤语）
				line.romanLyricByLang = line.romanLyricByLang || {};
				line.romanLyricByLang["zh-Latn-jyutping"] = jyutping;

				// 如果没有设置主要的 romanLyric，则使用这个
				if (!line.romanLyric) {
					line.romanLyric = jyutping;
				}
			}
		});
	}, [editLyricLines]);

	const onAutoTransliterationJapanese = useCallback(async () => {
		try {
			const kuroshiro = await getKuroshiro();

			// 动态导入 Kuroshiro 以使用 Util
			const { default: KuroshiroClass } = await import("kuroshiro");

			// 先收集需要处理的歌词行
			const linesToProcess: Array<{ index: number; content: string }> = [];
			const currentLines = store.get(lyricLinesAtom).lyricLines;

			for (let i = 0; i < currentLines.length; i++) {
				const line = currentLines[i];
				const content = line.words.map((w) => w.word).join("");

				// 检查是否包含日语
				if (KuroshiroClass.Util.hasJapanese(content)) {
					linesToProcess.push({ index: i, content });
				}
			}

			// 异步转换所有日语歌词
			const conversions = await Promise.all(
				linesToProcess.map(async ({ index, content }) => ({
					index,
					romaji: await (
						kuroshiro as {
							convert: (
								text: string,
								options: { mode: string; to: string },
							) => Promise<string>;
						}
					).convert(content, {
						mode: "spaced",
						to: "romaji",
					}),
				})),
			);

			// 更新歌词行
			editLyricLines((draft) => {
				for (const { index, romaji } of conversions) {
					const line = draft.lyricLines[index];
					if (line) {
						// 设置行音译，语言代码为 ja-Latn
						line.romanLyricByLang = line.romanLyricByLang || {};
						line.romanLyricByLang["ja-Latn"] = romaji;

						// 如果没有设置主要的 romanLyric，则使用这个
						if (!line.romanLyric) {
							line.romanLyric = romaji;
						}
					}
				}
			});
		} catch (err) {
			error("Failed to initialize kuroshiro:", err);
		}
	}, [editLyricLines, getKuroshiro, store]);

	const onAutoTransliterationKorean = useCallback(() => {
		editLyricLines((draft) => {
			for (const line of draft.lyricLines) {
				// 获取主要歌词内容
				const content = line.words.map((w) => w.word).join("");

				// 分离韩文和非韩文部分
				const segments: Array<{ text: string; isKorean: boolean }> = [];
				let currentSegment = "";
				let isCurrentKorean = false;

				for (const char of content) {
					// 判断是否为韩文字符（Hangul Syllables 范围）
					const code = char.charCodeAt(0);
					const isKorean =
						(code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
						(code >= 0x1100 && code <= 0x11ff) || // Hangul Jamo
						(code >= 0x3130 && code <= 0x318f); // Hangul Compatibility Jamo

					if (currentSegment === "") {
						currentSegment = char;
						isCurrentKorean = isKorean;
					} else if (isCurrentKorean === isKorean) {
						currentSegment += char;
					} else {
						segments.push({ text: currentSegment, isKorean: isCurrentKorean });
						currentSegment = char;
						isCurrentKorean = isKorean;
					}
				}

				if (currentSegment !== "") {
					segments.push({ text: currentSegment, isKorean: isCurrentKorean });
				}

				// 转换韩文部分并重新组合
				const convertedSegments = segments.map((segment) => {
					if (segment.isKorean) {
						return romanize(segment.text);
					}
					return segment.text;
				});

				const romanizedText = convertedSegments.join("");

				// 如果转换结果为空或与原文相同，跳过
				if (!romanizedText || romanizedText === content) {
					continue;
				}

				// 设置行音译，语言代码为 ko-Latn（韩语拉丁化）
				line.romanLyricByLang = line.romanLyricByLang || {};
				line.romanLyricByLang["ko-Latn"] = romanizedText;

				// 如果没有设置主要的 romanLyric，则使用这个
				if (!line.romanLyric) {
					line.romanLyric = romanizedText;
				}
			}
		});
	}, [editLyricLines]);

	return {
		newFileKey,
		openFileKey,
		saveFileKey,
		undoKey,
		redoKey,
		selectAllLinesKey,
		unselectAllLinesKey: selectAllLinesKey,
		selectInvertedLinesKey,
		selectWordsOfMatchedSelectionKey,
		deleteSelectionKey,
		undoDisabled: !undoLyricLines.canUndo,
		redoDisabled: !undoLyricLines.canRedo,
		onNewFile,
		onOpenFile,
		onOpenFileFromClipboard,
		onSaveFile,
		onOpenHistoryRestore,
		onSaveFileToClipboard,
		onSubmitToAMLLDB,
		onUndo,
		onRedo,
		onSelectAll,
		onUnselectAll,
		onSelectInverted,
		onSelectWordsOfMatchedSelection,
		onDeleteSelection,
		onOpenTimeShift,
		onOpenMetadataEditor,
		onOpenVocalTagsEditor,
		onOpenSettings,
		onAutoSegment,
		onRubySegment,
		onOpenAdvancedSegmentation,
		onSyncLineTimestamps,
		onAlignEndTimestamps,
		onOpenDistributeRomanization,
		onCheckRomanizationWarnings,
		onDistributeRomanizationBySpace,
		onDistributeRomanizationByCharCount,
		onAutoTransliterationPinyin,
		onAutoTransliterationJyutping,
		onAutoTransliterationJapanese,
		onAutoTransliterationKorean,
		onOpenLatencyTest,
		onOpenGitHub,
		onOpenWiki,
	};
};
