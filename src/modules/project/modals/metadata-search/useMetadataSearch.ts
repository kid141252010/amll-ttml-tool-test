import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	buildMetadataSearchInput,
	candidateKey,
	canSearchMetadata,
	clearMetadataSearchCache,
	formatMetadataSearchError,
	type MetadataSearchResult,
	type MetadataSource,
	type MetadataValues,
	type SpotifyCredentials,
	searchMetadata,
} from "$/modules/project/logic/metadata-search";
import {
	buildMetadataMergePreview,
	buildMetadataValuesFromValueSelection,
	buildSelectedMetadataValueKeys,
	flattenMetadataSearchCandidates,
	groupMetadataCandidatesByRegion,
} from "$/modules/project/logic/metadata-search/metadata-search-ui";
import type { TTMLMetadata } from "$/types/ttml";

interface UseMetadataSearchOptions {
	metadata: TTMLMetadata[];
	appleMusicToken: string | null;
	spotifyCredentials: SpotifyCredentials | null;
	metadataProxyUrl: string | null;
	translate: (
		key: string,
		fallback: string,
		options?: Record<string, unknown>,
	) => string;
	applyMetadataValues: (values: MetadataValues) => void;
	sourceOrder: MetadataSource[];
}

export const useMetadataSearch = ({
	metadata,
	appleMusicToken,
	spotifyCredentials,
	metadataProxyUrl,
	translate,
	applyMetadataValues,
	sourceOrder,
}: UseMetadataSearchOptions) => {
	const [open, setOpen] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const [result, setResult] = useState<MetadataSearchResult | null>(null);
	const [selectedValueKeys, setSelectedValueKeys] = useState<string[]>([]);
	const [previewOpen, setPreviewOpen] = useState(false);
	const runIdRef = useRef(0);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const userEditedSelectionRef = useRef(false);

	const input = useMemo(() => buildMetadataSearchInput(metadata), [metadata]);

	const candidates = useMemo(
		() => flattenMetadataSearchCandidates(result, sourceOrder),
		[result, sourceOrder],
	);
	const regionGroups = useMemo(
		() => groupMetadataCandidatesByRegion(candidates),
		[candidates],
	);
	const preview = useMemo(
		() => buildMetadataMergePreview(metadata, candidates, selectedValueKeys),
		[metadata, candidates, selectedValueKeys],
	);
	const messages = useMemo(() => {
		if (!result) return [];
		return Array.from(new Set([...result.errors, ...result.warnings]));
	}, [result]);

	const runSearch = useCallback(async () => {
		const searchRunId = runIdRef.current + 1;
		runIdRef.current = searchRunId;
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		setOpen(true);
		setPreviewOpen(false);
		if (!canSearchMetadata(input)) {
			setResult({
				sources: {},
				recommendedCandidateIds: [],
				errors: [
					translate(
						"metadataDialog.search.requirement",
						"流媒体 ID 与歌名必须至少提供一个",
					),
				],
				warnings: [],
			});
			setSelectedValueKeys([]);
			return;
		}
		if (isSearching) return;
		setIsSearching(true);
		setResult(null);
		setSelectedValueKeys([]);
		userEditedSelectionRef.current = false;
		timeoutRef.current = setTimeout(() => {
			if (runIdRef.current !== searchRunId) return;
			runIdRef.current += 1;
			timeoutRef.current = null;
			setIsSearching(false);
			setOpen(false);
			setPreviewOpen(false);
		}, 30_000);
		try {
			const finalResult = await searchMetadata(
				input,
				{
					appleMusicToken,
					spotifyCredentials,
					metadataProxyUrl,
				},
				{
					onSourceComplete: (source, sourceResult) => {
						if (runIdRef.current !== searchRunId) return;
						setResult((previous) => {
							const next: MetadataSearchResult = previous
								? {
										...previous,
										sources: { ...previous.sources },
										recommendedCandidateIds: [
											...previous.recommendedCandidateIds,
										],
										errors: [...previous.errors],
										warnings: [...previous.warnings],
									}
								: {
										sources: {},
										recommendedCandidateIds: [],
										errors: [],
										warnings: [],
									};
							next.sources[source] = sourceResult;
							next.errors = Object.values(next.sources).flatMap(
								(item) => item?.errors ?? [],
							);
							next.recommendedCandidateIds = sourceOrder.flatMap(
								(item) =>
									next.sources[item]?.candidates
										.filter((candidate) => candidate.selectedByDefault)
										.map(candidateKey) ?? [],
							);
							return next;
						});
					},
				},
			);
			if (runIdRef.current !== searchRunId) return;
			setResult(finalResult);
		} catch (error) {
			if (runIdRef.current !== searchRunId) return;
			setResult({
				sources: {},
				recommendedCandidateIds: [],
				errors: [
					formatMetadataSearchError(
						error,
						translate("metadataDialog.search.failed", "元数据搜索失败"),
					),
				],
				warnings: [],
			});
			setSelectedValueKeys([]);
		} finally {
			if (runIdRef.current === searchRunId) {
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
					timeoutRef.current = null;
				}
				setIsSearching(false);
			}
		}
	}, [
		appleMusicToken,
		input,
		isSearching,
		metadataProxyUrl,
		sourceOrder,
		spotifyCredentials,
		translate,
	]);

	useEffect(() => {
		return () => {
			runIdRef.current += 1;
			clearMetadataSearchCache();
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!result || userEditedSelectionRef.current) return;
		setSelectedValueKeys(
			buildSelectedMetadataValueKeys(
				candidates,
				result.recommendedCandidateIds,
			),
		);
	}, [candidates, result]);

	const applySelection = useCallback(
		(keys: string[]) => {
			if (keys.length === 0) return;
			const values = buildMetadataValuesFromValueSelection(candidates, keys);
			applyMetadataValues(values);
			setOpen(false);
			setPreviewOpen(false);
		},
		[applyMetadataValues, candidates],
	);

	const toggleValue = useCallback((valueKey: string) => {
		userEditedSelectionRef.current = true;
		setSelectedValueKeys((previous) => {
			if (previous.includes(valueKey)) {
				return previous.filter((id) => id !== valueKey);
			}
			return [...previous, valueKey];
		});
	}, []);

	const selectRecommended = useCallback(() => {
		if (!result) return;
		userEditedSelectionRef.current = false;
		setSelectedValueKeys(
			buildSelectedMetadataValueKeys(
				candidates,
				result.recommendedCandidateIds,
			),
		);
	}, [candidates, result]);

	return {
		open,
		setOpen,
		isSearching,
		result,
		selectedValueKeys,
		setSelectedValueKeys,
		previewOpen,
		setPreviewOpen,
		candidates,
		regionGroups,
		preview,
		messages,
		runSearch,
		applySelection,
		toggleValue,
		selectRecommended,
	};
};
