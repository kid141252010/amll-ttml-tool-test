import type { TTMLMetadata } from "$/types/ttml";
import { enrichMetadataSearchInput } from "./enrichment";
import { formatMetadataSearchError } from "./errors";
import { addUniqueValues, parseNumber, splitArtists, unique } from "./matching";
import {
	createMetadataNetworkClient,
	defaultMetadataNetworkClient,
} from "./network";
import { searchCache, stableSearchCacheKey } from "./search-cache";
import {
	canDiscoverAppleMusicToken,
	fetchFirstAppleMusicTrackById,
	normalizeConfiguredAppleMusicToken,
	searchAppleMusic,
} from "./sources/apple-music";
import { fetchNcmSongDetail, searchNcmMusic } from "./sources/ncm-music";
import { searchQQMusic } from "./sources/qq-music";
import {
	fetchSpotifyToken,
	fetchSpotifyTrackById,
	searchSpotify,
} from "./sources/spotify";
import { tokenCache } from "./token-cache";
import type {
	MetadataCandidate,
	MetadataSearchCallbacks,
	MetadataSearchInput,
	MetadataSearchResult,
	MetadataSource,
	MetadataSourceResult,
	MetadataValueKey,
	MetadataValues,
	SearchMetadataOptions,
} from "./types";

export type {
	MetadataCandidate,
	MetadataNetworkClient,
	MetadataSearchCallbacks,
	MetadataSearchInput,
	MetadataSearchResult,
	MetadataSource,
	MetadataSourceResult,
	MetadataValueKey,
	MetadataValues,
	SearchMetadataOptions,
	SpotifyCredentials,
} from "./types";

const ALL_SOURCES: MetadataSource[] = [
	"appleMusic",
	"qqMusic",
	"spotify",
	"ncmMusic",
];

export { formatMetadataSearchError } from "./errors";

export const buildMetadataSearchInput = (
	metadata: TTMLMetadata[],
): MetadataSearchInput => {
	const valuesFor = (key: string) =>
		metadata.find((entry) => entry.key.toLowerCase() === key.toLowerCase())
			?.value ?? [];
	const firstValue = (key: string) =>
		valuesFor(key)
			.map((value) => value.trim())
			.find((value) => value !== "");
	const idsFor = (key: string) =>
		unique(valuesFor(key).map((value) => value.trim()));

	return {
		title: firstValue("musicName"),
		artists: splitArtists(valuesFor("artists")),
		album: firstValue("album"),
		durationMs:
			parseNumber(firstValue("durationMs")) ??
			parseNumber(firstValue("duration")),
		releaseDate: firstValue("releaseDate"),
		ids: {
			ncmMusicId: idsFor("ncmMusicId"),
			qqMusicId: idsFor("qqMusicId"),
			spotifyId: idsFor("spotifyId"),
			appleMusicId: idsFor("appleMusicId"),
			isrc: idsFor("isrc"),
		},
	};
};

export const clearMetadataSearchCache = () => {
	searchCache.clear();
	tokenCache.clear();
};

export const canSearchMetadata = (input: MetadataSearchInput): boolean =>
	!!input.title?.trim() ||
	input.ids.ncmMusicId.length > 0 ||
	input.ids.qqMusicId.length > 0 ||
	input.ids.spotifyId.length > 0 ||
	input.ids.appleMusicId.length > 0;

export const candidateKey = (candidate: MetadataCandidate): string =>
	[
		candidate.source,
		candidate.region ?? "",
		candidate.matchSource ?? "",
		candidate.id,
	].join(":");

export const buildMetadataValuesFromSelection = (
	result: Pick<MetadataSearchResult, "sources">,
	selectedIds: Iterable<string>,
): MetadataValues => {
	const selectedSet = new Set(selectedIds);
	const values: MetadataValues = {};
	for (const source of Object.values(result.sources)) {
		for (const candidate of source?.candidates ?? []) {
			if (!selectedSet.has(candidateKey(candidate))) continue;
			for (const [key, items] of Object.entries(candidate.values)) {
				addUniqueValues(
					values,
					key as MetadataValueKey,
					Array.isArray(items) ? items : [],
				);
			}
		}
	}
	return values;
};

