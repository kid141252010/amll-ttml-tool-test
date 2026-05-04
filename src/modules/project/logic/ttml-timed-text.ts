import type {
	LyricLine,
	LyricWord,
	TTMLRomanWord,
	TTMLTranslationWord,
} from "$/types/ttml";

export const ITUNES_EXTENSION_NAMESPACE =
	"http://itunes.apple.com/lyric-ttml-extensions";
export const ITUNES_METADATA_NAMESPACE =
	"http://music.apple.com/lyric-ttml-internal";

export enum TtmlTextTrackLanguage {
	Untagged = "und",
}

export interface TimedTextItem {
	startTime: number;
	endTime: number;
	text: string;
	hasSpaceAfter?: boolean;
}

export interface WordRomanizationTrack {
	mainWords: LyricWord[];
	bgWords: LyricWord[];
	mainRoman: TTMLRomanWord[];
	bgRoman: TTMLRomanWord[];
}

export interface TimingBounds {
	beginTime: number;
	endTime: number;
}

type TrackSide = "mainRoman" | "bgRoman";

export function getXmlLangAttribute(lang: string): string | undefined {
	const normalized = lang.trim();
	if (!normalized || normalized === TtmlTextTrackLanguage.Untagged) {
		return undefined;
	}
	return normalized;
}

export function matchTimedTextItemsInOrder<T extends TimedTextItem>(
	words: readonly Pick<LyricWord, "startTime" | "endTime" | "word">[],
	items: readonly T[],
): Array<T | undefined> {
	const available = [...items];
	return words.map((word) => {
		if (word.word.trim().length === 0) return undefined;
		const matchIndex = available.findIndex((item) => hasSameTiming(word, item));
		if (matchIndex === -1) return undefined;
		const [match] = available.splice(matchIndex, 1);
		return match;
	});
}

export function collectWordRomanizationTracks(
	line: LyricLine,
	bgLine?: LyricLine,
	fallbackLang: string = TtmlTextTrackLanguage.Untagged,
): Map<string, WordRomanizationTrack> {
	const tracks = new Map<string, WordRomanizationTrack>();

	for (const [lang, romanWords] of Object.entries(
		line.wordRomanizationByLang ?? {},
	)) {
		setTrackSide(tracks, lang, "mainRoman", romanWords, line.words, []);
	}

	for (const [lang, romanWords] of Object.entries(
		bgLine?.wordRomanizationByLang ?? {},
	)) {
		setTrackSide(
			tracks,
			lang,
			"bgRoman",
			romanWords,
			line.words,
			bgLine?.words ?? [],
		);
	}

	const mainFallback = buildRomanWordFallback(line.words);
	applyFallbackTrack(
		tracks,
		fallbackLang,
		"mainRoman",
		mainFallback,
		line.words,
		[],
	);

	const bgWords = bgLine?.words ?? [];
	const bgFallback = buildRomanWordFallback(bgWords);
	applyFallbackTrack(
		tracks,
		fallbackLang,
		"bgRoman",
		bgFallback,
		line.words,
		bgWords,
	);

	return tracks;
}

export function getLineTimingBounds(line: LyricLine): TimingBounds {
	return {
		beginTime: getLineBeginTime(line),
		endTime: getTimingEndTime(collectLineTimes(line), line.endTime),
	};
}

export function getLinesTimingBounds(
	lines: readonly LyricLine[],
): TimingBounds {
	return {
		beginTime: getTimingBeginTime(lines),
		endTime: getTimingEndTime(
			lines.flatMap((line) => collectLineTimes(line)),
			lines[lines.length - 1]?.endTime ?? 0,
		),
	};
}

export function getTtmlDuration(lines: readonly LyricLine[]): number {
	return getLinesTimingBounds(lines).endTime;
}

function createEmptyTrack(
	mainWords: LyricWord[],
	bgWords: LyricWord[],
): WordRomanizationTrack {
	return {
		mainWords,
		bgWords,
		mainRoman: [],
		bgRoman: [],
	};
}

function ensureTrack(
	tracks: Map<string, WordRomanizationTrack>,
	lang: string,
	mainWords: LyricWord[],
	bgWords: LyricWord[],
): WordRomanizationTrack {
	const normalizedLang = lang.trim() || TtmlTextTrackLanguage.Untagged;
	const existing = tracks.get(normalizedLang);
	if (existing) {
		if (mainWords.length > 0) existing.mainWords = mainWords;
		if (bgWords.length > 0) existing.bgWords = bgWords;
		return existing;
	}
	const next = createEmptyTrack(mainWords, bgWords);
	tracks.set(normalizedLang, next);
	return next;
}

