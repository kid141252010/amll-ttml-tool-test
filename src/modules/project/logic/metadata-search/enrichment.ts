import { formatMetadataSearchError } from "./errors";
import { unique } from "./matching";
import type {
	MetadataCandidate,
	MetadataNetworkClient,
	MetadataSearchInput,
	MetadataSource,
	MetadataValueKey,
	SearchMetadataOptions,
} from "./types";

export interface MetadataSearchEnrichmentDeps {
	fetchNcmSongDetail: (
		id: string,
		client: MetadataNetworkClient,
		input: MetadataSearchInput,
	) => Promise<MetadataCandidate | null>;
	fetchFirstAppleMusicTrackById: (
		client: MetadataNetworkClient,
		configuredToken: string | null,
		id: string,
		input: MetadataSearchInput,
	) => Promise<MetadataCandidate | null>;
	fetchSpotifyToken: (
		client: MetadataNetworkClient,
		credentials: NonNullable<SearchMetadataOptions["spotifyCredentials"]>,
	) => Promise<string>;
	fetchSpotifyTrackById: (
		client: MetadataNetworkClient,
		token: string,
		id: string,
		market: string,
		input: MetadataSearchInput,
	) => Promise<MetadataCandidate | null>;
	canDiscoverAppleMusicToken: (client: MetadataNetworkClient) => boolean;
	normalizeConfiguredAppleMusicToken: (value: string | null) => string | null;
}

export const enrichMetadataSearchInput = async (
	input: MetadataSearchInput,
	client: MetadataNetworkClient,
	options: SearchMetadataOptions,
	includeSources: Set<MetadataSource>,
	warnings: string[],
	deps: MetadataSearchEnrichmentDeps,
): Promise<MetadataSearchInput> => {
	const enriched = cloneMetadataSearchInput(input);
	const shouldEnrichForCrossSearch =
		includeSources.has("qqMusic") || includeSources.has("ncmMusic");
	const appleMusicToken = deps.normalizeConfiguredAppleMusicToken(
		options.appleMusicToken ?? null,
	);

	if (
		input.ids.ncmMusicId.length > 0 &&
		(includeSources.has("ncmMusic") || shouldEnrichForCrossSearch)
	) {
		for (const id of input.ids.ncmMusicId) {
			try {
				const candidate = await deps.fetchNcmSongDetail(id, client, enriched);
				if (candidate) mergeCandidateIntoSearchInput(enriched, candidate);
			} catch (error) {
				warnings.push(
					formatMetadataSearchError(error, "网易云音乐 ID 基础信息补全失败"),
				);
			}
		}
	}

	if (
		input.ids.appleMusicId.length > 0 &&
		(appleMusicToken || deps.canDiscoverAppleMusicToken(client)) &&
		(includeSources.has("appleMusic") || shouldEnrichForCrossSearch)
	) {
		for (const id of input.ids.appleMusicId) {
			const candidate = await deps
				.fetchFirstAppleMusicTrackById(client, appleMusicToken, id, enriched)
				.catch((error) => {
					warnings.push(
						formatMetadataSearchError(error, "Apple Music ID 基础信息补全失败"),
					);
					return null;
				});
			if (candidate) mergeCandidateIntoSearchInput(enriched, candidate);
		}
	}

	if (
		input.ids.spotifyId.length > 0 &&
		options.spotifyCredentials?.clientId &&
		options.spotifyCredentials.clientSecret &&
		(includeSources.has("spotify") || shouldEnrichForCrossSearch)
	) {
		try {
			const token = await deps.fetchSpotifyToken(
				client,
				options.spotifyCredentials,
			);
			for (const id of input.ids.spotifyId) {
				const candidate = await deps.fetchSpotifyTrackById(
					client,
					token,
					id,
					"US",
					enriched,
				);
				if (candidate) mergeCandidateIntoSearchInput(enriched, candidate);
			}
		} catch (error) {
			warnings.push(
				formatMetadataSearchError(error, "Spotify ID 基础信息补全失败"),
			);
		}
	}

	return enriched;
};

export const cloneMetadataSearchInput = (
	input: MetadataSearchInput,
): MetadataSearchInput => ({
	title: input.title,
	artists: [...input.artists],
	album: input.album,
	durationMs: input.durationMs,
	releaseDate: input.releaseDate,
	ids: {
		ncmMusicId: [...input.ids.ncmMusicId],
		qqMusicId: [...input.ids.qqMusicId],
		spotifyId: [...input.ids.spotifyId],
		appleMusicId: [...input.ids.appleMusicId],
		isrc: [...input.ids.isrc],
	},
});

export const mergeCandidateIntoSearchInput = (
	input: MetadataSearchInput,
	candidate: MetadataCandidate,
) => {
	if (!input.title?.trim()) {
		input.title = candidate.values.musicName?.[0] ?? candidate.title;
	}
	if (!input.album?.trim()) {
		input.album = candidate.values.album?.[0] ?? candidate.album;
	}
	if (input.durationMs === undefined && candidate.durationMs !== undefined) {
		input.durationMs = candidate.durationMs;
	}
	if (!input.releaseDate && candidate.releaseDate) {
		input.releaseDate = candidate.releaseDate;
	}
	input.artists = unique([
		...input.artists,
		...(candidate.values.artists ?? []),
	]);
	input.ids.ncmMusicId = unique([
		...input.ids.ncmMusicId,
		...(candidate.values.ncmMusicId ?? []),
	]);
	input.ids.qqMusicId = unique([
		...input.ids.qqMusicId,
		...(candidate.values.qqMusicId ?? []),
	]);
	input.ids.spotifyId = unique([
		...input.ids.spotifyId,
		...(candidate.values.spotifyId ?? []),
	]);
	input.ids.appleMusicId = unique([
		...input.ids.appleMusicId,
		...(candidate.values.appleMusicId ?? []),
	]);
	input.ids.isrc = unique([
		...input.ids.isrc,
		...(candidate.values.isrc ?? []),
	]);
};

export const mergeMetadataValuesIntoCandidate = (
	candidate: MetadataCandidate,
	key: MetadataValueKey,
	values: string[],
) => {
	const existing = candidate.values[key] ?? [];
	candidate.values[key] = unique([...existing, ...values]);
};
