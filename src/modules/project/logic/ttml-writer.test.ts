// @vitest-environment happy-dom

import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import type { LyricLine, LyricWord, TTMLLyric } from "../../../types/ttml.ts";
import { parseLyric } from "./ttml-parser.ts";
import exportTTMLText, { type ExportTTMLOptions } from "./ttml-writer.ts";

type WordInput =
	| string
	| [word: string, start: number, end: number]
	| Partial<LyricWord>;

function makeWord(
	input: WordInput,
	defaultStart = 0,
	defaultEnd = 0,
): LyricWord {
	if (typeof input === "string") {
		return {
			id: `w-${Math.random().toString(36).slice(2, 7)}`,
			word: input,
			startTime: defaultStart,
			endTime: defaultEnd,
			obscene: false,
			emptyBeat: 0,
			romanWord: "",
			rubyPhraseStart: false,
		};
	}
	if (Array.isArray(input)) {
		return {
			id: `w-${Math.random().toString(36).slice(2, 7)}`,
			word: input[0],
			startTime: input[1],
			endTime: input[2],
			obscene: false,
			emptyBeat: 0,
			romanWord: "",
			rubyPhraseStart: false,
		};
	}
	return {
		id: `w-${Math.random().toString(36).slice(2, 7)}`,
		word: "",
		startTime: defaultStart,
		endTime: defaultEnd,
		obscene: false,
		emptyBeat: 0,
		romanWord: "",
		rubyPhraseStart: false,
		...input,
	};
}

interface LineInput extends Partial<Omit<LyricLine, "words">> {
	words?: WordInput[];
	start?: number;
	end?: number;
}

function makeLine(input: LineInput): LyricLine {
	const startTime = input.start ?? input.startTime ?? 0;
	const endTime = input.end ?? input.endTime ?? 0;
	const words = (input.words ?? []).map((w) => makeWord(w, startTime, endTime));
	return {
		id: input.id ?? `line-${Math.random().toString(36).slice(2, 7)}`,
		translatedLyric: "",
		romanLyric: "",
		isBG: false,
		isDuet: false,
		ignoreSync: false,
		...input,
		startTime,
		endTime,
		words,
	};
}

function mockLyric(lines: (LineInput | LyricLine)[]): TTMLLyric {
	return {
		metadata: [],
		agents: [],
		lyricLines: lines.map((l) =>
			"id" in l &&
			Array.isArray(l.words) &&
			typeof l.words[0] === "object" &&
			"id" in (l.words[0] ?? {})
				? (l as LyricLine)
				: makeLine(l),
		),
	};
}

function exportAndParse(lyric: TTMLLyric, options?: ExportTTMLOptions) {
	const xml = exportTTMLText(lyric, options);
	const doc = new DOMParser().parseFromString(xml, "application/xml");
	return {
		xml,
		doc,
		p: doc.querySelector("p"),
		ps: Array.from(doc.querySelectorAll("p")),
		div: doc.querySelector("div"),
		divs: Array.from(doc.querySelectorAll("div")),
	};
}

