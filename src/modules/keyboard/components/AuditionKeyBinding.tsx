import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	cmdAuditionSelection,
	cmdAuditionSelectionAfter,
	cmdAuditionSelectionBefore,
} from "$/modules/keyboard/commands";
import { useCommand } from "$/modules/keyboard/hooks";
import { processedLyricLinesAtom } from "$/modules/segmentation/utils/segment-processing";
import { selectedWordsAtom } from "$/states/main";

/**
 * 试听片段前后的时长 (毫秒)
 */
const AUDITION_PADDING_MS = 500;

export const AuditionKeyBinding = () => {
	const selectedWords = useAtomValue(selectedWordsAtom);
	const processedLines = useAtomValue(processedLyricLinesAtom);

	const selectedSegment = useMemo(() => {
		if (selectedWords.size === 0) return null;
		const selectedWordId = [...selectedWords][0];

		for (const line of processedLines) {
			const segment = line.segments.find(
				(s) => s.type === "word" && s.id === selectedWordId,
			);
			if (segment) return segment;
		}
		return null;
	}, [selectedWords, processedLines]);

	// 播放选中片段前 500ms
	useCommand(cmdAuditionSelectionBefore, () => {
		if (!selectedSegment?.startTime) return;
		audioEngine.auditionRange(
			(selectedSegment.startTime - AUDITION_PADDING_MS) / 1000,
			selectedSegment.startTime / 1000,
		);
	}, [selectedSegment]);

	// 播放选中的片段
	useCommand(cmdAuditionSelection, () => {
		if (!selectedSegment?.startTime || !selectedSegment?.endTime) return;
		audioEngine.auditionRange(
			selectedSegment.startTime / 1000,
			selectedSegment.endTime / 1000,
		);
	}, [selectedSegment]);

	// 播放选中片段后 500ms
	useCommand(cmdAuditionSelectionAfter, () => {
		if (!selectedSegment?.endTime) return;
		audioEngine.auditionRange(
			selectedSegment.endTime / 1000,
			(selectedSegment.endTime + AUDITION_PADDING_MS) / 1000,
		);
	}, [selectedSegment]);

	return null;
};
