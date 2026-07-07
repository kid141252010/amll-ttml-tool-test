import type { MetadataNetworkClient, MetadataNetworkRequest } from "./types";

type MetadataHttpResponse = {
	status: number;
	body: string;
	contentType?: string;
};

const ERROR_BODY_PREFIX_LENGTH = 160;
const DEFAULT_METADATA_PROXY_URL = "/api/metadata-network";
const DEFAULT_APPLE_MUSIC_TOKEN_URL = "/api/apple-music-token";

type TauriRuntimeWindow = Window & {
	__TAURI_INTERNALS__?: {
		invoke?: unknown;
	};
};

export type MetadataNetworkClientOptions = {
	proxyUrl?: string | null;
};

export const hasTauriInvokeRuntime = (): boolean =>
	typeof window !== "undefined" &&
	typeof (window as TauriRuntimeWindow).__TAURI_INTERNALS__?.invoke ===
		"function";

const resolveMetadataProxyUrl = (proxyUrl?: string | null): string => {
	const configured =
		proxyUrl?.trim() || import.meta.env.VITE_METADATA_PROXY_URL?.trim();
	return configured || DEFAULT_METADATA_PROXY_URL;
};

const resolveAppleMusicTokenUrl = (proxyUrl?: string | null): string => {
	const configured =
		proxyUrl?.trim() || import.meta.env.VITE_APPLE_MUSIC_TOKEN_URL?.trim();
	return configured || DEFAULT_APPLE_MUSIC_TOKEN_URL;
};

export const metadataHttpRequest = async (
	request: MetadataNetworkRequest,
	options: MetadataNetworkClientOptions = {},
): Promise<MetadataHttpResponse> => {
	if (hasTauriInvokeRuntime()) {
		const { invoke } = await import("@tauri-apps/api/core");
		return invoke<MetadataHttpResponse>("metadata_http_request", { request });
	}

	const response = await fetch(resolveMetadataProxyUrl(options.proxyUrl), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(request),
	});
	const responseText = await response.text();
	const payload = parseMetadataProxyResponse(response, responseText);
	if (!response.ok) {
		throw new Error(
			payload.error ||
				`Metadata proxy HTTP ${response.status}${formatResponseBodySuffix(responseText)}`,
		);
	}
	return payload;
};

export const createMetadataNetworkClient = (
	options: MetadataNetworkClientOptions = {},
): MetadataNetworkClient => ({
	async requestJson<T>(request: MetadataNetworkRequest) {
		const response = await metadataHttpRequest(request, options);
		if (response.status < 200 || response.status >= 300) {
			throw new Error(
				`HTTP ${response.status}${formatResponseBodySuffix(response.body)}`,
			);
		}
		try {
			return JSON.parse(response.body) as T;
		} catch {
			throw new Error(
				`Invalid JSON response from ${requestHost(request)}${formatResponseBodySuffix(response.body)}`,
			);
		}
	},
	async requestText(request: MetadataNetworkRequest) {
		const response = await metadataHttpRequest(request, options);
		if (response.status < 200 || response.status >= 300) {
			throw new Error(
				`HTTP ${response.status}${formatResponseBodySuffix(response.body)}`,
			);
		}
		return response.body;
	},
	async discoverAppleMusicToken() {
		if (hasTauriInvokeRuntime()) {
			return discoverAppleMusicTokenFromPage(this);
		}
		const response = await fetch(resolveAppleMusicTokenUrl());
		const responseText = await response.text();
		let payload: { token?: unknown; error?: unknown } | null = null;
		try {
			payload = JSON.parse(responseText) as {
				token?: unknown;
				error?: unknown;
			};
		} catch {
			throw new Error(
				`Apple Music token endpoint returned invalid JSON${formatResponseBodySuffix(responseText)}`,
			);
		}
		if (!response.ok) {
			throw new Error(
				(typeof payload?.error === "string" ? payload.error : null) ||
					`Apple Music token HTTP ${response.status}${formatResponseBodySuffix(responseText)}`,
			);
		}
		return typeof payload?.token === "string" && payload.token.trim()
			? payload.token.trim()
			: null;
	},
});

export const defaultMetadataNetworkClient: MetadataNetworkClient =
	createMetadataNetworkClient();

const requestHost = (request: MetadataNetworkRequest): string => {
	try {
		return new URL(request.url).hostname;
	} catch {
		return "unknown host";
	}
};

const formatResponseBodySuffix = (body: string): string => {
	const prefix = body
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, ERROR_BODY_PREFIX_LENGTH);
	return prefix ? `: ${prefix}` : "";
};

const parseMetadataProxyResponse = (
	response: Pick<Response, "ok" | "status">,
	body: string,
): MetadataHttpResponse & { error?: string } => {
	try {
		return JSON.parse(body) as MetadataHttpResponse & { error?: string };
	} catch {
		const prefix = response.ok
			? "Metadata proxy returned invalid JSON"
			: `Metadata proxy HTTP ${response.status}`;
		throw new Error(`${prefix}${formatResponseBodySuffix(body)}`);
	}
};

const discoverAppleMusicTokenFromPage = async (
	client: Pick<MetadataNetworkClient, "requestText">,
	storefront = "cn",
): Promise<string | null> => {
	const page = await client.requestText({
		url: `https://music.apple.com/${storefront}/search`,
		headers: { Accept: "text/html,*/*", "User-Agent": "Mozilla/5.0" },
	});
	const moduleSources = Array.from(
		page.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/gi),
	).map((match) => match[1]);
	for (const source of moduleSources) {
		if (!source) continue;
		const scriptUrl = new URL(source, "https://music.apple.com/").toString();
		const script = await client.requestText({
			url: scriptUrl,
			headers: { Accept: "text/javascript,*/*", "User-Agent": "Mozilla/5.0" },
		});
		const token = script.match(/eyJhbGciOiJ[^"']+/)?.[0];
		if (token) return token;
	}
	return null;
};
