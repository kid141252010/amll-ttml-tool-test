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
 * 解析 TTML 歌词文档到歌词数组的解析器
 * 用于解析从 Apple Music 来的歌词文件，且扩展并支持翻译和音译文本。
 * @see https://www.w3.org/TR/2018/REC-ttml1-20181108/
 */

import { uid } from "uid";
import type {
	LyricLine,
	LyricWord,
	LyricWordBase,
	TTMLAgent,
	TTMLLangData,
	TTMLLyric,
	TTMLMetadata,
	TTMLRomanWord,
	TTMLTranslationWord,
	TTMLVocalTag,
} from "../../../types/ttml.ts";
import { distributeRomanizationByCharCount } from "../../segmentation/utils/Transliteration/distributor.ts";
import { log } from "../../../utils/logging.ts";
import { parseTimespan } from "../../../utils/timestamp.ts";

/** 预设的 song-part 列表 */
const PREDEFINED_SONG_PARTS = new Set([
	"Verse",
	"Chorus",
	"PreChorus",
	"Bridge",
	"Intro",
	"Outro",
	"Refrain",
	"Instrumental",
	"Hook",
	"Reprise",
	"Transition",
	"FalseChorus",
]);

interface LineMetadata {
	main: string;
	bg: string;
	// 多背景行翻译映射：itunesKey -> 翻译文本
	bgByKey?: Map<string, string>;
}

interface WordRomanMetadata {
	main: TTMLRomanWord[];
	bg: TTMLRomanWord[];
}

interface SpanNode {
	text: string;
	begin: string | null;
	end: string | null;
	role: string | null;
	lang: string | null;
	emptyBeat: string | null;
	ruby: string | null;
	rubyPhraseStart: boolean;
	children: SpanNode[];
	tail: string;
}

function localName(el: Element): string {
	return el.localName || el.tagName.split(":").pop() || el.tagName;
}

function getAttr(el: Element, target: string): string | null {
	const direct = el.getAttribute(target);
	if (direct !== null) {
		return direct;
	}
	for (const attr of Array.from(el.attributes)) {
		if (
			attr.localName === target ||
			attr.name === target ||
			attr.name.endsWith(`:${target}`)
		) {
			return attr.value;
		}
	}
	return null;
}

