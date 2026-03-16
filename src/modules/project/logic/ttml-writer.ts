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

import type {
	LyricLine,
	LyricWord,
	TTMLLyric,
	TTMLRomanWord,
} from "../../../types/ttml.ts";
import { log } from "../../../utils/logging.ts";
import { msToTimestamp } from "../../../utils/timestamp.ts";

type LineMetadata = {
	main: string;
	bg: string;
};

export default function exportTTMLText(
	ttmlLyric: TTMLLyric,
	pretty = false,
): string {
	const params: LyricLine[][] = [];
	const lyric = ttmlLyric.lyricLines;

	let tmp: LyricLine[] = [];
	for (const line of lyric) {
		if (line.words.length === 0 && tmp.length > 0) {
			params.push(tmp);
			tmp = [];
		} else {
			tmp.push(line);
		}
	}

	if (tmp.length > 0) {
		params.push(tmp);
	}

	// 默认语言代码设置（用于根元素 xml:lang）
	const DEFAULT_LYRIC_LANG = "zh-Hans"; // 歌词默认语言

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
		span.setAttribute("begin", msToTimestamp(word.startTime));
		span.setAttribute("end", msToTimestamp(word.endTime));
		span.appendChild(doc.createTextNode(word.text));
		return span;
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
	// 设置歌词语言代码（默认 zh-Hans）
	ttRoot.setAttribute("xml:lang", DEFAULT_LYRIC_LANG);

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

	// Append metadata entries ( songwriter will be handled in iTunesMetadata later)
	for (const metadata of ttmlLyric.metadata) {
		for (const value of metadata.value) {
			const metaEl = doc.createElement("amll:meta");
			metaEl.setAttribute("key", metadata.key);
			metaEl.setAttribute("value", value);
			metadataEl.appendChild(metaEl);
		}
	}

	head.appendChild(metadataEl);

	let i = 0;

	const translationByLangMap = new Map<string, Map<string, LineMetadata>>();
	const romanizationByLangMap = new Map<string, Map<string, LineMetadata>>();
	const wordRomanizationByLangMap = new Map<
		string,
		Map<
			string,
			{
				mainWords: LyricWord[];
				bgWords: LyricWord[];
				mainRoman: TTMLRomanWord[];
				bgRoman: TTMLRomanWord[];
			}
		>
	>();

	const guessDuration = lyric[lyric.length - 1]?.endTime ?? 0;
	body.setAttribute("dur", msToTimestamp(guessDuration));
	const isDynamicLyric = lyric.some(
		(line) => line.words.filter((v) => v.word.trim().length > 0).length > 1,
	);

	for (const param of params) {
		const paramDiv = doc.createElement("div");
		const beginTime = param[0]?.startTime ?? 0;
		const endTime = param[param.length - 1]?.endTime ?? 0;

		paramDiv.setAttribute("begin", msToTimestamp(beginTime));
		paramDiv.setAttribute("end", msToTimestamp(endTime));

		for (let lineIndex = 0; lineIndex < param.length; lineIndex++) {
			const line = param[lineIndex];
			const lineP = doc.createElement("p");
			const beginTime = line.startTime ?? 0;
			const endTime = line.endTime;

			lineP.setAttribute("begin", msToTimestamp(beginTime));
			lineP.setAttribute("end", msToTimestamp(endTime));

			lineP.setAttribute("ttm:agent", line.isDuet ? "v2" : "v1");
			const normalizedVocal = normalizeVocalValue(line.vocal);
			if (normalizedVocal.length > 0) {
				lineP.setAttribute("amll:vocal", normalizedVocal);
			}

			const itunesKey = `L${++i}`;
			lineP.setAttribute("itunes:key", itunesKey);

			const mainWords = line.words;
			let bgWords: LyricWord[] = [];

			if (isDynamicLyric) {
				let beginTime = Number.POSITIVE_INFINITY;
				let endTime = 0;
				for (const word of line.words) {
					if (word.word.trim().length === 0 && !hasRuby(word)) {
						lineP.appendChild(doc.createTextNode(word.word));
					} else {
						const span = createWordElement(word);
						lineP.appendChild(span);
						beginTime = Math.min(beginTime, word.startTime);
						endTime = Math.max(endTime, word.endTime);
					}
				}
				lineP.setAttribute("begin", msToTimestamp(line.startTime));
				lineP.setAttribute("end", msToTimestamp(line.endTime));
			} else {
				const word = line.words[0];
				if (word.word.trim().length === 0 && !hasRuby(word)) {
					lineP.appendChild(doc.createTextNode(word.word));
				} else {
					lineP.appendChild(createWordElement(word));
				}
				lineP.setAttribute("begin", msToTimestamp(word.startTime));
				lineP.setAttribute("end", msToTimestamp(word.endTime));
			}

			const nextLine = param[lineIndex + 1];
			let bgLine: LyricLine | undefined;
			if (nextLine?.isBG) {
				lineIndex++;
				bgLine = nextLine;
				bgWords = bgLine.words;

				const bgLineSpan = doc.createElement("span");
				bgLineSpan.setAttribute("ttm:role", "x-bg");

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
					bgLineSpan.setAttribute("begin", msToTimestamp(beginTime));
					bgLineSpan.setAttribute("end", msToTimestamp(endTime));
				} else {
					const word = bgLine.words[0];
					if (word.word.trim().length === 0 && !hasRuby(word)) {
						bgLineSpan.appendChild(doc.createTextNode(`(${word.word})`));
					} else {
						const span = createWordElement(word);
						addWrapperToElement(span, "(", ")");
						bgLineSpan.appendChild(span);
					}
					bgLineSpan.setAttribute("begin", msToTimestamp(word.startTime));
					bgLineSpan.setAttribute("end", msToTimestamp(word.endTime));
				}

				const normalizedBgVocal = normalizeVocalValue(bgLine.vocal);
				if (normalizedBgVocal.length > 0) {
					bgLineSpan.setAttribute("amll:vocal", normalizedBgVocal);
				}

				lineP.appendChild(bgLineSpan);
			}

			// 收集翻译数据：只输出有语言代码的翻译（translatedLyricByLang）
			const translationLangs = new Set<string>([
				...Object.keys(line.translatedLyricByLang ?? {}),
				...Object.keys(bgLine?.translatedLyricByLang ?? {}),
			]);
			// 处理有语言代码的翻译（跳过 und）
			for (const lang of translationLangs) {
				if (lang === "und") continue; // 跳过 und，不输出
				const main = line.translatedLyricByLang?.[lang] ?? "";
				const bg = bgLine?.translatedLyricByLang?.[lang] ?? "";
				if (main.trim().length === 0 && bg.trim().length === 0) continue;
				if (!translationByLangMap.has(lang)) {
					translationByLangMap.set(lang, new Map());
				}
				translationByLangMap.get(lang)?.set(itunesKey, { main, bg });
			}
			// 注意：不输出无语言代码的 translatedLyric

			// 收集音译数据：逐字音译优先于逐行音译
			// 1. 首先收集逐行音译（romanLyricByLang）
			const romanLangs = new Set<string>([
				...Object.keys(line.romanLyricByLang ?? {}),
				...Object.keys(bgLine?.romanLyricByLang ?? {}),
			]);
			// 处理有语言代码的逐行音译（跳过 und）
			for (const lang of romanLangs) {
				if (lang === "und") continue; // 跳过 und，不输出
				const main = line.romanLyricByLang?.[lang] ?? "";
				const bg = bgLine?.romanLyricByLang?.[lang] ?? "";
				if (main.trim().length === 0 && bg.trim().length === 0) continue;
				if (!romanizationByLangMap.has(lang)) {
					romanizationByLangMap.set(lang, new Map());
				}
				romanizationByLangMap.get(lang)?.set(itunesKey, { main, bg });
			}
			// 注意：不输出无语言代码的 romanLyric

			// 2. 然后收集逐字音译（wordRomanizationByLang），会覆盖逐行音译
			const wordRomanLangs = new Set<string>([
				...Object.keys(line.wordRomanizationByLang ?? {}),
				...Object.keys(bgLine?.wordRomanizationByLang ?? {}),
			]);
			// 处理有语言代码的逐字音译（跳过 und）
			for (const lang of wordRomanLangs) {
				if (lang === "und") continue; // 跳过 und，不输出
				const mainRoman = line.wordRomanizationByLang?.[lang] ?? [];
				const bgRoman = bgLine?.wordRomanizationByLang?.[lang] ?? [];
				if (mainRoman.length === 0 && bgRoman.length === 0) continue;
				// 逐字音译优先：删除相同语言的逐行音译
				romanizationByLangMap.delete(lang);
				if (!wordRomanizationByLangMap.has(lang)) {
					wordRomanizationByLangMap.set(lang, new Map());
				}
				wordRomanizationByLangMap.get(lang)?.set(itunesKey, {
					mainWords,
					bgWords,
					mainRoman,
					bgRoman,
				});
			}
			// 注意：不输出无语言代码的 word.romanWord

			paramDiv.appendChild(lineP);
		}

		body.appendChild(paramDiv);
	}

	// 检查是否需要创建 iTunesMetadata（songwriter、translations、transliterations）
	const hasSongwriter = ttmlLyric.metadata.some(
		(m) => m.key === "songwriter" && m.value.some((v) => v.trim().length > 0),
	);
	const hasTranslations = translationByLangMap.size > 0;
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
			const songwriterMeta = ttmlLyric.metadata.find(
				(m) =>
					m.key === "songwriter" && m.value.some((v) => v.trim().length > 0),
			);
			if (songwriterMeta) {
				const songwritersEl = doc.createElement("songwriters");
				for (const name of songwriterMeta.value) {
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
			for (const [lang, entries] of translationByLangMap.entries()) {
				const translation = doc.createElement("translation");
				translation.setAttribute("xml:lang", lang);
				for (const [key, { main, bg }] of entries.entries()) {
					const textEl = doc.createElement("text");
					textEl.setAttribute("for", key);
					if (main.trim().length > 0) {
						textEl.appendChild(doc.createTextNode(main));
					}
					if (bg.trim().length > 0) {
						const bgSpan = doc.createElement("span");
						bgSpan.setAttribute("ttm:role", "x-bg");
						bgSpan.appendChild(doc.createTextNode(bg));
						textEl.appendChild(bgSpan);
					}
					translation.appendChild(textEl);
				}
				translations.appendChild(translation);
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
				for (const [key, { main, bg }] of entries.entries()) {
					const textEl = doc.createElement("text");
					textEl.setAttribute("for", key);
					if (main.trim().length > 0) {
						textEl.appendChild(doc.createTextNode(main));
					}
					if (bg.trim().length > 0) {
						const bgSpan = doc.createElement("span");
						bgSpan.setAttribute("ttm:role", "x-bg");
						bgSpan.appendChild(doc.createTextNode(bg));
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

					if (data.mainRoman.length > 0) {
						for (const word of data.mainWords) {
							if (word.word.trim().length === 0) {
								if (textEl.hasChildNodes()) {
									textEl.appendChild(doc.createTextNode(word.word));
								}
								continue;
							}
							const match = data.mainRoman.find(
								(r) =>
									r.startTime === word.startTime &&
									r.endTime === word.endTime,
							);
							if (!match || match.text.trim().length === 0) continue;
							textEl.appendChild(createRomanizationSpanFromData(match));
						}
					}

					if (data.bgRoman.length > 0) {
						const bgSpan = doc.createElement("span");
						bgSpan.setAttribute("ttm:role", "x-bg");
						const bgSpans: Element[] = [];
						for (const word of data.bgWords) {
							if (word.word.trim().length === 0) {
								if (bgSpan.hasChildNodes()) {
									bgSpan.appendChild(doc.createTextNode(word.word));
								}
								continue;
							}
							const match = data.bgRoman.find(
								(r) =>
									r.startTime === word.startTime &&
									r.endTime === word.endTime,
							);
							if (!match || match.text.trim().length === 0) continue;
							const span = createRomanizationSpanFromData(match);
							bgSpan.appendChild(span);
							bgSpans.push(span);
						}
						if (bgSpans.length > 0) {
							const first = bgSpans[0];
							const last = bgSpans[bgSpans.length - 1];
							if (first.firstChild) {
								first.firstChild.nodeValue = `(${first.firstChild.nodeValue}`;
							}
							if (last.firstChild) {
								last.firstChild.nodeValue = `${last.firstChild.nodeValue})`;
							}
							textEl.appendChild(bgSpan);
						}
					}

					const transliteration = getOrCreateTransliteration(lang);
					transliteration.appendChild(textEl);
				}
			}

			iTunesMetadata.appendChild(transliterations);
		}

		// 将 iTunesMetadata 添加到 metadata 的最后
		metadataEl.appendChild(iTunesMetadata);
	}

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
