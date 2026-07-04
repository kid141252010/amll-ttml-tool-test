import type {
	MetadataNetworkClient,
	MetadataNetworkRequest,
} from "./types";

type MetadataHttpResponse = {
	status: number;
	body: string;
	contentType?: string;
};

const ERROR_BODY_PREFIX_LENGTH = 160;
const DEFAULT_METADATA_PROXY_URL = "/api/metadata-network";

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
	const prefix = body.replace(/\s+/g, " ").trim().slice(0, ERROR_BODY_PREFIX_LENGTH);
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