function parseSpan(spanEl: Element): SpanNode {
	const span: SpanNode = {
		text: "",
		begin: getAttr(spanEl, "begin"),
		end: getAttr(spanEl, "end"),
		role: getAttr(spanEl, "role"),
		lang: getAttr(spanEl, "lang"),
		emptyBeat: getAttr(spanEl, "empty-beat"),
		ruby: getAttr(spanEl, "ruby"),
		rubyPhraseStart: getAttr(spanEl, "rubyPhraseStart") !== null,
		children: [],
		tail: "",
	};
	let lastChild: SpanNode | null = null;
	for (const node of Array.from(spanEl.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent ?? "";
			if (lastChild) {
				lastChild.tail += text;
			} else {
				span.text += text;
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const childEl = node as Element;
			if (localName(childEl) === "span") {
				const child = parseSpan(childEl);
				span.children.push(child);
				lastChild = child;
			}
		}
	}
	return span;
}

function flattenSpanText(span: SpanNode, skipRoles?: Set<string>): string {
	const skipCurrent = span.role ? skipRoles?.has(span.role) : false;
	let text = "";
	if (!skipCurrent) {
		text += span.text || "";
		for (const child of span.children) {
			text += flattenSpanText(child, skipRoles);
		}
	}
	text += span.tail || "";
	return text;
}

function flattenSpanInnerText(span: SpanNode, skipRoles?: Set<string>): string {
	const skipCurrent = span.role ? skipRoles?.has(span.role) : false;
	let text = "";
	if (!skipCurrent) {
		text += span.text || "";
		for (const child of span.children) {
			text += flattenSpanText(child, skipRoles);
		}
	}
	return text;
}

function collectRubyTextSpans(span: SpanNode): SpanNode[] {
	const results: SpanNode[] = [];
	if (span.ruby === "text") {
		results.push(span);
	}
	for (const child of span.children) {
		results.push(...collectRubyTextSpans(child));
	}
	return results;
}

function computeWordTiming(words: LyricWordBase[]): [number, number] {
	const filtered = words.filter((v) => v.word.trim().length > 0);
	const start =
		filtered.reduce(
			(pv, cv) => Math.min(pv, cv.startTime),
			Number.POSITIVE_INFINITY,
		) ?? 0;
	const end = filtered.reduce((pv, cv) => Math.max(pv, cv.endTime), 0);
	return [start === Number.POSITIVE_INFINITY ? 0 : start, end];
}

function createWordFromSpanElement(wordEl: Element): LyricWord | null {
	const begin = getAttr(wordEl, "begin");
	const end = getAttr(wordEl, "end");
	const spanNode = parseSpan(wordEl);
	const skipRoles = new Set(["x-translation", "x-roman"]);
	if (spanNode.ruby === "container") {
		const baseSpan = spanNode.children.find((child) => child.ruby === "base");
		const baseText = baseSpan
			? flattenSpanInnerText(baseSpan, skipRoles)
			: flattenSpanInnerText(spanNode, skipRoles);
		const rubyTextSpans = collectRubyTextSpans(spanNode);
		const containerStart = begin ? parseTimespan(begin) : null;
		const containerEnd = end ? parseTimespan(end) : null;
		const rubyWords: LyricWordBase[] = rubyTextSpans.map((rubySpan) => {
			const rubyBegin = rubySpan.begin
				? parseTimespan(rubySpan.begin)
				: (containerStart ?? 0);
			const rubyEnd = rubySpan.end
				? parseTimespan(rubySpan.end)
				: (containerEnd ?? 0);
			return {
				word: flattenSpanInnerText(rubySpan, skipRoles),
				startTime: rubyBegin,
				endTime: rubyEnd,
			};
		});
		const [rubyStart, rubyEnd] = computeWordTiming(rubyWords);
		const word: LyricWord = {
			id: uid(),
			word: baseText,
			startTime: containerStart ?? rubyStart,
			endTime: containerEnd ?? rubyEnd,
			obscene: false,
			emptyBeat: 0,
			romanWord: "",
			ruby: rubyWords.length > 0 ? rubyWords : undefined,
			rubyPhraseStart: spanNode.rubyPhraseStart,
		};
		const emptyBeat = getAttr(wordEl, "empty-beat");
		if (emptyBeat) {
			word.emptyBeat = Number(emptyBeat);
		}
		const obscene = getAttr(wordEl, "obscene");
		if (obscene === "true") {
			word.obscene = true;
		}
		return word;
	}
	if (!begin || !end) {
		return null;
	}
	const wordText = flattenSpanInnerText(spanNode, skipRoles);
	const word: LyricWord = {
		id: uid(),
		word: wordText,
		startTime: parseTimespan(begin),
		endTime: parseTimespan(end),
		obscene: false,
		emptyBeat: 0,
		romanWord: "",
		rubyPhraseStart: spanNode.rubyPhraseStart,
	};
	const emptyBeat = getAttr(wordEl, "empty-beat");
	if (emptyBeat) {
		word.emptyBeat = Number(emptyBeat);
	}
	const obscene = getAttr(wordEl, "obscene");
	if (obscene === "true") {
		word.obscene = true;
	}
	return word;
}

export function parseLyric(ttmlText: string): TTMLLyric {
	const domParser = new DOMParser();
	const ttmlDoc: XMLDocument = domParser.parseFromString(
		ttmlText,
		"application/xml",
	);

	log("ttml document parsed", ttmlDoc);

	// 读取根节点的 xml:lang 作为歌词语言代码，默认为 zh-Hans
	const ttRoot = ttmlDoc.querySelector("tt");
	const lyricLangAttr =
		ttRoot?.getAttribute("xml:lang") ?? ttRoot?.getAttribute("lang");
	const lyricLang = lyricLangAttr ?? "zh-Hans";
	const autoLang = !lyricLangAttr; // 当文件没有定义 xml:lang 时这个值为 true

	// 默认翻译语言代码
	const DEFAULT_TRANSLATION_LANG = "zh-Hans";

	// 计算默认音译语言代码：歌词语言 + "-Latn"，如果是中文则使用 "zh-Latn-pinyin"
	const getDefaultRomanizationLang = (lang: string): string => {
		if (lang.startsWith("zh")) {
			return "zh-Latn-pinyin";
		}
		return `${lang}-Latn`;
	};
	const defaultRomanLang = getDefaultRomanizationLang(lyricLang);

	// 判断是否为逐字翻译：仅当 type="replacement" 时
	const isWordByWordTranslation = (
		translationEl: Element,
		_lang: string,
	): boolean => {
		const typeAttr = translationEl.getAttribute("type");
		if (typeAttr === "replacement") return true;
		return false;
	};

	// 解析逐字翻译的 text 元素（带时间戳的 span）
	const parseWordByWordTranslationTextElement = (
		textEl: Element,
	): { main: TTMLTranslationWord[]; bg: TTMLTranslationWord[] } | null => {
		const mainWords: TTMLTranslationWord[] = [];
		const bgWords: TTMLTranslationWord[] = [];

		for (const node of Array.from(textEl.childNodes)) {
			if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as Element;
				if (el.getAttribute("ttm:role") === "x-bg") {
					// 背景行：解析内部的 span
					const nestedSpans = el.querySelectorAll("span[begin][end]");
					if (nestedSpans.length > 0) {
						nestedSpans.forEach((span) => {
							const rawText = span.textContent ?? "";
							const bgWordText = rawText
								.trim()
								.replace(/^[（(]/, "")
								.replace(/[)）]$/, "")
								.trim();
							if (bgWordText) {
								// 检测该 span 后是否有空格
								// 1. span 内部文本尾部是否有空格
								const hasTrailingSpace = /\s+$/.test(rawText);
								// 2. span 之后是否有纯文本空格节点
								let hasSpaceAfter = hasTrailingSpace;
								if (!hasSpaceAfter) {
									const nextNode = span.nextSibling;
									if (nextNode?.nodeType === Node.TEXT_NODE) {
										const nextText = nextNode.textContent ?? "";
										hasSpaceAfter = /^\s+/.test(nextText);
									}
								}
								bgWords.push({
									startTime: parseTimespan(span.getAttribute("begin") ?? ""),
									endTime: parseTimespan(span.getAttribute("end") ?? ""),
									text: bgWordText,
									hasSpaceAfter,
								});
							}
						});
					}
				} else if (el.hasAttribute("begin") && el.hasAttribute("end")) {
					// 主行：直接是带时间戳的 span
					const rawText = el.textContent ?? "";
					const text = rawText.trim();
					if (text) {
						// 检测该 span 后是否有空格
						// 1. span 内部文本尾部是否有空格
						const hasTrailingSpace = /\s+$/.test(rawText);
						// 2. span 之后是否有纯文本空格节点
						let hasSpaceAfter = hasTrailingSpace;
						if (!hasSpaceAfter) {
							const nextNode = el.nextSibling;
							if (nextNode?.nodeType === Node.TEXT_NODE) {
								const nextText = nextNode.textContent ?? "";
								hasSpaceAfter = /^\s+/.test(nextText);
							}
						}
						mainWords.push({
							startTime: parseTimespan(el.getAttribute("begin") ?? ""),
							endTime: parseTimespan(el.getAttribute("end") ?? ""),
							text: text,
							hasSpaceAfter,
						});
					}
				}
			}
		}

		if (mainWords.length > 0 || bgWords.length > 0) {
			return { main: mainWords, bg: bgWords };
		}
		return null;
	};

	// 解析逐行翻译的 text 元素（纯文本）
	const parseLineTranslationTextElement = (
		textEl: Element,
	): LineMetadata | null => {
		let main = "";
		let bg = "";
		const bgByKey = new Map<string, string>();

		for (const node of Array.from(textEl.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				main += node.textContent ?? "";
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as Element;
				if (el.getAttribute("ttm:role") === "x-bg") {
					// 检查是否有 for 属性（多背景行支持）
					const forKey = el.getAttribute("for");
					const bgText = el.textContent ?? "";
					if (forKey) {
						// 多背景行格式：使用 for 属性指定 key
						bgByKey.set(forKey, bgText.trim());
					} else {
						// 旧格式：直接累加到 bg
						bg += bgText;
					}
				}
			}
		}

		main = main.trim();
		bg = bg
			.trim()
			.replace(/^[（(]/, "")
			.replace(/[)）]$/, "")
			.trim();

		// 如果没有背景行，尝试从主行文本中解析括号格式："主行翻译 (背景行翻译)"
		if (!bg && main && bgByKey.size === 0) {
			const match = main.match(/^(.*?)\s*[（(]([^)）]+)[)）]\s*$/);
			if (match) {
				main = match[1].trim();
				bg = match[2].trim();
			}
		}

		if (main.length > 0 || bg.length > 0 || bgByKey.size > 0) {
			return { main, bg, bgByKey };
		}

		return null;
	};

	// 使用「按字数自动分配」将逐行翻译分配为逐字翻译
	const distributeTranslationToWords = (
		words: LyricWord[],
		translationText: string,
	): TTMLTranslationWord[] => {
		const distributed = distributeRomanizationByCharCount(
			words,
			translationText,
		);
		return words
			.map((word, index) => ({
				startTime: word.startTime,
				endTime: word.endTime,
				text: distributed[index] ?? "",
			}))
			.filter((item) => item.text.trim().length > 0);
	};

	// parseTranslationTextElement 是 parseLineTranslationTextElement 的别名，用于兼容现有代码
	const parseTranslationTextElement = parseLineTranslationTextElement;

	const parseRomanizationTextElement = (textEl: Element) => {
		const mainWords: TTMLRomanWord[] = [];
		const bgWords: TTMLRomanWord[] = [];
		let lineRomanMain = "";
		let lineRomanBg = "";
		let isWordByWord = false;

		for (const node of Array.from(textEl.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				lineRomanMain += node.textContent ?? "";
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as Element;
				if (el.getAttribute("ttm:role") === "x-bg") {
					const nestedSpans = el.querySelectorAll("span[begin][end]");
					if (nestedSpans.length > 0) {
						isWordByWord = true;
						nestedSpans.forEach((span) => {
							const rawText = span.textContent ?? "";
							const bgWordText = rawText
								.trim()
								.replace(/^[（(]/, "")
								.replace(/[)）]$/, "")
								.trim();

							if (bgWordText) {
								// 检测该 span 后是否有空格
								// 1. span 内部文本尾部是否有空格
								const hasTrailingSpace = /\s+$/.test(rawText);
								// 2. span 之后是否有纯文本空格节点
								let hasSpaceAfter = hasTrailingSpace;
								if (!hasSpaceAfter) {
									const nextNode = span.nextSibling;
									if (nextNode?.nodeType === Node.TEXT_NODE) {
										const nextText = nextNode.textContent ?? "";
										hasSpaceAfter = /^\s+/.test(nextText);
									}
								}

								bgWords.push({
									startTime: parseTimespan(span.getAttribute("begin") ?? ""),
									endTime: parseTimespan(span.getAttribute("end") ?? ""),
									text: bgWordText,
									hasSpaceAfter,
								});
							}
						});
					} else {
						lineRomanBg += el.textContent ?? "";
					}
				} else if (el.hasAttribute("begin") && el.hasAttribute("end")) {
					isWordByWord = true;
					const rawText = el.textContent ?? "";
					const text = rawText.trim();

					if (text) {
						// 检测该 span 后是否有空格
						// 1. span 内部文本尾部是否有空格
						const hasTrailingSpace = /\s+$/.test(rawText);
						// 2. span 之后是否有纯文本空格节点
						let hasSpaceAfter = hasTrailingSpace;
						if (!hasSpaceAfter) {
							const nextNode = el.nextSibling;
							if (nextNode?.nodeType === Node.TEXT_NODE) {
								const nextText = nextNode.textContent ?? "";
								hasSpaceAfter = /^\s+/.test(nextText);
							}
						}

						mainWords.push({
							startTime: parseTimespan(el.getAttribute("begin") ?? ""),
							endTime: parseTimespan(el.getAttribute("end") ?? ""),
							text: text,
							hasSpaceAfter,
						});
					}
				}
			}
		}

		const wordData = isWordByWord ? { main: mainWords, bg: bgWords } : null;

		lineRomanMain = lineRomanMain.trim();
		lineRomanBg = lineRomanBg
			.trim()
			.replace(/^[（(]/, "")
			.replace(/[)）]$/, "")
			.trim();

		const lineData =
			lineRomanMain.length > 0 || lineRomanBg.length > 0
				? { main: lineRomanMain, bg: lineRomanBg }
				: null;

		return { lineData, wordData };
	};

	const itunesTranslations = new Map<string, LineMetadata>();
	const translationTextElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > translations > translation > text[for]",
	);

	translationTextElements.forEach((textEl) => {
		const key = textEl.getAttribute("for");
		if (!key) return;
		const parsed = parseTranslationTextElement(textEl);
		if (parsed) {
			itunesTranslations.set(key, parsed);
		}
	});

	const itunesTranslationsByLang = new Map<string, Map<string, LineMetadata>>();
	const itunesTimedTranslationsByLang = new Map<
		string,
		Map<string, LineMetadata>
	>();
	// 存储逐字翻译：语言代码 -> (itunesKey -> { main: TTMLTranslationWord[], bg: TTMLTranslationWord[] })
	const itunesWordTranslationsByLang = new Map<
		string,
		Map<string, { main: TTMLTranslationWord[]; bg: TTMLTranslationWord[] }>
	>();
	// 记录哪些语言被标记为逐字翻译（用于后续分配纯文本翻译）
	const wordByWordLangs = new Set<string>();
	const translationElements = Array.from(
		ttmlDoc.querySelectorAll("iTunesMetadata > translations > translation"),
	);
	const hasLangTranslation = translationElements.some(
		(el) => (el.getAttribute("xml:lang") ?? "").trim().length > 0,
	);
	for (const translationEl of translationElements) {
		const langAttr = (translationEl.getAttribute("xml:lang") ?? "").trim();
		if (!langAttr && hasLangTranslation) continue;
		const lang = langAttr || DEFAULT_TRANSLATION_LANG;

		// 判断是否为逐字翻译
		const isWordByWord = isWordByWordTranslation(translationEl, lang);
		if (isWordByWord) {
			wordByWordLangs.add(lang);
		}

		if (!itunesTranslationsByLang.has(lang)) {
			itunesTranslationsByLang.set(lang, new Map());
		}
		if (!itunesTimedTranslationsByLang.has(lang)) {
			itunesTimedTranslationsByLang.set(lang, new Map());
		}
		if (!itunesWordTranslationsByLang.has(lang)) {
			itunesWordTranslationsByLang.set(lang, new Map());
		}
		const langTranslations = itunesTranslationsByLang.get(lang);
		const langTimedTranslations = itunesTimedTranslationsByLang.get(lang);
		const langWordTranslations = itunesWordTranslationsByLang.get(lang);
		if (!langTranslations || !langTimedTranslations || !langWordTranslations)
			continue;

		for (const textEl of translationEl.querySelectorAll("text[for]")) {
			const key = textEl.getAttribute("for");
			if (!key) continue;

			if (isWordByWord) {
				// 逐字翻译
				const hasSpanWithTime = textEl.querySelector("span[begin][end]");
				if (hasSpanWithTime) {
					// 情况1：内部为 span 节点和空格（带时间戳的逐字翻译）
					const wordByWordParsed =
						parseWordByWordTranslationTextElement(textEl);
					if (wordByWordParsed) {
						langWordTranslations.set(key, wordByWordParsed);
					}
				} else {
					// 情况2和3：纯文本内容，需要先解析为逐行翻译，然后分配为逐字翻译
					const lineParsed = parseLineTranslationTextElement(textEl);
					if (lineParsed) {
						// 暂时存储为逐行翻译，后续在解析歌词行时进行分配
						langTranslations.set(key, lineParsed);
					}
				}
			} else {
				// 普通逐行翻译
				const parsed = parseTranslationTextElement(textEl);
				if (!parsed) continue;
				if (textEl.querySelector("span")) {
					langTimedTranslations.set(key, parsed);
					langTranslations.delete(key);
				} else {
					langTranslations.set(key, parsed);
				}
			}
		}
	}

	const itunesLineRomanizations = new Map<string, LineMetadata>();
	const parseVocalValue = (value: string | string[] | null | undefined) => {
		if (!value) return [];
		const parts = Array.isArray(value) ? value : value.split(/[\s,]+/);
		return parts.map((v) => v.trim()).filter(Boolean);
	};

	const itunesWordRomanizations = new Map<string, WordRomanMetadata>();

	const romanizationTextElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > transliterations > transliteration > text[for]",
	);

	romanizationTextElements.forEach((textEl) => {
		const key = textEl.getAttribute("for");
		if (!key) return;
		const { lineData, wordData } = parseRomanizationTextElement(textEl);
		if (wordData) {
			itunesWordRomanizations.set(key, wordData);
		}
		if (lineData) {
			itunesLineRomanizations.set(key, lineData);
		}
	});

	const itunesLineRomanizationsByLang = new Map<
		string,
		Map<string, LineMetadata>
	>();
	const itunesWordRomanizationsByLang = new Map<
		string,
		Map<string, WordRomanMetadata>
	>();
	const transliterationElements = Array.from(
		ttmlDoc.querySelectorAll(
			"iTunesMetadata > transliterations > transliteration",
		),
	);
	const hasLangTransliteration = transliterationElements.some(
		(el) => (el.getAttribute("xml:lang") ?? "").trim().length > 0,
	);
	const fallbackLineRomanizations = new Map<string, LineMetadata>();
	const fallbackWordRomanizations = new Map<string, WordRomanMetadata>();
	for (const transliterationEl of transliterationElements) {
		const langAttr = (transliterationEl.getAttribute("xml:lang") ?? "").trim();
		const useFallback = !langAttr;
		if (useFallback && hasLangTransliteration) continue;
		const lang = langAttr || "und";
		const lineRomanMap = useFallback
			? fallbackLineRomanizations
			: (itunesLineRomanizationsByLang.get(lang) ??
				itunesLineRomanizationsByLang.set(lang, new Map()).get(lang));
		const wordRomanMap = useFallback
			? fallbackWordRomanizations
			: (itunesWordRomanizationsByLang.get(lang) ??
				itunesWordRomanizationsByLang.set(lang, new Map()).get(lang));
		if (!lineRomanMap || !wordRomanMap) continue;

		for (const textEl of transliterationEl.querySelectorAll("text[for]")) {
			const key = textEl.getAttribute("for");
			if (!key) continue;
			const { lineData, wordData } = parseRomanizationTextElement(textEl);
			if (wordData) {
				wordRomanMap.set(key, wordData);
			}
			if (lineData) {
				lineRomanMap.set(key, lineData);
			}
		}
	}
	if (
		!hasLangTransliteration &&
		(fallbackWordRomanizations.size > 0 || fallbackLineRomanizations.size > 0)
	) {
		if (fallbackWordRomanizations.size > 0) {
			itunesWordRomanizationsByLang.set("und", fallbackWordRomanizations);
		}
		if (fallbackLineRomanizations.size > 0) {
			itunesLineRomanizationsByLang.set("und", fallbackLineRomanizations);
		}
	}

	const itunesTimedTranslations = new Map<string, LineMetadata>();
	const timedTranslationTextElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > translations > translation > text[for]",
	);

	timedTranslationTextElements.forEach((textEl) => {
		const key = textEl.getAttribute("for");
		if (!key) return;
		const parsed = parseTranslationTextElement(textEl);
		if (parsed && textEl.querySelector("span")) {
			itunesTimedTranslations.set(key, parsed);
			itunesTranslations.delete(key);
		}
	});

	const metadata: TTMLMetadata[] = [];
	for (const meta of ttmlDoc.querySelectorAll("meta")) {
		if (meta.tagName === "amll:meta") {
			const key = meta.getAttribute("key");
			if (key) {
				const value = meta.getAttribute("value");
				if (value) {
					const existing = metadata.find((m) => m.key === key);
					if (existing) {
						existing.value.push(value);
					} else {
						metadata.push({
							key,
							value: [value],
						});
					}
				}
			}
		}
	}

	const vocalTagMap = new Map<string, string>();
	const vocalContainers = ttmlDoc.querySelectorAll(
		"metadata > amll\\:vocals, metadata > vocals, amll\\:vocals, vocals",
	);
	for (const container of vocalContainers) {
		for (const vocal of container.querySelectorAll("vocal")) {
			const key = vocal.getAttribute("key");
			if (!key) continue;
			const value = vocal.getAttribute("value") ?? "";
			vocalTagMap.set(key, value);
		}
	}
	const vocalTags: TTMLVocalTag[] = Array.from(vocalTagMap.entries()).map(
		([key, value]) => ({ key, value }),
	);

	const songwriterElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > songwriters > songwriter",
	);
	if (songwriterElements.length > 0) {
		const songwriterValues: string[] = [];
		songwriterElements.forEach((el) => {
			const name = el.textContent?.trim();
			if (name) {
				songwriterValues.push(name);
			}
		});
		if (songwriterValues.length > 0) {
			metadata.push({
				key: "songwriter",
				value: songwriterValues,
			});
		}
	}

	// 解析所有 ttm:agent 元素
	const agents: TTMLAgent[] = [];

	// 使用 getElementsByTagNameNS 或遍历所有元素来查找 ttm:agent
	// 因为 querySelectorAll 在处理 XML 命名空间时可能不一致
	const allElements = ttmlDoc.getElementsByTagName("*");
	for (const el of allElements) {
		// 检查标签名是否以 ttm:agent 结尾（处理命名空间前缀）
		const tagName = el.tagName;
		if (tagName !== "ttm:agent" && !tagName.endsWith(":agent")) continue;

		const id = el.getAttribute("xml:id");
		const type = el.getAttribute("type") as "person" | "group" | "other" | null;
		if (!id || !type) continue;

		// 收集所有 ttm:name 子元素
		const names: string[] = [];
		for (const child of el.getElementsByTagName("*")) {
			const childTagName = child.tagName;
			if (childTagName !== "ttm:name" && !childTagName.endsWith(":name"))
				continue;
			const name = child.textContent?.trim();
			if (name) {
				names.push(name);
			}
		}

		agents.push({ id, type, names });
	}

	// 创建 agent 查找映射，用于快速获取 agent 类型
	const agentMap = new Map<string, TTMLAgent>();
	for (const agent of agents) {
		agentMap.set(agent.id, agent);
	}

	// 初始化对唱处理选项
	const duetOptionsBase = calculateDuetOptions(agents);
	const duetState: DuetProcessOptions = {
		...duetOptionsBase,
		currentAgentId: duetOptionsBase.mainAgentId,
		duetToggle: false,
	};

	const lyricLines: LyricLine[] = [];

	function parseLineElement(
		lineEl: Element,
		isBG = false,
		isDuet = false,
		parentItunesKey: string | null = null,
		parentVocal: string | string[] | null = null,
		songPart: string | null = null,
	) {
		const startTimeAttr = lineEl.getAttribute("begin");
		const endTimeAttr = lineEl.getAttribute("end");

		let parsedStartTime = 0;
		let parsedEndTime = 0;

		if (startTimeAttr && endTimeAttr) {
			parsedStartTime = parseTimespan(startTimeAttr);
			parsedEndTime = parseTimespan(endTimeAttr);
		}

		const lineVocalAttr =
			lineEl.getAttribute("amll:vocal") ?? lineEl.getAttribute("vocal");
		const lineVocal = lineVocalAttr ?? (isBG ? parentVocal : null);
		const parsedLineVocal = parseVocalValue(lineVocal);

		// 获取行的 agent id
		const lineAgentId = lineEl.getAttribute("ttm:agent");

		// 计算当前行的对唱状态
		let lineIsDuet = isDuet;
		if (!isBG) {
			// 使用新的对唱状态计算函数
			const result = calculateDuetState(lineAgentId ?? undefined, duetState);
			lineIsDuet = result.isDuet;
			duetState.currentAgentId = result.newCurrentAgentId;
			duetState.duetToggle = result.newDuetToggle;
		}

		// 读取 RTL 标记
		const rtlAttr =
			lineEl.getAttribute("amll:rtl") ?? lineEl.getAttribute("rtl");
		const isRtl = rtlAttr === "true";

		const line: LyricLine = {
			id: uid(),
			words: [],
			translatedLyric: "",
			romanLyric: "",
			isBG,
			isDuet: lineIsDuet,
			startTime: parsedStartTime,
			endTime: parsedEndTime,
			ignoreSync: false,
			vocal: parsedLineVocal,
			isRtl,
		};

		// 如果是该 div 的第一个非背景行，且存在 songPart，则设置到行对象中
		if (songPart && !isBG) {
			line.songPart = songPart;
		}

		// 保存行的 agent 信息（包括 bg 行）
		if (lineAgentId) {
			line.agent = lineAgentId;
		}
		let haveBg = false;

		// 获取或生成 itunesKey
		let itunesKey: string | null = null;
		if (isBG) {
			// 背景行：优先使用自己的 itunes:key
			itunesKey = lineEl.getAttribute("itunes:key");
			if (!itunesKey) {
				// 没有 key 时分配 B 编号
				itunesKey = `B${bCounter}`;
				bCounter++;
			}
		} else {
			// 主行：直接使用自己的 itunes:key
			itunesKey = lineEl.getAttribute("itunes:key");
			if (!itunesKey) {
				// 没有 key 时分配 L 编号
				itunesKey = `L${lCounter}`;
				lCounter++;
			}
		}
		// 保存 itunesKey 到行对象
		line.itunesKey = itunesKey;

		const romanWordData = itunesKey
			? itunesWordRomanizations.get(itunesKey)
			: undefined;
		const sourceRomanList = isBG ? romanWordData?.bg : romanWordData?.main;
		const availableRomanWords = sourceRomanList ? [...sourceRomanList] : [];

		if (itunesKey) {
			const timedTrans = itunesTimedTranslations.get(itunesKey);
			const lineTrans = itunesTranslations.get(itunesKey);

			if (isBG) {
				// 多背景行支持：优先从 bgByKey 中查找，然后回退到旧的 bg 字段
				const bgByKey = timedTrans?.bgByKey ?? lineTrans?.bgByKey;
				if (bgByKey && itunesKey) {
					line.translatedLyric = bgByKey.get(itunesKey) ?? "";
				} else {
					line.translatedLyric = timedTrans?.bg ?? lineTrans?.bg ?? "";
				}
			} else {
				line.translatedLyric = timedTrans?.main ?? lineTrans?.main ?? "";
			}

			const lineRoman = itunesLineRomanizations.get(itunesKey);
			if (isBG) {
				line.romanLyric = lineRoman?.bg ?? "";
			} else {
				line.romanLyric = lineRoman?.main ?? "";
			}

			const translatedLyricByLang: Record<string, TTMLLangData<string>> = {};
			for (const [lang, translations] of itunesTranslationsByLang.entries()) {
				const timedTranslations = itunesTimedTranslationsByLang.get(lang);
				const langTrans =
					timedTranslations?.get(itunesKey) ?? translations.get(itunesKey);
				if (!langTrans) continue;
				// 标记是否为自动填充的语言代码（und 表示没有 xml:lang 属性）
				const isAutoFilled = lang === "und";
				let transData: string;
				if (isBG) {
					// 多背景行支持：优先从 bgByKey 中查找
					const bgByKey = langTrans.bgByKey;
					if (bgByKey && itunesKey) {
						transData = bgByKey.get(itunesKey) ?? langTrans.bg ?? "";
					} else {
						transData = langTrans.bg ?? "";
					}
				} else {
					transData = langTrans.main ?? "";
				}
				translatedLyricByLang[lang] = {
					data: transData,
					isAutoFilled,
				};
			}
			if (Object.keys(translatedLyricByLang).length > 0) {
				line.translatedLyricByLang = translatedLyricByLang;
			}

			const romanLyricByLang: Record<string, TTMLLangData<string>> = {};
			for (const [
				lang,
				romanizations,
			] of itunesLineRomanizationsByLang.entries()) {
				const langRoman = romanizations.get(itunesKey);
				if (!langRoman) continue;
				// 标记是否为自动填充的语言代码（und 表示没有 xml:lang 属性）
				const isAutoFilled = lang === "und";
				romanLyricByLang[lang] = {
					data: isBG ? (langRoman.bg ?? "") : (langRoman.main ?? ""),
					isAutoFilled,
				};
			}
			if (Object.keys(romanLyricByLang).length > 0) {
				line.romanLyricByLang = romanLyricByLang;
			}

			const wordRomanizationByLang: Record<string, TTMLLangData<TTMLRomanWord[]>> = {};
			for (const [
				lang,
				romanizations,
			] of itunesWordRomanizationsByLang.entries()) {
				const langRoman = romanizations.get(itunesKey);
				const romanList = isBG ? langRoman?.bg : langRoman?.main;
				if (!romanList || romanList.length === 0) continue;
				// 标记是否为自动填充的语言代码（und 表示没有 xml:lang 属性）
				const isAutoFilled = lang === "und";
				wordRomanizationByLang[lang] = {
					data: romanList,
					isAutoFilled,
				};
			}
			if (Object.keys(wordRomanizationByLang).length > 0) {
				line.wordRomanizationByLang = wordRomanizationByLang;
			}
		}

		for (const wordNode of lineEl.childNodes) {
			if (wordNode.nodeType === Node.TEXT_NODE) {
				const word = wordNode.textContent ?? "";
				line.words.push({
					id: uid(),
					word: word,
					startTime: word.trim().length > 0 ? line.startTime : 0,
					endTime: word.trim().length > 0 ? line.endTime : 0,
					obscene: false,
					emptyBeat: 0,
					romanWord: "",
					rubyPhraseStart: false,
				});
			} else if (wordNode.nodeType === Node.ELEMENT_NODE) {
				const wordEl = wordNode as Element;
				const role = wordEl.getAttribute("ttm:role");

				if (wordEl.nodeName === "span" && role) {
					if (role === "x-bg") {
						// 获取子背景行的 itunes:key（如果存在）
						const bgItunesKey = wordEl.getAttribute("itunes:key");
						parseLineElement(
							wordEl,
							true,
							line.isDuet,
							bgItunesKey ?? itunesKey, // 优先使用子背景行的 key，否则使用父行的 key
							line.vocal?.length ? line.vocal : null,
							null, // 背景行不传递 songPart
						);
						haveBg = true;
					} else if (role === "x-translation") {
						// 读取 xml:lang 属性，如果没有则使用默认翻译语言代码
						const transLangAttr =
							wordEl.getAttribute("xml:lang") ??
							wordEl.getAttribute("lang");
						const transLang = transLangAttr ?? DEFAULT_TRANSLATION_LANG;
						// 标记是否为自动填充（没有 xml:lang 属性）
						const isAutoFilled = !transLangAttr;
						if (!line.translatedLyricByLang) {
							line.translatedLyricByLang = {};
						}
						if (!line.translatedLyricByLang[transLang]) {
							line.translatedLyricByLang[transLang] = {
								data: wordEl.innerHTML,
								isAutoFilled,
							};
						}
					} else if (role === "x-roman") {
						// 内嵌音译使用默认音译语言代码存储到 romanLyricByLang
						if (!line.romanLyricByLang) {
							line.romanLyricByLang = {};
						}
						if (!line.romanLyricByLang[defaultRomanLang]) {
							line.romanLyricByLang[defaultRomanLang] = {
								data: wordEl.innerHTML,
								// 内嵌音译使用默认语言代码，视为自动填充
								isAutoFilled: true,
							};
						}
					}
				} else {
					const word = createWordFromSpanElement(wordEl);
					if (!word) continue;
					if (availableRomanWords.length > 0) {
						const matchIndex = availableRomanWords.findIndex(
							(r) =>
								r.startTime === word.startTime && r.endTime === word.endTime,
						);

						if (matchIndex !== -1) {
							word.romanWord = availableRomanWords[matchIndex].text;
							availableRomanWords.splice(matchIndex, 1);
						}
					}

					line.words.push(word);
				}
			}
		}

		// 处理逐字翻译：只处理被标记为逐字翻译的语言
		if (itunesKey) {
			const wordTranslationByLang: Record<string, TTMLLangData<TTMLTranslationWord[]>> = {};
			// 只遍历被标记为逐字翻译的语言
			for (const lang of wordByWordLangs) {
				// 标记是否为自动填充的语言代码（und 表示没有 xml:lang 属性）
				const isAutoFilled = lang === "und";
				const translations = itunesWordTranslationsByLang.get(lang);
				if (translations) {
					const langWordTrans = translations.get(itunesKey);
					if (langWordTrans) {
						// 已经有逐字翻译（带时间戳的 span 格式）
						const transList = isBG ? langWordTrans.bg : langWordTrans.main;
						if (transList && transList.length > 0) {
							wordTranslationByLang[lang] = {
								data: transList,
								isAutoFilled,
							};
						}
					}
				}
				// 对于纯文本的逐字翻译，从 itunesTranslationsByLang 中查找并分配
				const langLineTrans = itunesTranslationsByLang
					.get(lang)
					?.get(itunesKey);
				if (langLineTrans && line.words.length > 0) {
					const transText = isBG
						? (langLineTrans.bg ?? "")
						: (langLineTrans.main ?? "");
					if (transText.trim().length > 0) {
						// 使用「按字数自动分配」将逐行翻译分配为逐字翻译
						const distributed = distributeTranslationToWords(
							line.words,
							transText,
						);
						if (distributed.length > 0) {
							wordTranslationByLang[lang] = {
								data: distributed,
								isAutoFilled,
							};
						}
					}
				}
				// 从 translatedLyricByLang 中删除已转换为逐字翻译的语言
				if (line.translatedLyricByLang?.[lang] !== undefined) {
					delete line.translatedLyricByLang[lang];
					// 如果 translatedLyricByLang 为空，删除整个属性
					if (Object.keys(line.translatedLyricByLang).length === 0) {
						delete line.translatedLyricByLang;
					}
				}
			}
			if (Object.keys(wordTranslationByLang).length > 0) {
				line.wordTranslationByLang = wordTranslationByLang;
			}
		}

		if (!startTimeAttr || !endTimeAttr) {
			line.startTime = line.words
				.filter((w) => w.word.trim().length > 0)
				.reduce(
					(pv, cv) => Math.min(pv, cv.startTime),
					Number.POSITIVE_INFINITY,
				);
			line.endTime = line.words
				.filter((w) => w.word.trim().length > 0)
				.reduce((pv, cv) => Math.max(pv, cv.endTime), 0);
		}

		if (line.isBG) {
			const firstWord = line.words[0];
			if (firstWord && /^[（(]/.test(firstWord.word)) {
				firstWord.word = firstWord.word.substring(1);
				if (firstWord.word.length === 0) {
					line.words.shift();
				}
			}

			const lastWord = line.words[line.words.length - 1];
			if (lastWord && /[)）]$/.test(lastWord.word)) {
				lastWord.word = lastWord.word.substring(0, lastWord.word.length - 1);
				if (lastWord.word.length === 0) {
					line.words.pop();
				}
			}
		}

		if (haveBg) {
			const bgLine = lyricLines.pop();
			lyricLines.push(line);
			if (bgLine) lyricLines.push(bgLine);
		} else {
			lyricLines.push(line);
		}
	}

	// 用于存储文件中出现的自定义 song-part 值（不在预设列表中的）
	const customSongParts = new Set<string>();

	// L 和 B 计数器，用于为没有 itunes:key 的行分配编号
	// L 从 0 开始 (L0, L1, L2...)，B 从 1 开始 (B1, B2, B3...)
	let lCounter = 0;
	let bCounter = 1;

	// 先遍历所有 div，解析 song-part 属性，然后处理其中的 p 标签
	const divElements = ttmlDoc.querySelectorAll("body div[begin][end]");
	if (divElements.length > 0) {
		// 存在 div 结构，按 div 分组解析
		for (const divEl of divElements) {
			// 获取 div 的 song-part 属性（支持 itunes:song-part、itunes:songPart、songPart 和 song-part）
			const songPart =
				divEl.getAttribute("itunes:song-part") ??
				divEl.getAttribute("itunes:songPart") ??
				divEl.getAttribute("songPart") ??
				divEl.getAttribute("song-part") ??
				null;
			// 如果 songPart 不在预设列表中，添加到自定义列表
			if (songPart && !PREDEFINED_SONG_PARTS.has(songPart)) {
				customSongParts.add(songPart);
			}
			// 标记是否是该 div 的第一个非背景行
			let isFirstLineInDiv = true;
			for (const lineEl of divEl.querySelectorAll("p[begin][end]")) {
				// 只将 songPart 传递给该 div 的第一个非背景行
				const songPartToPass = isFirstLineInDiv ? songPart : null;
				parseLineElement(lineEl, false, false, null, null, songPartToPass);
				// 如果当前行不是背景行，则后续行不再传递 songPart
				if (
					!lineEl.getAttribute("ttm:role") ||
					lineEl.getAttribute("ttm:role") !== "x-bg"
				) {
					isFirstLineInDiv = false;
				}
			}
		}
	} else {
		// 没有 div 结构，直接解析 body 下的 p 标签
		for (const lineEl of ttmlDoc.querySelectorAll("body p[begin][end]")) {
			parseLineElement(lineEl, false, false, null, null, null);
		}
	}

	log("finished ttml load", lyricLines, metadata);

	const result: TTMLLyric = {
		metadata,
		lyricLines: lyricLines,
		vocalTags,
		agents,
		lyricLang,
		autoLang,
		customSongParts:
			customSongParts.size > 0 ? Array.from(customSongParts) : undefined,
	};

	// 输出整个解析后的对象到控制台
	console.log("[TTML Parser] Parsed TTML object:", result);

	return result;
}

