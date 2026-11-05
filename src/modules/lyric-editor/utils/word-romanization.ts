import type {
	LyricLine,
	LyricWord,
	TTMLLangData,
	TTMLRomanWord,
} from "../../../types/ttml.ts";

type StoredWordRomanization = TTMLLangData<TTMLRomanWord[]> | TTMLRomanWord[];

/** Update both the visible value and the selected language's saved track. */
export function syncWordRomanizationForWord(
	line: LyricLine,
	word: LyricWord,
	nextRomanWord: string,
	lang: string,
) {
	word.romanWord = nextRomanWord;
	if (!lang || word.word.trim().length === 0) return;

	const existing: StoredWordRomanization | undefined =
		line.wordRomanizationByLang?.[lang];
	const entries = Array.isArray(existing) ? existing : (existing?.data ?? []);
	const index = findWordRomanizationIndex(line, word, entries);
	if (index === -1) {
		if (!nextRomanWord.trim()) return;
		let insertionIndex = entries.length;
		for (let i = line.words.indexOf(word) + 1; i < line.words.length; i++) {
			const nextIndex = findWordRomanizationIndex(line, line.words[i], entries);
			if (nextIndex !== -1) {
				insertionIndex = nextIndex;
				break;
			}
		}
		entries.splice(insertionIndex, 0, {
			startTime: word.startTime,
			endTime: word.endTime,
			text: nextRomanWord,
		});
	} else {
		// Keep empty slots: removing one makes duplicate-timestamp words ambiguous.
		if (/\s$/.test(entries[index].text)) entries[index].hasSpaceAfter = true;
		entries[index].text = nextRomanWord;
	}
	line.wordRomanizationByLang ??= {};
	line.wordRomanizationByLang[lang] = {
		...(Array.isArray(existing) ? undefined : existing),
		data: entries,
	};
}

/** Retiming a word must also retime its associated romanization in every language. */
export function syncWordRomanizationTiming(
	line: LyricLine,
	word: LyricWord,
	previousStartTime: number,
	previousEndTime: number,
) {
	for (const value of Object.values(line.wordRomanizationByLang ?? {})) {
		const stored: StoredWordRomanization = value;
		const entries = Array.isArray(stored) ? stored : stored.data;
		const index = findWordRomanizationIndex(
			line,
			word,
			entries,
			previousStartTime,
			previousEndTime,
		);
		if (index !== -1) {
			entries[index].startTime = word.startTime;
			entries[index].endTime = word.endTime;
		}
	}
}

function findWordRomanizationIndex(
	line: LyricLine,
	word: LyricWord,
	entries: TTMLRomanWord[],
	startTime = word.startTime,
	endTime = word.endTime,
): number {
	if (!word.word.trim()) return -1;
	let wordCount = 0;
	let ordinal = -1;
	let occurrence = 0;
	for (const candidate of line.words) {
		if (!candidate.word.trim()) continue;
		if (candidate.id === word.id) ordinal = wordCount;
		if (
			ordinal === -1 &&
			candidate.startTime === startTime &&
			candidate.endTime === endTime
		)
			occurrence++;
		wordCount++;
	}
	if (ordinal === -1) return -1;
	const positional = entries[ordinal];
	if (
		entries.length === wordCount &&
		positional?.startTime === startTime &&
		positional.endTime === endTime
	)
		return ordinal;

	for (let i = 0; i < entries.length; i++) {
		if (entries[i].startTime !== startTime || entries[i].endTime !== endTime)
			continue;
		if (occurrence-- === 0) return i;
	}
	return -1;
}
