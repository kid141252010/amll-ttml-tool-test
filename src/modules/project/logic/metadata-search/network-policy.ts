import type { MetadataNetworkRequest } from "./types";

export const METADATA_NETWORK_MAX_BODY_BYTES = 64 * 1024;

export const METADATA_NETWORK_ALLOWED_HOSTS = new Set([
	"accounts.spotify.com",
	"api.spotify.com",
	"amp-api.music.apple.com",
	"music.apple.com",
	"u.y.qq.com",
	"ncmapi.bikonoo.com",
	"music163.xuanmou.com.cn",
	"neteasecloudmusicapi-main-api.vercel.app",
	"api-enhanced-six-beta.vercel.app",
]);

const ALLOWED_METHODS = new Set(["GET", "POST"]);

export type MetadataNetworkValidationResult =
	| { ok: true; url: URL; method: "GET" | "POST" }
	| { ok: false; error: string };

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
	if (request.body && new TextEncoder().encode(request.body).length > METADATA_NETWORK_MAX_BODY_BYTES) {
		return { ok: false, error: "Body is too large" };
	}

	return { ok: true, url, method: method as "GET" | "POST" };
};

export const filterMetadataRequestHeaders = (
	headers: Record<string, string> | undefined,
) => {
	const allowed = new Set([
		"accept",
		"accept-language",
		"authorization",
		"content-type",
		"origin",
		"referer",
		"user-agent",
	]);
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers ?? {})) {
		const normalized = key.toLowerCase();
		if (!allowed.has(normalized)) continue;
		result[key] = value;
	}
	return result;
};
