/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/Steve-xmh/amll-ttml-tool/blob/main/LICENSE
 */

/**
 * @fileoverview
 * 用于将内部歌词数组对象导出成 TTML 格式的模块
 * 但是可能会有信息会丢失
 */

import { separateSpecialSpansWithSpaceAtom } from "../../../modules/settings/states/index.ts";
import { globalStore } from "../../../states/store.ts";
import type {
	LyricLine,
	LyricWord,
	TTMLLangData,
	TTMLLyric,
	TTMLRomanWord,
	TTMLTranslationWord,
} from "../../../types/ttml.ts";
import { log } from "../../../utils/logging.ts";
import { msToTimestamp, parseTimespan } from "../../../utils/timestamp.ts";

type LineMetadata = {
	main: string;
	bg: string;
	isAutoFilled?: boolean;
	// 多背景行翻译列表（按顺序）
	bgList?: string[];
};

/** 某行（含其各背景行）在某语言下的逐字翻译/音译数据 */
type WordLevelEntry<T> = {
	mainWords: LyricWord[];
	mainItems: T[];
	/** 与该主行的背景行一一对应（按顺序） */
	bgs: { words: LyricWord[]; items: T[] }[];
	isAutoFilled?: boolean;
};

/**
 * 收集背景行逐行数据，按背景行顺序对齐：缺失项以空字符串占位，去掉末尾的空项。
 * 解析时按 x-bg span 的序号（bgIndex）对应背景行，占位保证序号不错位。
 */
function collectBgLineTexts(
	values: (TTMLLangData<string> | string | undefined)[],
): string[] {
	const list = values.map((v) => getLangData(v, "").data.trim());
	while (list.length > 0 && list[list.length - 1].length === 0) list.pop();
	return list;
}

function endsWithSpace(node: Node | null): boolean {
	if (!node) return false;
	return /\s$/.test(node.textContent ?? "");
}

function startsWithSpace(node: Node | null): boolean {
	if (!node) return false;
	return /^\s/.test(node.textContent ?? "");
}

/**
 * 辅助函数：从 TTMLLangData 或旧格式的字符串/数组中提取数据
 * 兼容旧数据格式：字符串或数组直接作为数据，isAutoFilled 默认为 false
 */
function getLangData<T>(
	value: TTMLLangData<T> | T | undefined,
	defaultValue: T,
): { data: T; isAutoFilled: boolean } {
	if (value === undefined) {
		return { data: defaultValue, isAutoFilled: false };
	}
	// 如果是 TTMLLangData 对象
	if (
		typeof value === "object" &&
		value !== null &&
		"data" in value &&
		!Array.isArray(value)
	) {
		return {
			data: value.data ?? defaultValue,
			isAutoFilled: value.isAutoFilled ?? false,
		};
	}
	// 兼容旧数据：直接是字符串或数组
	return { data: value as T, isAutoFilled: false };
}

/**
 * 未知语言代码，在 getLineLangView 中映射到默认语言后写出。
 * 规范要求 <translation> 和 <transliteration> 必须带 xml:lang。
 */
const UNDETERMINED_LANG = "und";

/** UI 的占位值，与 und 同等处理 */
const UNKNOWN_LANG = "unknown";

/** 默认翻译语言（当翻译数据未指定语言时使用） */
const DEFAULT_TRANSLATION_LANG = "zh-Hans";

function hasKeys(record: object | undefined): boolean {
	return !!record && Object.keys(record).length > 0;
}

/**
 * 某行实际用于导出的多语言数据。
 * 若行没有任何 *ByLang 数据，则回退到旧的单值字段（translatedLyric / romanLyric / word.romanWord），
 * 映射到默认语言后导出，避免 LRC/纯文本导入、逐字音译编辑等路径的数据在导出时丢失。
 */
interface LineLangView {
	trans: Record<string, TTMLLangData<string> | string>;
	wordTrans: Record<string, TTMLLangData<TTMLTranslationWord[]>>;
	roman: Record<string, TTMLLangData<string> | string>;
	wordRoman: Record<string, TTMLLangData<TTMLRomanWord[]>>;
	/** wordRoman 是否由 word.romanWord 回退生成（此时不覆盖同语言的逐行音译） */
	wordRomanFromWords: boolean;
}

/**
 * 计算默认音译语言代码：歌词语言 + "-Latn"，中文使用 "zh-Latn-pinyin"
 * （与 parser 的 getDefaultRomanizationLang 保持一致）
 */
function getDefaultRomanLang(lyricLang: string): string {
	if (lyricLang.startsWith("zh")) {
		return "zh-Latn-pinyin";
	}
	return `${lyricLang}-Latn`;
}

function getLineLangView(
	line: LyricLine,
	lyricLang: string,
): { view: LineLangView; conflicts: LangConflict[] } {
	const defaultRomanLang = getDefaultRomanLang(lyricLang);
	const conflicts: LangConflict[] = [];

	/**
	 * 将语言代码标准化：und 和 unknown 映射到默认语言，其他保持不变。
	 * 规范要求 <translation> 和 <transliteration> 必须带 xml:lang。
	 */
	const normalizeLang = (lang: string, isRoman: boolean): string => {
		const trimmed = lang.trim();
		if (
			trimmed === UNDETERMINED_LANG ||
			trimmed === UNKNOWN_LANG ||
			trimmed.length === 0
		) {
			return isRoman ? defaultRomanLang : DEFAULT_TRANSLATION_LANG;
		}
		return trimmed;
	};

	const view: LineLangView = {
		trans: {},
		wordTrans: {},
		roman: {},
		wordRoman: {},
		wordRomanFromWords: false,
	};

	/**
	 * 把某语言的某项数据放进 view：目标语言已被占用且内容不同时记录冲突（不静默覆盖）。
	 */
	const put = <T>(
		target: Record<string, T>,
		field: LangConflict["field"],
		rawLang: string,
		normalized: string,
		value: T,
		isRoman: boolean,
	) => {
		const existing = target[normalized];
		if (existing !== undefined && !isSameLangData(existing, value)) {
			conflicts.push({
				field,
				lang: normalized,
				mappedFrom: rawLang.trim() === normalized ? undefined : rawLang.trim(),
				isRoman,
			});
			return;
		}
		target[normalized] = value;
	};

	// 处理翻译数据，标准化语言代码
	const transByLang = line.translatedLyricByLang;
	if (transByLang && Object.keys(transByLang).length > 0) {
		for (const [lang, value] of Object.entries(transByLang)) {
			put(view.trans, "trans", lang, normalizeLang(lang, false), value, false);
		}
	}
	const wordTransByLang = line.wordTranslationByLang;
	if (wordTransByLang && Object.keys(wordTransByLang).length > 0) {
		for (const [lang, value] of Object.entries(wordTransByLang)) {
			put(
				view.wordTrans,
				"wordTrans",
				lang,
				normalizeLang(lang, false),
				value,
				false,
			);
		}
	}

	// 处理音译数据，标准化语言代码
	const romanByLang = line.romanLyricByLang;
	if (romanByLang && Object.keys(romanByLang).length > 0) {
		for (const [lang, value] of Object.entries(romanByLang)) {
			put(view.roman, "roman", lang, normalizeLang(lang, true), value, true);
		}
	}
	const wordRomanByLang = line.wordRomanizationByLang;
	if (wordRomanByLang && Object.keys(wordRomanByLang).length > 0) {
		for (const [lang, value] of Object.entries(wordRomanByLang)) {
			put(
				view.wordRoman,
				"wordRoman",
				lang,
				normalizeLang(lang, true),
				value,
				true,
			);
		}
	}

	// 回退到旧的单值字段（LRC 导入、纯文本导入等路径）
	if (
		!hasKeys(line.translatedLyricByLang) &&
		!hasKeys(line.wordTranslationByLang) &&
		(line.translatedLyric ?? "").trim().length > 0
	) {
		view.trans[DEFAULT_TRANSLATION_LANG] = {
			data: line.translatedLyric,
			isAutoFilled: true,
		};
	}
	if (
		!hasKeys(line.romanLyricByLang) &&
		!hasKeys(line.wordRomanizationByLang) &&
		(line.romanLyric ?? "").trim().length > 0
	) {
		view.roman[defaultRomanLang] = {
			data: line.romanLyric,
			isAutoFilled: true,
		};
	}
	if (!hasKeys(line.wordRomanizationByLang)) {
		// 每个非空白单词一项（无音译的为空文本，导出时跳过），保证按顺序匹配时不错位
		const timedWords = line.words.filter((word) => word.word.trim().length > 0);
		if (timedWords.some((word) => (word.romanWord ?? "").trim().length > 0)) {
			const romanWords: TTMLRomanWord[] = timedWords.map((word) => ({
				startTime: word.startTime,
				endTime: word.endTime,
				text: (word.romanWord ?? "").trim().length > 0 ? word.romanWord : "",
			}));
			view.wordRoman[defaultRomanLang] = {
				data: romanWords,
				isAutoFilled: true,
			};
			view.wordRomanFromWords = true;
		}
	}
	return { view, conflicts };
}

