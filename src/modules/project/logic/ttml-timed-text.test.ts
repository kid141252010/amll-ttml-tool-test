import { describe, expect, test } from "vitest";
import type { LyricLine, LyricWord } from "$/types/ttml";
import {
	ITUNES_EXTENSION_NAMESPACE,
	TtmlTextTrackLanguage,
	collectWordRomanizationTracks,
	getLineTimingBounds,
	getLinesTimingBounds,
	getTtmlDuration,
	getXmlLangAttribute,
	matchTimedTextItemsInOrder,
} from "./ttml-timed-text";

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

describe("ttml timed text helpers", () => {
	test("exports untagged internal language by omitting xml:lang", () => {
		expect(getXmlLangAttribute(TtmlTextTrackLanguage.Untagged)).toBeUndefined();
		expect(getXmlLangAttribute("ja-Latn")).toBe("ja-Latn");
		expect(ITUNES_EXTENSION_NAMESPACE).toBe(
			"http://itunes.apple.com/lyric-ttml-extensions",
		);
	});

	test("collects word.romanWord as an untagged word romanization fallback", () => {
		const tracks = collectWordRomanizationTracks(
			line([word("君", 1000, 1200, "kimi"), word("へ", 1200, 1400, "e")]),
		);

		expect(tracks.get(TtmlTextTrackLanguage.Untagged)?.mainRoman).toEqual([
			{ startTime: 1000, endTime: 1200, text: "kimi" },
			{ startTime: 1200, endTime: 1400, text: "e" },
		]);
	});

	test("does not add fallback when an existing language already matches word.romanWord", () => {
		const tracks = collectWordRomanizationTracks(
			line([word("君", 1000, 1200, "kimi")], {
				wordRomanizationByLang: {
					"ja-Latn": [{ startTime: 1000, endTime: 1200, text: "kimi" }],
				},
			}),
		);

		expect(tracks.has(TtmlTextTrackLanguage.Untagged)).toBe(false);
		expect(tracks.get("ja-Latn")?.mainRoman).toEqual([
			{ startTime: 1000, endTime: 1200, text: "kimi" },
		]);
	});

	test("collects word.romanWord fallback into the configured default language", () => {
		const collectWithFallback = collectWordRomanizationTracks as (
			line: LyricLine,
			bgLine: LyricLine | undefined,
			fallbackLang: string,
		) => ReturnType<typeof collectWordRomanizationTracks>;

		const tracks = collectWithFallback(
			line([word("顔", 1000, 1200, "kao")]),
			undefined,
			"ja-Latn",
		);

		expect(tracks.has(TtmlTextTrackLanguage.Untagged)).toBe(false);
		expect(tracks.get("ja-Latn")?.mainRoman).toEqual([
			{ startTime: 1000, endTime: 1200, text: "kao" },
		]);
	});

	test("merges legacy untagged word romanization into the configured default language", () => {
		const collectWithFallback = collectWordRomanizationTracks as (
			line: LyricLine,
			bgLine: LyricLine | undefined,
			fallbackLang: string,
		) => ReturnType<typeof collectWordRomanizationTracks>;

		const tracks = collectWithFallback(
			line([word("顔", 1000, 1200), word("で", 1200, 1400)], {
				wordRomanizationByLang: {
					und: [
						{ startTime: 1000, endTime: 1200, text: "legacy-kao" },
						{ startTime: 1200, endTime: 1400, text: "de" },
					],
					"ja-Latn": [{ startTime: 1000, endTime: 1200, text: "kao" }],
				},
			}),
			undefined,
			"ja-Latn",
		);

		expect(tracks.has(TtmlTextTrackLanguage.Untagged)).toBe(false);
		expect(tracks.get("ja-Latn")?.mainRoman).toEqual([
			{ startTime: 1000, endTime: 1200, text: "kao" },
			{ startTime: 1200, endTime: 1400, text: "de" },
		]);
	});

	test("keeps untagged word romanization untagged when no default language exists", () => {
		const tracks = collectWordRomanizationTracks(
			line([word("顔", 1000, 1200)], {
				wordRomanizationByLang: {
					und: [{ startTime: 1000, endTime: 1200, text: "kao" }],
				},
			}),
		);

		expect(tracks.get(TtmlTextTrackLanguage.Untagged)?.mainRoman).toEqual([
			{ startTime: 1000, endTime: 1200, text: "kao" },
		]);
	});

	test("matches duplicate timed words by consuming timed text in order", () => {
		const matches = matchTimedTextItemsInOrder(
			[word("a", 1000, 1200), word("b", 1000, 1200)],
			[
				{ startTime: 1000, endTime: 1200, text: "first" },
				{ startTime: 1000, endTime: 1200, text: "second" },
			],
		);

		expect(matches.map((item) => item?.text)).toEqual(["first", "second"]);
	});

	test("computes document duration from line, ruby, background, and auxiliary tracks", () => {
		const main = line([
			word("夢", 1000, 1200, "", {
				ruby: [{ word: "ゆめ", startTime: 1000, endTime: 1500 }],
			}),
		]);
		const bg = line([word("bg", 1200, 1700)], {
			isBG: true,
			wordRomanizationByLang: {
				[TtmlTextTrackLanguage.Untagged]: [
					{ startTime: 1200, endTime: 1800, text: "background" },
				],
			},
		});

		expect(getTtmlDuration([main, bg])).toBe(1800);
	});

	test("snaps line begin to first valid word when line start time is stale", () => {
		const timedLine = line([word("hello", 1200, 1500)], {
			startTime: 0,
			endTime: 1500,
		});

		expect(getLineTimingBounds(timedLine)).toEqual({
			beginTime: 1200,
			endTime: 1500,
		});
	});

	test("snaps grouped begin to earliest valid main or background word", () => {
		const main = line([word("main", 1800, 2200)], {
			startTime: 0,
			endTime: 2200,
		});
		const bg = line([word("bg", 1400, 2100)], {
			isBG: true,
			startTime: 0,
			endTime: 2100,
		});

		expect(getLinesTimingBounds([main, bg])).toEqual({
			beginTime: 1400,
			endTime: 2200,
		});
	});
});
