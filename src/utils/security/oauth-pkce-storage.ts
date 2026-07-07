const LYRICS_SITE_PKCE_KEY = "lyrics_site_pkce";
const LEGACY_CODE_VERIFIER_KEY = "lyrics_site_code_verifier";
const LEGACY_STATE_KEY = "lyrics_site_state";
const LYRICS_SITE_PKCE_TTL_MS = 10 * 60 * 1000;

type LyricsSitePkceState = {
	codeVerifier: string;
	state: string;
	expiresAt: number;
};

const removeLegacyPkceValues = () => {
	sessionStorage.removeItem(LEGACY_CODE_VERIFIER_KEY);
	sessionStorage.removeItem(LEGACY_STATE_KEY);
};

export const storeLyricsSitePkce = (
	codeVerifier: string,
	state: string,
): void => {
	removeLegacyPkceValues();
	const payload: LyricsSitePkceState = {
		codeVerifier,
		state,
		expiresAt: Date.now() + LYRICS_SITE_PKCE_TTL_MS,
	};
	sessionStorage.setItem(LYRICS_SITE_PKCE_KEY, JSON.stringify(payload));
};

export const clearLyricsSitePkce = (): void => {
	sessionStorage.removeItem(LYRICS_SITE_PKCE_KEY);
	removeLegacyPkceValues();
};

export const consumeLyricsSitePkce = (): LyricsSitePkceState | null => {
	const raw = sessionStorage.getItem(LYRICS_SITE_PKCE_KEY);
	clearLyricsSitePkce();
	if (!raw) return null;
	try {
		const payload = JSON.parse(raw) as Partial<LyricsSitePkceState>;
		if (
			!payload.codeVerifier ||
			!payload.state ||
			typeof payload.expiresAt !== "number" ||
			Date.now() > payload.expiresAt
		) {
			return null;
		}
		return {
			codeVerifier: payload.codeVerifier,
			state: payload.state,
			expiresAt: payload.expiresAt,
		};
	} catch {
		return null;
	}
};
