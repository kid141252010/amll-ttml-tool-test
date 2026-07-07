import { extractLyricMetadata } from "$/modules/project/utils/metadata-matcher";
import {
	formatMetadataSearchError,
	isMetadataProxyUnavailable,
} from "../errors";
import {
	addTextWithSimplifiedVariants,
	addUniqueValue,
	addUniqueValues,
	nestedGet,
	scoreMetadataCandidate,
	stringify,
	textMatchScore,
} from "../matching";
import type {
	MetadataCandidate,
	MetadataNetworkClient,
	MetadataSearchInput,
	MetadataSourceResult,
	MetadataValueKey,
	MetadataValues,
} from "../types";
import {
	compareIndex,
	dedupeByKey,
	hostForUrl,
	parseAlbum,
	parseAliases,
	parseArtists,
	sourceResult,
} from "./common";

const NCM_API_BASES = [
	"https://music163.xuanmou.com.cn",
	"https://neteasecloudmusicapi-main-api.vercel.app",
	"https://api-enhanced-six-beta.vercel.app",
];

export const searchNcmMusic = async (
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
			const formatted = formatMetadataSearchError(error, "搜索失败");
			if (isMetadataProxyUnavailable(error)) {
				errors.push(formatted);
				break;
			}
			errors.push(`${hostForUrl(base)}: ${formatted}`);
		}
	}

	const deduped = dedupeByKey(candidates, (candidate) => candidate.id)
		.sort(
			(left, right) => right.score - left.score || compareIndex(left, right),
		)
		.map((candidate, index) => ({
			...candidate,
			sourceIndex: index,
			selectedByDefault: index === 0,
		}));
	return sourceResult(
		deduped,
		deduped.length === 0
			? [...errors, "网易云音乐未找到带歌曲 ID 的候选"]
			: errors,
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

export const fetchNcmSongDetail = async (
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
			Math.max(
				...context.albums.map((expected) => textMatchScore(expected, album)),
				0,
			) * 30;
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
