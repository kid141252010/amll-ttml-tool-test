import { describe, expect, test, vi } from "vitest";
import type { TTMLMetadata } from "$/types/ttml";
import {
	buildMetadataSearchInput,
	canSearchMetadata,
	candidateKey,
	searchMetadata,
	buildMetadataValuesFromSelection,
} from "./index";
import {
	splitArtists,
	textMatchScore,
	normalizeMatchText,
	scoreMetadataCandidate,
} from "./matching";
import type {
	MetadataCandidate,
	MetadataNetworkClient,
	MetadataSearchInput,
} from "./types";

const metadata = (entries: Record<string, string[]>): TTMLMetadata[] =>
	Object.entries(entries).map(([key, value]) => ({ key, value }));

describe("metadata search input and matching", () => {
	test("requires either a title or a platform id to search", () => {
		const isrcOnly = buildMetadataSearchInput(
			metadata({ isrc: ["TWA471900001"] }),
		);
		const titleOnly = buildMetadataSearchInput(metadata({ musicName: ["玫瑰少年"] }));
		const idOnly = buildMetadataSearchInput(metadata({ ncmMusicId: ["1375248354"] }));

		expect(canSearchMetadata(isrcOnly)).toBe(false);
		expect(canSearchMetadata(titleOnly)).toBe(true);
		expect(canSearchMetadata(idOnly)).toBe(true);
	});

	test("extracts title, artists, album and all known ids from TTML metadata", () => {
		const input = buildMetadataSearchInput(
			metadata({
				musicName: ["  玫瑰少年  ", "Rose Boy"],
				artists: ["蔡依林, 五月天", "JOLIN蔡依林"],
				album: ["UGLY BEAUTY"],
				qqMusicId: ["224116257", "001hrIGe3flaPr"],
				spotifyId: ["spotify-track"],
				appleMusicId: ["1458862568"],
				isrc: ["TWA471900001"],
			}),
		);

		expect(input).toEqual({
			title: "玫瑰少年",
			artists: ["蔡依林", "五月天", "JOLIN蔡依林"],
			album: "UGLY BEAUTY",
			ids: {
				ncmMusicId: [],
				qqMusicId: ["224116257", "001hrIGe3flaPr"],
				spotifyId: ["spotify-track"],
				appleMusicId: ["1458862568"],
				isrc: ["TWA471900001"],
			},
		});
	});

	test("normalizes traditional Chinese before scoring", () => {
		expect(normalizeMatchText("浪費眼淚")).toBe(normalizeMatchText("浪费眼泪"));
		expect(textMatchScore("Ella陳嘉樺", "Ella陈嘉桦")).toBe(2);
	});

	test("splits common multi-artist delimiters", () => {
		expect(splitArtists(["Sān-Z & HOYO-MiX", "A、B；C"])).toEqual([
			"Sān-Z",
			"HOYO-MiX",
			"A",
			"B",
			"C",
		]);
	});

	test("ranks instrumental candidates below normal tracks when source title is not instrumental", () => {
		const input: MetadataSearchInput = {
			title: "I Ask",
			artists: ["Sān-Z"],
			album: "I Ask",
			ids: {
				ncmMusicId: [],
				qqMusicId: [],
				spotifyId: [],
				appleMusicId: [],
				isrc: [],
			},
		};
		const instrumental: MetadataCandidate = {
			source: "appleMusic",
			id: "instrumental",
			title: "I Ask - Instrumental",
			artists: ["Sān-Z"],
			album: "I Ask",
			score: 0,
			values: {},
			selectedByDefault: false,
		};
		const normal: MetadataCandidate = {
			source: "appleMusic",
			id: "normal",
			title: "I Ask",
			artists: ["Sān-Z"],
			album: "I Ask",
			score: 0,
			values: {},
			selectedByDefault: false,
		};

		expect(scoreMetadataCandidate(input, normal)).toBeGreaterThan(
			scoreMetadataCandidate(input, instrumental),
		);
		expect(scoreMetadataCandidate(input, instrumental)).toBeLessThan(0);
	});
});

