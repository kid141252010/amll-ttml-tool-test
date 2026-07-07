import {
	formatMetadataSearchError,
	isMetadataProxyUnavailable,
} from "../errors";
import {
	addUniqueValue,
	addUniqueValues,
	nestedGet,
	parseNumber,
	sameIdentifier,
	scoreMetadataCandidate,
	splitArtists,
	stringify,
	textMatchScore,
	unique,
} from "../matching";
import { jwtExpiresAt, tokenCache } from "../token-cache";
import type {
	MetadataCandidate,
	MetadataNetworkClient,
	MetadataSearchInput,
	MetadataSourceResult,
	MetadataValues,
} from "../types";
import {
	compareIndex,
	dedupeByKey,
	ensureOneSelectedPerRegion,
	sourceResult,
} from "./common";

const APPLE_STOREFRONTS = ["cn", "us", "kr", "jp", "tw"];
const APPLE_MUSIC_MISSING_TOKEN_ERROR =
	"缺少 Apple Music Bearer Token，跳过 Apple Music 搜索";

export const searchAppleMusic = async (
	input: MetadataSearchInput,
	client: MetadataNetworkClient,
	configuredToken: string | null,
): Promise<MetadataSourceResult> => {
	const candidates: MetadataCandidate[] = [];
	const errors: string[] = [];
	if (!input.title && input.ids.appleMusicId.length === 0) {
		return sourceResult([], ["未读取到歌名，跳过 Apple Music 搜索"]);
	}
	const configuredBearerToken =
		normalizeConfiguredAppleMusicToken(configuredToken);
	if (!configuredBearerToken && !canDiscoverAppleMusicToken(client)) {
		return sourceResult(
			[],
			[APPLE_MUSIC_MISSING_TOKEN_ERROR, "Apple Music 未找到带歌曲 ID 的候选"],
		);
	}

	for (const storefront of APPLE_STOREFRONTS) {
		try {
			const token =
				configuredBearerToken ??
				(await fetchAppleMusicBearerToken(client, storefront));
			for (const [index, id] of input.ids.appleMusicId.entries()) {
				const candidate = await fetchAppleMusicTrackById(
					client,
					token,
					id,
					storefront,
					input,
					index,
				);
				if (candidate) candidates.push(candidate);
			}
			if (input.title) {
				const url = new URL(
					`https://amp-api.music.apple.com/v1/catalog/${storefront}/search`,
				);
				url.searchParams.set("term", appleMusicSearchQuery(input));
				url.searchParams.set("types", "songs");
				url.searchParams.set("limit", "25");
				const payload = await client.requestJson({
					url: url.toString(),
					headers: appleMusicRequestHeaders(token),
				});
				candidates.push(
					...parseAppleMusicCandidates(payload, input, storefront),
				);
			}
		} catch (error) {
			const formatted = formatMetadataSearchError(
				error,
				"Apple Music 搜索失败",
			);
			if (isMetadataProxyUnavailable(error)) {
				errors.push(formatted);
				break;
			}
			errors.push(`${storefront}: ${formatted}`);
		}
	}

	const sorted = dedupeByKey(
		candidates.sort(
			(left, right) =>
				right.score - left.score ||
				APPLE_STOREFRONTS.indexOf(left.region ?? "") -
					APPLE_STOREFRONTS.indexOf(right.region ?? "") ||
				compareIndex(left, right),
		),
		(candidate) => `${candidate.region ?? ""}:${candidate.id}`,
	).map((candidate) => ({
		...candidate,
		selectedByDefault: appleCandidateAutoMatches(input, candidate),
	}));
	const uniqueErrors = unique(errors);
	return sourceResult(
		ensureOneSelectedPerRegion(sorted),
		sorted.length === 0
			? [...uniqueErrors, "Apple Music 未找到带歌曲 ID 的候选"]
			: uniqueErrors,
	);
};

export const fetchFirstAppleMusicTrackById = async (
	client: MetadataNetworkClient,
	configuredToken: string | null,
	id: string,
	input: MetadataSearchInput,
): Promise<MetadataCandidate | null> => {
	let lastError: unknown = null;
	const configuredBearerToken =
		normalizeConfiguredAppleMusicToken(configuredToken);
	if (!configuredBearerToken && !canDiscoverAppleMusicToken(client)) {
		return null;
	}
	for (const storefront of APPLE_STOREFRONTS) {
		try {
			const token =
				configuredBearerToken ??
				(await fetchAppleMusicBearerToken(client, storefront));
			const candidate = await fetchAppleMusicTrackById(
				client,
				token,
				id,
				storefront,
				input,
				0,
			);
			if (candidate) return candidate;
		} catch (error) {
			if (isMetadataProxyUnavailable(error)) throw error;
			lastError = error;
		}
	}
	if (lastError instanceof Error) throw lastError;
	return null;
};

const fetchAppleMusicTrackById = async (
	client: MetadataNetworkClient,
	token: string,
	id: string,
	storefront: string,
	input: MetadataSearchInput,
	sourceIndex: number,
): Promise<MetadataCandidate | null> => {
	const url = new URL(
		`https://amp-api.music.apple.com/v1/catalog/${storefront}/songs/${id}`,
	);
	const payload = await client.requestJson({
		url: url.toString(),
		headers: appleMusicRequestHeaders(token),
	});
	return (
		parseAppleMusicSongItems(
			nestedGet(payload, "data"),
			input,
			storefront,
			"id",
			sourceIndex,
		)[0] ?? null
	);
};

