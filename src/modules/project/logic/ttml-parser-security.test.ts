import { describe, expect, test } from "vitest";
import { getElementTextContentForTtml } from "./ttml-parser";

describe("ttml parser security helpers", () => {
	test("extracts text content without preserving executable markup", () => {
		const element = {
			textContent: "safe alert(1)",
			innerHTML: '<img src=x onerror="alert(1)">safe<script>alert(1)</script>',
		} as Element;

		expect(getElementTextContentForTtml(element)).toBe("safe alert(1)");
	});
});
