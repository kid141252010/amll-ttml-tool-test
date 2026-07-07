import { splitArtists, stringify } from "../matching";
import type { MetadataCandidate } from "../types";

export const sourceResult = <
	T extends { candidates: MetadataCandidate[]; errors: string[] },
>(
	candidates: MetadataCandidate[],
	errors: string[] = [],
): T =>
	({
		candidates,
		errors,
	}) as T;

export const parseArtists = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return splitArtists(
			value.map((item) =>
				item && typeof item === "object"
					? (item as Record<string, unknown>).name
					: item,
			),
		);
	}
	if (value && typeof value === "object") {
		return splitArtists([(value as Record<string, unknown>).name]);
	}
	return splitArtists([value]);
};

export const parseAlbum = (value: unknown): string | undefined => {
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return stringify(record.name) ?? stringify(record.title) ?? undefined;
	}
	return stringify(value) ?? undefined;
};

export const parseAliases = (
	record: Record<string, unknown>,
	keys: string[],
): string[] => {
	const aliases: string[] = [];
	for (const key of keys) {
		const value = record[key];
		if (Array.isArray(value)) {
			for (const item of value) {
				const text = stringify(item);
				if (text && !aliases.includes(text)) aliases.push(text);
			}
		} else {
			const text = stringify(value);
			if (text && !aliases.includes(text)) aliases.push(text);
		}
	}
	return aliases;
};

export const ensureOneSelectedPerRegion = (
	candidates: MetadataCandidate[],
): MetadataCandidate[] => {
	const seenRegions = new Set<string>();
	return candidates.map((candidate) => {
		const region = candidate.region ?? candidate.source;
		if (candidate.selectedByDefault) {
			seenRegions.add(region);
			return candidate;
		}
		if (candidate.score > 0 && !seenRegions.has(region)) {
			seenRegions.add(region);
			return { ...candidate, selectedByDefault: true };
		}
		return candidate;
	});
};

export const compareIndex = (
	left: Pick<MetadataCandidate, "sourceIndex">,
	right: Pick<MetadataCandidate, "sourceIndex">,
) => (left.sourceIndex ?? 0) - (right.sourceIndex ?? 0);

export const dedupeByKey = (
	candidates: MetadataCandidate[],
	getKey: (candidate: MetadataCandidate) => string,
): MetadataCandidate[] => {
	const seen = new Set<string>();
	const result: MetadataCandidate[] = [];
	for (const candidate of candidates) {
		const key = getKey(candidate);
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(candidate);
	}
	return result;
};

export const hostForUrl = (url: string): string => {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
};
