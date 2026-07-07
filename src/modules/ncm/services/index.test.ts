import { afterEach, describe, expect, test, vi } from "vitest";
import { requestNetease } from "./index";

vi.mock("./audio-service", () => ({
	cacheNeteaseAudioToIndexedDb: vi.fn(),
	loadNeteaseAudio: vi.fn(),
}));

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("Netease API request client", () => {
	test("attaches an AbortSignal so requests can time out", async () => {
		const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
			expect(init?.signal).toBeInstanceOf(AbortSignal);
			return new Response(JSON.stringify({ code: 200 }), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		await requestNetease("/login/status");

		expect(fetchMock).toHaveBeenCalledOnce();
	});
});
