import type { TTMLMetadata } from "$/types/ttml";
import { buildMetadataValuesFromSelection, candidateKey } from "./index";
import type {
	MetadataCandidate,
	MetadataSearchResult,
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

export const buildMetadataMergePreview = (
	currentMetadata: TTMLMetadata[],
	candidates: MetadataCandidate[],
	selectedIds: string[],
): MetadataMergePreviewItem[] => {
	const sourceResult: Pick<MetadataSearchResult, "sources"> = {
		sources: {
			appleMusic: { candidates, errors: [] },
		},
	};
	const mergedValues = buildMetadataValuesFromSelection(
		sourceResult,
		selectedIds,
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