const parseAppleMusicCandidates = (
	payload: unknown,
	input: MetadataSearchInput,
	storefront: string,
): MetadataCandidate[] => {
	return parseAppleMusicSongItems(
		nestedGet(payload, "results", "songs", "data"),
		input,
		storefront,
		"search",
	);
};

const parseAppleMusicSongItems = (
	songs: unknown,
	input: MetadataSearchInput,
	storefront: string,
	matchSource: "id" | "search",
	sourceIndexOffset = 0,
): MetadataCandidate[] => {
	if (!Array.isArray(songs)) return [];
	const candidates: MetadataCandidate[] = [];
	for (const [index, song] of songs.entries()) {
		if (!song || typeof song !== "object") continue;
		const record = song as Record<string, unknown>;
		const attributes =
			record.attributes && typeof record.attributes === "object"
				? (record.attributes as Record<string, unknown>)
				: {};
		const id = stringify(record.id);
		if (!id) continue;
		const title = stringify(attributes.name);
		const artists = splitArtists([attributes.artistName]);
		const album = stringify(attributes.albumName);
		const isrc = stringify(attributes.isrc);
		const values: MetadataValues = {};
		addUniqueValue(values, "appleMusicId", id);
		addUniqueValue(values, "isrc", isrc);
		addUniqueValue(values, "musicName", title);
		addUniqueValues(values, "artists", artists);
		addUniqueValue(values, "album", album);
		const candidate: MetadataCandidate = {
			source: "appleMusic",
			id,
			title: title ?? undefined,
			artists,
			album: album ?? undefined,
			region: storefront,
			isrc: isrc ?? undefined,
			durationMs: parseNumber(attributes.durationInMillis),
			releaseDate: stringify(attributes.releaseDate) ?? undefined,
			score: 0,
			values,
			selectedByDefault: false,
			matchSource,
			sourceIndex: sourceIndexOffset + index,
		};
		candidates.push({
			...candidate,
			score:
				(matchSource === "id" ? 500 : 0) +
				scoreMetadataCandidate(input, candidate, {
					isrc: 500,
					title: 100,
					artist: 80,
					album: 40,
				}),
		});
	}
	return candidates;
};

const appleMusicRequestHeaders = (token: string) => ({
	Authorization: `Bearer ${normalizeBearerToken(token)}`,
	Origin: "https://music.apple.com",
	Referer: "https://music.apple.com/",
	Accept: "application/json",
});

const fetchAppleMusicBearerToken = async (
	client: MetadataNetworkClient,
	storefront: string,
) => {
	return tokenCache.getOrFetch("apple-music", async () => {
		const discovered = normalizeConfiguredAppleMusicToken(
			(await client.discoverAppleMusicToken?.()) ?? null,
		);
		const token =
			discovered ??
			(await fetchAppleMusicBearerTokenFromPage(client, storefront));
		return {
			token,
			expiresAt: jwtExpiresAt(token),
		};
	});
};

const fetchAppleMusicBearerTokenFromPage = async (
	client: MetadataNetworkClient,
	storefront: string,
) => {
	const page = await client.requestText({
		url: `https://music.apple.com/${storefront}/search`,
		headers: { Accept: "text/html,*/*", "User-Agent": "Mozilla/5.0" },
	});
	const moduleSources = Array.from(
		page.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/gi),
	).map((match) => match[1]);
	for (const source of moduleSources) {
		if (!source) continue;
		const scriptUrl = new URL(source, "https://music.apple.com/").toString();
		const script = await client.requestText({
			url: scriptUrl,
			headers: { Accept: "text/javascript,*/*", "User-Agent": "Mozilla/5.0" },
		});
		const token = script.match(/eyJhbGciOiJ[^"']+/)?.[0];
		if (token) return token;
	}
	throw new Error("failed to find Apple Music bearer token");
};

const normalizeBearerToken = (value: string) =>
	value.replace(/^Bearer\s+/i, "").trim();

export const normalizeConfiguredAppleMusicToken = (
	value: string | null,
): string | null => {
	const token = normalizeBearerToken(value ?? "");
	return token || null;
};

export const canDiscoverAppleMusicToken = (
	_client: MetadataNetworkClient,
): boolean => true;

const appleMusicSearchQuery = (input: MetadataSearchInput) =>
	[input.title, input.artists.join(" "), input.album, input.ids.isrc[0]]
		.filter(Boolean)
		.join(" ");

const appleCandidateAutoMatches = (
	input: MetadataSearchInput,
	candidate: MetadataCandidate,
) => {
	if (candidate.matchSource === "id") return true;
	if (input.ids.isrc.some((isrc) => sameIdentifier(isrc, candidate.isrc))) {
		return true;
	}
	const artistMatches =
		input.artists.length === 0 ||
		input.artists.some((artist) =>
			candidate.artists.some((candidateArtist) =>
				textMatchScore(artist, candidateArtist),
			),
		);
	return artistMatches && textMatchScore(input.title, candidate.title) > 0;
};