export interface ExportTTMLOptions {
	pretty?: boolean;
	separateSpecialSpansWithSpace?: boolean;
}

/** 一行内某类辅助数据因 und/unknown 映射到默认语言而产生的语言冲突 */
interface LangConflict {
	field: "trans" | "wordTrans" | "roman" | "wordRoman";
	/** 映射后的目标语言 */
	lang: string;
	/** 原始语言码（und / unknown / 空），若原本就是目标语言则为 undefined */
	mappedFrom?: string;
	isRoman: boolean;
}

/** 判断两份多语言数据内容是否相同（语言相同且内容一致时不视为冲突） */
function isSameLangData(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export interface ExportIssue {
	type: "word-roman-without-lang" | "lang-conflict";
	lineIndex: number;
	/** 受影响的界面显示行号（从 1 开始，与编辑器一致） */
	lineNumber: number;
	message: string;
	lang?: string;
}

/**
 * 检查导出前可能存在的问题：
 * 1. 逐字音译数据没有语言码（word.romanWord 存在但 wordRomanizationByLang 为空），
 *    导出时会按默认语言写出，建议用户先明确指定语言；
 * 2. und/unknown 映射到默认语言后与该语言下的已有数据冲突（冲突项不会被写出）。
 *
 * 注意：本函数不做任何界面操作，仅返回问题列表，由调用方决定如何提示。
 */
export function collectExportIssues(ttmlLyric: TTMLLyric): ExportIssue[] {
	const issues: ExportIssue[] = [];
	const lyricLang = ttmlLyric.lyricLang ?? "zh-Hans";
	const defaultRomanLang = getDefaultRomanLang(lyricLang);

	for (let i = 0; i < ttmlLyric.lyricLines.length; i++) {
		const line = ttmlLyric.lyricLines[i];
		const lineNumber = i + 1;

		const { conflicts } = getLineLangView(line, lyricLang);

		for (const conflict of conflicts) {
			const fieldLabel = {
				trans: "逐行翻译",
				wordTrans: "逐字翻译",
				roman: "逐行音译",
				wordRoman: "逐字音译",
			}[conflict.field];
			const mapped = conflict.mappedFrom
				? `未指定语言（${conflict.mappedFrom}）的`
				: "未指定语言的";
			issues.push({
				type: "lang-conflict",
				lineIndex: i,
				lineNumber,
				lang: conflict.lang,
				message: `第 ${lineNumber} 行：${mapped}${fieldLabel}与已有的 ${conflict.lang} 数据冲突，导出时将保留已有数据`,
			});
		}

		// 逐字音译缺少语言码：导出时会写入默认语言，提示用户先指定语言
		const hasWordRomanWithoutLang =
			!hasKeys(line.wordRomanizationByLang) &&
			line.words.some((word) => (word.romanWord ?? "").trim().length > 0);
		if (hasWordRomanWithoutLang) {
			issues.push({
				type: "word-roman-without-lang",
				lineIndex: i,
				lineNumber,
				lang: defaultRomanLang,
				message: `第 ${lineNumber} 行存在未指定语言的逐字音译，导出时将按默认语言 ${defaultRomanLang} 写出`,
			});
		}
	}

	return issues;
}

export default function exportTTMLText(
	ttmlLyric: TTMLLyric,
	prettyOrOptions: boolean | ExportTTMLOptions = false,
): string {
	const pretty =
		typeof prettyOrOptions === "boolean"
			? prettyOrOptions
			: (prettyOrOptions?.pretty ?? false);
	let separateSpecialSpansWithSpace =
		typeof prettyOrOptions === "object"
			? prettyOrOptions.separateSpecialSpansWithSpace
			: undefined;

	if (separateSpecialSpansWithSpace === undefined) {
		try {
			separateSpecialSpansWithSpace = globalStore.get(
				separateSpecialSpansWithSpaceAtom,
			);
		} catch {
			// ignore
		}
		if (
			!separateSpecialSpansWithSpace &&
			typeof window !== "undefined" &&
			window.localStorage
		) {
			try {
				const item = window.localStorage.getItem(
					"separateSpecialSpansWithSpace",
				);
				if (item !== null) {
					separateSpecialSpansWithSpace = JSON.parse(item);
				}
			} catch {
				// ignore
			}
		}
		if (separateSpecialSpansWithSpace === undefined) {
			separateSpecialSpansWithSpace = false;
		}
	}
	const lyric = ttmlLyric.lyricLines;

	/**
	 * 预分组：每个主行与其背景行组成一个 <p> 单元，若干单元组成一个 <div>。
	 * - 背景行归属到「前一个主行」（可跨越空行 / songPart 造成的 div 边界），保持行顺序不变；
	 * - 歌词开头、尚无主行的背景行归属到「下一个主行」；
	 * - 整份歌词没有任何主行时，为背景行生成一个空主行容器 <p>。
	 * 背景行不再影响 div 划分（旧逻辑中位于 div 首位的背景行会被整行丢弃）。
	 */
	type LineUnit = { main: LyricLine; bgs: LyricLine[] };
	const params: LineUnit[][] = [];
	let tmp: LineUnit[] = [];
	let lastUnit: LineUnit | null = null;
	let pendingBgs: LyricLine[] = [];
	for (const line of lyric) {
		// 当遇到空行时，结束当前 div
		if (line.words.length === 0 && tmp.length > 0) {
			params.push(tmp);
			tmp = [];
			continue;
		}

		if (line.words.length > 0) {
			if (line.isBG) {
				if (lastUnit) lastUnit.bgs.push(line);
				else pendingBgs.push(line);
				continue;
			}
			// 只在以下情况创建新 div：
			// 1. 当前没有 div（tmp.length === 0）
			// 2. 当前行有 songPart（表示新的开始）
			const shouldStartNewDiv = tmp.length === 0 || line.songPart;

			if (shouldStartNewDiv && tmp.length > 0) {
				params.push(tmp);
				tmp = [];
			}

			lastUnit = { main: line, bgs: pendingBgs };
			pendingBgs = [];
			tmp.push(lastUnit);
		}
	}

	if (pendingBgs.length > 0) {
		// 没有任何主行：生成空主行容器承载背景行
		const first = pendingBgs[0];
		const last = pendingBgs[pendingBgs.length - 1];
		tmp.push({
			main: {
				...first,
				id: "",
				words: [],
				isBG: false,
				translatedLyric: "",
				romanLyric: "",
				translatedLyricByLang: undefined,
				romanLyricByLang: undefined,
				wordTranslationByLang: undefined,
				wordRomanizationByLang: undefined,
				startTime: first.startTime,
				endTime: last.endTime,
			},
			bgs: pendingBgs,
		});
	}

	if (tmp.length > 0) {
		params.push(tmp);
	}

	// 歌词语言代码：优先使用解析时读取的语言代码，否则使用默认值
	const lyricLang = ttmlLyric.lyricLang ?? "zh-Hans";

	const doc = new Document();

	function createRubyWordElement(word: LyricWord): Element {
		const container = doc.createElement("span");
		container.setAttribute("tts:ruby", "container");
		if (word.obscene) container.setAttribute("amll:obscene", "true");
		if (word.emptyBeat)
			container.setAttribute("amll:empty-beat", `${word.emptyBeat}`);
		if (word.rubyPhraseStart)
			container.setAttribute("amll:rubyPhraseStart", "true");
		const base = doc.createElement("span");
		base.setAttribute("tts:ruby", "base");
		base.appendChild(doc.createTextNode(word.word));
		container.appendChild(base);
		const textContainer = doc.createElement("span");
		textContainer.setAttribute("tts:ruby", "textContainer");
		for (const rubyWord of word.ruby ?? []) {
			const rubySpan = doc.createElement("span");
			rubySpan.setAttribute("tts:ruby", "text");
			rubySpan.setAttribute("begin", msToTimestamp(rubyWord.startTime));
			rubySpan.setAttribute("end", msToTimestamp(rubyWord.endTime));
			rubySpan.appendChild(doc.createTextNode(rubyWord.word));
			textContainer.appendChild(rubySpan);
		}
		container.appendChild(textContainer);
		return container;
	}

	function hasRuby(word: LyricWord): boolean {
		return Array.isArray(word.ruby) && word.ruby.length > 0;
	}

	/**
	 * 非逐字（Line）模式下整行的时间范围：取所有非空白（或带 ruby）单词的范围；
	 * 没有时退回首个单词的时间（旧行为）。单单词行即该单词自身的时间，与旧输出一致。
	 */
	function getLineModeRange(
		words: LyricWord[],
	): { startTime: number; endTime: number } | undefined {
		const timed = words.filter(
			(word) => word.word.trim().length > 0 || hasRuby(word),
		);
		if (timed.length === 0) return words[0];
		return {
			startTime: Math.min(...timed.map((word) => word.startTime)),
			endTime: Math.max(...timed.map((word) => word.endTime)),
		};
	}

	/**
	 * 非逐字（Line）模式下一行的节点：拼接所有单词的文本（旧逻辑只输出 words[0]）。
	 * 连续的普通单词合并为一个 span（时间取其中非空白单词的范围），带 ruby 的单词仍输出 ruby 结构；
	 * 首尾空白单词与只有空白的片段输出为 span 外的文本节点。单单词行的输出与旧逻辑逐字节一致。
	 */
	function createLineModeNodes(words: LyricWord[]): Node[] {
		const nodes: Node[] = [];
		let run: LyricWord[] = [];
		const flush = () => {
			if (run.length === 0) return;
			const isBlank = (word: LyricWord) => word.word.trim().length === 0;
			const firstIdx = run.findIndex((word) => !isBlank(word));
			if (firstIdx === -1) {
				nodes.push(doc.createTextNode(run.map((word) => word.word).join("")));
				run = [];
				return;
			}
			let lastIdx = run.length - 1;
			while (isBlank(run[lastIdx])) lastIdx--;
			// 首尾的空白单词与逐字模式一致，作为 span 外的文本节点输出
			const leading = run.slice(0, firstIdx);
			const core = run.slice(firstIdx, lastIdx + 1);
			const trailing = run.slice(lastIdx + 1);
			if (leading.length > 0) {
				nodes.push(doc.createTextNode(leading.map((w) => w.word).join("")));
			}
			if (core.length === 1) {
				nodes.push(createWordElement(core[0]));
			} else {
				const timed = core.filter((word) => !isBlank(word));
				nodes.push(
					createWordElement({
						...core[0],
						word: core.map((word) => word.word).join(""),
						startTime: Math.min(...timed.map((word) => word.startTime)),
						endTime: Math.max(...timed.map((word) => word.endTime)),
						obscene: timed.some((word) => word.obscene),
					}),
				);
			}
			if (trailing.length > 0) {
				nodes.push(doc.createTextNode(trailing.map((w) => w.word).join("")));
			}
			run = [];
		};
		for (const word of words) {
			if (hasRuby(word)) {
				flush();
				nodes.push(createWordElement(word));
			} else {
				run.push(word);
			}
		}
		flush();
		return nodes;
	}

	function createWordElement(word: LyricWord): Element {
		if (Array.isArray(word.ruby) && word.ruby.length > 0) {
			return createRubyWordElement(word);
		}
		const span = doc.createElement("span");
		span.setAttribute("begin", msToTimestamp(word.startTime));
		span.setAttribute("end", msToTimestamp(word.endTime));
		if (word.obscene) span.setAttribute("amll:obscene", "true");
		if (word.emptyBeat)
			span.setAttribute("amll:empty-beat", `${word.emptyBeat}`);
		span.appendChild(doc.createTextNode(word.word));
		return span;
	}

	function findFirstTextNode(node: Node): Text | null {
		if (node.nodeType === Node.TEXT_NODE) return node as Text;
		for (const child of Array.from(node.childNodes)) {
			const found = findFirstTextNode(child);
			if (found) return found;
		}
		return null;
	}

	function findLastTextNode(node: Node): Text | null {
		if (node.nodeType === Node.TEXT_NODE) return node as Text;
		const children = Array.from(node.childNodes);
		for (let i = children.length - 1; i >= 0; i--) {
			const found = findLastTextNode(children[i]);
			if (found) return found;
		}
		return null;
	}

	function addWrapperToElement(el: Element, prefix: string, suffix: string) {
		if (!prefix && !suffix) return;
		const first = findFirstTextNode(el);
		const last = findLastTextNode(el);
		if (!first) return;
		if (first === last) {
			first.nodeValue = `${prefix}${first.nodeValue ?? ""}${suffix}`;
			return;
		}
		if (prefix) {
			first.nodeValue = `${prefix}${first.nodeValue ?? ""}`;
		}
		if (last && suffix) {
			last.nodeValue = `${last.nodeValue ?? ""}${suffix}`;
		}
	}

	function createRomanizationSpanFromData(word: TTMLRomanWord): Element {
		const span = doc.createElement("span");
		span.setAttribute("xmlns", "http://www.w3.org/ns/ttml");
		span.setAttribute("begin", msToTimestamp(word.startTime));
		span.setAttribute("end", msToTimestamp(word.endTime));
		// 去除首尾空格，空格会作为单独的空格文本节点添加
		span.appendChild(doc.createTextNode(word.text.trim()));
		return span;
	}

	// 辅助函数：创建逐字翻译的 span 元素
	function createTranslationSpanFromData(word: TTMLTranslationWord): Element {
		const span = doc.createElement("span");
		span.setAttribute("xmlns", "http://www.w3.org/ns/ttml");
		span.setAttribute("begin", msToTimestamp(word.startTime));
		span.setAttribute("end", msToTimestamp(word.endTime));
		// 去除首尾空格，空格会作为单独的空格文本节点添加
		span.appendChild(doc.createTextNode(word.text.trim()));
		return span;
	}

	/** 按单词匹配逐字数据（翻译/音译），返回与 words 等长的数组（未匹配为 undefined） */
	function matchWordItems<T extends { startTime: number; endTime: number }>(
		words: LyricWord[],
		items: T[],
	): (T | undefined)[] {
		const timedWords = words.filter((word) => word.word.trim().length > 0);
		const timeKey = (t: { startTime: number; endTime: number }) =>
			`${t.startTime}:${t.endTime}`;
		const allItemsUntimed =
			items.length > 0 &&
			items.every((r) => r.startTime === 0 && r.endTime === 0);
		const hasDuplicateWordTimes =
			new Set(timedWords.map(timeKey)).size < timedWords.length;
		if (allItemsUntimed || hasDuplicateWordTimes) {
			// 时间无法区分单词（如纯文本导入的 0/0 单词）：按非空白单词的顺序一一对应，
			// 避免所有单词都匹配到第一条数据
			let next = 0;
			return words.map((word) =>
				word.word.trim().length === 0 ? undefined : items[next++],
			);
		}
		return words.map((word) => {
			if (word.word.trim().length === 0) return undefined;
			return items.find(
				(r) => r.startTime === word.startTime && r.endTime === word.endTime,
			);
		});
	}

	/**
	 * 输出一行（及其各背景行）的逐字翻译/音译内容到 <text> 元素。
	 * 每个背景行对应一个 x-bg span（按顺序）；中间缺失的背景行输出空 x-bg span 占位，
	 * 末尾缺失的不输出。
	 */
	function appendWordLevelContent<
		T extends TTMLTranslationWord | TTMLRomanWord,
	>(
		textEl: Element,
		data: WordLevelEntry<T>,
		createSpan: (item: T) => Element,
	) {
		if (data.mainItems.length > 0) {
			const matches = matchWordItems(data.mainWords, data.mainItems);
			data.mainWords.forEach((word, i) => {
				if (word.word.trim().length === 0) {
					if (textEl.hasChildNodes()) {
						textEl.appendChild(doc.createTextNode(word.word));
					}
					return;
				}
				const match = matches[i];
				if (!match || match.text.length === 0) return;
				textEl.appendChild(createSpan(match));
				// 如果 hasSpaceAfter 为 true，添加空格文本节点
				if (match.hasSpaceAfter) {
					textEl.appendChild(doc.createTextNode(" "));
				}
			});
		}

		const bgSpanList: (Element | null)[] = data.bgs.map((bg) => {
			if (bg.items.length === 0) return null;
			const bgSpan = doc.createElement("span");
			bgSpan.setAttribute("ttm:role", "x-bg");
			const bgSpans: Element[] = [];
			const matches = matchWordItems(bg.words, bg.items);
			bg.words.forEach((word, i) => {
				if (word.word.trim().length === 0) {
					if (bgSpan.hasChildNodes()) {
						bgSpan.appendChild(doc.createTextNode(word.word));
					}
					return;
				}
				const match = matches[i];
				if (!match || match.text.length === 0) return;
				const span = createSpan(match);
				bgSpan.appendChild(span);
				bgSpans.push(span);
				// 如果 hasSpaceAfter 为 true，添加空格文本节点
				if (match.hasSpaceAfter) {
					bgSpan.appendChild(doc.createTextNode(" "));
				}
			});
			if (bgSpans.length === 0) return null;
			const first = bgSpans[0];
			const last = bgSpans[bgSpans.length - 1];
			if (first.firstChild) {
				first.firstChild.nodeValue = `(${first.firstChild.nodeValue}`;
			}
			if (last.firstChild) {
				last.firstChild.nodeValue = `${last.firstChild.nodeValue})`;
			}
			return bgSpan;
		});
		let lastIndex = bgSpanList.length - 1;
		while (lastIndex >= 0 && !bgSpanList[lastIndex]) lastIndex--;
		for (let i = 0; i <= lastIndex; i++) {
			const bgSpan = bgSpanList[i];
			if (!bgSpan) {
				// 占位：保证后续背景行的序号与 bgIndex 对齐
				const placeholder = doc.createElement("span");
				placeholder.setAttribute("ttm:role", "x-bg");
				textEl.appendChild(placeholder);
				continue;
			}
			if (
				separateSpecialSpansWithSpace &&
				textEl.lastChild &&
				!endsWithSpace(textEl.lastChild) &&
				!startsWithSpace(bgSpan)
			) {
				textEl.appendChild(doc.createTextNode(" "));
			}
			textEl.appendChild(bgSpan);
		}
	}

	function normalizeVocalValue(vocal?: string | string[] | null): string {
		if (!vocal) return "";
		const parts = Array.isArray(vocal) ? vocal : vocal.split(/[\s,]+/);
		return parts
			.map((v) => v.trim())
			.filter(Boolean)
			.join(",");
	}

	const ttRoot = doc.createElement("tt");

	ttRoot.setAttribute("xmlns", "http://www.w3.org/ns/ttml");
	ttRoot.setAttribute("xmlns:ttm", "http://www.w3.org/ns/ttml#metadata");
	ttRoot.setAttribute("xmlns:tts", "http://www.w3.org/ns/ttml#styling");
	ttRoot.setAttribute("xmlns:amll", "http://www.example.com/ns/amll");
	ttRoot.setAttribute(
		"xmlns:itunes",
		"http://music.apple.com/lyric-ttml-internal",
	);
	// 设置歌词语言代码
	ttRoot.setAttribute("xml:lang", lyricLang);

	// Determine itunes:timing mode for Spicylyrics compatibility
	// Word = at least one line has 2+ non-blank words (dynamic/per-word timing)
	// Line = has lyric lines but every line has 0 or 1 non-blank word
	// None = no timed words at all
	const nonBlankWordCountsPerLine = lyric.map(
		(l) => l.words.filter((w) => w.word.trim().length > 0).length,
	);
	const totalNonBlankWords = nonBlankWordCountsPerLine.reduce(
		(sum, v) => sum + v,
		0,
	);
	const hasAnyTiming = lyric.some((l) =>
		l.words.some((w) => w.word.trim().length > 0 && w.endTime > w.startTime),
	);
	let timingMode: "Word" | "Line" | "None";
	if (totalNonBlankWords === 0 || !hasAnyTiming) timingMode = "None";
	else if (nonBlankWordCountsPerLine.some((c) => c > 1)) timingMode = "Word";
	else timingMode = "Line";
	ttRoot.setAttribute("itunes:timing", timingMode);

	doc.appendChild(ttRoot);

	const head = doc.createElement("head");

	ttRoot.appendChild(head);

	const body = doc.createElement("body");
	const hasOtherPerson = !!lyric.find((v) => v.isDuet);

	const metadataEl = doc.createElement("metadata");

	// 导出 agents 数组
	const agents = ttmlLyric.agents ?? [];
	if (agents.length > 0) {
		// 使用已有的 agents
		for (const agent of agents) {
			const agentEl = doc.createElement("ttm:agent");
			agentEl.setAttribute("type", agent.type);
			agentEl.setAttribute("xml:id", agent.id);

			// 添加 ttm:name 子元素
			for (const name of agent.names) {
				const nameEl = doc.createElement("ttm:name");
				nameEl.setAttribute("type", "full");
				nameEl.appendChild(doc.createTextNode(name));
				agentEl.appendChild(nameEl);
			}

			metadataEl.appendChild(agentEl);
		}
	} else {
		// agents 为空时添加默认 agent
		const mainPersonAgent = doc.createElement("ttm:agent");
		mainPersonAgent.setAttribute("type", "person");
		mainPersonAgent.setAttribute("xml:id", "v1");
		metadataEl.appendChild(mainPersonAgent);

		if (hasOtherPerson) {
			const otherPersonAgent = doc.createElement("ttm:agent");
			otherPersonAgent.setAttribute("type", "other");
			otherPersonAgent.setAttribute("xml:id", "v2");
			metadataEl.appendChild(otherPersonAgent);
		}
	}

	const vocalTags =
		ttmlLyric.vocalTags?.filter(
			(tag) => tag.key && tag.key.trim().length > 0,
		) ?? [];
	if (vocalTags.length > 0) {
		const vocalsEl = doc.createElement("amll:vocals");
		for (const tag of vocalTags) {
			const vocalEl = doc.createElement("vocal");
			vocalEl.setAttribute("key", tag.key);
			vocalEl.setAttribute("value", tag.value ?? "");
			vocalsEl.appendChild(vocalEl);
		}
		metadataEl.appendChild(vocalsEl);
	}

	// Append metadata entries (songwriter will be handled in iTunesMetadata later)
	for (const metadata of ttmlLyric.metadata) {
		// songwriter 会在 iTunesMetadata 中单独处理，不在此处重复导出
		if (metadata.key === "songwriter") continue;
		for (const value of metadata.value) {
			const metaEl = doc.createElement("amll:meta");
			metaEl.setAttribute("key", metadata.key);
			metaEl.setAttribute("value", value);
			metadataEl.appendChild(metaEl);
		}
	}

	head.appendChild(metadataEl);

	// 主行计数器，从 1 开始与 UI 显示行号保持一致 (L1, L2, L3...)
	let mainLineCounter = 1;

	const translationByLangMap = new Map<string, Map<string, LineMetadata>>();
	const wordTranslationByLangMap = new Map<
		string,
		Map<string, WordLevelEntry<TTMLTranslationWord>>
	>();
	const romanizationByLangMap = new Map<string, Map<string, LineMetadata>>();
	const wordRomanizationByLangMap = new Map<
		string,
		Map<string, WordLevelEntry<TTMLRomanWord>>
	>();

	function removeLineEntry(
		map: Map<string, Map<string, LineMetadata>>,
		lang: string,
		key: string,
	) {
		const entries = map.get(lang);
		if (!entries) return;
		entries.delete(key);
		if (entries.size === 0) map.delete(lang);
	}

	const guessDuration = lyric[lyric.length - 1]?.endTime ?? 0;
	body.setAttribute("dur", msToTimestamp(guessDuration));
	const isDynamicLyric = lyric.some(
		(line) => line.words.filter((v) => v.word.trim().length > 0).length > 1,
	);

	for (const param of params) {
		const paramDiv = doc.createElement("div");
		const lastParamUnit = param[param.length - 1];
		const beginTime = param[0]?.main.startTime ?? 0;
		const endTime =
			(lastParamUnit?.bgs[lastParamUnit.bgs.length - 1] ?? lastParamUnit?.main)
				?.endTime ?? 0;

		paramDiv.setAttribute("begin", msToTimestamp(beginTime));
		paramDiv.setAttribute("end", msToTimestamp(endTime));

		// 查找该 div 中第一个有 songPart 的非背景行，将其 songPart 写入 div
		const firstLineWithSongPart = param.find(
			({ main }) => main.songPart && main.songPart.trim().length > 0,
		)?.main;
		if (firstLineWithSongPart?.songPart) {
			paramDiv.setAttribute("itunes:song-part", firstLineWithSongPart.songPart);
		}

		// 与旧逻辑一致的「div 内行序号」（含背景行），用于下方 <p> begin 的兼容判断
		let lineIndex = -1;
		for (const unit of param) {
			const line = unit.main;
			lineIndex += 1 + unit.bgs.length;
			const lineP = doc.createElement("p");

			// 与 UI 显示行号一致分配 itunesKey（仅主行使用 L 编号，背景行不设 itunesKey，从 L1 开始）
			const itunesKey = `L${mainLineCounter}`;
			mainLineCounter++;

			const mainWords = line.words;
			const mainView = getLineLangView(line, lyricLang).view;
			const bgLines: LyricLine[] = [];

			// 收集主行节点
			const mainNodes: Node[] = [];
			if (isDynamicLyric) {
				for (const word of line.words) {
					if (word.word.trim().length === 0 && !hasRuby(word)) {
						mainNodes.push(doc.createTextNode(word.word));
					} else {
						const span = createWordElement(word);
						mainNodes.push(span);
					}
				}
			} else {
				// 空主行容器（无主行可归属的背景行）没有单词，不输出主行内容
				mainNodes.push(...createLineModeNodes(line.words));
			}

			// 计算主行有效起始时间
			let mainBeginTime = Number.POSITIVE_INFINITY;
			if (isDynamicLyric) {
				const firstValidWord = line.words.find((w) => w.word.trim().length > 0);
				if (firstValidWord) {
					mainBeginTime = firstValidWord.startTime;
				} else if (line.startTime !== undefined) {
					mainBeginTime = line.startTime;
				}
			} else {
				mainBeginTime =
					getLineModeRange(line.words)?.startTime ?? line.startTime ?? 0;
			}
			if (mainBeginTime === Number.POSITIVE_INFINITY) {
				mainBeginTime = line.startTime ?? 0;
			}

			// 暂存前置与后置背景行 span
			const preBgSpans: Element[] = [];
			const postBgSpans: Element[] = [];

			// 处理所有连续的背景行（多背景行支持）
			for (const bgLine of unit.bgs) {
				bgLines.push(bgLine);

				const bgLineSpan = doc.createElement("span");
				bgLineSpan.setAttribute("ttm:role", "x-bg");

				// 为 bg 行导出 agent 属性（如果有的话）
				if (bgLine.agent) {
					bgLineSpan.setAttribute("ttm:agent", bgLine.agent);
				}

				// 为 bg 行导出 RTL 属性
				if (bgLine.isRtl) {
					bgLineSpan.setAttribute("amll:rtl", "true");
				}

				let bgBeginTime = Number.POSITIVE_INFINITY;
				if (isDynamicLyric) {
					let beginTime = Number.POSITIVE_INFINITY;
					let endTime = 0;

					const firstWordIndex = bgLine.words.findIndex(
						(w) => w.word.trim().length > 0,
					);
					const lastWordIndex = bgLine.words
						.map((w) => w.word.trim().length > 0)
						.lastIndexOf(true);

					for (
						let wordIndex = 0;
						wordIndex < bgLine.words.length;
						wordIndex++
					) {
						const word = bgLine.words[wordIndex];
						if (word.word.trim().length === 0 && !hasRuby(word)) {
							bgLineSpan.appendChild(doc.createTextNode(word.word));
						} else {
							const span = createWordElement(word);

							const prefix = wordIndex === firstWordIndex ? "(" : "";
							const suffix = wordIndex === lastWordIndex ? ")" : "";
							addWrapperToElement(span, prefix, suffix);

							bgLineSpan.appendChild(span);
							beginTime = Math.min(beginTime, word.startTime);
							endTime = Math.max(endTime, word.endTime);
						}
					}
					if (beginTime === Number.POSITIVE_INFINITY) {
						beginTime = bgLine.startTime ?? 0;
						endTime = bgLine.endTime ?? 0;
					}
					bgBeginTime = beginTime;
					bgLineSpan.setAttribute("begin", msToTimestamp(beginTime));
					bgLineSpan.setAttribute("end", msToTimestamp(endTime));
				} else {
					const range = getLineModeRange(bgLine.words);
					if (!range) {
						// 无单词的背景行：不输出内容，仅保留时间
						bgBeginTime = bgLine.startTime ?? 0;
						bgLineSpan.setAttribute("begin", msToTimestamp(bgBeginTime));
						bgLineSpan.setAttribute("end", msToTimestamp(bgLine.endTime ?? 0));
					} else {
						const nodes = createLineModeNodes(bgLine.words);
						const elements = nodes.filter(
							(node): node is Element => node.nodeType === Node.ELEMENT_NODE,
						);
						if (elements.length === 0) {
							// 只有空白：与旧逻辑一致，整体加括号
							for (const node of nodes) bgLineSpan.appendChild(node);
							addWrapperToElement(bgLineSpan, "(", ")");
						} else {
							// 与逐字模式一致：括号加在首/尾单词元素上，首尾空白留在 span 外
							addWrapperToElement(elements[0], "(", "");
							addWrapperToElement(elements[elements.length - 1], "", ")");
							for (const node of nodes) bgLineSpan.appendChild(node);
						}
						bgBeginTime = range.startTime;
						bgLineSpan.setAttribute("begin", msToTimestamp(range.startTime));
						bgLineSpan.setAttribute("end", msToTimestamp(range.endTime));
					}
				}

				const normalizedBgVocal = normalizeVocalValue(bgLine.vocal);
				if (normalizedBgVocal.length > 0) {
					bgLineSpan.setAttribute("amll:vocal", normalizedBgVocal);
				}

				// 若 x-bg span 时间轴早于主 span 时间轴，则前置；否则后置
				if (bgBeginTime < mainBeginTime) {
					preBgSpans.push(bgLineSpan);
				} else {
					postBgSpans.push(bgLineSpan);
				}
			}

			// 按顺序挂载：前置背景行 -> 主行内容 -> 后置背景行
			for (let i = 0; i < preBgSpans.length; i++) {
				const preSpan = preBgSpans[i];
				if (
					separateSpecialSpansWithSpace &&
					i > 0 &&
					lineP.lastChild &&
					!endsWithSpace(lineP.lastChild) &&
					!startsWithSpace(preSpan)
				) {
					lineP.appendChild(doc.createTextNode(" "));
				}
				lineP.appendChild(preSpan);
			}

			const hasNonEmptyMain = mainNodes.some(
				(n) => (n.textContent ?? "").trim().length > 0,
			);
			if (
				separateSpecialSpansWithSpace &&
				preBgSpans.length > 0 &&
				hasNonEmptyMain &&
				lineP.lastChild &&
				!endsWithSpace(lineP.lastChild) &&
				!startsWithSpace(mainNodes[0])
			) {
				lineP.appendChild(doc.createTextNode(" "));
			}

			for (const node of mainNodes) {
				lineP.appendChild(node);
			}

			for (let j = 0; j < postBgSpans.length; j++) {
				const postSpan = postBgSpans[j];
				if (
					separateSpecialSpansWithSpace &&
					lineP.lastChild &&
					!endsWithSpace(lineP.lastChild) &&
					!startsWithSpace(postSpan)
				) {
					lineP.appendChild(doc.createTextNode(" "));
				}
				lineP.appendChild(postSpan);
			}

			// 确保 <p> 的时间轴囊括主行自身以及所有子 span（包括主行音节 span、ruby span 以及 x-bg 背景行等）的时间轴
			let minSpanBegin = Number.POSITIVE_INFINITY;
			let maxSpanEnd = 0;
			const timedSpans = lineP.querySelectorAll("span[begin][end]");
			for (const span of Array.from(timedSpans)) {
				const beginAttr = span.getAttribute("begin");
				const endAttr = span.getAttribute("end");
				if (beginAttr) {
					try {
						const t = parseTimespan(beginAttr);
						if (!Number.isNaN(t)) {
							minSpanBegin = Math.min(minSpanBegin, t);
						}
					} catch {}
				}
				if (endAttr) {
					try {
						const t = parseTimespan(endAttr);
						if (!Number.isNaN(t)) {
							maxSpanEnd = Math.max(maxSpanEnd, t);
						}
					} catch {}
				}
			}

			let finalBeginTime = isDynamicLyric
				? (line.startTime ?? 0)
				: (getLineModeRange(line.words)?.startTime ?? line.startTime ?? 0);
			let finalEndTime = isDynamicLyric
				? (line.endTime ?? 0)
				: (getLineModeRange(line.words)?.endTime ?? line.endTime ?? 0);

			if (
				lineIndex > 0 &&
				finalBeginTime === 0 &&
				minSpanBegin > 0 &&
				minSpanBegin !== Number.POSITIVE_INFINITY
			) {
				finalBeginTime = minSpanBegin;
			} else if (minSpanBegin !== Number.POSITIVE_INFINITY) {
				finalBeginTime = Math.min(finalBeginTime, minSpanBegin);
			}

			if (finalEndTime === 0 && maxSpanEnd > 0) {
				finalEndTime = maxSpanEnd;
			} else {
				finalEndTime = Math.max(finalEndTime, maxSpanEnd);
			}

			// 统一按标准声明顺序写入 lineP 的属性：begin, end, ttm:agent, amll:vocal, amll:rtl, itunes:key
			lineP.setAttribute("begin", msToTimestamp(finalBeginTime));
			lineP.setAttribute("end", msToTimestamp(finalEndTime));

			// 优先使用 line.agent，如果没有则根据 isDuet 判断
			const agentId = line.agent ?? (line.isDuet ? "v2" : "v1");
			lineP.setAttribute("ttm:agent", agentId);

			const normalizedVocal = normalizeVocalValue(line.vocal);
			if (normalizedVocal.length > 0) {
				lineP.setAttribute("amll:vocal", normalizedVocal);
			}

			// 写入 RTL 标记
			if (line.isRtl) {
				lineP.setAttribute("amll:rtl", "true");
			}

			lineP.setAttribute("itunes:key", itunesKey);

			const bgViews = bgLines.map((bg) => getLineLangView(bg, lyricLang).view);

			// 收集翻译数据（translatedLyricByLang，无 *ByLang 时回退 translatedLyric 作为 und）
			const translationLangs = new Set<string>([
				...Object.keys(mainView.trans),
				...bgViews.flatMap((bg) => Object.keys(bg.trans)),
			]);
			// 处理有语言代码的翻译（跳过 und）
			for (const lang of translationLangs) {
				const mainData = mainView.trans[lang];
				// 收集所有背景行的翻译，按背景行顺序对齐存入列表
				const bgList = collectBgLineTexts(bgViews.map((v) => v.trans[lang]));
				const bg = bgList.find((x) => x.length > 0) ?? "";
				// 使用辅助函数兼容旧数据格式
				const mainParsed = getLangData(mainData, "");
				const main = mainParsed.data;
				// 检查是否为自动填充的语言代码
				const isAutoFilled = mainParsed.isAutoFilled;
				if (main.trim().length === 0 && bgList.length === 0) continue;
				if (!translationByLangMap.has(lang)) {
					translationByLangMap.set(lang, new Map());
				}
				translationByLangMap
					.get(lang)
					?.set(itunesKey, { main, bg, isAutoFilled, bgList });
			}
			// 注意：不输出无语言代码的 translatedLyric

			// 2. 然后收集逐字翻译（wordTranslationByLang），会覆盖逐行翻译
			const wordTransLangs = new Set<string>([
				...Object.keys(mainView.wordTrans),
				...bgViews.flatMap((bg) => Object.keys(bg.wordTrans)),
			]);
			// 处理有语言代码的逐字翻译（跳过 und）
			for (const lang of wordTransLangs) {
				// 使用辅助函数兼容旧数据格式
				const mainTransParsed = getLangData(mainView.wordTrans[lang], []);
				const mainTrans = mainTransParsed.data;
				const isAutoFilled =
					mainTransParsed.isAutoFilled ||
					bgViews.some((v) => getLangData(v.wordTrans[lang], []).isAutoFilled);
				const bgTrans = bgViews.map(
					(v) => getLangData(v.wordTrans[lang], []).data,
				);
				if (mainTrans.length === 0 && bgTrans.every((t) => t.length === 0))
					continue;
				// 逐字翻译优先：仅删除「本行」相同语言的逐行翻译，其他行不受影响
				removeLineEntry(translationByLangMap, lang, itunesKey);
				if (!wordTranslationByLangMap.has(lang)) {
					wordTranslationByLangMap.set(lang, new Map());
				}
				wordTranslationByLangMap.get(lang)?.set(itunesKey, {
					mainWords,
					mainItems: mainTrans,
					isAutoFilled,
					bgs: bgLines.map((bg, i) => ({ words: bg.words, items: bgTrans[i] })),
				});
			}

			// 收集音译数据：逐字音译优先于逐行音译
			// 1. 首先收集逐行音译（romanLyricByLang）
			const romanLangs = new Set<string>([
				...Object.keys(mainView.roman),
				...bgViews.flatMap((bg) => Object.keys(bg.roman)),
			]);
			// 处理有语言代码的逐行音译（跳过 und）
			for (const lang of romanLangs) {
				const mainData = mainView.roman[lang];
				// 收集所有背景行的音译，按背景行顺序对齐存入列表
				const bgList = collectBgLineTexts(bgViews.map((v) => v.roman[lang]));
				const bg = bgList.find((x) => x.length > 0) ?? "";
				const anyBgAutoFilled = bgViews.some(
					(v) => getLangData(v.roman[lang], "").isAutoFilled,
				);
				// 使用辅助函数兼容旧数据格式
				const mainParsed = getLangData(mainData, "");
				const main = mainParsed.data;
				// 检查是否为自动填充的语言代码
				const isAutoFilled = mainParsed.isAutoFilled || anyBgAutoFilled;
				if (main.trim().length === 0 && bgList.length === 0) continue;
				if (!romanizationByLangMap.has(lang)) {
					romanizationByLangMap.set(lang, new Map());
				}
				romanizationByLangMap
					.get(lang)
					?.set(itunesKey, { main, bg, isAutoFilled, bgList });
			}
			// 注意：不输出无语言代码的 romanLyric

			// 2. 然后收集逐字音译（wordRomanizationByLang），会覆盖逐行音译
			const wordRomanLangs = new Set<string>([
				...Object.keys(mainView.wordRoman),
				...bgViews.flatMap((bg) => Object.keys(bg.wordRoman)),
			]);
			// 处理有语言代码的逐字音译（跳过 und）
			for (const lang of wordRomanLangs) {
				// 使用辅助函数兼容旧数据格式
				const mainRomanParsed = getLangData(mainView.wordRoman[lang], []);
				const mainRoman = mainRomanParsed.data;
				const isAutoFilled =
					mainRomanParsed.isAutoFilled ||
					bgViews.some((v) => getLangData(v.wordRoman[lang], []).isAutoFilled);
				const bgRoman = bgViews.map(
					(v) => getLangData(v.wordRoman[lang], []).data,
				);
				if (mainRoman.length === 0 && bgRoman.every((r) => r.length === 0))
					continue;
				// 逐字音译优先：仅删除「本行」相同语言的逐行音译，其他行不受影响
				// （由 word.romanWord 回退生成的 und 逐字音译与 romanLyric 并存，不覆盖）
				const fromWords =
					(mainView.wordRomanFromWords || !mainView.wordRoman[lang]) &&
					bgViews.every((bg) => bg.wordRomanFromWords || !bg.wordRoman[lang]);
				if (!fromWords) {
					removeLineEntry(romanizationByLangMap, lang, itunesKey);
				}
				if (!wordRomanizationByLangMap.has(lang)) {
					wordRomanizationByLangMap.set(lang, new Map());
				}
				wordRomanizationByLangMap.get(lang)?.set(itunesKey, {
					mainWords,
					mainItems: mainRoman,
					isAutoFilled,
					bgs: bgLines.map((bg, i) => ({ words: bg.words, items: bgRoman[i] })),
				});
			}
			// 注意：不输出无语言代码的 word.romanWord

			paramDiv.appendChild(lineP);
		}

		// 确保 div 的时间轴也囊括其下所有 p 元素的时间轴
		let divBegin = Number.POSITIVE_INFINITY;
		let divEnd = 0;
		for (const p of Array.from(paramDiv.querySelectorAll("p[begin][end]"))) {
			const bAttr = p.getAttribute("begin");
			const eAttr = p.getAttribute("end");
			if (bAttr) {
				try {
					const b = parseTimespan(bAttr);
					if (!Number.isNaN(b)) divBegin = Math.min(divBegin, b);
				} catch {}
			}
			if (eAttr) {
				try {
					const e = parseTimespan(eAttr);
					if (!Number.isNaN(e)) divEnd = Math.max(divEnd, e);
				} catch {}
			}
		}

		let finalDivBegin = beginTime;
		let finalDivEnd = endTime;
		if (divBegin !== Number.POSITIVE_INFINITY) {
			finalDivBegin = Math.min(finalDivBegin, divBegin);
		}
		if (divEnd > 0) {
			finalDivEnd = Math.max(finalDivEnd, divEnd);
		}

		paramDiv.setAttribute("begin", msToTimestamp(finalDivBegin));
		paramDiv.setAttribute("end", msToTimestamp(finalDivEnd));

		body.appendChild(paramDiv);
	}

	// 检查是否需要创建 iTunesMetadata（songwriter、translations、transliterations）
	const hasSongwriter = ttmlLyric.metadata.some(
		(m) => m.key === "songwriter" && m.value.some((v) => v.trim().length > 0),
	);
	const hasTranslations =
		translationByLangMap.size > 0 || wordTranslationByLangMap.size > 0;
	const hasTransliterations =
		romanizationByLangMap.size > 0 || wordRomanizationByLangMap.size > 0;

	if (hasSongwriter || hasTranslations || hasTransliterations) {
		const iTunesMetadata = doc.createElement("iTunesMetadata");
		iTunesMetadata.setAttribute(
			"xmlns",
			"http://music.apple.com/lyric-ttml-internal",
		);

		// 1. 添加 songwriter
		if (hasSongwriter) {
			// 合并所有 songwriter entry：保留第一条的原有取值，其余 entry 中未出现过的名字依次追加
			const songwriterMetas = ttmlLyric.metadata.filter(
				(m) =>
					m.key === "songwriter" && m.value.some((v) => v.trim().length > 0),
			);
			const songwriterNames = [...(songwriterMetas[0]?.value ?? [])];
			const seenNames = new Set(songwriterNames.map((n) => n.trim()));
			for (const meta of songwriterMetas.slice(1)) {
				for (const name of meta.value) {
					if (seenNames.has(name.trim())) continue;
					seenNames.add(name.trim());
					songwriterNames.push(name);
				}
			}
			if (songwriterMetas.length > 0) {
				const songwritersEl = doc.createElement("songwriters");
				for (const name of songwriterNames) {
					const trimmed = name.trim();
					if (!trimmed) continue;
					const swEl = doc.createElement("songwriter");
					swEl.appendChild(doc.createTextNode(trimmed));
					songwritersEl.appendChild(swEl);
				}
				if (songwritersEl.childNodes.length > 0) {
					iTunesMetadata.appendChild(songwritersEl);
				}
			}
		}

		// 2. 添加 translations
		if (hasTranslations) {
			const translations = doc.createElement("translations");
			// 用于缓存已创建的 translation 元素，避免重复创建
			const translationCache = new Map<string, Element>();

			// 辅助函数：获取或创建 translation 元素
			const getOrCreateTranslation = (lang: string, type: string): Element => {
				const cacheKey = `${lang}:${type}`;
				const cached = translationCache.get(cacheKey);
				if (cached) {
					return cached;
				}
				const translation = doc.createElement("translation");
				translation.setAttribute("xml:lang", lang);
				translation.setAttribute("type", type);
				translations.appendChild(translation);
				translationCache.set(cacheKey, translation);
				return translation;
			};

			// 2.1 处理逐行翻译（translationByLangMap）- type="subtitle"
			for (const [lang, entries] of translationByLangMap.entries()) {
				for (const [key, { main, bg, bgList }] of entries.entries()) {
					const textEl = doc.createElement("text");
					textEl.setAttribute("for", key);
					if (main.trim().length > 0) {
						textEl.appendChild(doc.createTextNode(main));
					}
					// 多背景行支持：按顺序输出背景句翻译（Apple 标准，无 for 属性）
					const effectiveBgList =
						bgList && bgList.length > 0
							? bgList
							: bg.trim().length > 0
								? [bg]
								: [];
					for (const bgText of effectiveBgList) {
						if (bgText.trim().length === 0) {
							// 占位：保证后续背景行的序号与 bgIndex 对齐
							const placeholder = doc.createElement("span");
							placeholder.setAttribute("ttm:role", "x-bg");
							textEl.appendChild(placeholder);
							continue;
						}
						if (
							separateSpecialSpansWithSpace &&
							textEl.lastChild &&
							!endsWithSpace(textEl.lastChild) &&
							!/^\s/.test(bgText)
						) {
							textEl.appendChild(doc.createTextNode(" "));
						}
						const bgSpan = doc.createElement("span");
						bgSpan.setAttribute("ttm:role", "x-bg");
						bgSpan.appendChild(doc.createTextNode(bgText));
						textEl.appendChild(bgSpan);
					}
					const translation = getOrCreateTranslation(lang, "subtitle");
					translation.appendChild(textEl);
				}
			}

			// 2.2 处理逐字翻译（wordTranslationByLangMap）- type="replacement"
			for (const [lang, entries] of wordTranslationByLangMap.entries()) {
				for (const [key, data] of entries.entries()) {
					const textEl = doc.createElement("text");
					textEl.setAttribute("for", key);

					appendWordLevelContent(textEl, data, createTranslationSpanFromData);
					const translation = getOrCreateTranslation(lang, "replacement");
					translation.appendChild(textEl);
				}
			}

			iTunesMetadata.appendChild(translations);
		}

		// 3. 添加 transliterations
		if (hasTransliterations) {
			const transliterations = doc.createElement("transliterations");
			// 用于缓存已创建的 transliteration 元素，避免使用 querySelector
			const transliterationCache = new Map<string, Element>();

			// 辅助函数：获取或创建 transliteration 元素
			const getOrCreateTransliteration = (lang: string): Element => {
				const cached = transliterationCache.get(lang);
				if (cached) {
					return cached;
				}
				const transliteration = doc.createElement("transliteration");
				transliteration.setAttribute("xml:lang", lang);
				transliterations.appendChild(transliteration);
				transliterationCache.set(lang, transliteration);
				return transliteration;
			};

			// 处理逐行音译（romanizationByLangMap）
			for (const [lang, entries] of romanizationByLangMap.entries()) {
				for (const [key, { main, bg, bgList }] of entries.entries()) {
					const textEl = doc.createElement("text");
					textEl.setAttribute("for", key);
					if (main.trim().length > 0) {
						textEl.appendChild(doc.createTextNode(main));
					}
					const effectiveBgList =
						bgList && bgList.length > 0
							? bgList
							: bg.trim().length > 0
								? [bg]
								: [];
					for (const bgText of effectiveBgList) {
						if (bgText.trim().length === 0) {
							// 占位：保证后续背景行的序号与 bgIndex 对齐
							const placeholder = doc.createElement("span");
							placeholder.setAttribute("ttm:role", "x-bg");
							textEl.appendChild(placeholder);
							continue;
						}
						if (
							separateSpecialSpansWithSpace &&
							textEl.lastChild &&
							!endsWithSpace(textEl.lastChild) &&
							!/^\s/.test(bgText)
						) {
							textEl.appendChild(doc.createTextNode(" "));
						}
						const bgSpan = doc.createElement("span");
						bgSpan.setAttribute("ttm:role", "x-bg");
						bgSpan.appendChild(doc.createTextNode(bgText));
						textEl.appendChild(bgSpan);
					}
					const transliteration = getOrCreateTransliteration(lang);
					transliteration.appendChild(textEl);
				}
			}

			// 处理逐字音译（wordRomanizationByLangMap）
			for (const [lang, entries] of wordRomanizationByLangMap.entries()) {
				for (const [key, data] of entries.entries()) {
					const textEl = doc.createElement("text");
					textEl.setAttribute("for", key);

					appendWordLevelContent(textEl, data, createRomanizationSpanFromData);

					const transliteration = getOrCreateTransliteration(lang);
					transliteration.appendChild(textEl);
				}
			}

			iTunesMetadata.appendChild(transliterations);
		}

		// 将 iTunesMetadata 添加到 metadata 的最后
		metadataEl.appendChild(iTunesMetadata);
	}

	// 确保 body 的 dur 至少等于最大的 div 结束时间
	let maxBodyEnd = guessDuration;
	for (const div of Array.from(body.querySelectorAll("div[end]"))) {
		const eAttr = div.getAttribute("end");
		if (eAttr) {
			try {
				const e = parseTimespan(eAttr);
				if (!Number.isNaN(e)) maxBodyEnd = Math.max(maxBodyEnd, e);
			} catch {}
		}
	}
	body.setAttribute("dur", msToTimestamp(maxBodyEnd));

	ttRoot.appendChild(body);
	log("ttml document built", ttRoot);

	if (pretty) {
		const xsltDoc = new DOMParser().parseFromString(
			[
				'<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">',
				'  <xsl:strip-space elements="*"/>',
				'  <xsl:template match="para[content-style][not(text())]">',
				'    <xsl:value-of select="normalize-space(.)"/>',
				"  </xsl:template>",
				'  <xsl:template match="node()|@*">',
				'    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
				"  </xsl:template>",
				'  <xsl:output indent="yes"/>',
				"</xsl:stylesheet>",
			].join("\n"),
			"application/xml",
		);

		const xsltProcessor = new XSLTProcessor();
		xsltProcessor.importStylesheet(xsltDoc);
		const resultDoc = xsltProcessor.transformToDocument(doc);

		return new XMLSerializer().serializeToString(resultDoc);
	}
	return new XMLSerializer().serializeToString(doc);
}
