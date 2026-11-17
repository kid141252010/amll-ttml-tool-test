import type {
	LyricLine,
	LyricWord,
	TTMLLangData,
	TTMLRomanWord,
} from "../../../types/ttml.ts";

type StoredWordRomanization = TTMLLangData<TTMLRomanWord[]> | TTMLRomanWord[];

/** Replacing a line track also retires the old timed version of that language. */
export function syncLineRomanizationForLang(
	line: LyricLine,
	text: string,
	lang: string,
	displayedWordLang: string,
) {
	if (!lang) return;
	line.romanLyric = text;
	line.romanLyricByLang ??= {};
	line.romanLyricByLang[lang] = { data: text, isAutoFilled: false };
	delete line.wordRomanizationByLang?.[lang];
	if (!displayedWordLang || displayedWordLang === lang ||
		Object.keys(line.wordRomanizationByLang ?? {}).length === 0) {
		for (const word of line.words) word.romanWord = "";
	}
}

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
	// Promote all legacy visible values together; a partial track would hide the rest.
	const entries = Array.isArray(existing) ? existing : (existing?.data ?? (
		Object.keys(line.wordRomanizationByLang ?? {}).length === 0
			? line.words.filter((candidate) => candidate.word.trim()).map((candidate) => ({
				startTime: candidate.startTime,
				endTime: candidate.endTime,
				text: candidate.romanWord,
				wordId: candidate.id,
			}))
			: []
	));
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
			wordId: word.id,
		});
	} else {
		// Keep empty slots: removing one makes duplicate-timestamp words ambiguous.
		if (/\s$/.test(entries[index].text)) entries[index].hasSpaceAfter = true;
		entries[index].text = nextRomanWord;
		entries[index].wordId = word.id;
	}
	line.wordRomanizationByLang ??= {};
	line.wordRomanizationByLang[lang] = {
		...(Array.isArray(existing) ? undefined : existing),
		data: entries,
	};
}

/** Use the same association for display, editing, and timing changes. */
export function applyWordRomanizationToWords(line: LyricLine, lang: string) {
	const stored: StoredWordRomanization | undefined = line.wordRomanizationByLang?.[lang];
	const entries = Array.isArray(stored) ? stored : (stored?.data ?? []);
	for (const word of line.words) {
		const index = findWordRomanizationIndex(line, word, entries);
		word.romanWord = index === -1 ? "" : entries[index].text;
		if (index !== -1) entries[index].wordId = word.id;
	}
}

/** Resolve associations before a batch changes timestamps that may collide. */
export function bindWordRomanizationToWords(line: LyricLine) {
	for (const value of Object.values(line.wordRomanizationByLang ?? {})) {
		const stored: StoredWordRomanization = value;
		const entries = Array.isArray(stored) ? stored : stored.data;
		for (const word of line.words) {
			const index = findWordRomanizationIndex(line, word, entries);
			if (index !== -1) entries[index].wordId = word.id;
		}
	}
}

/** Retiming a word must also retime its associated romanization in every language. */
export function syncWordRomanizationTiming(
	line: LyricLine,
	word: LyricWord,
	previousStartTime: number,
	previousEndTime: number,
) {
	if (word.startTime === previousStartTime && word.endTime === previousEndTime) return;
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
			entries[index].wordId = word.id;
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
	const bound = entries.findIndex((entry) => entry.wordId === word.id);
	if (bound !== -1) return bound;
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
	if (entries.length === wordCount && positional && !positional.wordId) return ordinal;

	for (let i = 0; i < entries.length; i++) {
		if (entries[i].startTime !== startTime || entries[i].endTime !== endTime)
			continue;
		if (occurrence-- === 0 && !entries[i].wordId) return i;
	}
	// For sparse tracks, accept only an unambiguous temporal overlap.
	let overlap = -1;
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		if (entry.wordId || entry.startTime >= endTime || entry.endTime <= startTime) continue;
		if (overlap !== -1 || line.words.some((candidate) =>
			candidate.id !== word.id && candidate.word.trim() &&
			candidate.startTime < entry.endTime && candidate.endTime > entry.startTime)) return -1;
		overlap = i;
	}
	return overlap;
}
