// @vitest-environment happy-dom

/**
 * 输出稳定性快照：对未触发任何已知缺陷的歌词，导出的 TTML 文本必须逐字节不变。
 * 期望字符串取自阶段 1A 修复「之前」的 writer 输出（happy-dom 环境下生成）。
 * 注意：happy-dom 的 `new Document()` 会额外添加 xhtml xmlns 并将 iTunesMetadata 小写，
 * 且 querySelectorAll("meta") 匹配不到 amll:meta，这些都是测试环境特有行为，真实浏览器不同。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { LyricLine, LyricWord, TTMLLyric } from "../../../types/ttml.ts";
import { parseLyric } from "./ttml-parser.ts";
import exportTTMLText from "./ttml-writer.ts";

beforeAll(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
});

const FIXTURE_DIR = path.join(__dirname, "__fixtures__");

function exportFixture(name: string, separateSpecialSpansWithSpace = false) {
	const text = fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
	return exportTTMLText(parseLyric(text), { separateSpecialSpansWithSpace });
}

// 单背景行（前置/后置）、逐行与逐字翻译/音译、对唱、songPart、RTL、songwriter
let seq = 0;
const w = (word: string, startTime: number, endTime: number): LyricWord => ({
	id: `w${seq++}`,
	word,
	startTime,
	endTime,
	obscene: false,
	emptyBeat: 0,
	romanWord: "",
	rubyPhraseStart: false,
});
const l = (p: Partial<LyricLine>): LyricLine => ({
	id: `l${seq++}`,
	words: [],
	translatedLyric: "",
	romanLyric: "",
	isBG: false,
	isDuet: false,
	startTime: 0,
	endTime: 0,
	ignoreSync: false,
	...p,
});
function bgSample(): TTMLLyric {
	return {
		metadata: [
			{ key: "musicName", value: ["S"] },
			{ key: "songwriter", value: ["W1", "W2"] },
		],
		agents: [],
		lyricLang: "ja",
		lyricLines: [
			l({
				words: [w("Main", 1000, 1500), w(" ", 0, 0), w("one", 1500, 2000)],
				startTime: 1000,
				endTime: 2000,
				songPart: "Verse",
				translatedLyricByLang: { en: { data: "Main one" } },
				romanLyricByLang: { "ja-Hira": { data: "main wan" } },
			}),
			l({
				isBG: true,
				words: [w("bg", 2000, 2500), w(" ", 0, 0), w("a", 2500, 3000)],
				startTime: 2000,
				endTime: 3000,
				translatedLyricByLang: { en: { data: "bg trans" } },
				romanLyricByLang: { "ja-Hira": { data: "bg roman" } },
			}),
			l({
				isDuet: true,
				words: [w("Two", 4000, 4500), w(" ", 0, 0), w("x", 4500, 5000)],
				startTime: 4000,
				endTime: 5000,
				wordTranslationByLang: {
					"zh-Hans": {
						data: [
							{
								startTime: 4000,
								endTime: 4500,
								text: "二",
								hasSpaceAfter: true,
							},
							{ startTime: 4500, endTime: 5000, text: "叉" },
						],
					},
				},
				wordRomanizationByLang: {
					"ja-Latn": {
						data: [
							{
								startTime: 4000,
								endTime: 4500,
								text: "tu",
								hasSpaceAfter: true,
							},
							{ startTime: 4500, endTime: 5000, text: "ekk" },
						],
					},
				},
			}),
			l({
				isBG: true,
				words: [w("pre", 3500, 3800), w(" ", 0, 0), w("bg", 3800, 3900)],
				startTime: 3500,
				endTime: 3900,
				vocal: ["a"],
				wordTranslationByLang: {
					"zh-Hans": {
						data: [
							{
								startTime: 3500,
								endTime: 3800,
								text: "前",
								hasSpaceAfter: true,
							},
							{ startTime: 3800, endTime: 3900, text: "背" },
						],
					},
				},
				wordRomanizationByLang: {
					"ja-Latn": {
						data: [
							{ startTime: 3500, endTime: 3800, text: "pu" },
							{ startTime: 3800, endTime: 3900, text: "bi" },
						],
					},
				},
			}),
			l({
				words: [w("Three", 6000, 6500), w(" ", 0, 0), w("y", 6500, 7000)],
				startTime: 6000,
				endTime: 7000,
				songPart: "Chorus",
				isRtl: true,
			}),
		],
	};
}

const EXPECTED_CLEAN =
	'<tt xmlns="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:amll="http://www.example.com/ns/amll" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xml:lang="ja" itunes:timing="Word"><head><metadata><ttm:agent type="person" xml:id="v1"><ttm:name type="full">Alice</ttm:name></ttm:agent><ttm:agent type="person" xml:id="v2"><ttm:name type="full">Bob</ttm:name></ttm:agent></metadata></head><body dur="00:08.000"><div begin="00:01.000" end="00:04.000" itunes:song-part="Verse"><p begin="00:01.000" end="00:02.000" ttm:agent="v1" itunes:key="L1"><span begin="00:01.000" end="00:01.500">Hello</span> <span begin="00:01.500" end="00:02.000">world</span></p><p begin="00:02.000" end="00:04.000" ttm:agent="v2" itunes:key="L2"><span begin="00:02.000" end="00:03.000">Good</span> <span begin="00:03.000" end="00:04.000">night</span></p></div><div begin="00:05.000" end="00:08.000" itunes:song-part="Chorus"><p begin="00:05.000" end="00:08.000" ttm:agent="v1" itunes:key="L3"><span begin="00:05.000" end="00:06.000">Sing</span> <span begin="00:06.000" end="00:08.000">along</span></p></div></body></tt>';

const EXPECTED_MULTI_LANG =
	'<tt xmlns="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:amll="http://www.example.com/ns/amll" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xml:lang="ja" itunes:timing="Word"><head><metadata><ttm:agent type="person" xml:id="v1"></ttm:agent><itunesmetadata xmlns="http://music.apple.com/lyric-ttml-internal"><translations><translation xml:lang="en" type="subtitle"><text for="L1">Hello world</text><text for="L2">Good night</text></translation><translation xml:lang="zh-Hans" type="subtitle"><text for="L1">你好世界</text><text for="L2">晚安</text></translation><translation xml:lang="ko" type="replacement"><text for="L1"><span xmlns="http://www.w3.org/ns/ttml" begin="00:01.000" end="00:01.500">안녕</span> <span xmlns="http://www.w3.org/ns/ttml" begin="00:01.500" end="00:02.000">세상</span></text></translation></translations><transliterations><transliteration xml:lang="ja-Hira"><text for="L1">こんにちは</text><text for="L2">おやすみ</text></transliteration><transliteration xml:lang="ja-Latn"><text for="L1"><span xmlns="http://www.w3.org/ns/ttml" begin="00:01.000" end="00:01.500">kon</span> <span xmlns="http://www.w3.org/ns/ttml" begin="00:01.500" end="00:02.000">nichiwa</span></text><text for="L2"><span xmlns="http://www.w3.org/ns/ttml" begin="00:02.000" end="00:03.000">oya</span> <span xmlns="http://www.w3.org/ns/ttml" begin="00:03.000" end="00:04.000">sumi</span></text></transliteration></transliterations></itunesmetadata></metadata></head><body dur="00:04.000"><div begin="00:01.000" end="00:04.000"><p begin="00:01.000" end="00:02.000" ttm:agent="v1" itunes:key="L1"><span begin="00:01.000" end="00:01.500">今日</span><span begin="00:01.500" end="00:02.000">は</span></p><p begin="00:02.000" end="00:04.000" ttm:agent="v1" itunes:key="L2"><span begin="00:02.000" end="00:03.000">お休</span><span begin="00:03.000" end="00:04.000">み</span></p></div></body></tt>';

const EXPECTED_SONGWRITERS =
	'<tt xmlns="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:amll="http://www.example.com/ns/amll" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xml:lang="ja" itunes:timing="Word"><head><metadata><ttm:agent type="person" xml:id="v1"></ttm:agent><itunesmetadata xmlns="http://music.apple.com/lyric-ttml-internal"><songwriters><songwriter>iTunes Writer A</songwriter><songwriter>iTunes Writer B</songwriter></songwriters></itunesmetadata></metadata></head><body dur="00:02.000"><div begin="00:01.000" end="00:02.000"><p begin="00:01.000" end="00:02.000" ttm:agent="v1" itunes:key="L1"><span begin="00:01.000" end="00:01.500">Hi</span> <span begin="00:01.500" end="00:02.000">there</span></p></div></body></tt>';

const EXPECTED_SINGLE_BG =
	'<tt xmlns="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:amll="http://www.example.com/ns/amll" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xml:lang="ja" itunes:timing="Word"><head><metadata><ttm:agent type="person" xml:id="v1"></ttm:agent><ttm:agent type="other" xml:id="v2"></ttm:agent><amll:meta key="musicName" value="S" /><itunesmetadata xmlns="http://music.apple.com/lyric-ttml-internal"><songwriters><songwriter>W1</songwriter><songwriter>W2</songwriter></songwriters><translations><translation xml:lang="en" type="subtitle"><text for="L1">Main one<span ttm:role="x-bg">bg trans</span></text></translation><translation xml:lang="zh-Hans" type="replacement"><text for="L2"><span xmlns="http://www.w3.org/ns/ttml" begin="00:04.000" end="00:04.500">二</span>  <span xmlns="http://www.w3.org/ns/ttml" begin="00:04.500" end="00:05.000">叉</span><span ttm:role="x-bg"><span xmlns="http://www.w3.org/ns/ttml" begin="00:03.500" end="00:03.800">(前</span>  <span xmlns="http://www.w3.org/ns/ttml" begin="00:03.800" end="00:03.900">背)</span></span></text></translation></translations><transliterations><transliteration xml:lang="ja-Hira"><text for="L1">main wan<span ttm:role="x-bg">bg roman</span></text></transliteration><transliteration xml:lang="ja-Latn"><text for="L2"><span xmlns="http://www.w3.org/ns/ttml" begin="00:04.000" end="00:04.500">tu</span>  <span xmlns="http://www.w3.org/ns/ttml" begin="00:04.500" end="00:05.000">ekk</span><span ttm:role="x-bg"><span xmlns="http://www.w3.org/ns/ttml" begin="00:03.500" end="00:03.800">(pu</span> <span xmlns="http://www.w3.org/ns/ttml" begin="00:03.800" end="00:03.900">bi)</span></span></text></transliteration></transliterations></itunesmetadata></metadata></head><body dur="00:07.000"><div begin="00:01.000" end="00:05.000" itunes:song-part="Verse"><p begin="00:01.000" end="00:03.000" ttm:agent="v1" itunes:key="L1"><span begin="00:01.000" end="00:01.500">Main</span> <span begin="00:01.500" end="00:02.000">one</span><span ttm:role="x-bg" begin="00:02.000" end="00:03.000"><span begin="00:02.000" end="00:02.500">(bg</span> <span begin="00:02.500" end="00:03.000">a)</span></span></p><p begin="00:03.500" end="00:05.000" ttm:agent="v2" itunes:key="L2"><span ttm:role="x-bg" begin="00:03.500" end="00:03.900" amll:vocal="a"><span begin="00:03.500" end="00:03.800">(pre</span> <span begin="00:03.800" end="00:03.900">bg)</span></span><span begin="00:04.000" end="00:04.500">Two</span> <span begin="00:04.500" end="00:05.000">x</span></p></div><div begin="00:06.000" end="00:07.000" itunes:song-part="Chorus"><p begin="00:06.000" end="00:07.000" ttm:agent="v1" amll:rtl="true" itunes:key="L3"><span begin="00:06.000" end="00:06.500">Three</span> <span begin="00:06.500" end="00:07.000">y</span></p></div></body></tt>';

const EXPECTED_SINGLE_BG_SEPARATED =
	'<tt xmlns="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:amll="http://www.example.com/ns/amll" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xml:lang="ja" itunes:timing="Word"><head><metadata><ttm:agent type="person" xml:id="v1"></ttm:agent><ttm:agent type="other" xml:id="v2"></ttm:agent><amll:meta key="musicName" value="S" /><itunesmetadata xmlns="http://music.apple.com/lyric-ttml-internal"><songwriters><songwriter>W1</songwriter><songwriter>W2</songwriter></songwriters><translations><translation xml:lang="en" type="subtitle"><text for="L1">Main one <span ttm:role="x-bg">bg trans</span></text></translation><translation xml:lang="zh-Hans" type="replacement"><text for="L2"><span xmlns="http://www.w3.org/ns/ttml" begin="00:04.000" end="00:04.500">二</span>  <span xmlns="http://www.w3.org/ns/ttml" begin="00:04.500" end="00:05.000">叉</span> <span ttm:role="x-bg"><span xmlns="http://www.w3.org/ns/ttml" begin="00:03.500" end="00:03.800">(前</span>  <span xmlns="http://www.w3.org/ns/ttml" begin="00:03.800" end="00:03.900">背)</span></span></text></translation></translations><transliterations><transliteration xml:lang="ja-Hira"><text for="L1">main wan <span ttm:role="x-bg">bg roman</span></text></transliteration><transliteration xml:lang="ja-Latn"><text for="L2"><span xmlns="http://www.w3.org/ns/ttml" begin="00:04.000" end="00:04.500">tu</span>  <span xmlns="http://www.w3.org/ns/ttml" begin="00:04.500" end="00:05.000">ekk</span> <span ttm:role="x-bg"><span xmlns="http://www.w3.org/ns/ttml" begin="00:03.500" end="00:03.800">(pu</span> <span xmlns="http://www.w3.org/ns/ttml" begin="00:03.800" end="00:03.900">bi)</span></span></text></transliteration></transliterations></itunesmetadata></metadata></head><body dur="00:07.000"><div begin="00:01.000" end="00:05.000" itunes:song-part="Verse"><p begin="00:01.000" end="00:03.000" ttm:agent="v1" itunes:key="L1"><span begin="00:01.000" end="00:01.500">Main</span> <span begin="00:01.500" end="00:02.000">one</span> <span ttm:role="x-bg" begin="00:02.000" end="00:03.000"><span begin="00:02.000" end="00:02.500">(bg</span> <span begin="00:02.500" end="00:03.000">a)</span></span></p><p begin="00:03.500" end="00:05.000" ttm:agent="v2" itunes:key="L2"><span ttm:role="x-bg" begin="00:03.500" end="00:03.900" amll:vocal="a"><span begin="00:03.500" end="00:03.800">(pre</span> <span begin="00:03.800" end="00:03.900">bg)</span></span> <span begin="00:04.000" end="00:04.500">Two</span> <span begin="00:04.500" end="00:05.000">x</span></p></div><div begin="00:06.000" end="00:07.000" itunes:song-part="Chorus"><p begin="00:06.000" end="00:07.000" ttm:agent="v1" amll:rtl="true" itunes:key="L3"><span begin="00:06.000" end="00:06.500">Three</span> <span begin="00:06.500" end="00:07.000">y</span></p></div></body></tt>';

describe("TTML export output stability (byte-identical for defect-free input)", () => {
	it("clean.ttml", () => {
		expect(exportFixture("clean.ttml")).toBe(EXPECTED_CLEAN);
	});

	it("multi-lang.ttml", () => {
		expect(exportFixture("multi-lang.ttml")).toBe(EXPECTED_MULTI_LANG);
	});

	it("songwriters.ttml", () => {
		expect(exportFixture("songwriters.ttml")).toBe(EXPECTED_SONGWRITERS);
	});

	it("single BG line per main line (pre/post), line + word translations", () => {
		expect(
			exportTTMLText(bgSample(), { separateSpecialSpansWithSpace: false }),
		).toBe(EXPECTED_SINGLE_BG);
	});

	it("single BG line per main line with separateSpecialSpansWithSpace", () => {
		expect(
			exportTTMLText(bgSample(), { separateSpecialSpansWithSpace: true }),
		).toBe(EXPECTED_SINGLE_BG_SEPARATED);
	});
});
