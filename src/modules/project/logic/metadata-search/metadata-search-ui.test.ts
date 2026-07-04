import { describe, expect, test } from "vitest";
import type { TTMLMetadata } from "$/types/ttml";
import { candidateKey, type MetadataCandidate } from "./index";
import {
	buildMetadataMergePreview,
	buildMetadataValuesFromValueSelection,
	buildSelectedCandidateIds,
	buildSelectedMetadataValueKeys,
	groupMetadataCandidatesByRegion,
	metadataCandidateValueKey,
} from "./metadata-search-ui";

const candidate = (
	overrides: Partial<MetadataCandidate> &
		Pick<MetadataCandidate, "source" | "id">,
): MetadataCandidate => {
	const { source, id, ...rest } = overrides;
	return {
		source,
		id,
		artists: overrides.artists ?? ["Artist"],
		score: overrides.score ?? 90,
		values: overrides.values ?? {},
		selectedByDefault: overrides.selectedByDefault ?? false,
		...rest,
	};
};

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

		expect(groups.map((group) => group.region)).toEqual([
			"CN",
			"US",
			"UNKNOWN",
		]);
		expect(groups[0].candidates.map(candidateKey)).toEqual([
			candidateKey(cnApple),
			candidateKey(cnQQ),
		]);
	});

	test("uses recommended ids as the initial multi-selection", () => {
		const selected = buildSelectedCandidateIds(["a", "b", "a"]);

		expect(selected).toEqual(["a", "b"]);
	});

	test("expands recommended candidate ids into value-level selections", () => {
		const recommended = candidate({
			source: "qqMusic",
			id: "qq-cn",
			values: {
				musicName: ["Title"],
				artists: ["Artist A", "Artist B"],
				qqMusicId: ["123"],
			},
		});
		const other = candidate({
			source: "spotify",
			id: "spotify-us",
			values: {
				musicName: ["Other title"],
			},
		});

		const selected = buildSelectedMetadataValueKeys(
			[recommended, other],
			[candidateKey(recommended)],
		);

		expect(selected).toEqual([
			metadataCandidateValueKey(recommended, "musicName", "Title"),
			metadataCandidateValueKey(recommended, "artists", "Artist A"),
			metadataCandidateValueKey(recommended, "artists", "Artist B"),
			metadataCandidateValueKey(recommended, "qqMusicId", "123"),
		]);
	});

	test("builds metadata values from selected individual values only", () => {
		const selectedCandidate = candidate({
			source: "appleMusic",
			id: "apple-cn",
			region: "cn",
			values: {
				musicName: ["Selected title"],
				artists: ["Artist A"],
				album: ["Album A"],
				appleMusicId: ["12345"],
			},
		});

		const values = buildMetadataValuesFromValueSelection(
			[selectedCandidate],
			[
				metadataCandidateValueKey(
					selectedCandidate,
					"musicName",
					"Selected title",
				),
			],
		);

		expect(values).toEqual({
			musicName: ["Selected title"],
		});
	});

	test("dedupes metadata values from multiple selected value items", () => {
		const qq = candidate({
			source: "qqMusic",
			id: "qq-cn",
			values: {
				isrc: ["CNABC2400001"],
				musicName: ["Title"],
			},
		});
		const spotify = candidate({
			source: "spotify",
			id: "spotify-us",
			region: "US",
			values: {
				isrc: ["CNABC2400001"],
				musicName: ["Title US"],
			},
		});

		const values = buildMetadataValuesFromValueSelection(
			[qq, spotify],
			[
				metadataCandidateValueKey(qq, "isrc", "CNABC2400001"),
				metadataCandidateValueKey(spotify, "isrc", "CNABC2400001"),
				metadataCandidateValueKey(spotify, "musicName", "Title US"),
			],
		);

		expect(values).toEqual({
			isrc: ["CNABC2400001"],
			musicName: ["Title US"],
		});
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
			[
				metadataCandidateValueKey(
					selectedCandidate,
					"musicName",
					"Existing title",
				),
				metadataCandidateValueKey(selectedCandidate, "musicName", "New title"),
				metadataCandidateValueKey(selectedCandidate, "artists", "Artist A"),
				metadataCandidateValueKey(selectedCandidate, "artists", "Artist B"),
				metadataCandidateValueKey(selectedCandidate, "appleMusicId", "12345"),
				metadataCandidateValueKey(selectedCandidate, "isrc", "CNABC2400001"),
			],
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
