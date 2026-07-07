import { afterEach, describe, expect, test, vi } from "vitest";
import { LrcLibApi } from "./client";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("LRCLIB API client", () => {
	test("trims search queries before sending them", async () => {
		const fetchMock = vi.fn(
			async () => new Response("[]", { status: 200 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		await LrcLibApi.search("  song artist  ");

		expect(fetchMock).toHaveBeenCalledWith(
			"https://lrclib.net/api/search?q=song%20artist",
		);
	});

	test("rejects overly long search queries before fetching", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(LrcLibApi.search("x".repeat(201))).rejects.toThrow(
			"Search query too long",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
