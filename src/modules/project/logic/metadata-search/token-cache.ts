export interface CachedToken {
	token: string;
	expiresAt: number;
}

const DEFAULT_TOKEN_TTL_MS = 30 * 60 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;

export class TokenCache {
	private cache = new Map<string, Promise<CachedToken>>();

	async getOrFetch(
		key: string,
		fetcher: () => Promise<CachedToken>,
	): Promise<string> {
		const existing = this.cache.get(key);
		if (existing) {
			const cached = await existing;
			if (cached.expiresAt > Date.now() + TOKEN_EXPIRY_SKEW_MS) {
				return cached.token;
			}
			this.cache.delete(key);
		}

		const promise = fetcher().catch((error) => {
			this.cache.delete(key);
			throw error;
		});
		this.cache.set(key, promise);
		const fresh = await promise;
		if (fresh.expiresAt <= Date.now() + TOKEN_EXPIRY_SKEW_MS) {
			this.cache.delete(key);
		}
		return fresh.token;
	}

	clear(): void {
		this.cache.clear();
	}
}

export const tokenCache = new TokenCache();

export const defaultTokenExpiresAt = (): number =>
	Date.now() + DEFAULT_TOKEN_TTL_MS;

export const jwtExpiresAt = (token: string): number => {
	const payload = token.split(".")[1];
	if (!payload) return defaultTokenExpiresAt();
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
		return typeof parsed.exp === "number"
			? parsed.exp * 1000
			: defaultTokenExpiresAt();
	} catch {
		return defaultTokenExpiresAt();
	}
};
