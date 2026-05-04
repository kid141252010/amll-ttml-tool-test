import { describe, expect, test } from "vitest";
import { stripXmlDeclaration } from "./ttml-writer";

describe("ttml writer serialization helpers", () => {
	test("strips xml declaration and leading BOM from serialized output", () => {
		expect(
			stripXmlDeclaration(
				'\uFEFF<?xml version="1.0" encoding="UTF-8"?>\n<tt />',
			),
		).toBe("<tt />");
	});
});
