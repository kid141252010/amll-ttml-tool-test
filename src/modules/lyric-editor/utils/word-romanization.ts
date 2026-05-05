export const getRomanWordEditState = (
	romanWord: string,
	suggestedRoman?: string,
) => ({
	value: romanWord,
	placeholder:
		romanWord.trim().length === 0 && suggestedRoman
			? suggestedRoman
			: undefined,
});

export const buildWordRomanizationAutoApplyKey = (
	projectId: string,
	availableLanguages: readonly string[],
) => `${projectId}:${[...availableLanguages].sort().join("\u0000")}`;

export const shouldAutoApplyWordRomanizationLanguage = ({
	availableLanguages,
	currentLanguage,
	currentAutoApplyKey,
	previousAutoApplyKey,
	isEditing = false,
}: {
	availableLanguages: readonly string[];
	currentLanguage: string | undefined;
	currentAutoApplyKey: string;
	previousAutoApplyKey: string | undefined;
	isEditing?: boolean;
}) =>
	!isEditing &&
	availableLanguages.length > 0 &&
	!currentLanguage &&
	currentAutoApplyKey !== previousAutoApplyKey;

export interface RomanWordEditSession {
	readonly lang: string;
	tryCommit: () => boolean;
	cancel: () => void;
	shouldAutoCommit: () => boolean;
}

export function createRomanWordEditSession(lang: string): RomanWordEditSession {
	let committed = false;
	let canceled = false;

	return {
		lang,
		tryCommit: () => {
			if (committed || canceled) return false;
			committed = true;
			return true;
		},
		cancel: () => {
			if (committed) return;
			canceled = true;
		},
		shouldAutoCommit: () => !committed && !canceled,
	};
}
