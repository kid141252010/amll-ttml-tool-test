import allowedHosts from "./allowed-hosts.json";
import type { MetadataNetworkRequest } from "./types";

export const METADATA_NETWORK_MAX_BODY_BYTES = 8 * 1024;
export const METADATA_NETWORK_MAX_JSON_DEPTH = 10;

export const METADATA_NETWORK_ALLOWED_HOSTS_LIST = allowedHosts as string[];

export const METADATA_NETWORK_ALLOWED_HOSTS = new Set(
	METADATA_NETWORK_ALLOWED_HOSTS_LIST,
);

export const METADATA_NETWORK_ALLOWED_HEADERS = [
	"accept",
	"accept-language",
	"authorization",
	"cache-control",
	"content-type",
	"origin",
	"pragma",
	"referer",
	"user-agent",
];

export const METADATA_NETWORK_ALLOWED_METHODS = ["GET", "POST"] as const;

const ALLOWED_METHODS = new Set<string>(METADATA_NETWORK_ALLOWED_METHODS);
const DANGEROUS_JSON_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export type MetadataNetworkValidationResult =
	| { ok: true; url: URL; method: "GET" | "POST" }
	| { ok: false; error: string };

const isJsonDepthAllowed = (value: unknown, depth = 0): boolean => {
	if (depth > METADATA_NETWORK_MAX_JSON_DEPTH) return false;
	if (Array.isArray(value)) {
		return value.every((item) => isJsonDepthAllowed(item, depth + 1));
	}
	if (typeof value === "object" && value !== null) {
		return Object.entries(value).every(
			([key, item]) =>
				!DANGEROUS_JSON_KEYS.has(key) && isJsonDepthAllowed(item, depth + 1),
		);
	}
	return true;
};

const validateRequestBody = (body: string | undefined) => {
	if (!body) return null;
	if (new TextEncoder().encode(body).length > METADATA_NETWORK_MAX_BODY_BYTES) {
		return "Body is too large";
	}
	const trimmed = body.trim();
	if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
		return null;
	}
	try {
		const parsed = JSON.parse(trimmed) as unknown;
		if (!isJsonDepthAllowed(parsed)) {
			return "Body structure is too deep";
		}
	} catch {
		return null;
	}
	return null;
};

export const validateMetadataNetworkRequest = (
	request: MetadataNetworkRequest,
): MetadataNetworkValidationResult => {
	let url: URL;
	try {
		url = new URL(request.url);
	} catch {
		return { ok: false, error: "URL is invalid" };
	}

	if (url.protocol !== "https:") {
		return { ok: false, error: "Protocol is not allowed" };
	}
	if (!METADATA_NETWORK_ALLOWED_HOSTS.has(url.hostname)) {
		return { ok: false, error: "Host is not allowed" };
	}

	const method = (request.method ?? "GET").toUpperCase();
	if (!ALLOWED_METHODS.has(method)) {
		return { ok: false, error: "Method is not allowed" };
	}
	const bodyError = validateRequestBody(request.body);
	if (bodyError) {
		return { ok: false, error: bodyError };
	}

	return { ok: true, url, method: method as "GET" | "POST" };
};

export const filterMetadataRequestHeaders = (
	headers: Record<string, string> | undefined,
) => {
	const allowed = new Set(METADATA_NETWORK_ALLOWED_HEADERS);
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers ?? {})) {
		const normalized = key.toLowerCase();
		if (!allowed.has(normalized)) continue;
		result[key] = value;
	}
	return result;
};
