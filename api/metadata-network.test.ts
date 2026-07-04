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
		expect(record.headers["access-control-allow-methods"]).toBe("POST, OPTIONS");
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
});
