// @vitest-environment happy-dom

import * as fs from "node:fs";
import * as path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { LyricLine, LyricWord, TTMLLyric } from "../../../types/ttml.ts";
import { parseLyric } from "./ttml-parser.ts";
import exportTTMLText, { collectExportIssues } from "./ttml-writer.ts";

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

	it("[N1] roundtrip multi-bg.ttml (main line + 2 BG lines)", () => {
		expectRoundtrip(loadFixture("multi-bg.ttml"));
	});

	// AMLL TTML DB 格式规范 Ruby 标注：仅 tts:ruby="text" 携带时间，base 不得含时间戳。
	// 因此 writer 不在 ruby 容器上写时间（维持阶段 1A 之前的输出），回读后单词时间为其注音时间范围。
	it("[N4 spec] roundtrip ruby.ttml keeps the four-layer structure without container timing", () => {
		const { first, exported, second } = roundtrip(loadFixture("ruby.ttml"));
		expect(exported).toContain(
			'<span tts:ruby="container"><span tts:ruby="base">漢字</span><span tts:ruby="textContainer"><span tts:ruby="text" begin="00:01.200" end="00:01.500">かん</span><span tts:ruby="text" begin="00:01.500" end="00:01.800">じ</span></span></span>',
		);
		const [w1, w2] = second.lyricLines[0].words;
		expect(w1.word).toBe("漢字");
		expect(w1.ruby).toEqual(first.lyricLines[0].words[0].ruby);
		expect(w2).toMatchObject({ word: "です", startTime: 2000, endTime: 3000 });
	});

	// 维护者决定：无 xml:lang 的翻译/音译映射到默认语言后写出（规范要求必须带 xml:lang）
	it("[1.1] roundtrip untagged-translation.ttml (und mapped to default langs)", () => {
		const { exported } = roundtrip(loadFixture("untagged-translation.ttml"));
		expect(exported).toContain(
			'<translation xml:lang="zh-Hans" type="subtitle">',
		);
		expect(exported).toContain('<transliteration xml:lang="ja-Latn">');
		expect(exported).toContain("Untagged trans");
		expect(exported).toContain("untagged roman");
		expectRoundtrip(exported);
	});

	// 维护者决定（3.6c）：空行不在导出中保留，仅作为 div 分隔符；以下用例固定该已接受行为。
	it("[3.6c accepted] empty-lines.ttml: empty <p> is read as an empty line but dropped on export", () => {
		const { first, exported, second } = roundtrip(
			loadFixture("empty-lines.ttml"),
		);
		const texts = (l: TTMLLyric) =>
			l.lyricLines.map((x) => x.words.map((y) => y.word).join(""));
		expect(texts(first)).toEqual(["One two", "", "Three four"]);
		expect(texts(second)).toEqual(["One two", "Three four"]);
		// 空行作为 div 分隔符：两个 div，各含一个 <p>
		expect(exported.match(/<div /g) ?? []).toHaveLength(2);
		expect(exported.match(/<p /g) ?? []).toHaveLength(2);
	});
});

