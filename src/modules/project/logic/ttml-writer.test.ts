import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import type { LyricLine, LyricWord, TTMLLyric } from "$/types/ttml";
import exportTTMLText, { stripXmlDeclaration } from "./ttml-writer";

const TEXT_NODE = 3;

class MinimalTextNode {
	readonly nodeType = TEXT_NODE;
	nodeValue: string;
	readonly childNodes: MinimalXmlNode[] = [];

	constructor(value: string) {
		this.nodeValue = value;
	}
}

class MinimalElement {
	readonly nodeType = 1;
	readonly childNodes: MinimalXmlNode[] = [];
	private readonly attributes = new Map<string, string>();

	constructor(private readonly tagName: string) {}

	get firstChild(): MinimalXmlNode | null {
		return this.childNodes[0] ?? null;
	}

	appendChild<T extends MinimalXmlNode>(node: T): T {
		this.childNodes.push(node);
		return node;
	}

	hasChildNodes(): boolean {
		return this.childNodes.length > 0;
	}

	setAttribute(name: string, value: string): void {
		this.attributes.set(name, value);
	}

	serialize(): string {
		const attrs = Array.from(this.attributes.entries())
			.map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
			.join("");
		const children = this.childNodes.map(serializeNode).join("");
		return `<${this.tagName}${attrs}>${children}</${this.tagName}>`;
	}
}

class MinimalDocument {
	readonly nodeType = 9;
	readonly childNodes: MinimalXmlNode[] = [];

	appendChild<T extends MinimalXmlNode>(node: T): T {
		this.childNodes.push(node);
		return node;
	}

	createElement(tagName: string): MinimalElement {
		return new MinimalElement(tagName);
	}

	createTextNode(value: string): MinimalTextNode {
		return new MinimalTextNode(value);
	}

	serialize(): string {
		return this.childNodes.map(serializeNode).join("");
	}
}

type MinimalXmlNode = MinimalDocument | MinimalElement | MinimalTextNode;

const MinimalNode = Object.assign(function MinimalNode() {}, { TEXT_NODE });

class MinimalXmlSerializer {
	serializeToString(node: MinimalXmlNode): string {
		return serializeNode(node);
	}
}

class MinimalDomParser {
	parseFromString(): MinimalDocument {
		return new MinimalDocument();
	}
}

class MinimalXsltProcessor {
	importStylesheet(): void {}

	transformToDocument(doc: MinimalDocument): MinimalDocument {
		return doc;
	}
}

function serializeNode(node: MinimalXmlNode): string {
	if (node instanceof MinimalTextNode) {
		return escapeText(node.nodeValue ?? "");
	}
	return node.serialize();
}

function escapeText(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
	return escapeText(value).replace(/"/g, "&quot;");
}

beforeAll(() => {
	vi.stubGlobal("Node", MinimalNode);
	vi.stubGlobal("Document", MinimalDocument);
	vi.stubGlobal("XMLSerializer", MinimalXmlSerializer);
	vi.stubGlobal("DOMParser", MinimalDomParser);
	vi.stubGlobal("XSLTProcessor", MinimalXsltProcessor);
});

afterAll(() => {
	vi.unstubAllGlobals();
});

const word = (
	wordText: string,
	startTime: number,
	endTime: number,
	romanWord = "",
	overrides: Partial<LyricWord> = {},
): LyricWord => ({
	id: `${wordText}-${startTime}-${endTime}`,
	word: wordText,
	startTime,
	endTime,
	obscene: false,
	emptyBeat: 0,
	romanWord,
	rubyPhraseStart: false,
	...overrides,
});

const line = (
	words: LyricWord[],
	overrides: Partial<LyricLine> = {},
): LyricLine => ({
	id: `line-${words.map((item) => item.id).join("-")}`,
	words,
	translatedLyric: "",
	romanLyric: "",
	isBG: false,
	isDuet: false,
	startTime: words[0]?.startTime ?? 0,
	endTime: words[words.length - 1]?.endTime ?? 0,
	ignoreSync: false,
	vocal: [],
	...overrides,
});

function buildLyricWithNestedSpanTracks(): TTMLLyric {
	const main = line(
		[
			word("你", 1000, 1200, "ni"),
			word("好", 1200, 1500, "hao"),
		],
		{
			translatedLyricByLang: { ja: "こんにちは" },
			wordTranslationByLang: {
				en: [
					{ startTime: 1000, endTime: 1200, text: "you" },
					{ startTime: 1200, endTime: 1500, text: "good" },
				],
			},
			romanLyricByLang: { "ja-Latn": "konnichiwa" },
			wordRomanizationByLang: {
				"en-Latn": [
					{ startTime: 1000, endTime: 1200, text: "you" },
					{ startTime: 1200, endTime: 1500, text: "good" },
				],
			},
			vocal: ["lead"],
		},
	);
	const background = line(
		[
			word("和", 1000, 1300, "he"),
			word("声", 1300, 1600, "sheng"),
		],
		{
			isBG: true,
			agent: "v2",
			translatedLyricByLang: { ja: "バック" },
			wordTranslationByLang: {
				en: [
					{ startTime: 1000, endTime: 1300, text: "back" },
					{ startTime: 1300, endTime: 1600, text: "voice" },
				],
			},
			romanLyricByLang: { "ja-Latn": "bakku" },
			wordRomanizationByLang: {
				"en-Latn": [
					{ startTime: 1000, endTime: 1300, text: "back" },
					{ startTime: 1300, endTime: 1600, text: "voice" },
				],
			},
			vocal: ["harmony"],
		},
	);

	return {
		metadata: [],
		lyricLines: [main, background],
		agents: [],
		lyricLang: "zh-Hans",
	};
}

describe("ttml writer serialization helpers", () => {
	test("strips xml declaration and leading BOM from serialized output", () => {
		expect(
			stripXmlDeclaration(
				'\uFEFF<?xml version="1.0" encoding="UTF-8"?>\n<tt />',
			),
		).toBe("<tt />");
	});
});

describe("ttml writer namespace serialization", () => {
	test.each([false, true])(
		"does not emit namespace declarations on internal span elements when pretty is %s",
		(pretty) => {
			const output = exportTTMLText(buildLyricWithNestedSpanTracks(), pretty);

			expect(output).toContain('<tt xmlns="http://www.w3.org/ns/ttml"');
			expect(output).toContain('ttm:role="x-bg"');
			expect(output).not.toMatch(/<span\b[^>]*\sxmlns=/);
			expect(output).not.toMatch(/<span\b[^>]*\sxmlns:ttm=/);
		},
	);
});

describe("ttml writer romanization language fallback", () => {
	test("exports word.romanWord fallback using the imported default romanization language", () => {
		const output = exportTTMLText({
			metadata: [],
			agents: [],
			lyricLang: "ja",
			defaultRomanizationLang: "ja-Latn",
			lyricLines: [
				line([
					word("顔", 1000, 1200, "kao"),
					word("で", 1200, 1400, "de"),
				]),
			],
		});

		expect(output).toContain('<transliteration xml:lang="ja-Latn">');
		expect(output).toContain('<text for="L1">');
		expect(output).toContain(">kao<");
		expect(output).not.toContain("<transliteration><text");
	});
});