describe("exportTTMLText - <p> timeline encompasses all spans", () => {
	it("should encompass x-bg span that begins earlier than main line", () => {
		const { p } = exportAndParse(
			mockLyric([
				{
					start: 10000,
					end: 15000,
					words: [
						["Hello", 10000, 12000],
						["world", 12000, 15000],
					],
				},
				{ isBG: true, start: 8000, end: 13000, words: [["echo", 8000, 13000]] },
			]),
		);

		expect(p).not.toBeNull();
		expect(p?.getAttribute("begin")).toBe("00:08.000");
		expect(p?.getAttribute("end")).toBe("00:15.000");

		const bgSpan = p?.querySelector('span[ttm\\:role="x-bg"]');
		expect(bgSpan).not.toBeNull();
		expect(bgSpan?.getAttribute("begin")).toBe("00:08.000");
		expect(bgSpan?.getAttribute("end")).toBe("00:13.000");
		expect(p?.firstElementChild).toBe(bgSpan);
		expect(bgSpan?.hasAttribute("xmlns")).toBe(false);
		expect(bgSpan?.hasAttribute("xmlns:ttm")).toBe(false);
	});

	it("should encompass x-bg span that ends later than main line", () => {
		const { p } = exportAndParse(
			mockLyric([
				{
					start: 10000,
					end: 15000,
					words: [
						["Hello", 10000, 12000],
						["world", 12000, 15000],
					],
				},
				{
					isBG: true,
					start: 12000,
					end: 18000,
					words: [["echo", 12000, 18000]],
				},
			]),
		);

		expect(p).not.toBeNull();
		expect(p?.getAttribute("begin")).toBe("00:10.000");
		expect(p?.getAttribute("end")).toBe("00:18.000");
		expect(p?.lastElementChild).toBe(
			p?.querySelector('span[ttm\\:role="x-bg"]'),
		);
	});

	it("should encompass x-bg span that both starts earlier and ends later", () => {
		const { p } = exportAndParse(
			mockLyric([
				{
					start: 10000,
					end: 15000,
					words: [
						["Hello", 10000, 12000],
						["world", 12000, 15000],
					],
				},
				{
					isBG: true,
					start: 7000,
					end: 19000,
					words: [["background", 7000, 19000]],
				},
			]),
		);

		expect(p).not.toBeNull();
		expect(p?.getAttribute("begin")).toBe("00:07.000");
		expect(p?.getAttribute("end")).toBe("00:19.000");
	});

	it("should encompass multiple background lines", () => {
		const { p } = exportAndParse(
			mockLyric([
				{
					start: 10000,
					end: 15000,
					words: [
						["Main", 10000, 12000],
						["Line", 12000, 15000],
					],
				},
				{ isBG: true, start: 8500, end: 13000, words: [["bg1", 8500, 13000]] },
				{
					isBG: true,
					start: 14000,
					end: 17500,
					words: [["bg2", 14000, 17500]],
				},
			]),
		);

		expect(p).not.toBeNull();
		expect(p?.getAttribute("begin")).toBe("00:08.500");
		expect(p?.getAttribute("end")).toBe("00:17.500");
	});

	it("should encompass x-bg in static (line-by-line) lyrics mode", () => {
		const { p } = exportAndParse(
			mockLyric([
				{
					start: 10000,
					end: 15000,
					words: [["Whole line text", 10000, 15000]],
				},
				{
					isBG: true,
					start: 8000,
					end: 18000,
					words: [["Whole bg text", 8000, 18000]],
				},
			]),
		);

		expect(p).not.toBeNull();
		expect(p?.getAttribute("begin")).toBe("00:08.000");
		expect(p?.getAttribute("end")).toBe("00:18.000");
	});

	it("should preserve standard line time when no bg and spans are within bounds", () => {
		const { p } = exportAndParse(
			mockLyric([
				{
					start: 10000,
					end: 15000,
					words: [
						["One", 10000, 12000],
						["Two", 12000, 15000],
					],
				},
			]),
		);

		expect(p).not.toBeNull();
		expect(p?.getAttribute("begin")).toBe("00:10.000");
		expect(p?.getAttribute("end")).toBe("00:15.000");
	});

	it("should encompass div around p elements", () => {
		const { div } = exportAndParse(
			mockLyric([
				{
					start: 10000,
					end: 15000,
					words: [
						["Hello", 10000, 12000],
						["world", 12000, 15000],
					],
				},
				{ isBG: true, start: 8000, end: 18000, words: [["echo", 8000, 18000]] },
			]),
		);

		expect(div).not.toBeNull();
		expect(div?.getAttribute("begin")).toBe("00:08.000");
		expect(div?.getAttribute("end")).toBe("00:18.000");
	});

	it("should handle multiple lines in one div with different x-bg offsets", () => {
		const { ps, div } = exportAndParse(
			mockLyric([
				{ start: 10000, end: 15000, words: [["First", 10000, 15000]] },
				{
					isBG: true,
					start: 8000,
					end: 14000,
					words: [["bgFirst", 8000, 14000]],
				},
				{ start: 20000, end: 25000, words: [["Second", 20000, 25000]] },
				{
					isBG: true,
					start: 22000,
					end: 28000,
					words: [["bgSecond", 22000, 28000]],
				},
			]),
		);

		expect(ps.length).toBe(2);
		expect(ps[0].getAttribute("begin")).toBe("00:08.000");
		expect(ps[0].getAttribute("end")).toBe("00:15.000");
		expect(ps[1].getAttribute("begin")).toBe("00:20.000");
		expect(ps[1].getAttribute("end")).toBe("00:28.000");

		expect(div?.getAttribute("begin")).toBe("00:08.000");
		expect(div?.getAttribute("end")).toBe("00:28.000");
	});

	it("should handle background line with multiple timed words", () => {
		const { p } = exportAndParse(
			mockLyric([
				{ start: 10000, end: 15000, words: [["Main", 10000, 15000]] },
				{
					isBG: true,
					start: 7500,
					end: 16500,
					words: [
						["Part1", 7500, 11000],
						["Part2", 11000, 16500],
					],
				},
			]),
		);

		expect(p?.getAttribute("begin")).toBe("00:07.500");
		expect(p?.getAttribute("end")).toBe("00:16.500");
	});
});

