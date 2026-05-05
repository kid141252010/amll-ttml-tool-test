import type { LyricLine, LyricWord, TTMLLyric } from "$/types/ttml";
import { TtmlTextTrackLanguage } from "$/modules/project/logic/ttml-timed-text";

export function getActiveWordRomanizationLang(
	ttmlLyric: TTMLLyric,
): string | undefined {
	let matchedLang: string | undefined;
	for (const line of ttmlLyric.lyricLines) {
		const byLang = line.wordRomanizationByLang;
		if (!byLang) continue;
		let lineMatched: string | undefined;
		for (const [lang, romanWords] of Object.entries(byLang)) {
			if (romanWords.length === 0) continue;
			if (lineMatchesRomanizationTrack(line, romanWords)) {
				lineMatched = lang;
				break;
			}
		}
		if (!lineMatched) return undefined;
		if (matchedLang && matchedLang !== lineMatched) return undefined;
		matchedLang = lineMatched;
	}
	return matchedLang;
}

export function getPreferredWordRomanizationLang(
	ttmlLyric: TTMLLyric,
	selectedLang?: string,
): string {
	const normalizedSelectedLang = normalizeLang(selectedLang);
	if (normalizedSelectedLang) return normalizedSelectedLang;

	const defaultLang = normalizeLang(ttmlLyric.defaultRomanizationLang);
	if (defaultLang) return defaultLang;

	return (
		getSortedWordRomanizationLanguages(ttmlLyric)[0] ??
		TtmlTextTrackLanguage.Untagged
	);
}

export function getSortedWordRomanizationLanguages(
	ttmlLyric: TTMLLyric,
	selectedLang?: string,
): string[] {
	const languages = getWordRomanizationLanguages(ttmlLyric);
	const originalIndex = new Map(
		languages.map((lang, index) => [lang, index] as const),
	);
	const normalizedSelectedLang = normalizeLang(selectedLang);
	const defaultLang = normalizeLang(ttmlLyric.defaultRomanizationLang);

	return [...languages].sort((left, right) => {
		const leftPriority = getWordRomanizationLangPriority(
			left,
			normalizedSelectedLang,
			defaultLang,
		);
		const rightPriority = getWordRomanizationLangPriority(
			right,
			normalizedSelectedLang,
			defaultLang,
		);
		if (leftPriority !== rightPriority) return leftPriority - rightPriority;
		return (originalIndex.get(left) ?? 0) - (originalIndex.get(right) ?? 0);
	});
}

export function syncWordRomanizationForWord(
	line: LyricLine,
	word: LyricWord,
	nextRomanWord: string,
	lang: string,
) {
	const normalizedLang = normalizeLang(lang) ?? TtmlTextTrackLanguage.Untagged;
	word.romanWord = nextRomanWord;
	line.wordRomanizationByLang ??= {};
	const entries = line.wordRomanizationByLang[normalizedLang] ?? [];
	const entryIndex = entries.findIndex((entry) => hasSameTiming(entry, word));
	const isEmpty = nextRomanWord.trim().length === 0;
	const shouldRemoveLegacyUntagged =
		normalizedLang !== TtmlTextTrackLanguage.Untagged;

	if (isEmpty) {
		if (entryIndex !== -1) {
			entries.splice(entryIndex, 1);
		}
		if (entries.length > 0) {
			line.wordRomanizationByLang[normalizedLang] = entries;
		} else {
			delete line.wordRomanizationByLang[normalizedLang];
		}
		if (shouldRemoveLegacyUntagged) {
			removeSameTimedWordRomanizationEntry(
				line,
				TtmlTextTrackLanguage.Untagged,
				word,
			);
		}
		pruneEmptyWordRomanizationMap(line);
		return;
	}

	const nextEntry = {
		...(entryIndex !== -1 ? entries[entryIndex] : undefined),
		startTime: word.startTime,
		endTime: word.endTime,
		text: nextRomanWord,
	};
	if (entryIndex === -1) {
		entries.push(nextEntry);
	} else {
		entries[entryIndex] = nextEntry;
	}
	line.wordRomanizationByLang[normalizedLang] =
		sortRomanizationEntriesByLine(line, entries);
	if (shouldRemoveLegacyUntagged) {
		removeSameTimedWordRomanizationEntry(
			line,
			TtmlTextTrackLanguage.Untagged,
			word,
		);
	}
	pruneEmptyWordRomanizationMap(line);
}

