import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import handler, { __resetGithubProxyRateLimitForTests } from "./github";

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

beforeEach(() => {
	__resetGithubProxyRateLimitForTests();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("github API proxy", () => {
	test("rejects non-HTTPS GitHub URLs before proxying", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const { record, res } = createResponse();

		await handler(
			{
				method: "GET",
				headers: {},
				query: { url: "http://api.github.com/user" },
			},
			res,
		);

		expect(record.statusCode).toBe(400);
		expect(record.body).toBe("Invalid url");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("returns a generic error when upstream fetch fails", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => {
			throw new Error("upstream leaked secret");
		}));
		const { record, res } = createResponse();

		await handler(
			{
				method: "GET",
				headers: {},
				query: { url: "https://api.github.com/user" },
			},
			res,
		);

		expect(record.statusCode).toBe(502);
		expect(record.headers["content-type"]).toBe("application/json");
		expect(JSON.parse(record.body)).toEqual({
			error: "Service temporarily unavailable",
			code: "PROXY_ERROR",
		});
	});

	test("rate limits repeated proxy requests from the same client", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("{}", { status: 200 })),
		);
		const headers = { "x-forwarded-for": "203.0.113.10" };

		for (let i = 0; i < 60; i++) {
			const { record, res } = createResponse();
			await handler(
				{
					method: "GET",
					headers,
					query: { url: "https://api.github.com/user" },
				},
				res,
			);
			expect(record.statusCode).toBe(200);
		}

		const { record, res } = createResponse();
		await handler(
			{
				method: "GET",
				headers,
				query: { url: "https://api.github.com/user" },
			},
			res,
		);

		expect(record.statusCode).toBe(429);
		expect(record.headers["content-type"]).toBe("application/json");
		expect(JSON.parse(record.body)).toEqual({
			error: "Too many requests",
			code: "RATE_LIMITED",
		});
	});
});
