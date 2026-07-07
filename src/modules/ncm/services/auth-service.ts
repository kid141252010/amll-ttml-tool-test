import type { NeteaseProfile } from "$/modules/settings/states";
import { requestNetease } from "./index";
import type { NeteaseResponse } from "./index";

const autoLoginFailureKey = "neteaseAutoLoginFailures";
const maxAutoLoginFailures = 3;
const autoLoginFailureWindowMs = 24 * 60 * 60 * 1000;

type AutoLoginFailureState = {
	count: number;
	firstFailureAt: number;
};

const readAutoLoginFailures = () => {
	if (typeof sessionStorage === "undefined") {
		return 0;
	}
	try {
		localStorage?.removeItem(autoLoginFailureKey);
		const raw = sessionStorage.getItem(autoLoginFailureKey);
		if (!raw) return 0;
		const parsed = JSON.parse(raw) as Partial<AutoLoginFailureState>;
		if (
			typeof parsed.count !== "number" ||
			typeof parsed.firstFailureAt !== "number" ||
			Date.now() - parsed.firstFailureAt > autoLoginFailureWindowMs
		) {
			sessionStorage.removeItem(autoLoginFailureKey);
			return 0;
		}
		return Number.isFinite(parsed.count) && parsed.count > 0 ? parsed.count : 0;
	} catch {
		return 0;
	}
};

const writeAutoLoginFailures = (value: number) => {
	if (typeof sessionStorage === "undefined") {
		return;
	}
	try {
		localStorage?.removeItem(autoLoginFailureKey);
		if (value <= 0) {
			sessionStorage.removeItem(autoLoginFailureKey);
			return;
		}
		const previousRaw = sessionStorage.getItem(autoLoginFailureKey);
		const previous = previousRaw
			? (JSON.parse(previousRaw) as Partial<AutoLoginFailureState>)
			: null;
		const firstFailureAt =
			typeof previous?.firstFailureAt === "number"
				? previous.firstFailureAt
				: Date.now();
		sessionStorage.setItem(
			autoLoginFailureKey,
			JSON.stringify({ count: value, firstFailureAt }),
		);
	} catch {
		return;
	}
};

export const NeteaseAutoLoginGuard = {
	maxFailures: maxAutoLoginFailures,
	getFailures: () => readAutoLoginFailures(),
	shouldAttempt: () => readAutoLoginFailures() < maxAutoLoginFailures,
	recordFailure: () => {
		const nextValue = readAutoLoginFailures() + 1;
		writeAutoLoginFailures(nextValue);
		return nextValue;
	},
	reset: () => writeAutoLoginFailures(0),
};

export const NeteaseAuthClient = {
	sendCaptcha: async (phone: string, ctcode = "86") => {
		return requestNetease<NeteaseResponse<boolean>>("/captcha/sent", {
			params: { phone, ctcode },
		});
	},
	loginByPhone: async (phone: string, captcha: string, ctcode = "86") => {
		const res = await requestNetease<
			NeteaseResponse<Record<string, unknown>> & {
				profile: NeteaseProfile;
				cookie: string;
			}
		>("/login/cellphone", {
			params: { phone, captcha, ctcode },
		});

		return {
			cookie: res.cookie ?? "",
			profile: res.profile,
		};
	},
	checkCookieStatus: async (cookieString: string) => {
		const res = await requestNetease<{
			data: {
				profile: NeteaseProfile | null;
				account?: { vipType: number; id: number };
			};
		}>("/login/status", {
			cookie: cookieString,
			method: "POST",
		});

		const profile = res.data?.profile;
		const account = res.data?.account;

		if (profile) {
			if (account && typeof account.vipType === "number") {
				return {
					...profile,
					vipType: account.vipType,
				};
			}
			return profile;
		}
		throw new Error("Cookie 已失效或未登录");
	},
};
