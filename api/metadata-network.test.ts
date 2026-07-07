import { afterEach, describe, expect, test, vi } from "vitest";
import handler from "./metadata-network";

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

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("metadata network API proxy", () => {
	test("responds to CORS preflight for external static deployments", async () => {
		const { record, res } = createResponse();

		await handler({ method: "OPTIONS" }, res);

		expect(record.statusCode).toBe(204);
		expect(record.headers["access-control-allow-origin"]).toBe("*");
		expect(record.headers["access-control-allow-methods"]).toBe(
			"POST, OPTIONS",
		);
		expect(record.headers["access-control-allow-headers"]).toBe("Content-Type");
		expect(record.body).toBe("");
	});

	test("rejects non-whitelisted metadata targets with CORS headers", async () => {
		const { record, res } = createResponse();

		await handler(
			{
				method: "POST",
				body: {
					url: "https://example.com/search",
				},
			},
			res,
		);

		expect(record.statusCode).toBe(400);
		expect(record.headers["access-control-allow-origin"]).toBe("*");
		expect(JSON.parse(record.body)).toEqual({ error: "Host is not allowed" });
	});

	test("rejects oversized metadata request bodies", async () => {
		const { record, res } = createResponse();

		await handler(
			{
				method: "POST",
				body: {
					url: "https://api.spotify.com/v1/search",
					method: "POST",
					body: "x".repeat(8 * 1024 + 1),
				},
			},
			res,
		);

		expect(record.statusCode).toBe(400);
		expect(JSON.parse(record.body)).toEqual({ error: "Body is too large" });
	});

	test("rejects deeply nested JSON metadata request bodies", async () => {
		const { record, res } = createResponse();
		let nested: unknown = "leaf";
		for (let i = 0; i < 12; i++) {
			nested = { nested };
		}

		await handler(
			{
				method: "POST",
				body: {
					url: "https://api.spotify.com/v1/search",
					method: "POST",
					body: JSON.stringify(nested),
				},
			},
			res,
		);

		expect(record.statusCode).toBe(400);
		expect(JSON.parse(record.body)).toEqual({
			error: "Body structure is too deep",
		});
	});

	test("returns a generic error when upstream metadata fetch fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("upstream leaked secret");
			}),
		);
		const { record, res } = createResponse();

		await handler(
			{
				method: "POST",
				body: {
					url: "https://api.spotify.com/v1/search",
					method: "GET",
				},
			},
			res,
		);

		expect(record.statusCode).toBe(502);
		expect(JSON.parse(record.body)).toEqual({
			error: "Service temporarily unavailable",
			code: "METADATA_PROXY_ERROR",
		});
	});
});
