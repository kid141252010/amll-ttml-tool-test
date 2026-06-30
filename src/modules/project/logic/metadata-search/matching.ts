import { Converter } from "opencc-js";
import type {
	MetadataCandidate,
	MetadataSearchInput,
	MetadataValues,
	MetadataValueKey,
} from "./types";

const toSimplified = Converter({ from: "tw", to: "cn" });

export const splitArtists = (values: Iterable<unknown>): string[] => {
	const artists: string[] = [];
	for (const rawValue of values) {
		const value = stringify(rawValue);
		if (!value) continue;
		for (const piece of value.split(/\s*(?:,|;|；|、|&|＆)\s*/)) {
			const trimmed = piece.trim();
			if (trimmed && !artists.includes(trimmed)) {
				artists.push(trimmed);
			}
		}
	}
	return artists;
};

export const normalizeMatchText = (value: unknown): string => {
	const text = stringify(value);
	if (!text) return "";
	return toSimplified(text).toLowerCase().trim().replace(/\s+/g, " ");
};

export const textMatchScore = (expected: unknown, actual: unknown): number => {
	const expectedText = normalizeMatchText(expected);
	const actualText = normalizeMatchText(actual);
	if (!expectedText || !actualText) return 0;
	if (expectedText === actualText) return 2;
	if (expectedText.includes(actualText) || actualText.includes(expectedText)) {
		return 1;
	}
	return 0;
};

export const sameRawText = (left: unknown, right: unknown): boolean => {
	const leftText = stringify(left);
	const rightText = stringify(right);
	return !!leftText && !!rightText && leftText === rightText;
};

export const sameIdentifier = (left: unknown, right: unknown): boolean => {
	const leftText = stringify(left);
	const rightText = stringify(right);
	return (
		!!leftText && !!rightText && leftText.toLowerCase() === rightText.toLowerCase()
	);
};

export const addUniqueValue = (
	values: MetadataValues,
	key: MetadataValueKey,
	value: unknown,
) => {
	const text = stringify(value);
	if (!text) return;
	const list = values[key] ?? [];
	if (!list.includes(text)) {
		values[key] = [...list, text];
	}
};

export const addUniqueValues = (
	values: MetadataValues,
	key: MetadataValueKey,
	items: Iterable<unknown>,
) => {
	for (const item of items) {
		addUniqueValue(values, key, item);
	}
};

export const scoreMetadataCandidate = (
	input: MetadataSearchInput,
	candidate: Pick<
		MetadataCandidate,
		"title" | "artists" | "album" | "isrc" | "sourceIndex"
	>,
	weights: {
		isrc?: number;
		title?: number;
		artist?: number;
		album?: number;
	} = {},
): number => {
	if (instrumentalMarkerConflicts(input.title, candidate.title)) {
		return -10_000 + (candidate.sourceIndex ?? 0);
	}
	let score = 0;
	if (
		input.ids.isrc.some((value) => sameIdentifier(value, candidate.isrc)) &&
		candidate.isrc
	) {
		score += weights.isrc ?? 500;
	}
	score += textMatchScore(input.title, candidate.title) * (weights.title ?? 100);
	for (const artist of input.artists) {
		score +=
			Math.max(
				...candidate.artists.map((candidateArtist) =>
					textMatchScore(artist, candidateArtist),
				),
				0,
			) * (weights.artist ?? 80);
	}
	score += textMatchScore(input.album, candidate.album) * (weights.album ?? 40);
	return score;
};

export const addTextWithSimplifiedVariants = (
	values: string[],
	value: unknown,
) => {
	const text = stringify(value);
	if (!text) return;
	for (const variant of [text, toSimplified(text)]) {
		if (variant && !values.includes(variant)) {
			values.push(variant);
		}
	}
};

export const stringify = (value: unknown): string | null => {
	if (value === null || value === undefined) return null;
	if (value instanceof Uint8Array) {
		return new TextDecoder().decode(value).trim() || null;
	}
	const text = String(value).trim();
	return text || null;
};

export const parseNumber = (value: unknown): number | undefined => {
	if (value === null || value === undefined) return undefined;
	const match = String(value).match(/\d+/);
	return match ? Number(match[0]) : undefined;
};

export const nestedGet = (value: unknown, ...keys: string[]): unknown => {
	let current = value;
	for (const key of keys) {
		if (!current || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
};

export const unique = (values: Iterable<string | null | undefined>): string[] => {
	const result: string[] = [];
	for (const value of values) {
		const text = stringify(value);
		if (text && !result.includes(text)) {
			result.push(text);
		}
	}
	return result;
};

const instrumentalMarkerConflicts = (
	expectedTitle: unknown,
	candidateTitle: unknown,
): boolean =>
	!hasInstrumentalMarker(expectedTitle) && hasInstrumentalMarker(candidateTitle);

const hasInstrumentalMarker = (value: unknown): boolean => {
	const text = ` ${normalizeMatchText(value)} `;
	if (!text.trim()) return false;
	return instrumentalMarkers.some((marker) => text.includes(marker));
};

const instrumentalMarkers = [
	"instrumental",
	" inst",
	"inst.",
	"off vocal",
	"off-vocal",
	"karaoke",
	"伴奏",
	"纯音乐",
	"純音樂",
	"インスト",
	"カラオケ",
	"반주",
];
