import type {
	MetadataNetworkClient,
	MetadataNetworkRequest,
} from "./types";

type MetadataHttpResponse = {
	status: number;
	body: string;
	contentType?: string;
};

export const metadataHttpRequest = async (
	request: MetadataNetworkRequest,
): Promise<MetadataHttpResponse> => {
	if (import.meta.env.TAURI_ENV_PLATFORM) {
		const { invoke } = await import("@tauri-apps/api/core");
		return invoke<MetadataHttpResponse>("metadata_http_request", { request });
	}

	const response = await fetch("/api/metadata-network", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(request),
	});
	const payload = (await response.json()) as MetadataHttpResponse & {
		error?: string;
	};
	if (!response.ok) {
		throw new Error(payload.error || `Metadata request failed: ${response.status}`);
	}
	return payload;
};

export const defaultMetadataNetworkClient: MetadataNetworkClient = {
	async requestJson<T>(request: MetadataNetworkRequest) {
		const response = await metadataHttpRequest(request);
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`HTTP ${response.status}`);
		}
		return JSON.parse(response.body) as T;
	},
	async requestText(request: MetadataNetworkRequest) {
		const response = await metadataHttpRequest(request);
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`HTTP ${response.status}`);
		}
		return response.body;
	},
};
