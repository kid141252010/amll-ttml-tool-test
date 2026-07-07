import { describe, expect, test } from "vitest";
import {
	filterMetadataRequestHeaders,
	METADATA_NETWORK_ALLOWED_HEADERS,
	METADATA_NETWORK_ALLOWED_HOSTS_LIST,
	METADATA_NETWORK_ALLOWED_METHODS,
	validateMetadataNetworkRequest,
} from "./network-policy";

describe("metadata network policy", () => {
	test("exports serializable policy lists for proxy consumers", () => {
		expect(METADATA_NETWORK_ALLOWED_HOSTS_LIST).toContain("music.apple.com");
		expect(METADATA_NETWORK_ALLOWED_HEADERS).toContain("authorization");
		expect(METADATA_NETWORK_ALLOWED_METHODS).toEqual(["GET", "POST"]);
	});

	test("allows whitelisted GET and POST requests", () => {
		expect(
			validateMetadataNetworkRequest({
				url: "https://api.spotify.com/v1/search?q=Song&type=track",
				method: "GET",
			}).ok,
		).toBe(true);
		expect(
			validateMetadataNetworkRequest({
				url: "https://u.y.qq.com/cgi-bin/musicu.fcg",
				method: "POST",
				body: "{}",
			}).ok,
		).toBe(true);
	});

	test("rejects non-whitelisted hosts, unsupported methods, unsupported protocols, QQ HTTP and large bodies", () => {
		expect(
			validateMetadataNetworkRequest({
				url: "https://example.com/search",
				method: "GET",
			}),
		).toEqual({ ok: false, error: "Host is not allowed" });
		expect(
			validateMetadataNetworkRequest({
				url: "https://api.spotify.com/v1/search",
				method: "DELETE",
			}),
		).toEqual({ ok: false, error: "Method is not allowed" });
		expect(
			validateMetadataNetworkRequest({
				url: "ftp://api.spotify.com/file",
				method: "GET",
			}),
		).toEqual({ ok: false, error: "Protocol is not allowed" });
		expect(
			validateMetadataNetworkRequest({
				url: "http://u.y.qq.com/cgi-bin/musicu.fcg",
				method: "POST",
				body: "{}",
			}),
		).toEqual({ ok: false, error: "Protocol is not allowed" });
		expect(
			validateMetadataNetworkRequest({
				url: "https://api.spotify.com/v1/search",
				method: "POST",
				body: "x".repeat(8 * 1024 + 1),
			}),
		).toEqual({ ok: false, error: "Body is too large" });
	});

	test("rejects deeply nested JSON request bodies", () => {
		let nested: unknown = "leaf";
		for (let i = 0; i < 12; i++) {
			nested = { nested };
		}

		expect(
			validateMetadataNetworkRequest({
				url: "https://api.spotify.com/v1/search",
				method: "POST",
				body: JSON.stringify(nested),
			}),
		).toEqual({ ok: false, error: "Body structure is too deep" });
	});

	test("keeps supported metadata request headers and filters unsupported headers", () => {
		expect(
			filterMetadataRequestHeaders({
				Accept: "application/json",
				"Cache-Control": "no-cache",
				Pragma: "no-cache",
				Referer: "",
				"X-Unsupported": "drop me",
			}),
		).toEqual({
			Accept: "application/json",
			"Cache-Control": "no-cache",
			Pragma: "no-cache",
			Referer: "",
		});
	});
});
