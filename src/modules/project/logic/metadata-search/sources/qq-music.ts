import {
	addUniqueValue,
	addUniqueValues,
	nestedGet,
	sameRawText,
	scoreMetadataCandidate,
	stringify,
} from "../matching";
import type {
	MetadataCandidate,
	MetadataNetworkClient,
	MetadataSearchInput,
	MetadataSourceResult,
	MetadataValues,
} from "../types";
import { compareIndex, parseAlbum, parseArtists, sourceResult } from "./common";

export const searchQQMusic = async (
	input: MetadataSearchInput,
	client: MetadataNetworkClient,
): Promise<MetadataSourceResult> => {
	if (!input.title) {
		const errors =
			input.ids.qqMusicId.length > 0
				? ["QQ 音乐暂不支持仅凭 ID 反查详情，请补充歌名后搜索"]
				: ["未读取到歌名，跳过 QQ 音乐搜索"];
		return sourceResult(candidatesFromNone(), errors);
	}

	const payload = qqMusicSearchPayload(input.title);
	const response = await client.requestJson({
		url: "https://u.y.qq.com/cgi-bin/musicu.fcg",
		method: "POST",
		headers: {
			Accept: "application/json",
			"Accept-Language": "zh-CN",
			"Cache-Control": "no-cache",
			"Content-Type": "application/json",
			Pragma: "no-cache",
			Referer: "",
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
		.sort(
			(left, right) => right.score - left.score || compareIndex(left, right),
		)
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

const candidatesFromNone = (): MetadataCandidate[] => [];

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
