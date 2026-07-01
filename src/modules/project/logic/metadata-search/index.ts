import type { TTMLMetadata } from "$/types/ttml";
import { extractLyricMetadata } from "$/modules/project/utils/metadata-matcher";
import {
	addTextWithSimplifiedVariants,
	addUniqueValue,
	addUniqueValues,
	nestedGet,
	parseNumber,
	sameIdentifier,
	sameRawText,
	scoreMetadataCandidate,
	splitArtists,
	stringify,
	textMatchScore,
	unique,
} from "./matching";
import { defaultMetadataNetworkClient } from "./network";
import type {
	MetadataCandidate,
	MetadataNetworkClient,
	MetadataSearchInput,
	MetadataSearchResult,
	MetadataSource,
	MetadataSourceResult,
	MetadataValues,
	MetadataValueKey,
	SearchMetadataOptions,
	SpotifyCredentials,
} from "./types";

export type {
	MetadataCandidate,
	MetadataNetworkClient,
	MetadataSearchInput,
	MetadataSearchResult,
	MetadataSource,
	MetadataSourceResult,
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

const APPLE_STOREFRONTS = ["cn", "us", "kr", "jp", "tw"];
const SPOTIFY_MARKETS = ["US", "KR", "JP", "TW"];
const NCM_API_BASES = [
	"https://music163.xuanmou.com.cn",
	"https://neteasecloudmusicapi-main-api.vercel.app",
	"https://api-enhanced-six-beta.vercel.app",
];

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
	const idsFor = (key: string) => unique(valuesFor(key).map((value) => value.trim()));

	return {
		title: firstValue("musicName"),
		artists: splitArtists(valuesFor("artists")),
		album: firstValue("album"),
		ids: {
			ncmMusicId: idsFor("ncmMusicId"),
			qqMusicId: idsFor("qqMusicId"),
			spotifyId: idsFor("spotifyId"),
			appleMusicId: idsFor("appleMusicId"),
			isrc: idsFor("isrc"),
		},
	};
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

export const formatMetadataSearchError = (
	error: unknown,
	fallback = "元数据搜索失败",
): string => {
	const message =
		error instanceof Error ? error.message : (stringify(error) ?? fallback);
	if (isRawJsonParseError(message)) {
		return "元数据服务返回了非 JSON 响应";
	}
	return message || fallback;
};

export const searchMetadata = async (
	input: MetadataSearchInput,
	options: SearchMetadataOptions = {},
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

	const client = options.client ?? defaultMetadataNetworkClient;
	const includeSources = new Set(options.includeSources ?? ALL_SOURCES);
	const enrichedInput = await enrichMetadataSearchInput(
		input,
		client,
		options,
		includeSources,
		result.warnings,
	);
	const initialJobs: Promise<[MetadataSource, MetadataSourceResult]>[] = [];
	if (includeSources.has("appleMusic")) {
		initialJobs.push(
			safeSource("appleMusic", () =>
				searchAppleMusic(enrichedInput, client, options.appleMusicToken ?? null),
			),
		);
	}
	if (includeSources.has("qqMusic")) {
		initialJobs.push(safeSource("qqMusic", () => searchQQMusic(enrichedInput, client)));
	}
	if (includeSources.has("spotify")) {
		initialJobs.push(
			safeSource("spotify", () =>
				searchSpotify(enrichedInput, client, options.spotifyCredentials ?? null),
			),
		);
	}

	for (const [source, sourceResult] of await Promise.all(initialJobs)) {
		result.sources[source] = sourceResult;
	}

	if (includeSources.has("ncmMusic")) {
		const qqDefault = result.sources.qqMusic?.candidates.find(
			(candidate) => candidate.selectedByDefault,
		);
		const [source, sourceResult] = await safeSource("ncmMusic", () =>
			searchNcmMusic(enrichedInput, client, qqDefault),
		);
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

const enrichMetadataSearchInput = async (
	input: MetadataSearchInput,
	client: MetadataNetworkClient,
	options: SearchMetadataOptions,
	includeSources: Set<MetadataSource>,
	warnings: string[],
): Promise<MetadataSearchInput> => {
	const enriched = cloneMetadataSearchInput(input);
	const shouldEnrichForCrossSearch =
		includeSources.has("qqMusic") || includeSources.has("ncmMusic");

	if (
		input.ids.ncmMusicId.length > 0 &&
		(includeSources.has("ncmMusic") || shouldEnrichForCrossSearch)
	) {
		for (const id of input.ids.ncmMusicId) {
			try {
				const candidate = await fetchNcmSongDetail(id, client, enriched);
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
		(includeSources.has("appleMusic") || shouldEnrichForCrossSearch)
	) {
		for (const id of input.ids.appleMusicId) {
			const candidate = await fetchFirstAppleMusicTrackById(
				client,
				options.appleMusicToken ?? null,
				id,
				enriched,
			).catch((error) => {
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
			const token = await fetchSpotifyToken(client, options.spotifyCredentials);
			for (const id of input.ids.spotifyId) {
				const candidate = await fetchSpotifyTrackById(
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

const cloneMetadataSearchInput = (
	input: MetadataSearchInput,
): MetadataSearchInput => ({
	title: input.title,
	artists: [...input.artists],
	album: input.album,
	ids: {
		ncmMusicId: [...input.ids.ncmMusicId],
		qqMusicId: [...input.ids.qqMusicId],
		spotifyId: [...input.ids.spotifyId],
		appleMusicId: [...input.ids.appleMusicId],
		isrc: [...input.ids.isrc],
	},
});

const mergeCandidateIntoSearchInput = (
	input: MetadataSearchInput,
	candidate: MetadataCandidate,
) => {
	if (!input.title?.trim()) {
		input.title = candidate.values.musicName?.[0] ?? candidate.title;
	}
	if (!input.album?.trim()) {
		input.album = candidate.values.album?.[0] ?? candidate.album;
	}
	input.artists = unique([...input.artists, ...(candidate.values.artists ?? [])]);
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
	input.ids.isrc = unique([...input.ids.isrc, ...(candidate.values.isrc ?? [])]);
};

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

const sourceResult = (
	candidates: MetadataCandidate[],
	errors: string[] = [],
): MetadataSourceResult => ({
	candidates,
	errors,
});

const searchQQMusic = async (
	input: MetadataSearchInput,
	client: MetadataNetworkClient,
): Promise<MetadataSourceResult> => {
	if (!input.title) {
		const errors =
			input.ids.qqMusicId.length > 0
				? ["QQ 音乐暂不支持仅凭 ID 反查详情，请补充歌名后搜索"]
				: ["未读取到歌名，跳过 QQ 音乐搜索"];
		return sourceResult([], errors);
	}

	const payload = qqMusicSearchPayload(input.title);
	const response = await client.requestJson({
		url: "http://u.y.qq.com/cgi-bin/musicu.fcg",
		method: "POST",
		headers: {
			"Accept-Language": "zh-CN",
			Accept: "application/json",
			"Content-Type": "application/json",
			"User-Agent": "QQMusic 14090508(android 12)",
		},
		body: JSON.stringify(payload),
	});
	const candidates = parseQQMusicCandidates(response)
		.map((candidate) => ({
			...candidate,
			score: scoreMetadataCandidate(input, candidate, {
				title: 100,
				artist: 60,
				album: 30,
				isrc: 0,
			}),
		}))
		.sort((left, right) => right.score - left.score || compareIndex(left, right))
		.map((candidate, index) => ({
			...candidate,
			sourceIndex: index,
			selectedByDefault: index === 0,
		}));
	return sourceResult(
		candidates,
		candidates.length === 0 ? ["QQ 音乐未找到带 songid 和 mid 的候选"] : [],
	);
};

const parseQQMusicCandidates = (payload: unknown): MetadataCandidate[] => {
	const songs = nestedGet(payload, "req", "data", "body", "item_song");
	if (!Array.isArray(songs)) return [];
	const candidates: MetadataCandidate[] = [];
	for (const [index, song] of songs.entries()) {
		if (!song || typeof song !== "object") continue;
		const record = song as Record<string, unknown>;
		const songId = stringify(record.id) ?? stringify(record.songid);
		const mid = stringify(record.mid) ?? stringify(record.songmid);
		if (!songId || !mid) continue;
		const title = stringify(record.name) ?? stringify(record.title);
		const subtitle = stringify(record.subtitle);
		const artists = parseArtists(record.singer);
		const album = parseAlbum(record.album);
		const values: MetadataValues = {};
		addUniqueValue(values, "qqMusicId", songId);
		addUniqueValue(values, "qqMusicId", mid);
		addUniqueValue(values, "musicName", title);
		if (subtitle && !sameRawText(subtitle, title)) {
			addUniqueValue(values, "musicName", subtitle);
		}
		addUniqueValues(values, "artists", artists);
		addUniqueValue(values, "album", album);
		candidates.push({
			source: "qqMusic",
			id: songId,
			altIds: [mid],
			title: title ?? undefined,
			artists,
			album,
			score: 0,
			values,
			selectedByDefault: false,
			sourceIndex: index,
		});
	}
	return candidates;
};

const qqMusicSearchPayload = (query: string) => ({
	comm: {
		ct: "11",
		cv: "14090508",
		v: "14090508",
		tmeAppID: "qqmusic",
		phonetype: "EBG-AN10",
		deviceScore: "553.47",
		devicelevel: "50",
		newdevicelevel: "20",
		rom: "HuaWei/EMOTION/EmotionUI_14.2.0",
		os_ver: "12",
		OpenUDID: "0",
		OpenUDID2: "0",
		QIMEI36: "0",
		udid: "0",
		chid: "0",
		aid: "0",
		oaid: "0",
		taid: "0",
		tid: "0",
		wid: "0",
		uid: "0",
		sid: "0",
		modeSwitch: "6",
		teenMode: "0",
		ui_mode: "2",
		nettype: "1020",
		v4ip: "",
	},
	req: {
		module: "music.search.SearchCgiService",
		method: "DoSearchForQQMusicMobile",
		param: {
			search_type: 0,
			query,
			page_num: 1,
			num_per_page: 30,
			highlight: 0,
			nqc_flag: 0,
			multi_zhida: 0,
			cat: 2,
			grp: 1,
			sin: 0,
			sem: 0,
		},
	},
});

const searchNcmMusic = async (
	input: MetadataSearchInput,
	client: MetadataNetworkClient,
	qqCandidate: MetadataCandidate | undefined,
): Promise<MetadataSourceResult> => {
	const candidates: MetadataCandidate[] = [];
	const errors: string[] = [];
	for (const id of input.ids.ncmMusicId) {
		try {
			const candidate = await fetchNcmSongDetail(id, client, input);
			if (candidate) candidates.push(candidate);
		} catch (error) {
			errors.push(formatMetadataSearchError(error, "网易云音乐 ID 反查失败"));
		}
	}

	const context = buildNcmContext(input, qqCandidate);
	if (context.titles.length === 0) {
		return sourceResult(candidates, [
			...errors,
			...(candidates.length ? [] : ["未读取到歌名，跳过网易云音乐搜索"]),
		]);
	}

	for (const base of NCM_API_BASES) {
		try {
			const searched = await searchNcmBase(base, context, input, client);
			candidates.push(...searched);
			if (searched.length > 0) break;
		} catch (error) {
			errors.push(
				`${hostForUrl(base)}: ${formatMetadataSearchError(error, "搜索失败")}`,
			);
		}
	}

	const deduped = dedupeByKey(candidates, (candidate) => candidate.id)
		.sort((left, right) => right.score - left.score || compareIndex(left, right))
		.map((candidate, index) => ({
			...candidate,
			sourceIndex: index,
			selectedByDefault: index === 0,
		}));
	return sourceResult(
		deduped,
		deduped.length === 0 ? [...errors, "网易云音乐未找到带歌曲 ID 的候选"] : errors,
	);
};

const searchNcmBase = async (
	base: string,
	context: NcmSearchContext,
	input: MetadataSearchInput,
	client: MetadataNetworkClient,
): Promise<MetadataCandidate[]> => {
	const candidates: MetadataCandidate[] = [];
	for (const title of context.titles) {
		const url = new URL(`${base}/cloudsearch`);
		url.searchParams.set("keywords", title);
		url.searchParams.set("limit", "100");
		url.searchParams.set("offset", "0");
		url.searchParams.set("type", "1");
		const payload = await client.requestJson({ url: url.toString() });
		candidates.push(...parseNcmSongCandidates(payload, input, context));
	}
	return candidates;
};

const fetchNcmSongDetail = async (
	id: string,
	client: MetadataNetworkClient,
	input: MetadataSearchInput,
): Promise<MetadataCandidate | null> => {
	const detailUrl = new URL("https://ncmapi.bikonoo.com/song/detail");
	detailUrl.searchParams.set("ids", id);
	detailUrl.searchParams.set("timestamp", Date.now().toString());
	detailUrl.searchParams.set("randomCNIP", "true");
	const lyricUrl = new URL("https://ncmapi.bikonoo.com/lyric/new");
	lyricUrl.searchParams.set("id", id);
	lyricUrl.searchParams.set("timestamp", Date.now().toString());
	lyricUrl.searchParams.set("randomCNIP", "true");
	const [detail, lyric] = await Promise.all([
		client.requestJson({ url: detailUrl.toString() }),
		client.requestJson({ url: lyricUrl.toString() }).catch(() => null),
	]);
	const song = Array.isArray((detail as { songs?: unknown[] }).songs)
		? (detail as { songs: unknown[] }).songs[0]
		: null;
	if (!song || typeof song !== "object") return null;
	const candidates = parseNcmSongCandidates(
		{ result: { songs: [song] } },
		input,
		buildNcmContext(input),
	);
	const candidate = candidates[0];
	if (!candidate) return null;
	const lyricText = stringify(nestedGet(lyric, "lrc", "lyric")) ?? "";
	const lyricMetadata = extractLyricMetadata(lyricText);
	for (const [key, values] of Object.entries(lyricMetadata)) {
		addUniqueValues(
			candidate.values,
			key as MetadataValueKey,
			values.filter(Boolean),
		);
	}
	return {
		...candidate,
		id,
		selectedByDefault: true,
		matchSource: "id",
	};
};

const parseNcmSongCandidates = (
	payload: unknown,
	input: MetadataSearchInput,
	context: NcmSearchContext,
): MetadataCandidate[] => {
	const songs = nestedGet(payload, "result", "songs");
	if (!Array.isArray(songs)) return [];
	const candidates: MetadataCandidate[] = [];
	for (const [index, song] of songs.entries()) {
		if (!song || typeof song !== "object") continue;
		const record = song as Record<string, unknown>;
		const id = stringify(record.id) ?? stringify(record.songid);
		if (!id) continue;
		const title = stringify(record.name) ?? stringify(record.title);
		const aliases = parseAliases(record, ["alia", "alias", "tns"]);
		const artists = parseArtists(record.ar ?? record.artists);
		const album = parseAlbum(record.al ?? record.album);
		const values: MetadataValues = {};
		addUniqueValue(values, "ncmMusicId", id);
		addUniqueValue(values, "musicName", title);
		addUniqueValues(values, "musicName", aliases);
		addUniqueValues(values, "artists", artists);
		addUniqueValue(values, "album", album);
		const candidate: MetadataCandidate = {
			source: "ncmMusic",
			id,
			title: title ?? undefined,
			artists,
			album,
			score: 0,
			values,
			selectedByDefault: false,
			sourceIndex: index,
		};
		const titleScore = Math.max(
			...context.titles.flatMap((expected) =>
				[title, ...aliases].map((actual) => textMatchScore(expected, actual)),
			),
			0,
		);
		let score = titleScore * 100;
		for (const artist of context.artists) {
			score +=
				Math.max(
					...artists.map((candidateArtist) =>
						textMatchScore(artist, candidateArtist),
					),
					0,
				) * 60;
		}
		score +=
			Math.max(...context.albums.map((expected) => textMatchScore(expected, album)), 0) *
			30;
		candidates.push({
			...candidate,
			score: Math.max(score, scoreMetadataCandidate(input, candidate)),
		});
	}
	return candidates;
};

type NcmSearchContext = {
	titles: string[];
	artists: string[];
	albums: string[];
};

const buildNcmContext = (
	input: MetadataSearchInput,
	qqCandidate?: MetadataCandidate,
): NcmSearchContext => {
	const titles: string[] = [];
	const artists: string[] = [];
	const albums: string[] = [];
	addTextWithSimplifiedVariants(titles, input.title);
	for (const artist of input.artists) {
		addTextWithSimplifiedVariants(artists, artist);
	}
	addTextWithSimplifiedVariants(albums, input.album);
	addTextWithSimplifiedVariants(titles, qqCandidate?.title);
	for (const artist of qqCandidate?.artists ?? []) {
		addTextWithSimplifiedVariants(artists, artist);
	}
	addTextWithSimplifiedVariants(albums, qqCandidate?.album);
	return { titles, artists, albums };
};

const searchAppleMusic = async (
	input: MetadataSearchInput,
	client: MetadataNetworkClient,
	configuredToken: string | null,
): Promise<MetadataSourceResult> => {
	const candidates: MetadataCandidate[] = [];
	const errors: string[] = [];
	if (!input.title && input.ids.appleMusicId.length === 0) {
		return sourceResult([], ["未读取到歌名，跳过 Apple Music 搜索"]);
	}

	for (const storefront of APPLE_STOREFRONTS) {
		try {
			const token =
				configuredToken ?? (await fetchAppleMusicBearerToken(client, storefront));
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
				candidates.push(...parseAppleMusicCandidates(payload, input, storefront));
			}
		} catch (error) {
			errors.push(
				`${storefront}: ${formatMetadataSearchError(error, "Apple Music 搜索失败")}`,
			);
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

const fetchFirstAppleMusicTrackById = async (
	client: MetadataNetworkClient,
	configuredToken: string | null,
	id: string,
	input: MetadataSearchInput,
): Promise<MetadataCandidate | null> => {
	let lastError: unknown = null;
	for (const storefront of APPLE_STOREFRONTS) {
		try {
			const token =
				configuredToken ?? (await fetchAppleMusicBearerToken(client, storefront));
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
	const page = await client.requestText({
		url: `https://music.apple.com/${storefront}/search`,
		headers: { Accept: "text/html,*/*", "User-Agent": "Mozilla/5.0" },
	});
	const moduleSources = Array.from(
		page.matchAll(
			/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/gi,
		),
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

const appleMusicSearchQuery = (input: MetadataSearchInput) =>
	[
		input.title,
		input.artists.join(" "),
		input.album,
		input.ids.isrc[0],
	]
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

const searchSpotify = async (
	input: MetadataSearchInput,
	client: MetadataNetworkClient,
	credentials: SpotifyCredentials | null,
): Promise<MetadataSourceResult> => {
	if (!credentials?.clientId || !credentials.clientSecret) {
		return sourceResult([], ["缺少 Spotify Client ID 或 Client Secret，跳过 Spotify 搜索"]);
	}
	const token = await fetchSpotifyToken(client, credentials);
	const candidates: MetadataCandidate[] = [];
	for (const id of input.ids.spotifyId) {
		const candidate = await fetchSpotifyTrackById(client, token, id, "US", input);
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

const fetchSpotifyToken = async (
	client: MetadataNetworkClient,
	credentials: SpotifyCredentials,
) => {
	const payload = await client.requestJson({
		url: "https://accounts.spotify.com/api/token",
		method: "POST",
		headers: {
			Accept: "application/json",
			Authorization: `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
	});
	const token = stringify((payload as { access_token?: unknown }).access_token);
	if (!token) throw new Error("Spotify token response did not include access_token");
	return token;
};

const fetchSpotifyTrackById = async (
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
		.map((track, index) => parseSpotifyTrack(track, input, market, index, "search"))
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

const ensureOneSelectedPerRegion = (
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

const parseArtists = (value: unknown): string[] => {
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

const parseAlbum = (value: unknown): string | undefined => {
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return stringify(record.name) ?? stringify(record.title) ?? undefined;
	}
	return stringify(value) ?? undefined;
};

const parseAliases = (
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

const compareIndex = (
	left: Pick<MetadataCandidate, "sourceIndex">,
	right: Pick<MetadataCandidate, "sourceIndex">,
) => (left.sourceIndex ?? 0) - (right.sourceIndex ?? 0);

const dedupeByKey = (
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

const hostForUrl = (url: string): string => {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
};

const isRawJsonParseError = (message: string): boolean =>
	/Unexpected token .* is not valid JSON/i.test(message) ||
	/Unexpected end of JSON input/i.test(message);
