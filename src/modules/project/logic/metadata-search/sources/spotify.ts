import {
	addUniqueValue,
	addUniqueValues,
	nestedGet,
	parseNumber,
	scoreMetadataCandidate,
	stringify,
} from "../matching";
import { defaultTokenExpiresAt, tokenCache } from "../token-cache";
import type {
	MetadataCandidate,
	MetadataNetworkClient,
	MetadataSearchInput,
	MetadataSourceResult,
	MetadataValues,
	SpotifyCredentials,
} from "../types";
import {
	compareIndex,
	dedupeByKey,
	ensureOneSelectedPerRegion,
	parseAlbum,
	parseArtists,
	sourceResult,
} from "./common";

const SPOTIFY_MARKETS = ["US", "KR", "JP", "TW"];

export const searchSpotify = async (
	input: MetadataSearchInput,
	client: MetadataNetworkClient,
	credentials: SpotifyCredentials | null,
): Promise<MetadataSourceResult> => {
	if (!credentials?.clientId || !credentials.clientSecret) {
		return sourceResult(
			[],
			["缺少 Spotify Client ID 或 Client Secret，跳过 Spotify 搜索"],
		);
	}
	const token = await fetchSpotifyToken(client, credentials);
	const candidates: MetadataCandidate[] = [];
	for (const id of input.ids.spotifyId) {
		const candidate = await fetchSpotifyTrackById(
			client,
			token,
			id,
			"US",
			input,
		);
		if (candidate) candidates.push(candidate);
	}
	for (const market of SPOTIFY_MARKETS) {
		for (const query of spotifySearchQueries(input)) {
			const url = new URL("https://api.spotify.com/v1/search");
			url.searchParams.set("q", query);
			url.searchParams.set("type", "track");
			url.searchParams.set("market", market);
			url.searchParams.set("limit", "20");
			const payload = await client.requestJson({
				url: url.toString(),
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/json",
				},
			});
			candidates.push(...parseSpotifyCandidates(payload, input, market));
			if (dedupeByKey(candidates, (candidate) => candidate.id).length >= 5) {
				break;
			}
		}
	}
	const sorted = dedupeByKey(
		candidates.sort(
			(left, right) =>
				right.score - left.score ||
				SPOTIFY_MARKETS.indexOf(left.region ?? "") -
					SPOTIFY_MARKETS.indexOf(right.region ?? "") ||
				compareIndex(left, right),
		),
		(candidate) => `${candidate.region ?? ""}:${candidate.id}`,
	);
	return sourceResult(
		ensureOneSelectedPerRegion(sorted),
		sorted.length === 0 ? ["Spotify 未找到带 track id 的候选"] : [],
	);
};

export const fetchSpotifyToken = async (
	client: MetadataNetworkClient,
	credentials: SpotifyCredentials,
) => {
	return tokenCache.getOrFetch(`spotify:${credentials.clientId}`, async () => {
		const payload = await client.requestJson({
			url: "https://accounts.spotify.com/api/token",
			method: "POST",
			headers: {
				Accept: "application/json",
				Authorization: `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "client_credentials",
			}).toString(),
		});
		const token = stringify(
			(payload as { access_token?: unknown }).access_token,
		);
		if (!token)
			throw new Error("Spotify token response did not include access_token");
		const expiresIn = parseNumber(
			(payload as { expires_in?: unknown }).expires_in,
		);
		return {
			token,
			expiresAt: expiresIn
				? Date.now() + expiresIn * 1000
				: defaultTokenExpiresAt(),
		};
	});
};

export const fetchSpotifyTrackById = async (
	client: MetadataNetworkClient,
	token: string,
	id: string,
	market: string,
	input: MetadataSearchInput,
): Promise<MetadataCandidate | null> => {
	const url = new URL(`https://api.spotify.com/v1/tracks/${id}`);
	url.searchParams.set("market", market);
	const payload = await client.requestJson({
		url: url.toString(),
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
	});
	return parseSpotifyTrack(payload, input, market, 0, "id");
};

const parseSpotifyCandidates = (
	payload: unknown,
	input: MetadataSearchInput,
	market: string,
): MetadataCandidate[] => {
	const tracks = nestedGet(payload, "tracks", "items");
	if (!Array.isArray(tracks)) return [];
	return tracks
		.map((track, index) =>
			parseSpotifyTrack(track, input, market, index, "search"),
		)
		.filter((candidate): candidate is MetadataCandidate => candidate !== null);
};

const parseSpotifyTrack = (
	track: unknown,
	input: MetadataSearchInput,
	market: string,
	sourceIndex: number,
	matchSource: string,
): MetadataCandidate | null => {
	if (!track || typeof track !== "object") return null;
	const record = track as Record<string, unknown>;
	const id = stringify(record.id);
	if (!id) return null;
	const albumRecord =
		record.album && typeof record.album === "object"
			? (record.album as Record<string, unknown>)
			: {};
	const title = stringify(record.name);
	const artists = parseArtists(record.artists);
	const album = parseAlbum(albumRecord);
	const isrc = stringify(nestedGet(record, "external_ids", "isrc"));
	const values: MetadataValues = {};
	addUniqueValue(values, "spotifyId", id);
	addUniqueValue(values, "isrc", isrc);
	addUniqueValue(values, "musicName", title);
	addUniqueValues(values, "artists", artists);
	addUniqueValue(values, "album", album);
	const candidate: MetadataCandidate = {
		source: "spotify",
		id,
		title: title ?? undefined,
		artists,
		album: album ?? undefined,
		region: market,
		isrc: isrc ?? undefined,
		durationMs: parseNumber(record.duration_ms),
		releaseDate: stringify(albumRecord.release_date) ?? undefined,
		score: 0,
		values,
		selectedByDefault: false,
		matchSource,
		sourceIndex,
	};
	return {
		...candidate,
		score: scoreMetadataCandidate(input, candidate, {
			isrc: 1000,
			title: 100,
			artist: 80,
			album: 40,
		}),
	};
};

const spotifySearchQueries = (input: MetadataSearchInput): string[] => {
	const queries: string[] = [];
	if (input.ids.isrc[0]) queries.push(`isrc:${input.ids.isrc[0]}`);
	const loose = [input.title, input.artists.join(" "), input.album]
		.filter(Boolean)
		.join(" ");
	if (loose) queries.push(loose);
	if (input.title && !queries.includes(input.title)) queries.push(input.title);
	const strict = [
		input.title ? `track:${input.title}` : null,
		input.artists.length ? `artist:${input.artists.join(" ")}` : null,
		input.album ? `album:${input.album}` : null,
	]
		.filter(Boolean)
		.join(" ");
	if (strict && !queries.includes(strict)) queries.push(strict);
	return queries;
};
