// @vitest-environment happy-dom

import { produce } from "immer";
import { afterEach, describe, expect, it } from "vitest";
import { syncWordRomanizationForWord } from "../../lyric-editor/utils/word-romanization";
import { parseLyric } from "../../project/logic/ttml-parser";
import exportTTMLText from "../../project/logic/ttml-writer";
import { processSingleLine } from "../../segmentation/utils/segment-processing";
import { createEmptyLyric, lyricLinesAtom } from "../../../states/main";
import { globalStore } from "../../../states/store";
import { newLyricLine, newLyricWord, type LyricLine, type TTMLLyric } from "../../../types/ttml";
import {
	adjustLineEndTime,
	commitUpdatedLine,
	getUpdatedLineForDivider,
	getUpdatedLineForLinePan,
	getUpdatedLineForWordPan,
	shiftLineStartTime,
	tryFixPartialInitialization,
	tryInitializeZeroTimestampLine,
} from "./timeline-mutations";

const initialState = globalStore.get(lyricLinesAtom);
afterEach(() => globalStore.set(lyricLinesAtom, initialState));

function createLyric(): TTMLLyric {
	const words = [
		{ ...newLyricWord(), word: "香", romanWord: "hoeng1", startTime: 1000, endTime: 1200 },
		{ ...newLyricWord(), word: "港", romanWord: "gong3", startTime: 1200, endTime: 1500 },
	];
	return {
		...createEmptyLyric(),
		lyricLines: [{
			...newLyricLine(), startTime: 1000, endTime: 1500, words,
			wordRomanizationByLang: Object.fromEntries(([
				["zh-Latn-jyutping", ["hoeng1", "gong3"]],
				["zh-Latn-pinyin", ["xiang1", "gang3"]],
			] as const).map(([lang, texts]) => [lang, { data: words.map((word, i) => ({
				startTime: word.startTime, endTime: word.endTime, text: texts[i],
			})) }])) as LyricLine["wordRomanizationByLang"],
		}],
	};
}

function expectSavedTimes(lyric: TTMLLyric, times: number[][], changed = false) {
	const xml = exportTTMLText(lyric);
	const saved = parseLyric(xml);
	for (const [lang, texts] of [
		["zh-Latn-jyutping", ["hoeng1", changed ? "gong2" : "gong3"]],
		["zh-Latn-pinyin", ["xiang1", "gang3"]],
	] as const) {
		expect(saved.lyricLines[0].wordRomanizationByLang?.[lang]?.data.map(({ startTime, endTime, text }) => [startTime, endTime, text]))
			.toEqual(times.map((time, i) => [...time, texts[i]]));
	}
	expect(xml).not.toContain("wordId");
}

describe("retiming keeps saved romanization synchronized", () => {
	it.each([
		{ mode: "divider", times: [[1000, 1300], [1300, 1500]] },
		{ mode: "word-pan", times: [[1000, 1100], [1100, 1400]] },
		{ mode: "line-pan", times: [[2000, 2200], [2200, 2500]] },
	])("supports $mode then editing and reimporting", ({ mode, times }) => {
		const lyric = createLyric();
		globalStore.set(lyricLinesAtom, lyric);
		const processed = processSingleLine(lyric.lyricLines[0]);
		const changed = mode === "divider" ? getUpdatedLineForDivider(processed, 0, 1300, false, 1000)
			: mode === "word-pan" ? getUpdatedLineForWordPan(processed, lyric.lyricLines[0].words[1].id, 1100, 1000)
			: getUpdatedLineForLinePan(processed, 2000);
		commitUpdatedLine(changed);
		const edited = produce(globalStore.get(lyricLinesAtom), (draft) => {
			const line = draft.lyricLines[0];
			syncWordRomanizationForWord(line, line.words[1], "gong2", "zh-Latn-jyutping");
		});
		expectSavedTimes(edited, times, true);
		expect(lyric.lyricLines[0].wordRomanizationByLang?.["zh-Latn-jyutping"]?.data[1].endTime).toBe(1500);
	});

	it.each([
		{ mode: "shift", times: [[2000, 2200], [2200, 2500]] },
		{ mode: "extend", times: [[1000, 1200], [1200, 1700]] },
		{ mode: "compress", times: [[1000, 1200], [1200, 1400]] },
	])("synchronizes line $mode", ({ mode, times }) => {
		const lyric = produce(createLyric(), (draft) => {
			const line = draft.lyricLines[0];
			if (mode === "shift") shiftLineStartTime(line, 2000);
			else adjustLineEndTime(line, mode === "extend" ? 1700 : 1400);
		});
		expectSavedTimes(lyric, times);
	});

	it("initializes all zero-timestamp words without sharing the first romanization", () => {
		const lyric = createLyric();
		const line = lyric.lyricLines[0];
		for (const word of line.words) word.startTime = word.endTime = 0;
		for (const track of Object.values(line.wordRomanizationByLang ?? {})) {
			for (const item of track.data) item.startTime = item.endTime = 0;
		}
		tryInitializeZeroTimestampLine(line, 1000, 2000);
		expectSavedTimes(lyric, [[1000, 1500], [1500, 2000]]);
	});

	it("distributes a partially initialized group and saves each romanization time", () => {
		const lyric = createLyric();
		const line = lyric.lyricLines[0];
		line.words[0].endTime = 2000;
		line.words[1].startTime = line.words[1].endTime = 0;
		for (const track of Object.values(line.wordRomanizationByLang ?? {})) {
			track.data[0].endTime = 2000;
			track.data[1].startTime = track.data[1].endTime = 0;
		}
		tryFixPartialInitialization(line);
		expectSavedTimes(lyric, [[1000, 1500], [1500, 2000]]);
	});

	it("retimes a sparse track when the new word time collides with another old time", () => {
		const lyric = createLyric();
		const line = lyric.lyricLines[0];
		line.words.push({ ...newLyricWord(), word: "啊", startTime: 1500, endTime: 1800 });
		line.endTime = 1800;
		globalStore.set(lyricLinesAtom, lyric);
		commitUpdatedLine(getUpdatedLineForLinePan(processSingleLine(line), 1200));
		expectSavedTimes(globalStore.get(lyricLinesAtom), [[1200, 1400], [1400, 1700]]);
	});

	it("does not restore a stale romanization value from a drag snapshot", () => {
		const lyric = createLyric();
		const snapshot = getUpdatedLineForLinePan(processSingleLine(lyric.lyricLines[0]), 2000);
		const edited = produce(lyric, (draft) => {
			const line = draft.lyricLines[0];
			syncWordRomanizationForWord(line, line.words[1], "gong2", "zh-Latn-jyutping");
		});
		globalStore.set(lyricLinesAtom, edited);
		commitUpdatedLine(snapshot);
		expect(globalStore.get(lyricLinesAtom).lyricLines[0].words[1].romanWord).toBe("gong2");
		expectSavedTimes(globalStore.get(lyricLinesAtom), [[2000, 2200], [2200, 2500]], true);
	});
});