/**
 * 对唱处理选项
 */
export interface DuetProcessOptions {
	/** agent 列表 */
	agents: TTMLAgent[];
	/** 是否使用复杂对唱模式（group 数量 >= 2） */
	isComplexMode: boolean;
	/** 主歌手 agent ID */
	mainAgentId: string;
	/** 当前 agent ID（用于切换判断） */
	currentAgentId: string;
	/** 当前对唱状态 */
	duetToggle: boolean;
}

/**
 * 对唱处理结果
 */
export interface DuetProcessResult {
	/** 当前行是否为对唱 */
	isDuet: boolean;
	/** 新的当前 agent ID */
	newCurrentAgentId: string;
	/** 新的对唱状态 */
	newDuetToggle: boolean;
}

/**
 * 计算对唱处理选项
 * @param agents - agent 列表
 * @returns 对唱处理选项
 */
export function calculateDuetOptions(
	agents: TTMLAgent[],
): Omit<DuetProcessOptions, "currentAgentId" | "duetToggle"> {
	// 统计 group 数量
	const groupCount = agents.filter((a) => a.type === "group").length;

	// 找到第一个 person 类型 agent，如果没有则找第一个 group
	const firstPerson = agents.find((a) => a.type === "person");
	const firstGroup = agents.find((a) => a.type === "group");
	const mainAgentId = firstPerson?.id ?? firstGroup?.id ?? "";

	return {
		agents,
		isComplexMode: groupCount >= 2,
		mainAgentId,
	};
}