describe("TTML known defects (phase 0 safety net)", () => {
	it("[1.1] translatedLyric/romanLyric/romanWord without *ByLang must survive export", () => {
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

	it("[1.2] per-word translation on one line must not erase per-line translations of other lines", () => {
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

	it("[1.3] BG line that is first in a div (after an empty line) must not be dropped", () => {
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

	it("[1.3] BG line carrying its own songPart (starts a new div) must not be dropped", () => {
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

	it("[N1] parser keeps main line before its 2+ BG lines ([main, bg1, bg2])", () => {
		const parsed = parseLyric(loadFixture("multi-bg.ttml"));
		expect(parsed.lyricLines.map((l) => l.isBG)).toEqual([false, true, true]);
	});

	it("[N2] isAutoFilled transliteration (written without xml:lang) must survive re-import alongside a tagged one", () => {
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

	// 维护者决定：und/unknown 映射到默认语言后写出 xml:lang。
	// 若该语言已被真实数据占用，保留真实数据、丢弃映射项，并由 collectExportIssues 报出冲突。
	it("[N2] several auto-filled languages on one line keep distinct languages; conflicting untagged entry is reported", () => {
		const lyric = lyricOf([
			line({
				words: [w("Hello", 1000, 1500), w(" ", 0, 0), w("world", 1500, 2000)],
				romanLyricByLang: {
					"ja-Latn": { data: "auto ja", isAutoFilled: true },
					"zh-Latn-pinyin": { data: "auto zh", isAutoFilled: true },
					und: { data: "real und", isAutoFilled: true },
					"ko-Latn": { data: "tagged ko", isAutoFilled: false },
				},
			}),
		]);
		const { xml, parsed } = exportAndReparse(lyric);
		// 每个语言块都带 xml:lang（规范要求）
		expect(xml).toContain('xml:lang="ja-Latn"');
		expect(xml).toContain('xml:lang="zh-Latn-pinyin"');
		expect(xml).toContain('xml:lang="ko-Latn"');
		// und 映射到默认音译语言 zh-Latn-pinyin，与已有的自动填充项内容不同 → 冲突被报出
		const issues = collectExportIssues(lyric);
		const conflict = issues.find((x) => x.type === "lang-conflict");
		expect(conflict?.lang).toBe("zh-Latn-pinyin");
		expect(conflict?.lineNumber).toBe(1);
		// 保留已有数据，不静默丢弃也不覆盖
		const values = Object.values(
			parsed.lyricLines[0].romanLyricByLang ?? {},
		).map((v) => v.data);
		expect(values).toEqual(
			expect.arrayContaining(["auto ja", "auto zh", "tagged ko"]),
		);
		// 一次往返后稳定
		const again = exportTTMLText(parsed, {
			separateSpecialSpansWithSpace: false,
		});
		expect(
			exportTTMLText(parseLyric(again), {
				separateSpecialSpansWithSpace: false,
			}),
		).toBe(again);
	});

	it("[3.6b] per-word translation of every BG line is exported when a main line has 2+ BG lines", () => {
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

	it("[3.6b] per-line / per-word data of each BG line is restored onto that BG line (with a gap)", () => {
		const lyric = lyricOf([
			line({
				words: [w("Main", 1000, 1500), w(" ", 0, 0), w("line", 1500, 2000)],
			}),
			line({
				isBG: true,
				words: [w("bgA", 2000, 2500), w(" ", 0, 0), w("x", 2500, 3000)],
			}),
			line({
				isBG: true,
				words: [w("bgB", 3000, 3500), w(" ", 0, 0), w("y", 3500, 4000)],
				translatedLyricByLang: { en: { data: "Line B", isAutoFilled: false } },
				wordRomanizationByLang: {
					"ja-Latn": {
						data: [
							{
								startTime: 3000,
								endTime: 3500,
								text: "rb",
								hasSpaceAfter: true,
							},
							{
								startTime: 3500,
								endTime: 4000,
								text: "ry",
								hasSpaceAfter: false,
							},
						],
						isAutoFilled: false,
					},
				},
			}),
		]);
		const { parsed } = exportAndReparse(lyric);
		const [main, bgA, bgB] = parsed.lyricLines;
		expect(parsed.lyricLines.map((l) => l.isBG)).toEqual([false, true, true]);
		expect(main.translatedLyricByLang?.en?.data ?? "").toBe("");
		expect(bgA.translatedLyricByLang?.en?.data ?? "").toBe("");
		expect(bgB.translatedLyricByLang?.en?.data).toBe("Line B");
		expect(bgA.wordRomanizationByLang?.["ja-Latn"]).toBeUndefined();
		expect(
			bgB.wordRomanizationByLang?.["ja-Latn"]?.data.map((x) => x.text),
		).toEqual(["rb", "ry"]);
		expect(bgB.words.map((x) => x.romanWord)).toEqual(["rb", "", "ry"]);
	});

	it("[3.6c accepted] empty line -> div break; consecutive / leading / trailing empty lines collapse", () => {
		const lyric = lyricOf([
			line({ words: [] }),
			line({
				words: [w("One", 1000, 1500), w(" ", 0, 0), w("two", 1500, 2000)],
			}),
			line({ words: [], startTime: 2000, endTime: 3000 }),
			line({ words: [], startTime: 2000, endTime: 3000 }),
			line({
				words: [w("Three", 3000, 3500), w(" ", 0, 0), w("four", 3500, 4000)],
			}),
			line({ words: [] }),
		]);
		const { xml, parsed } = exportAndReparse(lyric);
		const divs = xml.match(/<div [^>]*>.*?<\/div>/g) ?? [];
		expect(divs).toHaveLength(2);
		expect(divs[0]).toContain("One");
		expect(divs[1]).toContain("Three");
		expect(xml.match(/<p /g) ?? []).toHaveLength(2);
		expect(
			parsed.lyricLines.map((x) => x.words.map((y) => y.word).join("")),
		).toEqual(["One two", "Three four"]);
	});

	it("[N3] words all at 0/0 time must not all match the first per-word translation", () => {
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

	// AMLL TTML DB 格式规范 Ruby 标注：仅 tts:ruby="text" 携带时间，base 不得含时间戳。
	it("[N4 spec] ruby word time equals the range of its ruby text times", () => {
		const { second } = roundtrip(loadFixture("ruby.ttml"));
		const word = second.lyricLines[0].words[0];
		expect(word.word).toBe("漢字");
		expect([word.startTime, word.endTime]).toEqual([1200, 1800]);
	});

	it("[N5] non-word-by-word export emits all words of a line, not only words[0]", () => {
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

	it("[N5] non-word-by-word export concatenates all words of a line (whitespace words included)", () => {
		// Line 模式下每行至多一个非空白单词，因此「多个单词」即首尾带空白单词
		const lyric = lyricOf([
			line({ words: [w("Main", 500, 900)] }),
			line({
				isBG: true,
				words: [w(" ", 0, 0), w("bg", 900, 1000), w(" ", 0, 0)],
			}),
			line({ words: [w(" ", 0, 0), w("Hello", 1000, 2000), w(" ", 0, 0)] }),
			line({ words: [w("Second", 2000, 3000)] }),
		]);
		const { xml, parsed } = exportAndReparse(lyric);
		expect(xml).toContain(
			'<span ttm:role="x-bg" begin="00:00.900" end="00:01.000"> <span begin="00:00.900" end="00:01.000">(bg)</span> </span>',
		);
		expect(xml).toContain(
			'itunes:key="L2"> <span begin="00:01.000" end="00:02.000">Hello</span> </p>',
		);
		// 单单词行与旧输出一致
		expect(xml).toContain(
			'itunes:key="L3"><span begin="00:02.000" end="00:03.000">Second</span></p>',
		);
		expect(
			parsed.lyricLines.map((l) => l.words.map((x) => x.word).join("")),
		).toEqual(["Main", "bg", "Hello", "Second"]);
	});

	it("[N5] non-word-by-word export does not crash on BG lines without words", () => {
		const lyric = lyricOf([
			line({ words: [w("Hello", 1000, 2000)] }),
			line({ isBG: true, words: [] }),
			line({ isBG: true, words: [w(" ", 0, 0)] }),
			line({ words: [w("Second", 2000, 3000)] }),
		]);
		const { parsed } = exportAndReparse(lyric);
		expect(
			parsed.lyricLines.filter((l) => !l.isBG).map((l) => l.words[0]?.word),
		).toEqual(["Hello", "Second"]);
	});

	it("[N6] exportTTMLText does not mutate its (deep-frozen) input", () => {
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

	it("[3.3] parseLyric throws a clear error on malformed XML", () => {
		expect(() =>
			parseLyric('<tt xmlns="http://www.w3.org/ns/ttml"><body><div></tt>'),
		).toThrow(/XML/);
	});

	it("[3.6a] amll:meta songwriter and iTunes songwriters both survive roundtrip", () => {
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

describe("TTML fix items 3, 4, 5", () => {
	// Item 3: msToTimestamp 对非有限数（undefined / NaN）归零，不产生 NaN:000NaN
	it("[item3] undefined word time is coerced to 0 instead of emitting NaN:000NaN", () => {
		const bad = w("B", 0, 0);
		// biome-ignore lint/suspicious/noExplicitAny: 模拟未初始化时间
		(bad as any).startTime = undefined;
		// biome-ignore lint/suspicious/noExplicitAny: 模拟未初始化时间
		(bad as any).endTime = undefined;
		const lyric = lyricOf([
			line({
				words: [w("A", 1000, 2000), bad],
				startTime: 1000,
				endTime: 3000,
			}),
		]);
		const { xml } = exportAndReparse(lyric);
		expect(xml).not.toContain("NaN");
		expect(xml).toContain('begin="00:00.000"');
	});

	it("[item3] collectExportIssues reports invalid-time for undefined word time", () => {
		const bad = w("B", 0, 0);
		// biome-ignore lint/suspicious/noExplicitAny: 模拟未初始化时间
		(bad as any).startTime = undefined;
		// biome-ignore lint/suspicious/noExplicitAny: 模拟未初始化时间
		(bad as any).endTime = undefined;
		const lyric = lyricOf([
			line({
				words: [w("A", 1000, 2000), bad],
				startTime: 1000,
				endTime: 3000,
			}),
		]);
		const issues = collectExportIssues(lyric);
		const inv = issues.find((x) => x.type === "invalid-time");
		expect(inv).toBeDefined();
		expect(inv?.lineNumber).toBe(1);
		expect(inv?.message).toContain("第 1 行");
	});

	it("[item3] itunes:timing is None (not Word) when all words have 0/0 time (all-zero lines must not falsely trigger Word)", () => {
		const lyric = lyricOf([line({ words: [w("A", 0, 0), w("B", 0, 0)] })]);
		const { xml } = exportAndReparse(lyric);
		expect(xml).toContain('itunes:timing="None"');
	});

	// Item 4: 同一 (lang, Lx) 在 transliteration 块内只能出现一个 <text for>
	it("[item4] explicit wordRomanizationByLang replaces romanLyricByLang for same lang/key, no duplicate <text for>", () => {
		const lyric = lyricOf([
			line({
				words: [w("Hello", 1000, 1500), w(" ", 0, 0), w("world", 1500, 2000)],
				startTime: 1000,
				endTime: 2000,
				romanLyricByLang: { "ja-Latn": { data: "line roman" } },
				wordRomanizationByLang: {
					"ja-Latn": {
						data: [
							{ startTime: 1000, endTime: 1500, text: "he" },
							{ startTime: 1500, endTime: 2000, text: "wo" },
						],
					},
				},
			}),
		]);
		const { xml } = exportAndReparse(lyric);
		// 仅允许一个 <text for="L1">
		const matches = [...xml.matchAll(/<text for="L1"/g)];
		expect(matches).toHaveLength(1);
		// 写出逐字内容（word-level 优先）
		expect(xml).toContain("he");
		expect(xml).toContain("wo");
		// 不写出逐行 roman（已被逐字替代）
		expect(xml).not.toContain("line roman");
	});

	it("[item4] word.romanWord fallback coexists with romanLyric (not deduplicated)", () => {
		// word.romanWord 回退（fromWords=true）不覆盖同语言的 romanLyric
		const lyric = lyricOf([
			line({
				words: [w("Hello", 1000, 1500), w(" ", 0, 0), w("world", 1500, 2000)],
				startTime: 1000,
				endTime: 2000,
				translatedLyric: "Plain trans",
				romanLyric: "plain roman",
			}),
		]);
		lyric.lyricLines[0].words[0].romanWord = "he";
		lyric.lyricLines[0].words[2].romanWord = "wo";
		const { parsed } = exportAndReparse(lyric);
		const l = parsed.lyricLines[0];
		expect(l.romanLyric).toBe("plain roman");
		expect(l.words.map((x) => x.romanWord)).toEqual(["he", "", "wo"]);
	});

	// Item 5: BG 括号恰好一对，已有括号不变成双层
	it("[item5] BG dynamic mode: text with parens is not double-wrapped ((oh → (oh)", () => {
		const lyric = lyricOf([
			line({
				words: [w("Main", 1000, 1500), w(" ", 0, 0), w("line", 1500, 2000)],
				startTime: 1000,
				endTime: 2000,
			}),
			line({
				isBG: true,
				words: [w("(oh", 2000, 2500), w(" ", 0, 0), w("yeah)", 2500, 3000)],
				startTime: 2000,
				endTime: 3000,
			}),
		]);
		const { xml } = exportAndReparse(lyric);
		expect(xml).not.toContain("((oh");
		expect(xml).not.toContain("yeah))");
		expect(xml).toContain("(oh");
		expect(xml).toContain("yeah)");
	});

	it("[item5] BG line mode: text with parens is not double-wrapped", () => {
		// 每行至多1个非空白词 → Line 模式
		const lyric = lyricOf([
			line({ words: [w("Main", 500, 900)], startTime: 500, endTime: 900 }),
			line({
				isBG: true,
				words: [w("(oh yeah)", 900, 1200)],
				startTime: 900,
				endTime: 1200,
			}),
			line({
				words: [w("Second", 1200, 2000)],
				startTime: 1200,
				endTime: 2000,
			}),
		]);
		const { xml } = exportAndReparse(lyric);
		expect(xml).not.toContain("((oh yeah)");
		expect(xml).not.toContain("(oh yeah))");
		expect(xml).toContain("(oh yeah)");
	});

	it("[item5] BG dynamic mode: text without parens gets exactly one pair added", () => {
		const lyric = lyricOf([
			line({
				words: [w("Main", 1000, 1500), w(" ", 0, 0), w("line", 1500, 2000)],
				startTime: 1000,
				endTime: 2000,
			}),
			line({
				isBG: true,
				words: [w("oh", 2000, 2500), w(" ", 0, 0), w("yeah", 2500, 3000)],
				startTime: 2000,
				endTime: 3000,
			}),
		]);
		const { xml } = exportAndReparse(lyric);
		expect(xml).toContain("(oh");
		expect(xml).toContain("yeah)");
	});
});
