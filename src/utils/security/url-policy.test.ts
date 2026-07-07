import { describe, expect, test } from "vitest";
import { getSafeRemoteUrl } from "./url-policy";

describe("remote URL security policy", () => {
	test("allows public HTTPS TTML URLs", () => {
		const url = getSafeRemoteUrl(
			"https://raw.githubusercontent.com/amll-dev/db/main/song.ttml",
			{ requireTtml: true },
		);

		expect(url?.toString()).toBe(
			"https://raw.githubusercontent.com/amll-dev/db/main/song.ttml",
		);
	});

	test("rejects unsafe remote URLs", () => {
		const unsafeUrls = [
			"http://raw.githubusercontent.com/amll-dev/db/main/song.ttml",
			"https://localhost/song.ttml",
			"https://127.0.0.1/song.ttml",
			"https://10.1.2.3/song.ttml",
			"https://172.16.0.1/song.ttml",
			"https://192.168.1.5/song.ttml",
			"https://169.254.169.254/latest/meta-data/song.ttml",
			"https://[::1]/song.ttml",
			"https://[fe80::1]/song.ttml",
			"https://example.com/song.txt",
			"https://user:pass@example.com/song.ttml",
		];

		for (const input of unsafeUrls) {
			expect(getSafeRemoteUrl(input, { requireTtml: true })).toBeNull();
		}
	});
});