describe("metadata search orchestration", () => {
	const input: MetadataSearchInput = {
		title: "玫瑰少年",
		artists: ["蔡依林"],
		album: "UGLY BEAUTY",
		ids: {
			ncmMusicId: [],
			qqMusicId: [],
			spotifyId: [],
			appleMusicId: ["1458862568"],
			isrc: ["TWA471900001"],
		},
	};

	test("sorts QQ candidates by title, artist and album, then uses QQ context for NetEase", async () => {
		const requests: string[] = [];
		const client: MetadataNetworkClient = {
			requestJson: vi.fn(async ({ url, body }) => {
				requests.push(`${url} ${body ?? ""}`);
				if (url.includes("u.y.qq.com")) {
					return {
						req: {
							data: {
								body: {
									item_song: [
										{
											id: 235883438,
											mid: "0035sVym0anwc4",
											name: "玫瑰少年",
											singer: [{ name: "五月天" }],
											album: { name: "玫瑰少年" },
										},
										{
											id: 224116257,
											mid: "001hrIGe3flaPr",
											name: "玫瑰少年",
											singer: [{ name: "JOLIN蔡依林" }],
											album: { name: "UGLY BEAUTY" },
										},
									],
								},
							},
						},
					};
				}
				if (url.includes("/cloudsearch") && url.includes("type=1")) {
					return {
						result: {
							songs: [
								{
									id: 33894312,
									name: "玫瑰少年",
									ar: [{ name: "五月天" }],
									al: { name: "玫瑰少年" },
								},
								{
									id: 1375248354,
									name: "玫瑰少年",
									ar: [{ name: "蔡依林" }],
									al: { name: "UGLY BEAUTY" },
								},
							],
						},
					};
				}
				if (url.includes("music.apple.com")) {
					return "<html></html>";
				}
				if (url.includes("amp-api.music.apple.com")) {
					return { results: { songs: { data: [] } } };
				}
				return {};
			}),
			requestText: vi.fn(async () => ""),
		};

		const result = await searchMetadata(input, {
			client,
			spotifyCredentials: null,
			appleMusicToken: "token",
			includeSources: ["qqMusic", "ncmMusic"],
		});

		expect(result.sources.qqMusic.candidates.map((item) => item.id)).toEqual([
			"224116257",
			"235883438",
		]);
		expect(result.sources.ncmMusic.candidates.map((item) => item.id)).toEqual([
			"1375248354",
			"33894312",
		]);
		expect(requests.join("\n")).toContain("玫瑰少年");
	});

	test("builds deduped metadata values from selected candidates", () => {
		const qq: MetadataCandidate = {
			source: "qqMusic",
			id: "224116257",
			altIds: ["001hrIGe3flaPr"],
			title: "玫瑰少年",
			artists: ["JOLIN蔡依林"],
			album: "Ugly Beauty",
			score: 100,
			values: {
				qqMusicId: ["224116257", "001hrIGe3flaPr"],
				musicName: ["玫瑰少年"],
				artists: ["JOLIN蔡依林"],
				album: ["Ugly Beauty"],
			},
			selectedByDefault: true,
		};
		const spotifyUs: MetadataCandidate = {
			source: "spotify",
			id: "same-id",
			title: "Rose Boy",
			artists: ["Jolin Tsai"],
			album: "Ugly Beauty",
			region: "US",
			isrc: "TWA471900001",
			score: 98,
			values: {
				spotifyId: ["same-id"],
				musicName: ["Rose Boy"],
				isrc: ["TWA471900001"],
			},
			selectedByDefault: true,
		};
		const spotifyKr: MetadataCandidate = {
			...spotifyUs,
			title: "로즈 보이",
			region: "KR",
			values: {
				spotifyId: ["same-id"],
				musicName: ["로즈 보이"],
				isrc: ["TWA471900001"],
			},
		};
		const result = {
			sources: {
				qqMusic: { candidates: [qq], errors: [] },
				spotify: { candidates: [spotifyUs, spotifyKr], errors: [] },
			},
			recommendedCandidateIds: [
				candidateKey(qq),
				candidateKey(spotifyUs),
				candidateKey(spotifyKr),
			],
			errors: [],
			warnings: [],
		};

		expect(
			buildMetadataValuesFromSelection(result, result.recommendedCandidateIds),
		).toEqual({
			qqMusicId: ["224116257", "001hrIGe3flaPr"],
			musicName: ["玫瑰少年", "Rose Boy", "로즈 보이"],
			artists: ["JOLIN蔡依林"],
			album: ["Ugly Beauty"],
			spotifyId: ["same-id"],
			isrc: ["TWA471900001"],
		});
	});
});