describe("exportTTMLText - leading x-bg placement", () => {
	it("should prepend x-bg span before main words when x-bg starts earlier than main line", () => {
		const { p } = exportAndParse(
			mockLyric([
				{
					start: 10000,
					end: 15000,
					words: [
						["Hello", 10000, 12000],
						[" world", 12000, 15000],
					],
				},
				{ isBG: true, start: 8000, end: 9500, words: [["lead", 8000, 9500]] },
			]),
		);

		expect(p).not.toBeNull();
		const children = Array.from(p?.children ?? []);
		expect(children.length).toBe(3);

		// 第一个子元素应为前置的 x-bg span
		expect(children[0].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[0].textContent).toBe("(lead)");
		expect(children[0].getAttribute("begin")).toBe("00:08.000");

		// 后续子元素为主行音节
		expect(children[1].textContent).toBe("Hello");
		expect(children[2].textContent).toBe(" world");

		// 时间轴依然正确囊括全部区间
		expect(p?.getAttribute("begin")).toBe("00:08.000");
		expect(p?.getAttribute("end")).toBe("00:15.000");
	});

	it("should append x-bg span after main words when x-bg starts later than main line", () => {
		const { p } = exportAndParse(
			mockLyric([
				{
					start: 10000,
					end: 15000,
					words: [
						["Hello", 10000, 12000],
						[" world", 12000, 15000],
					],
				},
				{
					isBG: true,
					start: 13000,
					end: 16000,
					words: [["trail", 13000, 16000]],
				},
			]),
		);

		const children = Array.from(p?.children ?? []);
		expect(children.length).toBe(3);
		expect(children[0].textContent).toBe("Hello");
		expect(children[1].textContent).toBe(" world");
		expect(children[2].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[2].textContent).toBe("(trail)");
	});

	it("should append x-bg span after main words when x-bg starts at exactly the same time as main line", () => {
		const { p } = exportAndParse(
			mockLyric([
				{ start: 10000, end: 15000, words: [["Hello", 10000, 15000]] },
				{
					isBG: true,
					start: 10000,
					end: 13000,
					words: [["same", 10000, 13000]],
				},
			]),
		);

		const children = Array.from(p?.children ?? []);
		expect(children.length).toBe(2);
		expect(children[0].textContent).toBe("Hello");
		expect(children[1].getAttribute("ttm:role")).toBe("x-bg");
	});

	it("should handle mixed multiple background lines (leading and trailing)", () => {
		const { p } = exportAndParse(
			mockLyric([
				{ start: 10000, end: 15000, words: [["Main", 10000, 15000]] },
				{
					isBG: true,
					start: 7000,
					end: 9000,
					words: [["Intro-BG", 7000, 9000]],
				},
				{
					isBG: true,
					start: 13000,
					end: 17000,
					words: [["Outro-BG", 13000, 17000]],
				},
			]),
		);

		const children = Array.from(p?.children ?? []);
		expect(children.length).toBe(3);
		expect(children[0].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[0].textContent).toBe("(Intro-BG)");
		expect(children[1].textContent).toBe("Main");
		expect(children[2].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[2].textContent).toBe("(Outro-BG)");
		expect(p?.getAttribute("begin")).toBe("00:07.000");
		expect(p?.getAttribute("end")).toBe("00:17.000");
	});

	it("should prepend multiple background lines if all start earlier than main line", () => {
		const { p } = exportAndParse(
			mockLyric([
				{ start: 10000, end: 15000, words: [["Main", 10000, 15000]] },
				{ isBG: true, start: 6000, end: 8000, words: [["BG1", 6000, 8000]] },
				{ isBG: true, start: 8000, end: 9500, words: [["BG2", 8000, 9500]] },
			]),
		);

		const children = Array.from(p?.children ?? []);
		expect(children.length).toBe(3);
		expect(children[0].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[0].textContent).toBe("(BG1)");
		expect(children[1].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[1].textContent).toBe("(BG2)");
		expect(children[2].textContent).toBe("Main");
	});

	it("should prepend x-bg in static lyric mode when x-bg starts earlier than main line", () => {
		const { p } = exportAndParse(
			mockLyric([
				{ start: 10000, end: 15000, words: [["Static Main", 10000, 15000]] },
				{
					isBG: true,
					start: 7000,
					end: 9000,
					words: [["Static BG", 7000, 9000]],
				},
			]),
		);

		const children = Array.from(p?.children ?? []);
		expect(children.length).toBe(2);
		expect(children[0].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[0].textContent).toBe("(Static BG)");
		expect(children[1].textContent).toBe("Static Main");
		expect(p?.getAttribute("begin")).toBe("00:07.000");
		expect(p?.getAttribute("end")).toBe("00:15.000");
	});
});