export function syncTimedWordTracksForWordTiming(
	line: LyricLine,
	previousTiming: Pick<LyricWord, "startTime" | "endTime">,
	nextTiming: Pick<LyricWord, "startTime" | "endTime">,
) {
	if (hasSameTiming(previousTiming, nextTiming)) return;
	syncTimedTextTrackMap(line.wordRomanizationByLang, previousTiming, nextTiming);
	syncTimedTextTrackMap(line.wordTranslationByLang, previousTiming, nextTiming);
}

function getWordRomanizationLanguages(ttmlLyric: TTMLLyric): string[] {
	const languages: string[] = [];
	const seen = new Set<string>();
	for (const line of ttmlLyric.lyricLines) {
		for (const [lang, romanWords] of Object.entries(
			line.wordRomanizationByLang ?? {},
		)) {
			if (romanWords.length === 0 || seen.has(lang)) continue;
			seen.add(lang);
			languages.push(lang);
		}
	}
	return languages;
}

function getWordRomanizationLangPriority(
	lang: string,
	selectedLang: string | undefined,
	defaultLang: string | undefined,
) {
	if (selectedLang && lang === selectedLang) return 0;
	if (defaultLang && lang === defaultLang) return 1;
	if (lang !== TtmlTextTrackLanguage.Untagged) return 2;
	return 3;
}

function lineMatchesRomanizationTrack(
	line: LyricLine,
	romanWords: NonNullable<LyricLine["wordRomanizationByLang"]>[string],
): boolean {
	let matchedAny = false;
	for (const word of line.words) {
		if (word.word.trim().length === 0) continue;
		const match = romanWords.find((entry) => hasSameTiming(entry, word));
		const roman = match?.text ?? "";
		if (roman.trim().length === 0) continue;
		matchedAny = true;
		if (word.romanWord !== roman) {
			return false;
		}
	}
	return matchedAny;
}

function sortRomanizationEntriesByLine(
	line: LyricLine,
	entries: NonNullable<LyricLine["wordRomanizationByLang"]>[string],
) {
	return [...entries].sort((left, right) => {
		const leftIndex = line.words.findIndex((word) => hasSameTiming(left, word));
		const rightIndex = line.words.findIndex((word) => hasSameTiming(right, word));
		if (leftIndex !== -1 && rightIndex !== -1) return leftIndex - rightIndex;
		if (leftIndex !== -1) return -1;
		if (rightIndex !== -1) return 1;
		return left.startTime - right.startTime || left.endTime - right.endTime;
	});
}

function removeSameTimedWordRomanizationEntry(
	line: LyricLine,
	lang: string,
	word: LyricWord,
) {
	const byLang = line.wordRomanizationByLang;
	const entries = byLang?.[lang];
	if (!byLang || !entries) return;

	const filteredEntries = entries.filter((entry) => !hasSameTiming(entry, word));
	if (filteredEntries.length > 0) {
		byLang[lang] = filteredEntries;
	} else {
		delete byLang[lang];
	}
}

function pruneEmptyWordRomanizationMap(line: LyricLine) {
	if (
		line.wordRomanizationByLang &&
		Object.keys(line.wordRomanizationByLang).length === 0
	) {
		delete line.wordRomanizationByLang;
	}
}

function normalizeLang(lang: string | undefined): string | undefined {
	const normalized = lang?.trim();
	return normalized || undefined;
}

function syncTimedTextTrackMap<
	T extends Pick<LyricWord, "startTime" | "endTime">,
>(
	byLang: Record<string, T[]> | undefined,
	previousTiming: Pick<LyricWord, "startTime" | "endTime">,
	nextTiming: Pick<LyricWord, "startTime" | "endTime">,
) {
	if (!byLang) return;
	for (const entries of Object.values(byLang)) {
		for (const entry of entries) {
			if (!hasSameTiming(entry, previousTiming)) continue;
			entry.startTime = nextTiming.startTime;
			entry.endTime = nextTiming.endTime;
		}
	}
}

function hasSameTiming(
	left: Pick<LyricWord, "startTime" | "endTime">,
	right: Pick<LyricWord, "startTime" | "endTime">,
): boolean {
	return left.startTime === right.startTime && left.endTime === right.endTime;
}
