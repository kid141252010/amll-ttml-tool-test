import { describe, expect, test } from "vitest";
import type { TTMLMetadata } from "$/types/ttml";
import { candidateKey, type MetadataCandidate } from "./index";
import {
	buildMetadataMergePreview,
	buildSelectedCandidateIds,
	groupMetadataCandidatesByRegion,
} from "./metadata-search-ui";

const candidate = (
	overrides: Partial<MetadataCandidate> & Pick<MetadataCandidate, "source" | "id">,
): MetadataCandidate => ({
	source: overrides.source,
	id: overrides.id,
	artists: overrides.artists ?? ["Artist"],
	score: overrides.score ?? 90,
	values: overrides.values ?? {},
	selectedByDefault: overrides.selectedByDefault ?? false,
	...overrides,
});

const metadata = (entries: Record<string, string[]>): TTMLMetadata[] =>
	Object.entries(entries).map(([key, value]) => ({ key, value }));

describe("metadata search UI helpers", () => {
	test("groups candidates by upper-case region with unknown candidates last", () => {
		const cnApple = candidate({
			source: "appleMusic",
			id: "apple-cn",
			region: "cn",
		});
		const cnQQ = candidate({
			source: "qqMusic",
			id: "qq-cn",
			region: "CN",
		});
		const unknownSpotify = candidate({
			source: "spotify",
			id: "spotify-global",
		});
		const usApple = candidate({
			source: "appleMusic",
			id: "apple-us",
			region: "us",
		});

		const groups = groupMetadataCandidatesByRegion([
			unknownSpotify,
			usApple,
			cnApple,
			cnQQ,
		]);

		expect(groups.map((group) => group.region)).toEqual(["CN", "US", "UNKNOWN"]);
		expect(groups[0].candidates.map(candidateKey)).toEqual([
			candidateKey(cnApple),
			candidateKey(cnQQ),
		]);
	});

	test("uses recommended ids as the initial multi-selection", () => {
		const selected = buildSelectedCandidateIds(["a", "b", "a"]);

		expect(selected).toEqual(["a", "b"]);
	});

	test("builds a merge preview that separates added and skipped existing values", () => {
		const selectedCandidate = candidate({
			source: "appleMusic",
			id: "apple-cn",
			region: "cn",
			values: {
				musicName: ["Existing title", "New title"],
				artists: ["Artist A", "Artist B"],
				appleMusicId: ["12345"],
				isrc: ["CNABC2400001"],
			},
		});

		const preview = buildMetadataMergePreview(
			metadata({
				musicName: ["Existing title"],
				artists: ["Artist A"],
			}),
			[selectedCandidate],
			[candidateKey(selectedCandidate)],
		);

		expect(preview).toEqual([
			{
				key: "musicName",
				added: ["New title"],
				skipped: ["Existing title"],
			},
			{
				key: "artists",
				added: ["Artist B"],
				skipped: ["Artist A"],
			},
			{
				key: "appleMusicId",
				added: ["12345"],
				skipped: [],
			},
			{
				key: "isrc",
				added: ["CNABC2400001"],
				skipped: [],
			},
		]);
	});
});
