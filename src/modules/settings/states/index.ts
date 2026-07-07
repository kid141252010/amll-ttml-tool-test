import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { createExpiringSessionStorage } from "$/utils/security/sensitive-storage";

export enum SyncJudgeMode {
	FirstKeyDownTime = "first-keydown-time",
	FirstKeyDownTimeLegacy = "first-keydown-time-legacy",
	LastKeyUpTime = "last-keyup-time",
	MiddleKeyTime = "middle-key-time",
}

export enum LayoutMode {
	Simple = "simple",
	Advance = "advance",
}

export const latencyTestBPMAtom = atomWithStorage("latencyTestBPM", 120);

export const syncJudgeModeAtom = atomWithStorage(
	"syncJudgeMode",
	SyncJudgeMode.FirstKeyDownTime,
);

export const layoutModeAtom = atomWithStorage("layoutMode", LayoutMode.Simple);

export const showWordRomanizationInputAtom = atomWithStorage(
	"showWordRomanizationInput",
	false,
);

export const displayRomanizationInSyncAtom = atomWithStorage(
	"displayRomanizationInSync",
	false,
);

export const showLineTranslationAtom = atomWithStorage(
	"showLineTranslation",
	true,
);

export const showLineRomanizationAtom = atomWithStorage(
	"showLineRomanization",
	true,
);

export const hideSubmitAMLLDBWarningAtom = atomWithStorage(
	"hideSubmitAMLLDBWarning",
	false,
);
export const generateNameFromMetadataAtom = atomWithStorage(
	"generateNameFromMetadata",
	true,
);

export const autosaveEnabledAtom = atomWithStorage("autosaveEnabled", true);
export const autosaveIntervalAtom = atomWithStorage("autosaveInterval", 10);
export const autosaveLimitAtom = atomWithStorage("autosaveLimit", 10);

export const showTimestampsAtom = atomWithStorage("showTimestamps", true);

export const highlightActiveWordAtom = atomWithStorage(
	"highlightActiveWord",
	true,
);

export const highlightErrorsAtom = atomWithStorage("highlightErrors", false);

export const smartFirstWordAtom = atomWithStorage("smartFirstWord", false);
export const smartLastWordAtom = atomWithStorage("smartLastWord", false);

export const enableAutoRomanizationPredictionAtom = atomWithStorage(
	"enableAutoRomanizationPrediction",
	false,
);

const sensitiveStringStorage = createExpiringSessionStorage<string>({
	ttlMs: 12 * 60 * 60 * 1000,
});

export const githubPatAtom = atomWithStorage(
	"githubPat",
	"",
	sensitiveStringStorage,
	{ getOnInit: true },
);
export const githubLoginAtom = atomWithStorage("githubLogin", "");
export const githubAmlldbAccessAtom = atomWithStorage(
	"githubAmlldbAccess",
	false,
);
export const githubRiskConfirmedAtom = atomWithStorage(
	"githubRiskConfirmed",
	false,
);
export type NeteaseProfile = {
	userId: number;
	nickname: string;
	avatarUrl: string;
	vipType: number;
	signature?: string;
};
export const neteaseCookieAtom = atomWithStorage(
	"neteaseCookie",
	"",
	sensitiveStringStorage,
	{ getOnInit: true },
);
export const neteaseUserAtom = atomWithStorage<NeteaseProfile | null>(
	"neteaseUser",
	null,
);
export const neteaseRiskConfirmedAtom = atomWithStorage(
	"neteaseRiskConfirmed",
	false,
);
export const spotifyClientIdAtom = atomWithStorage("spotifyClientId", "");
export const spotifyClientSecretAtom = atomWithStorage(
	"spotifyClientSecret",
	"",
	sensitiveStringStorage,
	{ getOnInit: true },
);
export const appleMusicBearerTokenAtom = atomWithStorage(
	"APPLE_MUSIC_BEARER_TOKEN",
	"",
	sensitiveStringStorage,
	{ getOnInit: true },
);
export const metadataProxyUrlAtom = atomWithStorage(
	"metadataProxyUrl",
	import.meta.env.VITE_METADATA_PROXY_URL ?? "",
);
export const reviewHiddenLabelsAtom = atomWithStorage<string[]>(
	"reviewHiddenLabels",
	[],
);
export const reviewSelectedLabelsAtom = atomWithStorage<string[]>(
	"reviewSelectedLabels",
	[],
);
export const reviewPendingFilterAtom = atomWithStorage(
	"reviewPendingFilter",
	false,
);
export const reviewUpdatedFilterAtom = atomWithStorage(
	"reviewUpdatedFilter",
	false,
);
export const reviewRefreshTokenAtom = atom(0);
export type ReviewLabel = {
	name: string;
	color: string;
};
export const reviewLabelsAtom = atom<ReviewLabel[]>([]);

// 歌词站登录状态
export type LyricsSiteUser = {
	username: string;
	displayName: string;
	avatarUrl: string;
	reviewPermission: 0 | 1;
};
export const lyricsSiteTokenAtom = atomWithStorage<string>(
	"lyricsSiteToken",
	"",
	sensitiveStringStorage,
	{ getOnInit: true },
);
export const lyricsSiteUserAtom = atomWithStorage<LyricsSiteUser | null>(
	"lyricsSiteUser",
	null,
);
export const lyricsSiteLoginPendingAtom = atomWithStorage<boolean>(
	"lyricsSiteLoginPending",
	false,
);

// 是否显示测试版分支警告框
export const showBetaBranchWarningAtom = atomWithStorage(
	"showBetaBranchWarning",
	true,
);

// 主题色
export type AccentColor =
	| "gray"
	| "gold"
	| "bronze"
	| "brown"
	| "yellow"
	| "amber"
	| "orange"
	| "tomato"
	| "red"
	| "ruby"
	| "crimson"
	| "pink"
	| "plum"
	| "purple"
	| "violet"
	| "iris"
	| "indigo"
	| "blue"
	| "cyan"
	| "teal"
	| "jade"
	| "green"
	| "grass"
	| "lime"
	| "mint"
	| "sky";

export const accentColorAtom = atomWithStorage<AccentColor>(
	"accentColor",
	"green",
);