describe("exportTTMLText - special spans space isolation (experimental)", () => {
	it("should not insert space separator by default or when option is false", () => {
		const lyric = mockLyric([
			{ start: 1000, end: 3000, words: [["Main", 1000, 3000]] },
			{ isBG: true, start: 2000, end: 4000, words: [["Bg", 2000, 4000]] },
		]);

		const { p: pDefault } = exportAndParse(lyric);
		const bgSpanDefault = pDefault?.querySelector('span[ttm\\:role="x-bg"]');
		expect(bgSpanDefault?.previousSibling?.nodeType).toBe(Node.ELEMENT_NODE);

		const { p: pFalse } = exportAndParse(lyric, {
			separateSpecialSpansWithSpace: false,
		});
		const bgSpanFalse = pFalse?.querySelector('span[ttm\\:role="x-bg"]');
		expect(bgSpanFalse?.previousSibling?.nodeType).toBe(Node.ELEMENT_NODE);
	});

	it("should isolate post-bg span with space when enabled", () => {
		const { p } = exportAndParse(
			mockLyric([
				{ start: 1000, end: 3000, words: [["Hello", 1000, 3000]] },
				{ isBG: true, start: 2000, end: 4000, words: [["World", 2000, 4000]] },
			]),
			{ separateSpecialSpansWithSpace: true },
		);

		const bgSpan = p?.querySelector('span[ttm\\:role="x-bg"]');
		expect(bgSpan).not.toBeNull();
		const prev = bgSpan?.previousSibling;
		expect(prev?.nodeType).toBe(Node.TEXT_NODE);
		expect(prev?.textContent).toBe(" ");
	});

	it("should isolate pre-bg span with space when enabled", () => {
		const { p } = exportAndParse(
			mockLyric([
				{ start: 5000, end: 8000, words: [["Main", 5000, 8000]] },
				{ isBG: true, start: 2000, end: 4000, words: [["Intro", 2000, 4000]] },
			]),
			{ separateSpecialSpansWithSpace: true },
		);

		const bgSpan = p?.querySelector('span[ttm\\:role="x-bg"]');
		expect(bgSpan).not.toBeNull();
		const next = bgSpan?.nextSibling;
		expect(next?.nodeType).toBe(Node.TEXT_NODE);
		expect(next?.textContent).toBe(" ");
	});

	it("should isolate multiple consecutive bg spans with spaces", () => {
		const { p } = exportAndParse(
			mockLyric([
				{ start: 1000, end: 3000, words: [["Main", 1000, 3000]] },
				{ isBG: true, start: 2000, end: 3500, words: [["Bg1", 2000, 3500]] },
				{ isBG: true, start: 2500, end: 4000, words: [["Bg2", 2500, 4000]] },
			]),
			{ separateSpecialSpansWithSpace: true },
		);

		const bgSpans = p?.querySelectorAll('span[ttm\\:role="x-bg"]');
		expect(bgSpans?.length).toBe(2);
		expect(bgSpans?.[0].previousSibling?.nodeType).toBe(Node.TEXT_NODE);
		expect(bgSpans?.[0].previousSibling?.textContent).toBe(" ");
		expect(bgSpans?.[1].previousSibling?.nodeType).toBe(Node.TEXT_NODE);
		expect(bgSpans?.[1].previousSibling?.textContent).toBe(" ");
	});

	it("should not insert duplicate space if main line already ends with whitespace", () => {
		const { p } = exportAndParse(
			mockLyric([
				{
					start: 1000,
					end: 3000,
					words: [
						["Hello", 1000, 2500],
						[" ", 0, 0],
					],
				},
				{ isBG: true, start: 2000, end: 4000, words: [["World", 2000, 4000]] },
			]),
			{ separateSpecialSpansWithSpace: true },
		);

		const bgSpan = p?.querySelector('span[ttm\\:role="x-bg"]');
		const prev = bgSpan?.previousSibling;
		expect(prev?.nodeType).toBe(Node.TEXT_NODE);
		expect(prev?.textContent).toBe(" ");
		expect(prev?.previousSibling?.nodeType).toBe(Node.ELEMENT_NODE);
	});

	it("should isolate bg translations and transliterations with space when enabled", () => {
		const lyric = mockLyric([
			{
				start: 1000,
				end: 3000,
				words: [["主歌词", 1000, 3000]],
				translatedLyricByLang: { en: { data: "Main Trans" } },
				romanLyricByLang: { en: { data: "main roman" } },
			},
			{
				isBG: true,
				start: 2000,
				end: 4000,
				words: [["背景词", 2000, 4000]],
				translatedLyricByLang: { en: { data: "Bg Trans" } },
				romanLyricByLang: { en: { data: "bg roman" } },
			},
		]);

		const { doc: docDisabled } = exportAndParse(lyric, {
			separateSpecialSpansWithSpace: false,
		});
		const transBgDisabled = docDisabled.querySelector(
			"translations translation text span[ttm\\:role='x-bg']",
		);
		expect(transBgDisabled?.previousSibling?.textContent).toBe("Main Trans");

		const { doc: docEnabled } = exportAndParse(lyric, {
			separateSpecialSpansWithSpace: true,
		});
		const transBg = docEnabled.querySelector(
			"translations translation text span[ttm\\:role='x-bg']",
		);
		expect(transBg?.previousSibling?.nodeType).toBe(Node.TEXT_NODE);
		expect(transBg?.previousSibling?.textContent?.endsWith(" ")).toBe(true);

		const romanBg = docEnabled.querySelector(
			"transliterations transliteration text span[ttm\\:role='x-bg']",
		);
		expect(romanBg?.previousSibling?.nodeType).toBe(Node.TEXT_NODE);
		expect(romanBg?.previousSibling?.textContent?.endsWith(" ")).toBe(true);
	});

	it("should parse back cleanly with parseLyric (round-trip test)", () => {
		const { xml } = exportAndParse(
			mockLyric([
				{
					start: 1000,
					end: 5000,
					words: [
						["Hello", 1000, 2500],
						["world", 2500, 5000],
					],
					translatedLyricByLang: { en: { data: "Hello world trans" } },
				},
				{
					isBG: true,
					start: 3000,
					end: 6000,
					words: [["Background", 3000, 6000]],
					translatedLyricByLang: { en: { data: "Background trans" } },
				},
			]),
			{ separateSpecialSpansWithSpace: true },
		);

		const parsed = parseLyric(xml);
		expect(parsed.lyricLines.length).toBe(2);
		expect(parsed.lyricLines[0].isBG).toBe(false);
		expect(parsed.lyricLines[1].isBG).toBe(true);
		expect(parsed.lyricLines[0].words.map((w) => w.word)).toEqual([
			"Hello",
			"world",
		]);
		expect(parsed.lyricLines[1].words.map((w) => w.word)).toEqual([
			"Background",
		]);
		expect(parsed.lyricLines[0].translatedLyricByLang?.en?.data).toBe(
			"Hello world trans",
		);
		expect(parsed.lyricLines[1].translatedLyricByLang?.en?.data).toBe(
			"Background trans",
		);
	});

	it("should ignore pre-bg isolation space on import without adding extra empty word to main line, while preserving normal inter-word spaces", () => {
		const ttml = `
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal">
  <body>
    <div>
      <p begin="01:00.000" end="01:05.000">
        <span ttm:role="x-bg" begin="01:00.000" end="01:02.000"><span begin="01:00.000" end="01:02.000">(BG)</span></span> <span begin="01:02.500" end="01:03.500">Hello</span> <span begin="01:03.500" end="01:04.500">world</span>
      </p>
    </div>
  </body>
</tt>`;
		const parsed = parseLyric(ttml);
		expect(parsed.lyricLines.length).toBe(2);
		expect(parsed.lyricLines[1].isBG).toBe(true);
		expect(parsed.lyricLines[1].words.map((w) => w.word)).toEqual(["BG"]);
		expect(parsed.lyricLines[0].isBG).toBe(false);
		expect(parsed.lyricLines[0].words.map((w) => w.word)).toEqual([
			"Hello",
			" ",
			"world",
		]);
	});

	it("should parse and round-trip JOLIN蔡依林 - 电话皇后 with pre-bg and normal spaces cleanly", () => {
		const filePath = "F:\\ttml\\蔡依林\\Play\\JOLIN蔡依林 - 电话皇后.ttml";
		if (!fs.existsSync(filePath)) return;
		const raw = fs.readFileSync(filePath, "utf8");
		const parsed = parseLyric(raw);

		expect(parsed.lyricLines.filter((l) => l.isBG).length).toBe(12);

		const exported = exportTTMLText(parsed, {
			separateSpecialSpansWithSpace: true,
		});
		const reimported = parseLyric(exported);

		const l13Main = reimported.lyricLines.find(
			(l) => l.itunesKey === "L13" && !l.isBG,
		);
		expect(l13Main?.words.map((w) => w.word)).toEqual(["爱", "上", "我", "吧"]);

		const l25Main = reimported.lyricLines.find((l) => l.itunesKey === "L25");
		expect(l25Main?.words.map((w) => w.word)).toEqual([
			"One,",
			" ",
			"two,",
			" ",
			"three",
			" ",
			"前",
			"任",
			"算",
			"一",
			"下",
		]);

		const pMatch = exported.match(/<p\s+([^>]+)>/);
		expect(pMatch).not.toBeNull();
		expect(pMatch?.[0]).toMatch(
			/^<p\s+begin="[^"]*"\s+end="[^"]*"\s+ttm:agent="[^"]*"\s+itunes:key="[^"]*"/,
		);
	});

	it("should parse, export with space isolation, and round-trip Hebe田馥甄 - 01 大船 cleanly", () => {
		const filePath = "F:\\ttml\\Hebe田馥甄\\要去什么地方\\01 大船.ttml";
		if (!fs.existsSync(filePath)) return;
		const raw = fs.readFileSync(filePath, "utf8");
		const parsed = parseLyric(raw);

		const l13Main = parsed.lyricLines.find(
			(l) => l.itunesKey === "L13" && !l.isBG,
		);
		expect(l13Main).toBeDefined();
		expect(l13Main?.words.map((w) => w.word)).toEqual([
			"换",
			"来",
			"了",
			" ",
			"换",
			"来",
			"了",
			" ",
			"换",
			"来",
			"了",
			" ",
			"换",
			"来",
			"了",
		]);

		const exportedWithSpace = exportTTMLText(parsed, {
			separateSpecialSpansWithSpace: true,
		});
		expect(exportedWithSpace).toContain('了</span> <span ttm:role="x-bg"');

		const exportedWithoutSpace = exportTTMLText(parsed, {
			separateSpecialSpansWithSpace: false,
		});
		expect(exportedWithoutSpace).toContain('了</span><span ttm:role="x-bg"');

		if (typeof window !== "undefined" && window.localStorage) {
			window.localStorage.setItem("separateSpecialSpansWithSpace", "true");
			expect(exportTTMLText(parsed)).toContain(
				'了</span> <span ttm:role="x-bg"',
			);
			window.localStorage.removeItem("separateSpecialSpansWithSpace");
		}

		const reimported = parseLyric(exportedWithSpace);
		const reimportedL13 = reimported.lyricLines.find(
			(l) => l.itunesKey === "L13" && !l.isBG,
		);
		expect(reimportedL13?.words.map((w) => w.word)).toEqual(
			l13Main?.words.map((w) => w.word),
		);
	});
});

