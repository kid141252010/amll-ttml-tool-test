import { ContextMenu } from "@radix-ui/themes";
import { type Atom, atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useTranslation } from "react-i18next";
import { replaceWordDialogAtom, splitWordDialogAtom } from "$/states/dialogs";
import {
	editingWordStateAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
} from "$/types/ttml";
import { msToTimestamp } from "$/utils/timestamp.ts";
import { normalizeLineTime } from "../utils/normalize-line-time";

const selectedLinesSizeAtom = atom((get) => get(selectedLinesAtom).size);
const selectedWordsSizeAtom = atom((get) => get(selectedWordsAtom).size);

export const LyricWordMenu = ({
	wordIndex,
	wordAtom,
	lineIndex,
}: {
	wordIndex: number;
	wordAtom: Atom<LyricWord>;
	lineIndex: number;
}) => {
	const { t } = useTranslation();

	const store = useStore();
	const selectedWordsSize = useAtomValue(selectedWordsSizeAtom);
	const selectedLinesSize = useAtomValue(selectedLinesSizeAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setOpenSplitWordDialog = useSetAtom(splitWordDialogAtom);
	const setOpenReplaceWordDialog = useSetAtom(replaceWordDialogAtom);
	const setEditingWordState = useSetAtom(editingWordStateAtom);
	const word = useAtomValue(wordAtom);

	return (
		<>
			<ContextMenu.Item
				disabled={selectedWordsSize !== 1}
				onSelect={() => {
					setEditingWordState({
						wordIndex,
						lineIndex,
						word: word.word,
					});
					setOpenSplitWordDialog(true);
				}}
			>
				{t("contextMenu.splitWord", "拆分单词…")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={selectedWordsSize !== 1}
				onSelect={() => {
					setEditingWordState({
						wordIndex,
						lineIndex,
						word: word.word,
					});
					setOpenReplaceWordDialog(true);
				}}
			>
				{t("contextMenu.replaceWord", "替换单词…")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!(selectedWordsSize > 1 && selectedLinesSize === 1)}
				onSelect={() => {
					editLyricLines((state) => {
						const selectedWords = store.get(selectedWordsAtom);
						const line = state.lyricLines[lineIndex];
						if (line) {
							const selectedWordsInLine = line.words.filter((w) =>
								selectedWords.has(w.id),
							);

							if (selectedWordsInLine.length > 1) {
								const mergedWord = selectedWordsInLine
									.map((w) => w.word)
									.join("");
								const firstWord = selectedWordsInLine[0];
								const lastWord =
									selectedWordsInLine[selectedWordsInLine.length - 1];
								const firstIndex = line.words.indexOf(firstWord);

								const newWord = newLyricWord();
								newWord.word = mergedWord;
								newWord.startTime = firstWord.startTime;
								newWord.endTime = lastWord.endTime;

								state.lyricLines[lineIndex].words = line.words.filter(
									(w) => !selectedWords.has(w.id),
								);
								if (firstIndex !== -1) {
									state.lyricLines[lineIndex].words.splice(
										firstIndex,
										0,
										newWord,
									);
								}
							}
						}
					});
				}}
			>
				{t("contextMenu.combineWords", "合并单词")}
			</ContextMenu.Item>

			<ContextMenu.Item
				disabled={selectedWordsSize === 0}
				onSelect={() => {
					editLyricLines((state) => {
						const selectedWords = store.get(selectedWordsAtom);
						for (const line of state.lyricLines) {
							const originalLength = line.words.length;
							const filteredWords = line.words.filter(
								(w) => !selectedWords.has(w.id),
							);
							line.words = filteredWords;
							if (originalLength !== filteredWords.length)
								normalizeLineTime(line);
						}
					});
				}}
			>
				{t("contextMenu.deleteWords", {
					count: selectedWordsSize,
					defaultValue: "删除选定单词",
				})}
			</ContextMenu.Item>

			<ContextMenu.Separator />

			<ContextMenu.Item
				disabled={selectedWordsSize !== 1 || wordIndex === 0}
				onSelect={() => autoCalculateFromPrevWord()}
			>
				{t("contextMenu.autoCalculateFromPrev", "根据上一音节自动计算")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={selectedWordsSize !== 1}
				onSelect={() => autoCalculateFromNextWord()}
			>
				{t("contextMenu.autoCalculateFromNext", "根据下一音节自动计算")}
			</ContextMenu.Item>

			<ContextMenu.Separator />

			<ContextMenu.Item
				disabled={selectedWordsSize !== 1}
				onSelect={() => afterToNewLine()}
			>
				{t("contextMenu.moveFollowingWordToNewLine", "此后单词拆至新行")}
			</ContextMenu.Item>

			<ContextMenu.Item
				disabled={selectedWordsSize === 0}
				onSelect={() => selectedToNewLine()}
			>
				{t("contextMenu.moveWordToNewLine", {
					count: selectedWordsSize,
					defaultValue: "所选单词拆至新行",
				})}
			</ContextMenu.Item>

			<ContextMenu.Separator />

			<ContextMenu.Item
				disabled={selectedWordsSize !== 1}
				onSelect={() => copyWordContent()}
			>
				{t("contextMenu.copyWordContent", "复制音节内容")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={selectedWordsSize === 0}
				onSelect={() => copySelectedWordsText()}
			>
				{t("contextMenu.copySelectedWordsText", "复制选中音节文本")}
			</ContextMenu.Item>

			<ContextMenu.Separator />
		</>
	);

	function copyWordContent() {
		const selectedWordIds = store.get(selectedWordsAtom);
		const selectedWords: LyricWord[] = [];

		// 收集选中的音节
		for (const line of store.get(lyricLinesAtom).lyricLines) {
			for (const w of line.words) {
				if (selectedWordIds.has(w.id)) {
					selectedWords.push(w);
				}
			}
		}

		// 按开始时间排序
		selectedWords.sort((a, b) => a.startTime - b.startTime);

		// 格式化为 「text/begin/end」，时间使用分:秒:毫秒格式
		const content = selectedWords
			.map(
				(w) =>
					`「${w.word}/\`${msToTimestamp(w.startTime)}\`/\`${msToTimestamp(w.endTime)}\`」`,
			)
			.join("\n");

		// 复制到剪贴板
		if (content) {
			navigator.clipboard.writeText(content);
		}
	}

	function copySelectedWordsText() {
		const selectedWordIds = store.get(selectedWordsAtom);
		const selectedWords: LyricWord[] = [];

		// 收集选中的音节
		for (const line of store.get(lyricLinesAtom).lyricLines) {
			for (const w of line.words) {
				if (selectedWordIds.has(w.id)) {
					selectedWords.push(w);
				}
			}
		}

		// 按开始时间排序
		selectedWords.sort((a, b) => a.startTime - b.startTime);

		// 拼接文本为一行
		const content = selectedWords.map((w) => w.word).join("");

		// 复制到剪贴板
		if (content) {
			navigator.clipboard.writeText(content);
		}
	}

	function selectedToNewLine() {
		editLyricLines((state) => {
			const selectedWordIds = store.get(selectedWordsAtom);
			const selectedWords: LyricWord[] = [];
			const affectedLines: LyricLine[] = [];
			for (const line of state.lyricLines) {
				const deletedAtBounds =
					line.words.length > 0 &&
					(selectedWordIds.has(line.words[0].id) ||
						selectedWordIds.has(line.words[line.words.length - 1].id));
				line.words = line.words.filter((w) => {
					if (selectedWordIds.has(w.id)) {
						selectedWords.push(w);
						affectedLines.push(line);
						return false;
					}
					return true;
				});
				if (deletedAtBounds) normalizeLineTime(line);
			}
			const newLine = {
				...newLyricLine(),
				isBG: state.lyricLines[lineIndex].isBG,
				isDuet: state.lyricLines[lineIndex].isDuet,
			} as LyricLine;
			newLine.words.push(...selectedWords);
			normalizeLineTime(newLine);
			state.lyricLines.splice(lineIndex + 1, 0, newLine);
		});
	}

	function afterToNewLine() {
		editLyricLines((state) => {
			const line = state.lyricLines[lineIndex];
			if (!line) return;
			const word = line.words[wordIndex];
			if (!word) return;
			if (/^\s*$/.test(word.word) && !word.startTime && !word.endTime)
				line.words.splice(wordIndex, 1);
			const wordsToMove = line.words.splice(wordIndex);
			const newLine = {
				...newLyricLine(),
				isBG: line.isBG,
				isDuet: line.isDuet,
			} as LyricLine;
			newLine.words.push(...wordsToMove);
			normalizeLineTime(line);
			normalizeLineTime(newLine);
			state.lyricLines.splice(lineIndex + 1, 0, newLine);
		});
	}

	function getCharWidthCount(str: string): number {
		let count = 0;
		for (const char of str) {
			const code = char.charCodeAt(0);
			// 判断是否为全角字符
			// CJK 统一表意文字: 4E00-9FFF
			// CJK 扩展 A: 3400-4DBF
			// CJK 扩展 B-F: 20000-2EBEF (需要检查代理对)
			// 全角 ASCII: FF01-FF5E
			// 全角标点: FF5F-FF60, FFE0-FFE6
			// 日文平假名: 3040-309F
			// 日文片假名: 30A0-30FF
			// 韩文: AC00-D7AF
			const isFullWidth =
				(code >= 0x4e00 && code <= 0x9fff) || // CJK 统一表意文字
				(code >= 0x3400 && code <= 0x4dbf) || // CJK 扩展 A
				(code >= 0x3040 && code <= 0x309f) || // 日文平假名
				(code >= 0x30a0 && code <= 0x30ff) || // 日文片假名
				(code >= 0xac00 && code <= 0xd7af) || // 韩文音节
				(code >= 0xff01 && code <= 0xff5e) || // 全角 ASCII
				(code >= 0xff5f && code <= 0xff60) || // 全角括号
				(code >= 0xffe0 && code <= 0xffe6) || // 全角货币符号
				(code >= 0x3000 && code <= 0x303f) || // CJK 符号和标点
				(code >= 0x31f0 && code <= 0x31ff) || // 日文片假名语音扩展
				(code >= 0x31c0 && code <= 0x31ef) || // CJK 笔画
				(code >= 0x2e80 && code <= 0x2eff) || // CJK 部首补充
				(code >= 0x2f00 && code <= 0x2fdf) || // 康熙部首
				(code >= 0x2ff0 && code <= 0x2fff) || // 表意文字描述字符
				(code >= 0x3100 && code <= 0x312f) || // 注音字母
				(code >= 0x3130 && code <= 0x318f) || // 韩文兼容字母
				(code >= 0x3200 && code <= 0x32ff) || // 带圈 CJK 字母/月份
				(code >= 0xa000 && code <= 0xa48f) || // 彝文音节
				(code >= 0xa490 && code <= 0xa4cf) || // 彝文部首
				(code >= 0xf900 && code <= 0xfaff) || // CJK 兼容表意文字
				(code >= 0xfe30 && code <= 0xfe4f) || // CJK 兼容形式
				(code >= 0x20000 && code <= 0x2a6df) || // CJK 扩展 B
				(code >= 0x2a700 && code <= 0x2b73f) || // CJK 扩展 C
				(code >= 0x2b740 && code <= 0x2b81f) || // CJK 扩展 D
				(code >= 0x2b820 && code <= 0x2ceaf) || // CJK 扩展 E
				(code >= 0x2ceb0 && code <= 0x2ebef); // CJK 扩展 F

			count += isFullWidth ? 2 : 1;
		}
		return count;
	}

	function calculateDuration(
		referenceWord: LyricWord,
		targetWord: LyricWord,
	): number {
		const refDuration = referenceWord.endTime - referenceWord.startTime;
		const refWidthCount = getCharWidthCount(referenceWord.word);
		const targetWidthCount = getCharWidthCount(targetWord.word);

		if (refWidthCount === 0) return 500;

		const calculatedDuration = (refDuration / refWidthCount) * targetWidthCount;
		return Math.min(500, calculatedDuration);
	}

	function autoCalculateFromPrevWord() {
		editLyricLines((state) => {
			const line = state.lyricLines[lineIndex];
			if (!line) return;
			if (wordIndex === 0) return;

			const currentWord = line.words[wordIndex];
			const prevWord = line.words[wordIndex - 1];
			if (!currentWord || !prevWord) return;

			const newDuration = calculateDuration(prevWord, currentWord);
			currentWord.endTime = currentWord.startTime + newDuration;
			normalizeLineTime(line);
		});
	}

	function autoCalculateFromNextWord() {
		editLyricLines((state) => {
			const line = state.lyricLines[lineIndex];
			if (!line) return;
			if (wordIndex >= line.words.length - 1) return;

			const currentWord = line.words[wordIndex];
			const nextWord = line.words[wordIndex + 1];
			if (!currentWord || !nextWord) return;

			const newDuration = calculateDuration(nextWord, currentWord);
			currentWord.startTime = currentWord.endTime - newDuration;
			normalizeLineTime(line);
		});
	}
};
