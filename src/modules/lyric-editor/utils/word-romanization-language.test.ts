import { describe, expect, test } from "vitest";
import type { LyricLine, LyricWord, TTMLLyric } from "$/types/ttml";
import {
	getPreferredWordRomanizationLang,
	getSortedWordRomanizationLanguages,
	syncTimedWordTracksForWordTiming,
	syncWordRomanizationForWord,
} from "./word-romanization-language";

const word = (
	wordText: string,
	startTime: number,
	endTime: number,
	romanWord = "",
	overrides: Partial<LyricWord> = {},
): LyricWord => ({
	id: `${wordText}-${startTime}-${endTime}`,
	word: wordText,
	startTime,
	endTime,
	obscene: false,
	emptyBeat: 0,
	romanWord,
	rubyPhraseStart: false,
	...overrides,
});

const line = (
	words: LyricWord[],
	overrides: Partial<LyricLine> = {},
): LyricLine => ({
	id: `line-${words.map((item) => item.id).join("-")}`,
	words,
	translatedLyric: "",
	romanLyric: "",
	isBG: false,
	isDuet: false,
	startTime: words[0]?.startTime ?? 0,
	endTime: words[words.length - 1]?.endTime ?? 0,
	ignoreSync: false,
	vocal: [],
	...overrides,
});

const lyric = (
	lyricLines: LyricLine[],
	overrides: Partial<TTMLLyric> = {},
): TTMLLyric => ({
	metadata: [],
	agents: [],
	lyricLines,
	...overrides,
});

describe("word romanization language synchronization", () => {
	test("sorts explicit and default languages before legacy untagged tracks", () => {
		const state = lyric(
			[
				line([word("顔", 1000, 1200, "kao")], {
					wordRomanizationByLang: {
						und: [{ startTime: 1000, endTime: 1200, text: "legacy" }],
						"ja-Latn": [{ startTime: 1000, endTime: 1200, text: "kao" }],
						"en-Latn": [{ startTime: 1000, endTime: 1200, text: "face" }],
					},
				}),
			],
			{ defaultRomanizationLang: "ja-Latn" },
		);

		expect(getSortedWordRomanizationLanguages(state, "en-Latn")).toEqual([
			"en-Latn",
			"ja-Latn",
			"und",
		]);
		expect(getSortedWordRomanizationLanguages(state)).toEqual([
			"ja-Latn",
			"en-Latn",
			"und",
		]);
	});

	test("uses an explicitly selected language without falling back to active or untagged tracks", () => {
		const state = lyric(
			[
				line([word("顔", 1000, 1200, "legacy")], {
					wordRomanizationByLang: {
						und: [{ startTime: 1000, endTime: 1200, text: "legacy" }],
						"ja-Latn": [{ startTime: 1000, endTime: 1200, text: "kao" }],
					},
				}),
			],
			{ defaultRomanizationLang: "ja-Latn" },
		);

		expect(getPreferredWordRomanizationLang(state, "ja-Latn")).toBe("ja-Latn");
	});

	test("uses imported default language when an imported line has no word romanization track", () => {
		const targetLine = line([word("顔", 1000, 1200)]);
		const state = lyric([targetLine], {
			defaultRomanizationLang: "ja-Latn",
		});

		const lang = getPreferredWordRomanizationLang(state);
		syncWordRomanizationForWord(targetLine, targetLine.words[0], "kao", lang);

		expect(lang).toBe("ja-Latn");
		expect(targetLine.words[0].romanWord).toBe("kao");
		expect(targetLine.wordRomanizationByLang?.["ja-Latn"]).toEqual([
			{ startTime: 1000, endTime: 1200, text: "kao" },
		]);
	});

	test("updates the active language without mutating another language track", () => {
		const targetLine = line([word("君", 1000, 1200, "kimi")], {
			wordRomanizationByLang: {
				"ja-Latn": [{ startTime: 1000, endTime: 1200, text: "kimi" }],
				"en-Latn": [{ startTime: 1000, endTime: 1200, text: "you" }],
			},
		});
		const state = lyric([targetLine], {
			defaultRomanizationLang: "ja-Latn",
		});

		const lang = getPreferredWordRomanizationLang(state);
		syncWordRomanizationForWord(targetLine, targetLine.words[0], "kimi2", lang);

		expect(lang).toBe("ja-Latn");
		expect(targetLine.wordRomanizationByLang?.["ja-Latn"]).toEqual([
			{ startTime: 1000, endTime: 1200, text: "kimi2" },
		]);
		expect(targetLine.wordRomanizationByLang?.["en-Latn"]).toEqual([
			{ startTime: 1000, endTime: 1200, text: "you" },
		]);
	});

	test("removes only the matching timed entry when clearing a word romanization", () => {
		const targetLine = line(
			[word("顔", 1000, 1200, "kao"), word("で", 1200, 1400, "de")],
			{
				wordRomanizationByLang: {
					"ja-Latn": [
						{ startTime: 1000, endTime: 1200, text: "kao" },
						{ startTime: 1200, endTime: 1400, text: "de" },
					],
				},
			},
		);

		syncWordRomanizationForWord(
			targetLine,
			targetLine.words[0],
			"",
			"ja-Latn",
		);

		expect(targetLine.words[0].romanWord).toBe("");
		expect(targetLine.wordRomanizationByLang?.["ja-Latn"]).toEqual([
			{ startTime: 1200, endTime: 1400, text: "de" },
		]);
	});

	test("removes same-timed legacy untagged entries when saving a tagged word romanization", () => {
		const targetLine = line([word("顔", 1000, 1200, "legacy")], {
			wordRomanizationByLang: {
				und: [{ startTime: 1000, endTime: 1200, text: "legacy" }],
				"ja-Latn": [],
			},
		});

		syncWordRomanizationForWord(
			targetLine,
			targetLine.words[0],
			"kao",
			"ja-Latn",
		);

		expect(targetLine.wordRomanizationByLang?.und).toBeUndefined();
		expect(targetLine.wordRomanizationByLang?.["ja-Latn"]).toEqual([
			{ startTime: 1000, endTime: 1200, text: "kao" },
		]);
	});

	test("updates timed word tracks when a word timing changes", () => {
		const targetLine = line([word("顔", 1000, 1200, "kao")], {
			wordRomanizationByLang: {
				"ja-Latn": [{ startTime: 1000, endTime: 1200, text: "kao" }],
				"en-Latn": [{ startTime: 1000, endTime: 1200, text: "face" }],
			},
			wordTranslationByLang: {
				en: [{ startTime: 1000, endTime: 1200, text: "face" }],
			},
		});

		targetLine.words[0].startTime = 1050;
		targetLine.words[0].endTime = 1250;
		syncTimedWordTracksForWordTiming(
			targetLine,
			{ startTime: 1000, endTime: 1200 },
			{ startTime: 1050, endTime: 1250 },
		);

		expect(targetLine.wordRomanizationByLang?.["ja-Latn"]).toEqual([
			{ startTime: 1050, endTime: 1250, text: "kao" },
		]);
		expect(targetLine.wordRomanizationByLang?.["en-Latn"]).toEqual([
			{ startTime: 1050, endTime: 1250, text: "face" },
		]);
		expect(targetLine.wordTranslationByLang?.en).toEqual([
			{ startTime: 1050, endTime: 1250, text: "face" },
		]);
	});
});
