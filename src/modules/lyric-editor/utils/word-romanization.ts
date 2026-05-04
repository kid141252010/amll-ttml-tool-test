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
}: {
	availableLanguages: readonly string[];
	currentLanguage: string | undefined;
	currentAutoApplyKey: string;
	previousAutoApplyKey: string | undefined;
}) =>
	availableLanguages.length > 0 &&
	!currentLanguage &&
	currentAutoApplyKey !== previousAutoApplyKey;
