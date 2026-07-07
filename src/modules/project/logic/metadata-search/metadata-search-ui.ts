import type { TTMLMetadata } from "$/types/ttml";
import { candidateKey } from "./index";
import { addUniqueValues } from "./matching";
import type {
	MetadataCandidate,
	MetadataSearchResult,
	MetadataValueKey,
	MetadataValues,
} from "./types";

export interface MetadataRegionGroup {
	region: string;
	candidates: MetadataCandidate[];
}

export interface MetadataMergePreviewItem {
	key: keyof MetadataValues;
	added: string[];
	skipped: string[];
}

export interface MetadataCandidateValueItem {
	id: string;
	candidateId: string;
	candidate: MetadataCandidate;
	key: MetadataValueKey;
	value: string;
}

const UNKNOWN_REGION = "UNKNOWN";

const normalizeRegion = (region: string | undefined): string => {
	const trimmed = region?.trim();
	return trimmed ? trimmed.toUpperCase() : UNKNOWN_REGION;
};

export const groupMetadataCandidatesByRegion = (
	candidates: MetadataCandidate[],
): MetadataRegionGroup[] => {
	const groups = new Map<string, MetadataCandidate[]>();
	for (const candidate of candidates) {
		const region = normalizeRegion(candidate.region);
		const group = groups.get(region);
		if (group) {
			group.push(candidate);
		} else {
			groups.set(region, [candidate]);
		}
	}
	return Array.from(groups.entries())
		.sort(([a], [b]) => {
			if (a === UNKNOWN_REGION) return 1;
			if (b === UNKNOWN_REGION) return -1;
			return a.localeCompare(b);
		})
		.map(([region, groupCandidates]) => ({
			region,
			candidates: groupCandidates,
		}));
};

export const buildSelectedCandidateIds = (candidateIds: string[]): string[] =>
	Array.from(new Set(candidateIds));

export const metadataCandidateValueKey = (
	candidate: MetadataCandidate,
	key: MetadataValueKey,
	value: string,
): string => JSON.stringify([candidateKey(candidate), key, value]);

export const buildMetadataCandidateValueItems = (
	candidates: MetadataCandidate[],
): MetadataCandidateValueItem[] => {
	const items: MetadataCandidateValueItem[] = [];
	for (const candidate of candidates) {
		const candidateId = candidateKey(candidate);
		for (const [key, values] of Object.entries(candidate.values)) {
			if (!Array.isArray(values)) continue;
			for (const value of values) {
				const trimmed = value.trim();
				if (!trimmed) continue;
				items.push({
					id: metadataCandidateValueKey(
						candidate,
						key as MetadataValueKey,
						trimmed,
					),
					candidateId,
					candidate,
					key: key as MetadataValueKey,
					value: trimmed,
				});
			}
		}
	}
	return items;
};

export const buildSelectedMetadataValueKeys = (
	candidates: MetadataCandidate[],
	candidateIds: Iterable<string>,
): string[] => {
	const selectedCandidateIds = new Set(candidateIds);
	return Array.from(
		new Set(
			buildMetadataCandidateValueItems(candidates)
				.filter((item) => selectedCandidateIds.has(item.candidateId))
				.map((item) => item.id),
		),
	);
};

export const buildMetadataValuesFromValueSelection = (
	candidates: MetadataCandidate[],
	selectedValueKeys: Iterable<string>,
): MetadataValues => {
	const selectedSet = new Set(selectedValueKeys);
	const values: MetadataValues = {};
	for (const item of buildMetadataCandidateValueItems(candidates)) {
		if (!selectedSet.has(item.id)) continue;
		addUniqueValues(values, item.key, [item.value]);
	}
	return values;
};

export const buildMetadataMergePreview = (
	currentMetadata: TTMLMetadata[],
	candidates: MetadataCandidate[],
	selectedValueKeys: string[],
): MetadataMergePreviewItem[] => {
	const mergedValues = buildMetadataValuesFromValueSelection(
		candidates,
		selectedValueKeys,
	);
	const existingValues = new Map<string, Set<string>>();
	for (const entry of currentMetadata) {
		existingValues.set(
			entry.key,
			new Set(entry.value.map((value) => value.trim()).filter(Boolean)),
		);
	}

	const preview: MetadataMergePreviewItem[] = [];
	for (const [key, values] of Object.entries(mergedValues)) {
		const existing = existingValues.get(key) ?? new Set<string>();
		const added: string[] = [];
		const skipped: string[] = [];
		for (const value of values ?? []) {
			const trimmed = value.trim();
			if (!trimmed) continue;
			if (existing.has(trimmed)) {
				skipped.push(trimmed);
			} else {
				added.push(trimmed);
				existing.add(trimmed);
			}
		}
		if (added.length > 0 || skipped.length > 0) {
			preview.push({
				key: key as keyof MetadataValues,
				added,
				skipped,
			});
		}
	}
	return preview;
};

export const flattenMetadataSearchCandidates = (
	result: MetadataSearchResult | null,
	sourceOrder: Array<keyof MetadataSearchResult["sources"]>,
): MetadataCandidate[] => {
	if (!result) return [];
	return sourceOrder.flatMap(
		(source) => result.sources[source]?.candidates ?? [],
	);
};

export const isCandidateSelected = (
	selectedIds: readonly string[],
	candidate: MetadataCandidate,
): boolean => selectedIds.includes(candidateKey(candidate));