function setTrackSide(
	tracks: Map<string, WordRomanizationTrack>,
	lang: string,
	side: TrackSide,
	items: readonly TTMLRomanWord[],
	mainWords: LyricWord[],
	bgWords: LyricWord[],
) {
	const normalizedItems = cloneTimedTextItems(items);
	if (normalizedItems.length === 0) return;
	const track = ensureTrack(tracks, lang, mainWords, bgWords);
	track[side] = normalizedItems;
}

function applyFallbackTrack(
	tracks: Map<string, WordRomanizationTrack>,
	lang: string,
	side: TrackSide,
	fallbackItems: TTMLRomanWord[],
	mainWords: LyricWord[],
	bgWords: LyricWord[],
) {
	if (fallbackItems.length === 0) return;
	const normalizedLang = lang.trim() || TtmlTextTrackLanguage.Untagged;
	const existingTrack = tracks.get(normalizedLang);
	if (existingTrack) {
		if (isEquivalentTimedTextList(existingTrack[side], fallbackItems)) return;
	} else if (hasEquivalentTrackSide(tracks, side, fallbackItems)) {
		return;
	}
	const track = ensureTrack(tracks, normalizedLang, mainWords, bgWords);
	track[side] = fallbackItems;
}

function hasEquivalentTrackSide(
	tracks: Map<string, WordRomanizationTrack>,
	side: TrackSide,
	items: readonly TTMLRomanWord[],
): boolean {
	for (const track of tracks.values()) {
		if (isEquivalentTimedTextList(track[side], items)) {
			return true;
		}
	}
	return false;
}

function buildRomanWordFallback(words: readonly LyricWord[]): TTMLRomanWord[] {
	return words
		.filter(
			(word) => word.word.trim().length > 0 && word.romanWord.trim().length > 0,
		)
		.map((word) => ({
			startTime: word.startTime,
			endTime: word.endTime,
			text: word.romanWord,
		}));
}

function cloneTimedTextItems<T extends TimedTextItem>(
	items: readonly T[],
): T[] {
	return items
		.filter((item) => item.text.trim().length > 0)
		.map((item) => ({ ...item }));
}

function isEquivalentTimedTextList(
	left: readonly TimedTextItem[],
	right: readonly TimedTextItem[],
): boolean {
	const normalizedLeft = cloneTimedTextItems(left);
	const normalizedRight = cloneTimedTextItems(right);
	if (normalizedLeft.length !== normalizedRight.length) return false;
	return normalizedLeft.every((item, index) => {
		const other = normalizedRight[index];
		return (
			other !== undefined &&
			hasSameTiming(item, other) &&
			item.text.trim() === other.text.trim()
		);
	});
}

function hasSameTiming(
	left: Pick<TimedTextItem, "startTime" | "endTime">,
	right: Pick<TimedTextItem, "startTime" | "endTime">,
): boolean {
	return left.startTime === right.startTime && left.endTime === right.endTime;
}

function collectLineTimes(line: LyricLine): number[] {
	const times: number[] = [];
	addTimeRange(times, line.startTime, line.endTime);

	for (const word of line.words) {
		addTimeRange(times, word.startTime, word.endTime);
		for (const rubyWord of word.ruby ?? []) {
			addTimeRange(times, rubyWord.startTime, rubyWord.endTime);
		}
	}

	for (const romanWords of Object.values(line.wordRomanizationByLang ?? {})) {
		addTimedTextList(times, romanWords);
	}
	for (const translationWords of Object.values(
		line.wordTranslationByLang ?? {},
	)) {
		addTimedTextList(times, translationWords);
	}

	return times;
}

function getTimingBeginTime(lines: readonly LyricLine[]): number {
	if (lines.length === 0) return 0;
	return Math.min(...lines.map(getLineBeginTime));
}

function getLineBeginTime(line: LyricLine): number {
	const firstWord = line.words.find(isValidTimingWord);
	return normalizeTime(firstWord?.startTime ?? line.startTime);
}

function isValidTimingWord(word: LyricWord): boolean {
	return (
		word.word.trim().length > 0 ||
		(word.ruby?.some((rubyWord) => rubyWord.word.trim().length > 0) ?? false)
	);
}

function getTimingEndTime(times: readonly number[], fallbackEnd: number): number {
	if (times.length === 0) return normalizeTime(fallbackEnd);
	return Math.max(...times.map(normalizeTime));
}

function addTimedTextList(
	times: number[],
	items: readonly (TTMLRomanWord | TTMLTranslationWord)[],
) {
	for (const item of items) {
		addTimeRange(times, item.startTime, item.endTime);
	}
}

function addTimeRange(times: number[], startTime: number, endTime: number) {
	if (Number.isFinite(startTime)) times.push(startTime);
	if (Number.isFinite(endTime)) times.push(endTime);
}

function normalizeTime(time: number): number {
	if (!Number.isFinite(time) || Number.isNaN(time)) return 0;
	return Math.max(0, time);
}
