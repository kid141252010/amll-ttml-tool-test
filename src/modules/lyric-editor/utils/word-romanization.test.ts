import { describe, expect, test } from "vitest";
import {
	buildWordRomanizationAutoApplyKey,
	getRomanWordEditState,
	shouldAutoApplyWordRomanizationLanguage,
} from "./word-romanization";

describe("word romanization helpers", () => {
	test("keeps suggested romanization out of the committed input value", () => {
		expect(getRomanWordEditState("", "kimi")).toEqual({
			value: "",
			placeholder: "kimi",
		});
		expect(getRomanWordEditState("already", "kimi")).toEqual({
			value: "already",
			placeholder: undefined,
		});
	});

	test("auto-applies a word romanization language only once per project-language set", () => {
		const key = buildWordRomanizationAutoApplyKey("project-a", ["ja-Latn"]);

		expect(
			shouldAutoApplyWordRomanizationLanguage({
				availableLanguages: ["ja-Latn"],
				currentLanguage: undefined,
				currentAutoApplyKey: key,
				previousAutoApplyKey: undefined,
			}),
		).toBe(true);

		expect(
			shouldAutoApplyWordRomanizationLanguage({
				availableLanguages: ["ja-Latn"],
				currentLanguage: "ja-Latn",
				currentAutoApplyKey: key,
				previousAutoApplyKey: undefined,
			}),
		).toBe(false);

		expect(
			shouldAutoApplyWordRomanizationLanguage({
				availableLanguages: ["ja-Latn"],
				currentLanguage: undefined,
				currentAutoApplyKey: key,
				previousAutoApplyKey: key,
			}),
		).toBe(false);
	});
});
