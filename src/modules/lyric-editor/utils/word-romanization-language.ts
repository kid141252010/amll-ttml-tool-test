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
): string {
	return (
		getActiveWordRomanizationLang(ttmlLyric) ??
		normalizeLang(ttmlLyric.defaultRomanizationLang) ??
		getFirstWordRomanizationLang(ttmlLyric) ??
		TtmlTextTrackLanguage.Untagged
	);
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

	if (isEmpty) {
		if (entryIndex !== -1) {
			entries.splice(entryIndex, 1);
		}
		if (entries.length > 0) {
			line.wordRomanizationByLang[normalizedLang] = entries;
		} else {
			delete line.wordRomanizationByLang[normalizedLang];
			if (Object.keys(line.wordRomanizationByLang).length === 0) {
				delete line.wordRomanizationByLang;
			}
		}
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
}

function getFirstWordRomanizationLang(ttmlLyric: TTMLLyric): string | undefined {
	for (const line of ttmlLyric.lyricLines) {
		const lang = Object.keys(line.wordRomanizationByLang ?? {}).find(
			(key) => (line.wordRomanizationByLang?.[key]?.length ?? 0) > 0,
		);
		if (lang) return lang;
	}
	return undefined;
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

function normalizeLang(lang: string | undefined): string | undefined {
	const normalized = lang?.trim();
	return normalized || undefined;
}

function hasSameTiming(
	left: Pick<LyricWord, "startTime" | "endTime">,
	right: Pick<LyricWord, "startTime" | "endTime">,
): boolean {
	return left.startTime === right.startTime && left.endTime === right.endTime;
}
