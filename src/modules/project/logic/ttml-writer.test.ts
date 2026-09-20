// @vitest-environment happy-dom

import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import type { LyricLine, TTMLLyric } from "../../../types/ttml.ts";
import { parseLyric } from "./ttml-parser.ts";
import exportTTMLText from "./ttml-writer.ts";

function createMockLyric(lines: Partial<LyricLine>[]): TTMLLyric {
	return {
		metadata: [],
		agents: [],
		lyricLines: lines.map((l, idx) => ({
			id: `line-${idx}`,
			words: [],
			translatedLyric: "",
			romanLyric: "",
			isBG: false,
			isDuet: false,
			startTime: 0,
			endTime: 0,
			ignoreSync: false,
			...l,
		})),
	};
}

describe("exportTTMLText - <p> timeline encompasses all spans", () => {
	it("should encompass x-bg span that begins earlier than main line", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Hello",
						startTime: 10000,
						endTime: 12000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
					{
						id: "w2",
						word: "world",
						startTime: 12000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 8000,
				endTime: 13000,
				words: [
					{
						id: "bg1",
						word: "echo",
						startTime: 8000,
						endTime: 13000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		expect(p).not.toBeNull();
		// begin should encompass 8000ms (00:08.000)
		expect(p?.getAttribute("begin")).toBe("00:08.000");
		// end should encompass main line 15000ms (00:15.000)
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
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Hello",
						startTime: 10000,
						endTime: 12000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
					{
						id: "w2",
						word: "world",
						startTime: 12000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 12000,
				endTime: 18000,
				words: [
					{
						id: "bg1",
						word: "echo",
						startTime: 12000,
						endTime: 18000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		expect(p).not.toBeNull();
		// begin should be main line 10000ms (00:10.000)
		expect(p?.getAttribute("begin")).toBe("00:10.000");
		// end should encompass x-bg 18000ms (00:18.000)
		expect(p?.getAttribute("end")).toBe("00:18.000");

		const bgSpan = p?.querySelector('span[ttm\\:role="x-bg"]');
		expect(p?.lastElementChild).toBe(bgSpan);
	});

	it("should encompass x-bg span that both starts earlier and ends later", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Hello",
						startTime: 10000,
						endTime: 12000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
					{
						id: "w2",
						word: "world",
						startTime: 12000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 7000,
				endTime: 19000,
				words: [
					{
						id: "bg1",
						word: "background",
						startTime: 7000,
						endTime: 19000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		expect(p).not.toBeNull();
		expect(p?.getAttribute("begin")).toBe("00:07.000");
		expect(p?.getAttribute("end")).toBe("00:19.000");
	});

	it("should encompass multiple background lines", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Main",
						startTime: 10000,
						endTime: 12000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
					{
						id: "w2",
						word: "Line",
						startTime: 12000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 8500,
				endTime: 13000,
				words: [
					{
						id: "bg1",
						word: "bg1",
						startTime: 8500,
						endTime: 13000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 14000,
				endTime: 17500,
				words: [
					{
						id: "bg2",
						word: "bg2",
						startTime: 14000,
						endTime: 17500,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		expect(p).not.toBeNull();
		expect(p?.getAttribute("begin")).toBe("00:08.500");
		expect(p?.getAttribute("end")).toBe("00:17.500");
	});

	it("should encompass x-bg in static (line-by-line) lyrics mode", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Whole line text",
						startTime: 10000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 8000,
				endTime: 18000,
				words: [
					{
						id: "bg1",
						word: "Whole bg text",
						startTime: 8000,
						endTime: 18000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		expect(p).not.toBeNull();
		expect(p?.getAttribute("begin")).toBe("00:08.000");
		expect(p?.getAttribute("end")).toBe("00:18.000");
	});

	it("should preserve standard line time when no bg and spans are within bounds", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "One",
						startTime: 10000,
						endTime: 12000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
					{
						id: "w2",
						word: "Two",
						startTime: 12000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		expect(p).not.toBeNull();
		expect(p?.getAttribute("begin")).toBe("00:10.000");
		expect(p?.getAttribute("end")).toBe("00:15.000");
	});

	it("should encompass div around p elements", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Hello",
						startTime: 10000,
						endTime: 12000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
					{
						id: "w2",
						word: "world",
						startTime: 12000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 8000,
				endTime: 18000,
				words: [
					{
						id: "bg1",
						word: "echo",
						startTime: 8000,
						endTime: 18000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const div = doc.querySelector("div");

		expect(div).not.toBeNull();
		expect(div?.getAttribute("begin")).toBe("00:08.000");
		expect(div?.getAttribute("end")).toBe("00:18.000");
	});

	it("should handle multiple lines in one div with different x-bg offsets", () => {
		const ttmlLyric = createMockLyric([
			// Line 1: Main 10s-15s, BG 8s-14s (earlier begin)
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "l1w1",
						word: "First",
						startTime: 10000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 8000,
				endTime: 14000,
				words: [
					{
						id: "l1bg1",
						word: "bgFirst",
						startTime: 8000,
						endTime: 14000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			// Line 2: Main 20s-25s, BG 22s-28s (later end)
			{
				startTime: 20000,
				endTime: 25000,
				words: [
					{
						id: "l2w1",
						word: "Second",
						startTime: 20000,
						endTime: 25000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 22000,
				endTime: 28000,
				words: [
					{
						id: "l2bg1",
						word: "bgSecond",
						startTime: 22000,
						endTime: 28000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const pList = doc.querySelectorAll("p");

		expect(pList.length).toBe(2);
		expect(pList[0].getAttribute("begin")).toBe("00:08.000");
		expect(pList[0].getAttribute("end")).toBe("00:15.000");
		expect(pList[1].getAttribute("begin")).toBe("00:20.000");
		expect(pList[1].getAttribute("end")).toBe("00:28.000");

		const div = doc.querySelector("div");
		expect(div?.getAttribute("begin")).toBe("00:08.000");
		expect(div?.getAttribute("end")).toBe("00:28.000");
	});

	it("should handle background line with multiple timed words", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Main",
						startTime: 10000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 7500,
				endTime: 16500,
				words: [
					{
						id: "bg1",
						word: "Part1",
						startTime: 7500,
						endTime: 11000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
					{
						id: "bg2",
						word: "Part2",
						startTime: 11000,
						endTime: 16500,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		expect(p?.getAttribute("begin")).toBe("00:07.500");
		expect(p?.getAttribute("end")).toBe("00:16.500");
	});
});

describe("exportTTMLText - leading x-bg placement", () => {
	it("should prepend x-bg span before main words when x-bg starts earlier than main line", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Hello",
						startTime: 10000,
						endTime: 12000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
					{
						id: "w2",
						word: " world",
						startTime: 12000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 8000,
				endTime: 9500,
				words: [
					{
						id: "bg1",
						word: "lead",
						startTime: 8000,
						endTime: 9500,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		expect(p).not.toBeNull();
		const children = Array.from(p?.children ?? []);
		expect(children.length).toBe(3); // [bgSpan, span(Hello), span( world)]

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
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Hello",
						startTime: 10000,
						endTime: 12000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
					{
						id: "w2",
						word: " world",
						startTime: 12000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 13000,
				endTime: 16000,
				words: [
					{
						id: "bg1",
						word: "trail",
						startTime: 13000,
						endTime: 16000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		const children = Array.from(p?.children ?? []);
		expect(children.length).toBe(3);

		// 主行音节在前
		expect(children[0].textContent).toBe("Hello");
		expect(children[1].textContent).toBe(" world");

		// x-bg span 在后
		expect(children[2].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[2].textContent).toBe("(trail)");
	});

	it("should append x-bg span after main words when x-bg starts at exactly the same time as main line", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Hello",
						startTime: 10000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 10000,
				endTime: 13000,
				words: [
					{
						id: "bg1",
						word: "same",
						startTime: 10000,
						endTime: 13000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		const children = Array.from(p?.children ?? []);
		expect(children.length).toBe(2);
		expect(children[0].textContent).toBe("Hello");
		expect(children[1].getAttribute("ttm:role")).toBe("x-bg");
	});

	it("should handle mixed multiple background lines (leading and trailing)", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Main",
						startTime: 10000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 7000,
				endTime: 9000,
				words: [
					{
						id: "bg1",
						word: "Intro-BG",
						startTime: 7000,
						endTime: 9000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 13000,
				endTime: 17000,
				words: [
					{
						id: "bg2",
						word: "Outro-BG",
						startTime: 13000,
						endTime: 17000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		const children = Array.from(p?.children ?? []);
		expect(children.length).toBe(3);

		// [0] 前置背景行: Intro-BG (7000 < 10000)
		expect(children[0].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[0].textContent).toBe("(Intro-BG)");
		expect(children[0].getAttribute("begin")).toBe("00:07.000");

		// [1] 主行: Main (10000 - 15000)
		expect(children[1].textContent).toBe("Main");

		// [2] 后置背景行: Outro-BG (13000 >= 10000)
		expect(children[2].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[2].textContent).toBe("(Outro-BG)");
		expect(children[2].getAttribute("begin")).toBe("00:13.000");

		// <p> 全区间囊括
		expect(p?.getAttribute("begin")).toBe("00:07.000");
		expect(p?.getAttribute("end")).toBe("00:17.000");
	});

	it("should prepend multiple background lines if all start earlier than main line", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Main",
						startTime: 10000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 6000,
				endTime: 8000,
				words: [
					{
						id: "bg1",
						word: "BG1",
						startTime: 6000,
						endTime: 8000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 8000,
				endTime: 9500,
				words: [
					{
						id: "bg2",
						word: "BG2",
						startTime: 8000,
						endTime: 9500,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		const children = Array.from(p?.children ?? []);
		expect(children.length).toBe(3);

		// 两条背景行都早于主行，均前置且保持原先后顺序
		expect(children[0].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[0].textContent).toBe("(BG1)");

		expect(children[1].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[1].textContent).toBe("(BG2)");

		expect(children[2].textContent).toBe("Main");

		expect(p?.getAttribute("begin")).toBe("00:06.000");
		expect(p?.getAttribute("end")).toBe("00:15.000");
	});

	it("should prepend x-bg in static lyric mode when x-bg starts earlier than main line", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 10000,
				endTime: 15000,
				words: [
					{
						id: "w1",
						word: "Static Main",
						startTime: 10000,
						endTime: 15000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 7000,
				endTime: 9000,
				words: [
					{
						id: "bg1",
						word: "Static BG",
						startTime: 7000,
						endTime: 9000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");

		const children = Array.from(p?.children ?? []);
		expect(children.length).toBe(2);

		// 前置背景行
		expect(children[0].getAttribute("ttm:role")).toBe("x-bg");
		expect(children[0].textContent).toBe("(Static BG)");
		expect(children[1].textContent).toBe("Static Main");

		expect(p?.getAttribute("begin")).toBe("00:07.000");
		expect(p?.getAttribute("end")).toBe("00:15.000");
	});
});

describe("exportTTMLText - special spans space isolation (experimental)", () => {
	it("should not insert space separator by default or when option is false", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 1000,
				endTime: 3000,
				words: [
					{
						id: "w1",
						word: "Main",
						startTime: 1000,
						endTime: 3000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 2000,
				endTime: 4000,
				words: [
					{
						id: "bg1",
						word: "Bg",
						startTime: 2000,
						endTime: 4000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xmlDefault = exportTTMLText(ttmlLyric);
		const parser = new DOMParser();
		const docDefault = parser.parseFromString(xmlDefault, "application/xml");
		const pDefault = docDefault.querySelector("p");
		const bgSpanDefault = pDefault?.querySelector('span[ttm\\:role="x-bg"]');
		// 默认情况下，bgSpan 的前一个 sibling 应该是主 span，而不是空格文本节点
		expect(bgSpanDefault?.previousSibling?.nodeType).toBe(Node.ELEMENT_NODE);

		const xmlExplicitFalse = exportTTMLText(ttmlLyric, {
			separateSpecialSpansWithSpace: false,
		});
		const docFalse = parser.parseFromString(
			xmlExplicitFalse,
			"application/xml",
		);
		const pFalse = docFalse.querySelector("p");
		const bgSpanFalse = pFalse?.querySelector('span[ttm\\:role="x-bg"]');
		expect(bgSpanFalse?.previousSibling?.nodeType).toBe(Node.ELEMENT_NODE);
	});

	it("should isolate post-bg span with space when enabled", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 1000,
				endTime: 3000,
				words: [
					{
						id: "w1",
						word: "Hello",
						startTime: 1000,
						endTime: 3000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 2000,
				endTime: 4000,
				words: [
					{
						id: "bg1",
						word: "World",
						startTime: 2000,
						endTime: 4000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric, {
			separateSpecialSpansWithSpace: true,
		});
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");
		const bgSpan = p?.querySelector('span[ttm\\:role="x-bg"]');

		expect(bgSpan).not.toBeNull();
		const prev = bgSpan?.previousSibling;
		expect(prev?.nodeType).toBe(Node.TEXT_NODE);
		expect(prev?.textContent).toBe(" ");
	});

	it("should isolate pre-bg span with space when enabled", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 5000,
				endTime: 8000,
				words: [
					{
						id: "w1",
						word: "Main",
						startTime: 5000,
						endTime: 8000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 2000,
				endTime: 4000,
				words: [
					{
						id: "bg1",
						word: "Intro",
						startTime: 2000,
						endTime: 4000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric, {
			separateSpecialSpansWithSpace: true,
		});
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");
		const bgSpan = p?.querySelector('span[ttm\\:role="x-bg"]');

		expect(bgSpan).not.toBeNull();
		// 前置背景行后面应该是空格文本节点
		const next = bgSpan?.nextSibling;
		expect(next?.nodeType).toBe(Node.TEXT_NODE);
		expect(next?.textContent).toBe(" ");
	});

	it("should isolate multiple consecutive bg spans with spaces", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 1000,
				endTime: 3000,
				words: [
					{
						id: "w1",
						word: "Main",
						startTime: 1000,
						endTime: 3000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 2000,
				endTime: 3500,
				words: [
					{
						id: "bg1",
						word: "Bg1",
						startTime: 2000,
						endTime: 3500,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 2500,
				endTime: 4000,
				words: [
					{
						id: "bg2",
						word: "Bg2",
						startTime: 2500,
						endTime: 4000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric, {
			separateSpecialSpansWithSpace: true,
		});
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");
		const bgSpans = p?.querySelectorAll('span[ttm\\:role="x-bg"]');

		expect(bgSpans?.length).toBe(2);
		const bg1 = bgSpans?.[0];
		const bg2 = bgSpans?.[1];

		// 主行与 bg1 之间有空格
		expect(bg1?.previousSibling?.nodeType).toBe(Node.TEXT_NODE);
		expect(bg1?.previousSibling?.textContent).toBe(" ");

		// bg1 与 bg2 之间有空格
		expect(bg2?.previousSibling?.nodeType).toBe(Node.TEXT_NODE);
		expect(bg2?.previousSibling?.textContent).toBe(" ");
	});

	it("should not insert duplicate space if main line already ends with whitespace", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 1000,
				endTime: 3000,
				words: [
					{
						id: "w1",
						word: "Hello",
						startTime: 1000,
						endTime: 2500,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
					{
						id: "w2",
						word: " ",
						startTime: 0,
						endTime: 0,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
			{
				isBG: true,
				startTime: 2000,
				endTime: 4000,
				words: [
					{
						id: "bg1",
						word: "World",
						startTime: 2000,
						endTime: 4000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
			},
		]);

		const xml = exportTTMLText(ttmlLyric, {
			separateSpecialSpansWithSpace: true,
		});
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, "application/xml");
		const p = doc.querySelector("p");
		const bgSpan = p?.querySelector('span[ttm\\:role="x-bg"]');

		// 前面已有空格，不应连续插入两个独立的空格节点或双空格
		const prev = bgSpan?.previousSibling;
		expect(prev?.nodeType).toBe(Node.TEXT_NODE);
		expect(prev?.textContent).toBe(" ");
		// prev 的上一个兄弟节点应为元素节点（而非第二个空格节点）
		expect(prev?.previousSibling?.nodeType).toBe(Node.ELEMENT_NODE);
	});

	it("should isolate bg translations and transliterations with space when enabled", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 1000,
				endTime: 3000,
				words: [
					{
						id: "w1",
						word: "主歌词",
						startTime: 1000,
						endTime: 3000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
				translatedLyricByLang: {
					en: { data: "Main Trans" },
				},
				romanLyricByLang: {
					en: { data: "main roman" },
				},
			},
			{
				isBG: true,
				startTime: 2000,
				endTime: 4000,
				words: [
					{
						id: "bg1",
						word: "背景词",
						startTime: 2000,
						endTime: 4000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
				translatedLyricByLang: {
					en: { data: "Bg Trans" },
				},
				romanLyricByLang: {
					en: { data: "bg roman" },
				},
			},
		]);

		// 1. 禁用时：主翻译与背景翻译之间无空格
		const xmlDisabled = exportTTMLText(ttmlLyric, {
			separateSpecialSpansWithSpace: false,
		});
		const parser = new DOMParser();
		const docDisabled = parser.parseFromString(xmlDisabled, "application/xml");
		const transTextDisabled = docDisabled.querySelector(
			"translations translation text",
		);
		const transBgDisabled = transTextDisabled?.querySelector(
			'span[ttm\\:role="x-bg"]',
		);
		expect(transBgDisabled?.previousSibling?.textContent).toBe("Main Trans");

		// 2. 启用时：主翻译与背景翻译之间以空格隔开
		const xmlEnabled = exportTTMLText(ttmlLyric, {
			separateSpecialSpansWithSpace: true,
		});
		const docEnabled = parser.parseFromString(xmlEnabled, "application/xml");

		// 检查翻译 <text>
		const transText = docEnabled.querySelector("translations translation text");
		expect(transText).not.toBeNull();
		const transBgSpan = transText?.querySelector('span[ttm\\:role="x-bg"]');
		expect(transBgSpan).not.toBeNull();
		expect(transBgSpan?.previousSibling?.nodeType).toBe(Node.TEXT_NODE);
		expect(transBgSpan?.previousSibling?.textContent?.endsWith(" ")).toBe(true);

		// 检查音译 <text>
		const romanText = docEnabled.querySelector(
			"transliterations transliteration text",
		);
		expect(romanText).not.toBeNull();
		const romanBgSpan = romanText?.querySelector('span[ttm\\:role="x-bg"]');
		expect(romanBgSpan).not.toBeNull();
		expect(romanBgSpan?.previousSibling?.nodeType).toBe(Node.TEXT_NODE);
		expect(romanBgSpan?.previousSibling?.textContent?.endsWith(" ")).toBe(true);
	});

	it("should parse back cleanly with parseLyric (round-trip test)", () => {
		const ttmlLyric = createMockLyric([
			{
				startTime: 1000,
				endTime: 5000,
				words: [
					{
						id: "w1",
						word: "Hello",
						startTime: 1000,
						endTime: 2500,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
					{
						id: "w2",
						word: "world",
						startTime: 2500,
						endTime: 5000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
				translatedLyricByLang: {
					en: { data: "Hello world trans" },
				},
			},
			{
				isBG: true,
				startTime: 3000,
				endTime: 6000,
				words: [
					{
						id: "bg1",
						word: "Background",
						startTime: 3000,
						endTime: 6000,
						obscene: false,
						emptyBeat: 0,
						romanWord: "",
						rubyPhraseStart: false,
					},
				],
				translatedLyricByLang: {
					en: { data: "Background trans" },
				},
			},
		]);

		const xml = exportTTMLText(ttmlLyric, {
			separateSpecialSpansWithSpace: true,
		});

		// 用 parseLyric 重新解析导出的 xml 字符串
		const parsed = parseLyric(xml);

		// 验证行数：应为 1 个主行 + 1 个背景行 = 2 行
		expect(parsed.lyricLines.length).toBe(2);

		const mainLine = parsed.lyricLines[0];
		const bgLine = parsed.lyricLines[1];

		expect(mainLine.isBG).toBe(false);
		expect(bgLine.isBG).toBe(true);

		// 验证单词内容正确恢复（不产生任何多余的空单词节点）
		expect(mainLine.words.map((w) => w.word)).toEqual(["Hello", "world"]);
		expect(mainLine.words.length).toBe(2);

		const bgWords = bgLine.words.map((w) => w.word);
		expect(bgWords).toEqual(["Background"]);

		// 验证翻译数据无损解析
		expect(mainLine.translatedLyricByLang?.en?.data).toBe("Hello world trans");
		expect(bgLine.translatedLyricByLang?.en?.data).toBe("Background trans");
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
		const mainLine = parsed.lyricLines[0];
		const bgLine = parsed.lyricLines[1];

		// 背景行正确解析（首尾小括号会被 parser 标准化剔除）
		expect(bgLine.isBG).toBe(true);
		expect(bgLine.words.map((w) => w.word)).toEqual(["BG"]);

		// 主行开头的隔离空格被跳过，词间普通空格完整保留
		expect(mainLine.isBG).toBe(false);
		expect(mainLine.words.map((w) => w.word)).toEqual(["Hello", " ", "world"]);
		expect(mainLine.words.length).toBe(3);
	});

	it("should parse and round-trip JOLIN蔡依林 - 电话皇后 with pre-bg and normal spaces cleanly", () => {
		const filePath = "F:\\ttml\\蔡依林\\Play\\JOLIN蔡依林 - 电话皇后.ttml";
		if (!fs.existsSync(filePath)) return;
		const raw = fs.readFileSync(filePath, "utf8");
		const parsed = parseLyric(raw);

		// 验证 12 个前置背景词均成功提取
		const bgLines = parsed.lyricLines.filter((l) => l.isBG);
		expect(bgLines.length).toBe(12);

		// 开启空格隔离导出
		const exported = exportTTMLText(parsed, {
			separateSpecialSpansWithSpace: true,
		});

		// 再次导入
		const reimported = parseLyric(exported);

		// 检验 L12 前置背景词的主行：爱 上 我 吧（不得包含多余的开头空格节点）
		const l12Main = reimported.lyricLines.find(
			(l) => l.itunesKey === "L12" && !l.isBG,
		);
		expect(l12Main?.words.map((w) => w.word)).toEqual(["爱", "上", "我", "吧"]);

		// 检验 L24 普通词间空格：One, two, three 前任算一下（词间空格不得丢失）
		const l24Main = reimported.lyricLines.find((l) => l.itunesKey === "L24");
		expect(l24Main?.words.map((w) => w.word)).toEqual([
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
	});
});
