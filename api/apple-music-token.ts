type ApiRequest = {
	method?: string;
};

type ApiResponse = {
	status: (code: number) => void;
	setHeader: (key: string, value: string) => void;
	send: (body: string) => void;
};

const APPLE_MUSIC_SEARCH_URL = "https://music.apple.com/cn/search";

const sendJson = (res: ApiResponse, status: number, payload: unknown) => {
	res.status(status);
	res.setHeader("content-type", "application/json");
	res.send(JSON.stringify(payload));
};

const setCorsHeaders = (res: ApiResponse) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

export const extractAppleMusicTokenFromScript = (
	script: string,
): string | null => script.match(/eyJhbGciOiJ[^"']+/)?.[0] ?? null;

export const extractAppleMusicModuleSources = (page: string): string[] =>
	Array.from(
		page.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/gi),
	)
		.map((match) => match[1])
		.filter((source): source is string => !!source);

export const appleMusicTokenExpiresAt = (token: string): number | null => {
	const payload = token.split(".")[1];
	if (!payload) return null;
	try {
		const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
		const padded = normalized.padEnd(
			normalized.length + ((4 - (normalized.length % 4)) % 4),
			"=",
		);
		const decoded =
			typeof atob === "function"
				? atob(padded)
				: Buffer.from(padded, "base64").toString("utf-8");
		const parsed = JSON.parse(decoded) as { exp?: unknown };
		return typeof parsed.exp === "number" ? parsed.exp * 1000 : null;
	} catch {
		return null;
	}
};

export const discoverAppleMusicToken = async (): Promise<{
	token: string;
	expiresAt: number | null;
}> => {
	const pageResponse = await fetch(APPLE_MUSIC_SEARCH_URL, {
		headers: {
			Accept: "text/html,*/*",
			"User-Agent": "Mozilla/5.0",
		},
	});
	if (!pageResponse.ok) {
		throw new Error(`Apple Music page HTTP ${pageResponse.status}`);
	}
	const page = await pageResponse.text();
	for (const source of extractAppleMusicModuleSources(page)) {
		const scriptUrl = new URL(source, APPLE_MUSIC_SEARCH_URL).toString();
		const scriptResponse = await fetch(scriptUrl, {
			headers: {
				Accept: "text/javascript,*/*",
				"User-Agent": "Mozilla/5.0",
			},
		});
		if (!scriptResponse.ok) continue;
		const token = extractAppleMusicTokenFromScript(await scriptResponse.text());
		if (token) {
			return {
				token,
				expiresAt: appleMusicTokenExpiresAt(token),
			};
		}
	}
	throw new Error("failed to find Apple Music bearer token");
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
	setCorsHeaders(res);
	const method = (req.method ?? "GET").toUpperCase();
	if (method === "OPTIONS") {
		res.status(204);
		res.send("");
		return;
	}
	if (method !== "GET") {
		sendJson(res, 405, { error: "Method not allowed" });
		return;
	}
	try {
		sendJson(res, 200, await discoverAppleMusicToken());
	} catch (error) {
		sendJson(res, 502, {
			error:
				error instanceof Error
					? error.message
					: "Apple Music token discovery failed",
		});
	}
}
