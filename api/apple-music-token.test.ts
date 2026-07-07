import { afterEach, describe, expect, test, vi } from "vitest";
import handler from "./apple-music-token";

type ResponseRecord = {
	statusCode: number;
	headers: Record<string, string>;
	body: string;
};

const createResponse = () => {
	const record: ResponseRecord = {
		statusCode: 0,
		headers: {},
		body: "",
	};
	return {
		record,
		res: {
			status(code: number) {
				record.statusCode = code;
			},
			setHeader(key: string, value: string) {
				record.headers[key.toLowerCase()] = value;
			},
			send(body: string) {
				record.body = body;
			},
		},
	};
};

const jwtWithExp = (exp: number) => {
	const payload = btoa(JSON.stringify({ exp }))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
	return `eyJhbGciOiJub25lIn0.${payload}.signature`;
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("Apple Music token API", () => {
	test("extracts bearer token from Apple Music module scripts", async () => {
		const token = jwtWithExp(1_900_000_000);
		const fetchMock = vi.fn(async (url: string) => ({
			ok: true,
			status: 200,
			text: async () =>
				url.includes("assets.example")
					? `const token = "${token}";`
					: '<script type="module" src="https://assets.example/app.js"></script>',
		}));
		vi.stubGlobal("fetch", fetchMock);
		const { record, res } = createResponse();

		await handler({ method: "GET" }, res);

		expect(record.statusCode).toBe(200);
		expect(record.headers["access-control-allow-origin"]).toBe("*");
		expect(JSON.parse(record.body)).toEqual({
			token,
			expiresAt: 1_900_000_000_000,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://music.apple.com/cn/search",
			expect.objectContaining({
				headers: expect.objectContaining({ Accept: "text/html,*/*" }),
			}),
		);
	});
});