/**
 * 计算行的对唱状态（参考 C++ 实现）
 * @param lineAgentId - 当前行的 agent ID
 * @param options - 对唱处理选项
 * @returns 对唱处理结果
 */
export function calculateDuetState(
	lineAgentId: string | undefined,
	options: DuetProcessOptions,
): DuetProcessResult {
	const { agents, isComplexMode, mainAgentId, currentAgentId, duetToggle } =
		options;

	// 如果没有 agent ID，返回默认值
	if (!lineAgentId) {
		return {
			isDuet: false,
			newCurrentAgentId: currentAgentId,
			newDuetToggle: duetToggle,
		};
	}

	// 查找行的 agent 信息
	const lineAgent = agents.find((a) => a.id === lineAgentId);

	// 经典对唱模式（group 数量 < 2）
	if (!isComplexMode) {
		// 如果找不到 agent 或者是 group 类型，不对唱
		if (!lineAgent || lineAgent.type === "group") {
			return {
				isDuet: false,
				newCurrentAgentId: currentAgentId,
				newDuetToggle: duetToggle,
			};
		}

		// person/other 类型：agent 切换时翻转对唱状态
		let newDuetToggle = duetToggle;
		let newCurrentAgentId = currentAgentId;

		if (mainAgentId !== lineAgentId) {
			if (currentAgentId !== lineAgentId) {
				newDuetToggle = !duetToggle;
				newCurrentAgentId = lineAgentId;
			}
			return {
				isDuet: newDuetToggle,
				newCurrentAgentId,
				newDuetToggle,
			};
		}

		// 主歌手，不对唱
		return {
			isDuet: false,
			newCurrentAgentId: lineAgentId,
			newDuetToggle: false,
		};
	}

	// 复杂对唱模式（group 数量 >= 2）：所有行都参与对唱切换
	let newDuetToggle = duetToggle;
	let newCurrentAgentId = currentAgentId;

	if (currentAgentId !== lineAgentId) {
		newDuetToggle = !duetToggle;
		newCurrentAgentId = lineAgentId;
	}

	return {
		isDuet: newDuetToggle,
		newCurrentAgentId,
		newDuetToggle,
	};
}
