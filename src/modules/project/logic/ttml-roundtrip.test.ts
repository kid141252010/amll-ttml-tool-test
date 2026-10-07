// @vitest-environment happy-dom

import * as fs from "node:fs";
import * as path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { LyricLine, LyricWord, TTMLLyric } from "../../../types/ttml.ts";
import { parseLyric } from "./ttml-parser.ts";
import exportTTMLText from "./ttml-writer.ts";

beforeAll(() => {
	// parser/writer 在 DEV 下会打印整个 DOM，静默以保持输出可读
	vi.spyOn(console, "log").mockImplementation(() => {});
});

const FIXTURE_DIR = path.join(__dirname, "__fixtures__");

function loadFixture(name: string): string {
	return fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

/**
 * 去除仅存在于内存中、每次解析都会变化的字段，便于深度比较。
 * - line.id / word.id：由 uid() 在每次解析时随机生成，不会写入 TTML。
 * 其余字段（含 itunesKey）均要求稳定：fixtures 使用与 writer 一致的 L1..Ln 编号。
 */
function normalizeForCompare(lyric: TTMLLyric): unknown {
	const clone: TTMLLyric = structuredClone(lyric);
	for (const line of clone.lyricLines) {
		delete (line as Partial<LyricLine>).id;
		for (const word of line.words) {
			delete (word as Partial<LyricWord>).id;
		}
	}
	return clone;
}

function roundtrip(ttmlText: string) {
	const first = parseLyric(ttmlText);
	const exported = exportTTMLText(structuredClone(first), {
		separateSpecialSpansWithSpace: false,
	});
	const second = parseLyric(exported);
	return { first, exported, second };
}

function expectRoundtrip(ttmlText: string) {
	const { first, second } = roundtrip(ttmlText);
	expect(normalizeForCompare(second)).toEqual(normalizeForCompare(first));
}

let idSeq = 0;

function w(word: string, startTime: number, endTime: number): LyricWord {
	return {
		id: `w${idSeq++}`,
		word,
		startTime,
		endTime,
		obscene: false,
		emptyBeat: 0,
		romanWord: "",
		rubyPhraseStart: false,
	};
}

function line(partial: Partial<LyricLine>): LyricLine {
	const words = partial.words ?? [];
	const timed = words.filter((x) => x.word.trim().length > 0);
	return {
		id: `l${idSeq++}`,
		words,
		translatedLyric: "",
		romanLyric: "",
		isBG: false,
		isDuet: false,
		startTime: timed[0]?.startTime ?? 0,
		endTime: timed[timed.length - 1]?.endTime ?? 0,
		ignoreSync: false,
		...partial,
	};
}

function lyricOf(
	lines: LyricLine[],
	extra: Partial<TTMLLyric> = {},
): TTMLLyric {
	return { metadata: [], agents: [], lyricLines: lines, ...extra };
}

function exportAndReparse(lyric: TTMLLyric) {
	const xml = exportTTMLText(lyric, { separateSpecialSpansWithSpace: false });
	return { xml, parsed: parseLyric(xml) };
}

function deepFreeze<T>(obj: T): T {
	if (obj && typeof obj === "object") {
		for (const v of Object.values(obj)) deepFreeze(v);
		Object.freeze(obj);
	}
	return obj;
}

/** 某行在指定语言下的翻译全文（逐行或逐字均可） */
function translationText(l: LyricLine | undefined, lang: string): string {
	if (!l) return "";
	const byLine = l.translatedLyricByLang?.[lang]?.data ?? "";
	const byWord = (l.wordTranslationByLang?.[lang]?.data ?? [])
		.map((x) => x.text)
		.join(" ");
	return byLine || byWord;
}

describe("TTML roundtrip - fixtures (parse -> export -> parse)", () => {
	it("roundtrip clean.ttml (agents/duet, songPart, word timing)", () => {
		expectRoundtrip(loadFixture("clean.ttml"));
	});

	it("roundtrip multi-lang.ttml (per-line + per-word translations/transliterations, distinct langs)", () => {
		expectRoundtrip(loadFixture("multi-lang.ttml"));
	});

	it("roundtrip songwriters.ttml (iTunes songwriters)", () => {
		expectRoundtrip(loadFixture("songwriters.ttml"));
	});

	it.fails("[N1] roundtrip multi-bg.ttml (main line + 2 BG lines)", () => {
		expectRoundtrip(loadFixture("multi-bg.ttml"));
	});

	it.fails("[N4] roundtrip ruby.ttml", () => {
		expectRoundtrip(loadFixture("ruby.ttml"));
	});

	it.fails("[1.1] roundtrip untagged-translation.ttml (und transliteration skipped on export)", () => {
		expectRoundtrip(loadFixture("untagged-translation.ttml"));
	});

	it.fails("[3.6c] roundtrip empty-lines.ttml", () => {
		expectRoundtrip(loadFixture("empty-lines.ttml"));
	});
});

describe("TTML known defects (phase 0 safety net)", () => {
	it.fails("[1.1] translatedLyric/romanLyric/romanWord without *ByLang must survive export", () => {
		const lyric = lyricOf([
			line({
				words: [w("Hello", 1000, 1500), w(" ", 0, 0), w("world", 1500, 2000)],
				translatedLyric: "Plain trans",
				romanLyric: "plain roman",
			}),
		]);
		lyric.lyricLines[0].words[0].romanWord = "he";
		lyric.lyricLines[0].words[2].romanWord = "wo";
		const { parsed } = exportAndReparse(lyric);
		const l = parsed.lyricLines[0];
		expect(l.translatedLyric).toBe("Plain trans");
		expect(l.romanLyric).toBe("plain roman");
		expect(l.words.map((x) => x.romanWord)).toEqual(["he", "", "wo"]);
	});

	it.fails("[1.2] per-word translation on one line must not erase per-line translations of other lines", () => {
		// 只有当逐行翻译所在行位于逐字翻译行「之前」时才会被 map.delete 清掉
		const lyric = lyricOf([
			line({
				words: [w("One", 1000, 1500), w(" ", 0, 0), w("two", 1500, 2000)],
				translatedLyricByLang: { en: { data: "Line one trans" } },
			}),
			line({
				words: [w("Three", 3000, 3500), w(" ", 0, 0), w("four", 3500, 4000)],
				wordTranslationByLang: {
					en: {
						data: [
							{ startTime: 3000, endTime: 3500, text: "Tres" },
							{ startTime: 3500, endTime: 4000, text: "cuatro" },
						],
					},
				},
			}),
		]);
		const { xml, parsed } = exportAndReparse(lyric);
		expect(xml).toContain("Line one trans");
		expect(translationText(parsed.lyricLines[0], "en")).toContain("Line");
	});

	it.fails("[1.3] BG line that is first in a div (after an empty line) must not be dropped", () => {
		const lyric = lyricOf([
			line({
				words: [w("Main", 1000, 1500), w(" ", 0, 0), w("one", 1500, 2000)],
			}),
			line({ words: [] }),
			line({
				isBG: true,
				words: [w("Orphan", 2500, 2800), w(" ", 0, 0), w("bg", 2800, 3000)],
			}),
			line({
				words: [w("Main", 3000, 3500), w(" ", 0, 0), w("two", 3500, 4000)],
			}),
		]);
		const { xml, parsed } = exportAndReparse(lyric);
		expect(xml).toContain("Orphan");
		expect(
			parsed.lyricLines.some(
				(l) => l.isBG && l.words.some((x) => x.word === "Orphan"),
			),
		).toBe(true);
	});

	it.fails("[1.3] BG line carrying its own songPart (starts a new div) must not be dropped", () => {
		const lyric = lyricOf([
			line({
				words: [w("Main", 1000, 1500), w(" ", 0, 0), w("one", 1500, 2000)],
			}),
			line({
				isBG: true,
				songPart: "Chorus",
				words: [w("Orphan", 2500, 2800), w(" ", 0, 0), w("bg", 2800, 3000)],
			}),
			line({
				words: [w("Main", 3000, 3500), w(" ", 0, 0), w("two", 3500, 4000)],
			}),
		]);
		const { xml } = exportAndReparse(lyric);
		expect(xml).toContain("Orphan");
	});

	it.fails("[N1] parser keeps main line before its 2+ BG lines ([main, bg1, bg2])", () => {
		const parsed = parseLyric(loadFixture("multi-bg.ttml"));
		expect(parsed.lyricLines.map((l) => l.isBG)).toEqual([false, true, true]);
	});

	it.fails("[N2] isAutoFilled transliteration (written without xml:lang) must survive re-import alongside a tagged one", () => {
		const lyric = lyricOf([
			line({
				words: [w("Hello", 1000, 1500), w(" ", 0, 0), w("world", 1500, 2000)],
				romanLyricByLang: {
					"ja-Latn": { data: "auto roman", isAutoFilled: true },
					"ko-Latn": { data: "tagged roman", isAutoFilled: false },
				},
			}),
		]);
		const { xml, parsed } = exportAndReparse(lyric);
		expect(xml).toContain("auto roman");
		const values = Object.values(
			parsed.lyricLines[0].romanLyricByLang ?? {},
		).map((v) => v.data);
		expect(values).toContain("tagged roman");
		expect(values).toContain("auto roman");
	});

	it.fails("[3.6b] per-word translation of every BG line is exported when a main line has 2+ BG lines", () => {
		const lyric = lyricOf([
			line({
				words: [w("Main", 1000, 1500), w(" ", 0, 0), w("line", 1500, 2000)],
			}),
			line({
				isBG: true,
				words: [w("bgA", 2000, 2500), w(" ", 0, 0), w("x", 2500, 3000)],
				wordTranslationByLang: {
					en: {
						data: [
							{ startTime: 2000, endTime: 2500, text: "TransA" },
							{ startTime: 2500, endTime: 3000, text: "TransAx" },
						],
					},
				},
			}),
			line({
				isBG: true,
				words: [w("bgB", 3000, 3500), w(" ", 0, 0), w("y", 3500, 4000)],
				wordTranslationByLang: {
					en: {
						data: [
							{ startTime: 3000, endTime: 3500, text: "TransB" },
							{ startTime: 3500, endTime: 4000, text: "TransBy" },
						],
					},
				},
			}),
		]);
		const { xml } = exportAndReparse(lyric);
		expect(xml).toContain("TransA");
		expect(xml).toContain("TransB");
	});

	it.fails("[3.6c] empty lines survive export/re-import", () => {
		const lyric = lyricOf([
			line({
				words: [w("One", 1000, 1500), w(" ", 0, 0), w("two", 1500, 2000)],
			}),
			line({ words: [], startTime: 2000, endTime: 3000 }),
			line({
				words: [w("Three", 3000, 3500), w(" ", 0, 0), w("four", 3500, 4000)],
			}),
		]);
		const { parsed } = exportAndReparse(lyric);
		expect(parsed.lyricLines).toHaveLength(3);
		expect(parsed.lyricLines[1].words.filter((x) => x.word.trim())).toEqual([]);
	});

	it.fails("[N3] words all at 0/0 time must not all match the first per-word translation", () => {
		const lyric = lyricOf([
			line({
				words: [w("aa", 0, 0), w(" ", 0, 0), w("bb", 0, 0)],
				wordTranslationByLang: {
					en: {
						data: [
							{ startTime: 0, endTime: 0, text: "XX", hasSpaceAfter: true },
							{ startTime: 0, endTime: 0, text: "YY" },
						],
					},
				},
			}),
		]);
		const { xml } = exportAndReparse(lyric);
		expect(xml).toContain("YY");
		expect(xml.match(/>XX</g) ?? []).toHaveLength(1);
	});

	it.fails("[N4] ruby word keeps its own begin/end", () => {
		const { second } = roundtrip(loadFixture("ruby.ttml"));
		const word = second.lyricLines[0].words[0];
		expect(word.word).toBe("漢字");
		expect([word.startTime, word.endTime]).toEqual([1000, 2000]);
	});

	it.fails("[N5] non-word-by-word export emits all words of a line, not only words[0]", () => {
		// 每行至多 1 个非空白词 -> 非逐字（Line）模式
		const lyric = lyricOf([
			line({ words: [w(" ", 0, 0), w("Hello", 1000, 2000)] }),
			line({ words: [w("Second", 2000, 3000)] }),
		]);
		const { xml, parsed } = exportAndReparse(lyric);
		expect(xml).toContain("Hello");
		expect(parsed.lyricLines[0].words.map((x) => x.word).join("")).toContain(
			"Hello",
		);
	});

	it.fails("[N6] exportTTMLText does not mutate its (deep-frozen) input", () => {
		const lyric = lyricOf([
			line({
				words: [w("Hello", 1000, 1500), w(" ", 0, 0), w("world", 1500, 2000)],
			}),
		]);
		const snapshot = structuredClone(lyric);
		deepFreeze(lyric);
		expect(() =>
			exportTTMLText(lyric, { separateSpecialSpansWithSpace: false }),
		).not.toThrow();
		expect(lyric).toEqual(snapshot);
	});

	it.fails("[3.3] parseLyric throws a clear error on malformed XML", () => {
		expect(() =>
			parseLyric('<tt xmlns="http://www.w3.org/ns/ttml"><body><div></tt>'),
		).toThrow();
	});

	it.fails("[3.6a] amll:meta songwriter and iTunes songwriters both survive roundtrip", () => {
		// 浏览器中 parser 对两种来源各产出一条 songwriter entry（ttml-parser.ts L830 push 而非合并）；
		// happy-dom 下 querySelectorAll("meta") 匹配不到 amll:meta，因此这里直接构造该内存形态。
		const lyric = lyricOf(
			[
				line({
					words: [w("Hi", 1000, 1500), w(" ", 0, 0), w("there", 1500, 2000)],
				}),
			],
			{
				metadata: [
					{ key: "songwriter", value: ["Meta Writer"] },
					{ key: "songwriter", value: ["iTunes Writer A", "iTunes Writer B"] },
				],
			},
		);
		const { parsed } = exportAndReparse(lyric);
		const all = parsed.metadata
			.filter((m) => m.key === "songwriter")
			.flatMap((m) => m.value);
		expect(new Set(all)).toEqual(
			new Set(["Meta Writer", "iTunes Writer A", "iTunes Writer B"]),
		);
	});
});
