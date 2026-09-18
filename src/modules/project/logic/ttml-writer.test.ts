// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import exportTTMLText from "./ttml-writer.ts";
import type { TTMLLyric, LyricLine } from "../../../types/ttml.ts";

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
