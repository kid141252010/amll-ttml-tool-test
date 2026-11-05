// @vitest-environment happy-dom

import { atom, createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { parseLyric } from "../../project/logic/ttml-parser.ts";
import exportTTMLText from "../../project/logic/ttml-writer.ts";
import {
	lyricLinesAtom,
	selectedWordRomanizationLangAtom,
} from "../../../states/main.ts";
import {
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "../../../types/ttml.ts";
import { syncWordRomanizationTiming } from "../utils/word-romanization.ts";
import { RomanWordView } from "./roman-word-view.tsx";

// React's DOM renderer requires this flag for deterministic act() flushing.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function createJyutpingLyric(): TTMLLyric {
	const words = [
		{
			...newLyricWord(),
			word: "香",
			romanWord: "hoeng1",
			startTime: 1000,
			endTime: 1200,
		},
		{
			...newLyricWord(),
			word: "港",
			romanWord: "gong3",
			startTime: 1000,
			endTime: 1200,
		},
	];
	return {
		metadata: [],
		agents: [],
		lyricLines: [
			{
				...newLyricLine(),
				words,
				startTime: 1000,
				endTime: 1200,
				wordRomanizationByLang: {
					"zh-Latn-jyutping": {
						data: words.map((word) => ({
							startTime: word.startTime,
							endTime: word.endTime,
							text: word.romanWord,
						})),
					},
					"zh-Latn-pinyin": {
						data: [
							{ startTime: 1000, endTime: 1200, text: "xiang1" },
							{ startTime: 1000, endTime: 1200, text: "gang3" },
						],
					},
				},
			},
		],
	};
}

describe("word romanization survives editing and saving", () => {
	it.each([
		{ nextValue: "gong2", fillMissing: false },
		{ nextValue: "", fillMissing: false },
		{ nextValue: "gong2", fillMissing: true },
	])("persists edit $nextValue (missing=$fillMissing) without changing the other language", async ({
		nextValue,
		fillMissing,
	}) => {
		const store = createStore();
		const lyric = createJyutpingLyric();
		if (fillMissing) {
			lyric.lyricLines[0].wordRomanizationByLang![
				"zh-Latn-jyutping"
			].data.pop();
			lyric.lyricLines[0].words[1].romanWord = "";
		}
		store.set(lyricLinesAtom, lyric);
		store.set(selectedWordRomanizationLangAtom, "zh-Latn-jyutping");
		const wordAtom = atom((get) => get(lyricLinesAtom).lyricLines[0].words[1]);
		const editingIndexAtom = atom<number | null>(1);
		const container = document.body.appendChild(document.createElement("div"));
		const root = createRoot(container);
		try {
			await act(async () =>
				root.render(
					<Provider store={store}>
						<RomanWordView
							wordAtom={wordAtom}
							wordIndex={1}
							editingIndexAtom={editingIndexAtom}
						/>
					</Provider>,
				),
			);
			const input = container.querySelector("input");
			if (!input) throw new Error("Romanization editor was not rendered");
			await act(async () => {
				input.value = nextValue;
				input.dispatchEvent(
					new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
				);
			});
			const saved = parseLyric(exportTTMLText(store.get(lyricLinesAtom)));
			const tracks = saved.lyricLines[0].wordRomanizationByLang;
			expect(
				tracks?.["zh-Latn-jyutping"]?.data.map((item) => item.text),
			).toEqual(nextValue ? ["hoeng1", nextValue] : ["hoeng1"]);
			expect(tracks?.["zh-Latn-pinyin"]?.data.map((item) => item.text)).toEqual(
				["xiang1", "gang3"],
			);
		} finally {
			await act(async () => root.unmount());
			container.remove();
		}
	});

	it("retimes duplicate-timestamp words independently in every saved language", () => {
		const lyric = createJyutpingLyric();
		const line = lyric.lyricLines[0];
		const word = line.words[1];
		word.startTime = 1300;
		word.endTime = 1600;
		syncWordRomanizationTiming(line, word, 1000, 1200);
		const saved = parseLyric(exportTTMLText(lyric));
		const tracks = saved.lyricLines[0].wordRomanizationByLang;
		for (const [lang, texts] of [
			["zh-Latn-jyutping", ["hoeng1", "gong3"]],
			["zh-Latn-pinyin", ["xiang1", "gang3"]],
		] as const) {
			expect(
				tracks?.[lang]?.data.map(({ startTime, endTime, text }) => ({
					startTime,
					endTime,
					text,
				})),
			).toEqual([
				{ startTime: 1000, endTime: 1200, text: texts[0] },
				{ startTime: 1300, endTime: 1600, text: texts[1] },
			]);
		}
	});
});
