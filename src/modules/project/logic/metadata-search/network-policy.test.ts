import { describe, expect, test } from "vitest";
import { validateMetadataNetworkRequest } from "./network-policy";

describe("metadata network policy", () => {
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
				body: "x".repeat(65537),
			}),
		).toEqual({ ok: false, error: "Body is too large" });
	});
});