export const searchMetadata = async (
	input: MetadataSearchInput,
	options: SearchMetadataOptions = {},
	callbacks: MetadataSearchCallbacks = {},
): Promise<MetadataSearchResult> => {
	const result: MetadataSearchResult = {
		sources: {},
		recommendedCandidateIds: [],
		errors: [],
		warnings: [],
	};
	if (!canSearchMetadata(input)) {
		result.errors.push("流媒体 ID 与歌名必须至少提供一个");
		return result;
	}

	const client =
		options.client ??
		(options.metadataProxyUrl === undefined
			? defaultMetadataNetworkClient
			: createMetadataNetworkClient({ proxyUrl: options.metadataProxyUrl }));
	const includeSources = new Set(options.includeSources ?? ALL_SOURCES);
	const totalSources = ALL_SOURCES.filter((source) =>
		includeSources.has(source),
	).length;
	let completedSources = 0;
	const sourceComplete = (
		source: MetadataSource,
		sourceResult: MetadataSourceResult,
	) => {
		completedSources += 1;
		callbacks.onSourceComplete?.(source, sourceResult);
		callbacks.onProgress?.(completedSources, totalSources);
		return sourceResult;
	};
	const enrichedInput = await enrichMetadataSearchInput(
		input,
		client,
		options,
		includeSources,
		result.warnings,
		{
			fetchNcmSongDetail,
			fetchFirstAppleMusicTrackById,
			fetchSpotifyToken,
			fetchSpotifyTrackById,
			canDiscoverAppleMusicToken,
			normalizeConfiguredAppleMusicToken,
		},
	);
	const initialJobs: Promise<[MetadataSource, MetadataSourceResult]>[] = [];
	let qqMusicJob: Promise<[MetadataSource, MetadataSourceResult]> | null = null;
	let ncmMusicJob: Promise<[MetadataSource, MetadataSourceResult]> | null =
		null;
	if (includeSources.has("appleMusic")) {
		initialJobs.push(
			safeSource("appleMusic", () =>
				cachedSourceSearch(
					"appleMusic",
					enrichedInput,
					{
						appleMusicToken: options.appleMusicToken ?? null,
					},
					() =>
						searchAppleMusic(
							enrichedInput,
							client,
							options.appleMusicToken ?? null,
						),
				),
			).then(([source, sourceResult]) => [
				source,
				sourceComplete(source, sourceResult),
			]),
		);
	}
	if (includeSources.has("qqMusic")) {
		qqMusicJob = safeSource("qqMusic", () =>
			cachedSourceSearch("qqMusic", enrichedInput, {}, () =>
				searchQQMusic(enrichedInput, client),
			),
		).then(([source, sourceResult]) => [
			source,
			sourceComplete(source, sourceResult),
		]);
		initialJobs.push(qqMusicJob);
	}
	if (includeSources.has("spotify")) {
		initialJobs.push(
			safeSource("spotify", () =>
				cachedSourceSearch(
					"spotify",
					enrichedInput,
					{
						clientId: options.spotifyCredentials?.clientId ?? null,
					},
					() =>
						searchSpotify(
							enrichedInput,
							client,
							options.spotifyCredentials ?? null,
						),
				),
			).then(([source, sourceResult]) => [
				source,
				sourceComplete(source, sourceResult),
			]),
		);
	}
	if (includeSources.has("ncmMusic")) {
		ncmMusicJob = (qqMusicJob ?? Promise.resolve(null)).then((qqResult) => {
			const qqDefault =
				qqResult?.[1].candidates.find(
					(candidate) => candidate.selectedByDefault,
				) ??
				result.sources.qqMusic?.candidates.find(
					(candidate) => candidate.selectedByDefault,
				);
			return safeSource("ncmMusic", () =>
				cachedSourceSearch(
					"ncmMusic",
					enrichedInput,
					{
						qqDefault: qqDefault ? candidateKey(qqDefault) : null,
					},
					() => searchNcmMusic(enrichedInput, client, qqDefault),
				),
			).then(([source, sourceResult]) => [
				source,
				sourceComplete(source, sourceResult),
			]);
		});
		initialJobs.push(ncmMusicJob);
	}

	for (const [source, sourceResult] of await Promise.all(initialJobs)) {
		result.sources[source] = sourceResult;
	}

	if (ncmMusicJob && !result.sources.ncmMusic) {
		const [source, sourceResult] = await ncmMusicJob;
		result.sources[source] = sourceResult;
	}

	for (const source of ALL_SOURCES) {
		for (const candidate of result.sources[source]?.candidates ?? []) {
			if (candidate.selectedByDefault) {
				result.recommendedCandidateIds.push(candidateKey(candidate));
			}
		}
	}
	for (const source of Object.values(result.sources)) {
		result.errors.push(...(source?.errors ?? []));
	}
	return result;
};

const cachedSourceSearch = (
	source: MetadataSource,
	input: MetadataSearchInput,
	extra: Record<string, unknown>,
	searcher: () => Promise<MetadataSourceResult>,
) =>
	searchCache.getOrSearch(
		stableSearchCacheKey(source, {
			input,
			...extra,
		}),
		searcher,
	);

const safeSource = async (
	source: MetadataSource,
	fn: () => Promise<MetadataSourceResult>,
): Promise<[MetadataSource, MetadataSourceResult]> => {
	try {
		return [source, await fn()];
	} catch (error) {
		return [
			source,
			{
				candidates: [],
				errors: [formatMetadataSearchError(error, `${source} search failed`)],
			},
		];
	}
};
