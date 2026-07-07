import {
	filterMetadataRequestHeaders,
	validateMetadataNetworkRequest,
} from "../src/modules/project/logic/metadata-search/network-policy";
import type { MetadataNetworkRequest } from "../src/modules/project/logic/metadata-search/types";

type ApiRequest = {
	method?: string;
	body?: unknown;
};

type ApiResponse = {
	status: (code: number) => void;
	setHeader: (key: string, value: string) => void;
	send: (body: string) => void;
};

const parseRequestBody = (body: unknown): MetadataNetworkRequest | null => {
	if (!body) return null;
	if (typeof body === "string") {
		try {
			return JSON.parse(body) as MetadataNetworkRequest;
		} catch {
			return null;
		}
	}
	if (typeof body === "object") {
		return body as MetadataNetworkRequest;
	}
	return null;
};

const sendJson = (res: ApiResponse, status: number, payload: unknown) => {
	res.status(status);
	res.setHeader("content-type", "application/json");
	res.send(JSON.stringify(payload));
};

const setCorsHeaders = (res: ApiResponse) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
	setCorsHeaders(res);
	const method = (req.method ?? "POST").toUpperCase();
	if (method === "OPTIONS") {
		res.status(204);
		res.send("");
		return;
	}
	if (method !== "POST") {
		sendJson(res, 405, { error: "Method not allowed" });
		return;
	}
	const request = parseRequestBody(req.body);
	if (!request) {
		sendJson(res, 400, { error: "Invalid request body" });
		return;
	}
	const validation = validateMetadataNetworkRequest(request);
	if (!validation.ok) {
		sendJson(res, 400, { error: validation.error });
		return;
	}

	try {
		const response = await fetch(validation.url.toString(), {
			method: validation.method,
			headers: filterMetadataRequestHeaders(request.headers),
			body: validation.method === "GET" ? undefined : request.body,
		});
		const body = await response.text();
		sendJson(res, 200, {
			status: response.status,
			contentType: response.headers.get("content-type") ?? undefined,
			body,
		});
	} catch (error) {
		console.error("[Metadata Network Proxy Error]", error);
		sendJson(res, 502, {
			error: "Service temporarily unavailable",
			code: "METADATA_PROXY_ERROR",
		});
	}
}
