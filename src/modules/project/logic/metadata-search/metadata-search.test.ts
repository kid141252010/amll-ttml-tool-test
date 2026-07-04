import { afterEach, describe, expect, test, vi } from "vitest";
import type { TTMLMetadata } from "$/types/ttml";
import {
	buildMetadataSearchInput,
	canSearchMetadata,
	candidateKey,
	searchMetadata,
	buildMetadataValuesFromSelection,
	formatMetadataSearchError,
} from "./index";
import { defaultMetadataNetworkClient } from "./network";
import {
	splitArtists,
	textMatchScore,
	normalizeMatchText,
	scoreMetadataCandidate,
} from "./matching";
import type {
	MetadataCandidate,
	MetadataNetworkClient,
	MetadataNetworkRequest,
	MetadataSearchInput,
} from "./types";

afterEach(() => {
	vi.unstubAllGlobals();
});

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

describe("metadata network error formatting", () => {
	const mockMetadataHttpResponse = (
		response: { status: number; body: string; contentType?: string },
	) => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				status: 200,
				text: async () => JSON.stringify(response),
			})),
		);
	};

	test("reports upstream HTTP errors with a body prefix", async () => {
		mockMetadataHttpResponse({
			status: 502,
			body: "A server error occurred while handling the metadata request",
			contentType: "text/plain",
		});

		await expect(
			defaultMetadataNetworkClient.requestJson({
				url: "https://api.spotify.com/v1/search",
			}),
		).rejects.toThrow(
			"HTTP 502: A server error occurred while handling the metadata request",
		);
	});

	test("accepts parseable JSON even when the upstream content type is plain text", async () => {
		mockMetadataHttpResponse({
			status: 200,
			body: JSON.stringify({ ok: true }),
			contentType: "text/plain; charset=utf-8",
		});

		await expect(
			defaultMetadataNetworkClient.requestJson({
				url: "https://u.y.qq.com/cgi-bin/musicu.fcg",
			}),
		).resolves.toEqual({ ok: true });
	});

	test("reports non-JSON metadata proxy error responses without raw parser errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: false,
				status: 500,
				text: async () =>
					"A server error occurred while handling the metadata proxy request",
			})),
		);

		await expect(
			defaultMetadataNetworkClient.requestJson({
				url: "https://api.spotify.com/v1/search",
			}),
		).rejects.toThrow(
			"Metadata proxy HTTP 500: A server error occurred while handling the metadata proxy request",
		);
		await expect(
			defaultMetadataNetworkClient.requestJson({
				url: "https://api.spotify.com/v1/search",
			}),
		).rejects.not.toThrow("Unexpected token");
	});

	test("reports non-JSON metadata proxy success responses without raw parser errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				status: 200,
				text: async () =>
					"A server error occurred while handling the metadata proxy request",
			})),
		);

		await expect(
			defaultMetadataNetworkClient.requestJson({
				url: "https://api.spotify.com/v1/search",
			}),
		).rejects.toThrow(
			"Metadata proxy returned invalid JSON: A server error occurred while handling the metadata proxy request",
		);
	});

	test("reports non-JSON upstream responses with the source host and body prefix", async () => {
		mockMetadataHttpResponse({
			status: 200,
			body: "A server error occurred while handling the metadata request",
			contentType: "text/plain",
		});

		await expect(
			defaultMetadataNetworkClient.requestJson({
				url: "https://amp-api.music.apple.com/v1/catalog/us/search",
			}),
		).rejects.toThrow(
			"Invalid JSON response from amp-api.music.apple.com: A server error occurred while handling the metadata request",
		);
	});

	test("sanitizes raw JSON parser errors from unexpected metadata clients", async () => {
		expect(
			formatMetadataSearchError(
				new SyntaxError('Unexpected token \'A\', "A server e"... is not valid JSON'),
			),
		).toBe("元数据服务返回了非 JSON 响应");
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
		const requests: MetadataNetworkRequest[] = [];
		const requestJson: MetadataNetworkClient["requestJson"] = async <T,>(
			request: MetadataNetworkRequest,
		): Promise<T> => {
			const { url, body } = request;
			requests.push(request);
			let response: unknown = {};
			if (url.includes("u.y.qq.com")) {
				response = {
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
			} else if (url.includes("/cloudsearch") && url.includes("type=1")) {
				response = {
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
			} else if (url.includes("music.apple.com")) {
				response = "<html></html>";
			} else if (url.includes("amp-api.music.apple.com")) {
				response = { results: { songs: { data: [] } } };
			}
			return response as T;
		};
		const client: MetadataNetworkClient = {
			requestJson,
			requestText: vi.fn(async () => ""),
		};

		const result = await searchMetadata(input, {
			client,
			spotifyCredentials: null,
			appleMusicToken: "token",
			includeSources: ["qqMusic", "ncmMusic"],
		});

		expect(result.sources.qqMusic?.candidates.map((item) => item.id)).toEqual([
			"224116257",
			"235883438",
		]);
		const qqRequest = requests.find((item) =>
			item.url.includes("u.y.qq.com"),
		);
		expect(qqRequest?.url).toBe("https://u.y.qq.com/cgi-bin/musicu.fcg");
		expect(qqRequest?.headers).toMatchObject({
			Accept: "application/json",
			"Accept-Language": "zh-CN",
			"Cache-Control": "no-cache",
			"Content-Type": "application/json",
			Pragma: "no-cache",
			Referer: "",
			"User-Agent": "QQMusic 14090508(android 12)",
		});
		expect(qqRequest?.body).toContain("玫瑰少年");
		expect(result.sources.ncmMusic?.candidates.map((item) => item.id)).toEqual([
			"1375248354",
			"33894312",
		]);
	});

	test("enriches search context from an existing NetEase id before querying QQ Music", async () => {
		const requests: string[] = [];
		const requestJson: MetadataNetworkClient["requestJson"] = async <T,>(
			request: MetadataNetworkRequest,
		): Promise<T> => {
			const { url, body } = request;
			requests.push(`${url} ${body ?? ""}`);
			let response: unknown = {};
			if (url.includes("/song/detail")) {
				response = {
					songs: [
						{
							id: 1375248354,
							name: "玫瑰少年",
							ar: [{ name: "蔡依林" }],
							al: { name: "UGLY BEAUTY" },
						},
					],
				};
			} else if (url.includes("/lyric/new")) {
				response = { lrc: { lyric: "" } };
			} else if (url.includes("u.y.qq.com")) {
				response = {
					req: {
						data: {
							body: {
								item_song: [
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
			} else if (url.includes("/cloudsearch")) {
				response = { result: { songs: [] } };
			}
			return response as T;
		};
		const client: MetadataNetworkClient = {
			requestJson,
			requestText: vi.fn(async () => ""),
		};

		const result = await searchMetadata(
			{
				artists: [],
				ids: {
					ncmMusicId: ["1375248354"],
					qqMusicId: [],
					spotifyId: [],
					appleMusicId: [],
					isrc: [],
				},
			},
			{
				client,
				spotifyCredentials: null,
				includeSources: ["qqMusic", "ncmMusic"],
			},
		);

		expect(result.sources.qqMusic?.candidates.map((item) => item.id)).toEqual([
			"224116257",
		]);
		expect(requests.find((item) => item.includes("u.y.qq.com"))).toContain(
			"玫瑰少年",
		);
	});

	test("fetches Apple Music details from an existing id without a title", async () => {
		const requestJson: MetadataNetworkClient["requestJson"] = async <T,>(
			request: MetadataNetworkRequest,
		): Promise<T> => {
			let response: unknown = {};
			if (request.url.includes("/songs/1458862568")) {
				response = {
					data: [
						{
							id: "1458862568",
							attributes: {
								name: "玫瑰少年",
								artistName: "蔡依林",
								albumName: "UGLY BEAUTY",
								isrc: "TWA471900001",
								durationInMillis: 209000,
								releaseDate: "2019-04-01",
							},
						},
					],
				};
			}
			return response as T;
		};
		const client: MetadataNetworkClient = {
			requestJson,
			requestText: vi.fn(async () => ""),
		};

		const result = await searchMetadata(
			{
				artists: [],
				ids: {
					ncmMusicId: [],
					qqMusicId: [],
					spotifyId: [],
					appleMusicId: ["1458862568"],
					isrc: [],
				},
			},
			{
				client,
				spotifyCredentials: null,
				appleMusicToken: "token",
				includeSources: ["appleMusic"],
			},
		);

		expect(result.sources.appleMusic?.candidates[0]?.values).toMatchObject({
			appleMusicId: ["1458862568"],
			musicName: ["玫瑰少年"],
			artists: ["蔡依林"],
			album: ["UGLY BEAUTY"],
			isrc: ["TWA471900001"],
		});
	});

	test("uses a configured Apple Music bearer token without fetching music.apple.com pages", async () => {
		const requests: string[] = [];
		const requestJson: MetadataNetworkClient["requestJson"] = async <T,>(
			request: MetadataNetworkRequest,
		): Promise<T> => {
			requests.push(request.url);
			expect(request.headers?.Authorization).toBe("Bearer configured-token");
			if (request.url.includes("/search")) {
				return {
					results: {
						songs: {
							data: [
								{
									id: "1458862568",
									attributes: {
										name: "玫瑰少年",
										artistName: "蔡依林",
										albumName: "UGLY BEAUTY",
										isrc: "TWA471900001",
									},
								},
							],
						},
					},
				} as T;
			}
			return { data: [] } as T;
		};
		const client: MetadataNetworkClient = {
			requestJson,
			requestText: vi.fn(async () => {
				throw new Error("music.apple.com should not be fetched");
			}),
		};

		const result = await searchMetadata(
			{
				...input,
				ids: {
					ncmMusicId: [],
					qqMusicId: [],
					spotifyId: [],
					appleMusicId: [],
					isrc: [],
				},
			},
			{
				client,
				appleMusicToken: "Bearer configured-token",
				spotifyCredentials: null,
				includeSources: ["appleMusic"],
			},
		);

		expect(result.sources.appleMusic?.candidates[0]?.id).toBe("1458862568");
		expect(requests.every((url) => url.includes("amp-api.music.apple.com"))).toBe(
			true,
		);
		expect(client.requestText).not.toHaveBeenCalled();
	});

	test("skips Apple Music on web when no bearer token is configured", async () => {
		const client: MetadataNetworkClient = {
			requestJson: vi.fn(async () => ({})),
			requestText: vi.fn(async () => {
				throw new Error("music.apple.com should not be fetched on web");
			}),
		};

		const result = await searchMetadata(input, {
			client,
			appleMusicToken: null,
			spotifyCredentials: null,
			includeSources: ["appleMusic"],
		});

		expect(client.requestJson).not.toHaveBeenCalled();
		expect(client.requestText).not.toHaveBeenCalled();
		expect(result.sources.appleMusic?.errors).toEqual([
			"缺少 Apple Music Bearer Token，跳过 Apple Music 搜索",
			"Apple Music 未找到带歌曲 ID 的候选",
		]);
	});

	test("reports Apple Music non-JSON failures per storefront without raw parser errors", async () => {
		const client: MetadataNetworkClient = {
			requestJson: vi.fn(async (request: MetadataNetworkRequest) => {
				const host = new URL(request.url).hostname;
				throw new Error(`Invalid JSON response from ${host}: A server error occurred`);
			}),
			requestText: vi.fn(async () => ""),
		};

		const result = await searchMetadata(
			{
				...input,
				ids: {
					ncmMusicId: [],
					qqMusicId: [],
					spotifyId: [],
					appleMusicId: [],
					isrc: [],
				},
			},
			{
				client,
				appleMusicToken: "token",
				spotifyCredentials: null,
				includeSources: ["appleMusic"],
			},
		);

		expect(result.sources.appleMusic?.errors).toEqual([
			"cn: Invalid JSON response from amp-api.music.apple.com: A server error occurred",
			"us: Invalid JSON response from amp-api.music.apple.com: A server error occurred",
			"kr: Invalid JSON response from amp-api.music.apple.com: A server error occurred",
			"jp: Invalid JSON response from amp-api.music.apple.com: A server error occurred",
			"tw: Invalid JSON response from amp-api.music.apple.com: A server error occurred",
			"Apple Music 未找到带歌曲 ID 的候选",
		]);
		expect(result.errors.join("\n")).not.toContain("Unexpected token");
	});

	test("stops Apple Music storefront retries when metadata proxy is unavailable", async () => {
		const client: MetadataNetworkClient = {
			requestJson: vi.fn(async () => {
				throw new Error(
					"Metadata proxy HTTP 500: A server error has occurred FUNCTION_INVOCATION_FAILED fra1::abc",
				);
			}),
			requestText: vi.fn(async () => ""),
		};

		const result = await searchMetadata(
			{
				...input,
				ids: {
					ncmMusicId: [],
					qqMusicId: [],
					spotifyId: [],
					appleMusicId: [],
					isrc: [],
				},
			},
			{
				client,
				appleMusicToken: "token",
				spotifyCredentials: null,
				includeSources: ["appleMusic"],
			},
		);

		expect(client.requestJson).toHaveBeenCalledTimes(1);
		expect(result.sources.appleMusic?.errors).toEqual([
			"元数据代理暂不可用",
			"Apple Music 未找到带歌曲 ID 的候选",
		]);
	});

	test("reports NetEase mirror non-JSON failures with each mirror host", async () => {
		const client: MetadataNetworkClient = {
			requestJson: vi.fn(async (request: MetadataNetworkRequest) => {
				const host = new URL(request.url).hostname;
				throw new Error(`Invalid JSON response from ${host}: A server error occurred`);
			}),
			requestText: vi.fn(async () => ""),
		};

		const result = await searchMetadata(
			{
				...input,
				ids: {
					ncmMusicId: [],
					qqMusicId: [],
					spotifyId: [],
					appleMusicId: [],
					isrc: [],
				},
			},
			{
				client,
				spotifyCredentials: null,
				includeSources: ["ncmMusic"],
			},
		);

		expect(result.sources.ncmMusic?.errors).toEqual([
			"music163.xuanmou.com.cn: Invalid JSON response from music163.xuanmou.com.cn: A server error occurred",
			"neteasecloudmusicapi-main-api.vercel.app: Invalid JSON response from neteasecloudmusicapi-main-api.vercel.app: A server error occurred",
			"api-enhanced-six-beta.vercel.app: Invalid JSON response from api-enhanced-six-beta.vercel.app: A server error occurred",
			"网易云音乐未找到带歌曲 ID 的候选",
		]);
	});

	test("stops NetEase mirror retries when metadata proxy is unavailable", async () => {
		const client: MetadataNetworkClient = {
			requestJson: vi.fn(async () => {
				throw new Error(
					"Metadata proxy HTTP 500: A server error has occurred FUNCTION_INVOCATION_FAILED fra1::abc",
				);
			}),
			requestText: vi.fn(async () => ""),
		};

		const result = await searchMetadata(
			{
				...input,
				ids: {
					ncmMusicId: [],
					qqMusicId: [],
					spotifyId: [],
					appleMusicId: [],
					isrc: [],
				},
			},
			{
				client,
				spotifyCredentials: null,
				includeSources: ["ncmMusic"],
			},
		);

		expect(client.requestJson).toHaveBeenCalledTimes(1);
		expect(result.sources.ncmMusic?.errors).toEqual([
			"元数据代理暂不可用",
			"网易云音乐未找到带歌曲 ID 的候选",
		]);
	});

	test("does not leak raw JSON parser errors when the metadata proxy returns plain text", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: false,
				status: 500,
				text: async () => "A server error occurred while searching metadata",
			})),
		);

		const result = await searchMetadata(input, {
			appleMusicToken: "token",
			spotifyCredentials: null,
			includeSources: ["appleMusic", "ncmMusic"],
		});
		const visibleMessages = [...result.errors, ...result.warnings].join("\n");

		expect(visibleMessages).not.toContain("Unexpected token");
		expect(visibleMessages).toContain(
			"cn: Metadata proxy HTTP 500: A server error occurred while searching metadata",
		);
		expect(visibleMessages).toContain(
			"music163.xuanmou.com.cn: Metadata proxy HTTP 500: A server error occurred while searching metadata",
		);
	});

	test("does not leak raw JSON parser errors thrown by an injected metadata client", async () => {
		const client: MetadataNetworkClient = {
			requestJson: vi.fn(async () => {
				throw new SyntaxError(
					'Unexpected token \'A\', "A server e"... is not valid JSON',
				);
			}),
			requestText: vi.fn(async () => ""),
		};

		const result = await searchMetadata(
			{
				...input,
				ids: {
					ncmMusicId: [],
					qqMusicId: [],
					spotifyId: [],
					appleMusicId: [],
					isrc: [],
				},
			},
			{
				client,
				appleMusicToken: "token",
				spotifyCredentials: null,
				includeSources: ["appleMusic", "ncmMusic"],
			},
		);
		const visibleMessages = [...result.errors, ...result.warnings].join("\n");

		expect(visibleMessages).not.toContain("Unexpected token");
		expect(visibleMessages).toContain("cn: 元数据服务返回了非 JSON 响应");
		expect(visibleMessages).toContain(
			"music163.xuanmou.com.cn: 元数据服务返回了非 JSON 响应",
		);
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
