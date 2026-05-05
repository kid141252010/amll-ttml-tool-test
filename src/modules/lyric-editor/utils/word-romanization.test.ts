import { describe, expect, test } from "vitest";
import {
	buildWordRomanizationAutoApplyKey,
	createRomanWordEditSession,
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

	test("does not auto-apply a language while a word romanization edit is active", () => {
		expect(
			shouldAutoApplyWordRomanizationLanguage({
				availableLanguages: ["ja-Latn"],
				currentLanguage: undefined,
				currentAutoApplyKey: buildWordRomanizationAutoApplyKey("project-a", [
					"ja-Latn",
				]),
				previousAutoApplyKey: undefined,
				isEditing: true,
			}),
		).toBe(false);
	});

	test("commits a word romanization edit session at most once and preserves its captured language", () => {
		const session = createRomanWordEditSession("ja-Latn");

		expect(session.lang).toBe("ja-Latn");
		expect(session.tryCommit()).toBe(true);
		expect(session.tryCommit()).toBe(false);
		expect(session.shouldAutoCommit()).toBe(false);
	});

	test("cancels a word romanization edit session before blur or unmount can commit", () => {
		const session = createRomanWordEditSession("ja-Latn");

		session.cancel();

		expect(session.tryCommit()).toBe(false);
		expect(session.shouldAutoCommit()).toBe(false);
	});
});
