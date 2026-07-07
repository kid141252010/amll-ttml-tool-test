export const NETEASE_API_BASE = "https://ncmapi.bikonoo.com";
export const NETEASE_REQUEST_TIMEOUT_MS = 10_000;

export type NeteaseResponse<T> = {
	code?: number;
	message?: string;
	msg?: string;
	cookie?: string;
	data?: T;
	[key: string]: unknown;
};

export const requestNetease = async <T>(
	path: string,
	options: {
		params?: Record<string, string | number | boolean>;
		method?: "GET" | "POST";
		cookie?: string;
	} = {},
): Promise<T> => {
	const url = new URL(`${NETEASE_API_BASE}${path}`);
	const params: Record<string, string | boolean> = {
		timestamp: Date.now().toString(),
		randomCNIP: true,
		...options.params,
	};

	if (options.cookie) {
		params.cookie = options.cookie;
	}

	Object.keys(params).forEach((key) => {
		url.searchParams.append(key, String(params[key]));
	});

	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(),
		NETEASE_REQUEST_TIMEOUT_MS,
	);

	let res: Response;
	try {
		res = await fetch(url.toString(), {
			method: options.method || "GET",
			credentials: "include",
			signal: controller.signal,
		});
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw new Error("网易云请求超时，请稍后重试");
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}

	const data = (await res.json()) as NeteaseResponse<T>;
	const responseCode =
		data.code ?? (data.data as { code?: number } | undefined)?.code;
	if (responseCode !== undefined && responseCode !== 200) {
		throw new Error(data.msg || data.message || `API Error: ${responseCode}`);
	}
	return data as T;
};

export { NeteaseAuthClient, NeteaseAutoLoginGuard } from "./auth-service";
export {
	cacheNeteaseAudioToIndexedDb,
	loadNeteaseAudio,
} from "./audio-service";
export { fetchNeteaseSongMeta } from "./meta-service";