describe("exportTTMLText - itunes:key Lx markers consistent with display line numbers", () => {
	it("should assign itunes:key sequentially starting from L1 matching display row numbers", () => {
		const lines = Array.from({ length: 42 }, (_, i) =>
			makeLine({
				start: i * 1000,
				end: (i + 1) * 1000,
				words: [[`Word${i + 1}`, i * 1000, (i + 1) * 1000]],
			}),
		);
		const { ps } = exportAndParse(mockLyric(lines));

		expect(ps.length).toBe(42);
		ps.forEach((p, i) => {
			expect(p.getAttribute("itunes:key")).toBe(`L${i + 1}`);
		});
	});

	it("should renumber Lx sequentially matching display when a line is inserted into the middle (not become last L43)", () => {
		const lines = Array.from({ length: 42 }, (_, i) =>
			makeLine({
				start: i * 1000,
				end: (i + 1) * 1000,
				itunesKey: `L${i + 1}`,
				translatedLyricByLang: {
					zh: { data: `翻译${i + 1}`, isAutoFilled: false },
				},
				words: [[`Word${i + 1}`, i * 1000, (i + 1) * 1000]],
			}),
		);

		// 模拟用户在第 10 行（index 10）插入新行
		lines.splice(
			10,
			0,
			makeLine({
				start: 10500,
				end: 11000,
				itunesKey: "L43",
				translatedLyricByLang: {
					zh: { data: "新插入行的翻译", isAutoFilled: false },
				},
				words: [["NewWord", 10500, 11000]],
			}),
		);

		const { doc, ps } = exportAndParse(mockLyric(lines));

		expect(ps.length).toBe(43);
		ps.forEach((p, i) => {
			expect(p.getAttribute("itunes:key")).toBe(`L${i + 1}`);
		});

		expect(ps[10].getAttribute("itunes:key")).toBe("L11");
		expect(ps[10].textContent?.trim()).toBe("NewWord");

		expect(ps[42].getAttribute("itunes:key")).toBe("L43");
		expect(ps[42].textContent?.trim()).toBe("Word42");

		expect(doc.querySelector('text[for="L11"]')?.textContent?.trim()).toBe(
			"新插入行的翻译",
		);
		expect(doc.querySelector('text[for="L43"]')?.textContent?.trim()).toBe(
			"翻译42",
		);
	});

	it("should correctly handle background lines without skipping main line Lx numbers", () => {
		const { ps } = exportAndParse(
			mockLyric([
				{ start: 1000, end: 2000, words: [["Main1", 1000, 2000]] },
				{ isBG: true, start: 1500, end: 2000, words: [["BG1", 1500, 2000]] },
				{ start: 3000, end: 4000, words: [["Main2", 3000, 4000]] },
				{ start: 5000, end: 6000, words: [["Main3", 5000, 6000]] },
			]),
		);

		expect(ps.length).toBe(3);
		expect(ps[0].getAttribute("itunes:key")).toBe("L1");
		expect(ps[1].getAttribute("itunes:key")).toBe("L2");
		expect(ps[2].getAttribute("itunes:key")).toBe("L3");
	});

	it("should safely export frozen/read-only lyrics without throwing TypeError (e.g. from Immer store)", () => {
		function deepFreeze<T>(obj: T): T {
			if (obj === null || typeof obj !== "object") return obj;
			Object.freeze(obj);
			for (const key of Object.keys(obj)) {
				const val = (obj as Record<string, unknown>)[key];
				if (typeof val === "object" && val !== null && !Object.isFrozen(val)) {
					deepFreeze(val);
				}
			}
			return obj;
		}

		const ttmlLyric = deepFreeze(
			mockLyric([
				{ start: 1000, end: 2000, words: [["FrozenWord", 1000, 2000]] },
				{
					isBG: true,
					start: 1200,
					end: 1800,
					words: [["BgFrozen", 1200, 1800]],
				},
			]),
		);

		expect(() => exportTTMLText(ttmlLyric)).not.toThrow();
		const xml = exportTTMLText(ttmlLyric);
		expect(xml).toContain('itunes:key="L1"');
	});

	it("should export songPart as camelCase itunes:songPart attribute on div element", () => {
		const lyric = mockLyric([
			{
				start: 1000,
				end: 2000,
				songPart: "Verse",
				words: [["Hello", 1000, 2000]],
			},
			{
				start: 2000,
				end: 3000,
				songPart: "Chorus",
				words: [["World", 2000, 3000]],
			},
		]);

		const { xml } = exportAndParse(lyric);
		expect(xml).toContain('itunes:songPart="Verse"');
		expect(xml).toContain('itunes:songPart="Chorus"');
		expect(xml).not.toContain("itunes:song-part");

		const parsed = parseLyric(xml);
		expect(parsed.lyricLines[0]?.songPart).toBe("Verse");
		expect(parsed.lyricLines[1]?.songPart).toBe("Chorus");
	});
});
