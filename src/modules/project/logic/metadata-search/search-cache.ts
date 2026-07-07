import type { MetadataSourceResult } from "./types";

export class SearchCache {
	private cache = new Map<string, Promise<MetadataSourceResult>>();

	async getOrSearch(
		key: string,
		searcher: () => Promise<MetadataSourceResult>,
	): Promise<MetadataSourceResult> {
		const existing = this.cache.get(key);
		if (existing) return existing;

		const promise = searcher().catch((error) => {
			this.cache.delete(key);
			throw error;
		});
		this.cache.set(key, promise);
		return promise;
	}

	clear(): void {
		this.cache.clear();
	}
}

export const searchCache = new SearchCache();

export const stableSearchCacheKey = (
	source: string,
	parts: Record<string, unknown>,
): string => JSON.stringify([source, normalizeForCache(parts)]);

const normalizeForCache = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map(normalizeForCache);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, item]) => [key, normalizeForCache(item)]),
		);
	}
	return value;
};
