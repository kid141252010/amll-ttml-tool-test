/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/Steve-xmh/amll-ttml-tool/blob/main/LICENSE
 */

import { ManualWordSplitter } from "$/modules/segmentation/components/ManualWordSplitter.tsx";
import { useSegmentationConfig } from "$/modules/segmentation/utils/useSegmentationConfig.ts";
import { recalculateWordTime } from "$/modules/segmentation/utils/segmentation.ts";
import { useCurrentLocation } from "$/modules/lyric-editor/utils/lyric-states.ts";
import {
	displayRomanizationInSyncAtom,
	highlightActiveWordAtom,
	highlightErrorsAtom,
	showTimestampsAtom,
	showWordRomanizationInputAtom,
} from "$/modules/settings/states/index.ts";
import {
	currentEmptyBeatAtom,
	showTouchSyncPanelAtom,
	syncTimeOffsetAtom,
	visualizeTimestampUpdateAtom,
} from "$/modules/settings/states/sync.ts";
import {
	keySyncEndAtom,
	keySyncNextAtom,
	keySyncStartAtom,
} from "$/states/keybindings.ts";
import {
	bgLyricIgnoreSyncAtom,
	lyricLinesAtom,
	selectedLinesAtom,
} from "$/states/main.ts";
import {
	Checkbox,
	Flex,
	Grid,
	Slider,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, atom } from "jotai";
import { splitAtom } from "jotai/utils";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, forwardRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { KeyBinding } from "../KeyBinding/index.tsx";
import { RibbonFrame, RibbonSection } from "./common";

const lyricLinesOnlyAtom = splitAtom(
	atom((get) => get(lyricLinesAtom).lyricLines),
	(line) => line.id,
);

const EmptyBeatField = () => {
	const [currentEmptyBeat, setCurrentEmptyBeat] = useAtom(currentEmptyBeatAtom);
	const currentWordEmptyBeat =
		useCurrentLocation({ requireWord: true })?.word.emptyBeat || 0;
	const { t } = useTranslation();

	return (
		<>
			<Text wrap="nowrap" size="1">
				{t("ribbonBar.syncMode.currentEmptyBeat", "当前空拍")}
			</Text>
			<Slider
				value={[currentEmptyBeat]}
				onValueChange={(v) => setCurrentEmptyBeat(v[0])}
				min={0}
				max={currentWordEmptyBeat}
				step={1}
				disabled={currentWordEmptyBeat === 0}
			/>
			<div />
			<Text wrap="nowrap" align="center" size="1">
				{currentEmptyBeat} / {currentWordEmptyBeat}
			</Text>
		</>
	);
};

const CurrentLineEditor = () => {
	const currentLocation = useCurrentLocation({ requireWord: false });
	const { t } = useTranslation();
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const { config: segmentationConfig } = useSegmentationConfig();

	const line = currentLocation?.line;
	const lineIndex = currentLocation?.lineIndex ?? -1;

	// 将当前行所有单词拼接为连续文本，并记录单词边界位置作为已激活的分词点
	const { lineText, splitIndices } = useMemo(() => {
		if (!line) return { lineText: "", splitIndices: new Set<number>() };
		let text = "";
		const indices = new Set<number>();
		for (let wi = 0; wi < line.words.length; wi++) {
			if (wi > 0) indices.add(text.length);
			text += line.words[wi].word;
		}
		return { lineText: text, splitIndices: indices };
	}, [line]);

	// 点击竖线时：若该位置已是单词边界则合并相邻单词，否则在单词内部拆分
	const handleToggleSplit = useCallback(
		(index: number) => {
			if (lineIndex < 0) return;
			editLyricLines((state) => {
				const targetLine = state.lyricLines[lineIndex];
				if (!targetLine) return;

				let charOffset = 0;
				for (let wi = 0; wi < targetLine.words.length; wi++) {
					const word = targetLine.words[wi];
					const wordStart = charOffset;
					const wordEnd = charOffset + word.word.length;

					if (index === wordStart && wi > 0) {
						// 边界处 → 合并前一个单词与当前单词
						const prevWord = targetLine.words[wi - 1];
						if (!prevWord) return;
						const merged = {
							...prevWord,
							word: prevWord.word + word.word,
							startTime: prevWord.startTime,
							endTime: word.endTime,
						};
						targetLine.words.splice(wi - 1, 2, merged);
						return;
					}

					if (index > wordStart && index < wordEnd) {
						// 单词内部 → 拆分为两段
						const relIndex = index - wordStart;
						const segments = [
							word.word.slice(0, relIndex),
							word.word.slice(relIndex),
						];
						if (segments[0].length === 0 || segments[1].length === 0) return;
						const newWords = recalculateWordTime(
							word,
							segments,
							segmentationConfig,
						);
						targetLine.words.splice(wi, 1, ...newWords);
						return;
					}

					charOffset = wordEnd;
				}
			});
		},
		[editLyricLines, lineIndex, segmentationConfig],
	);

	const handleClearAllSplits = useCallback(() => {
		if (lineIndex < 0) return;
		editLyricLines((state) => {
			const targetLine = state.lyricLines[lineIndex];
			if (!targetLine || targetLine.words.length <= 1) return;
			const firstWord = targetLine.words[0];
			const lastWord = targetLine.words[targetLine.words.length - 1];
			targetLine.words = [
				{
					...firstWord,
					word: targetLine.words.map((w) => w.word).join(""),
					startTime: firstWord.startTime,
					endTime: lastWord.endTime,
				},
			];
		});
	}, [editLyricLines, lineIndex]);

	if (!currentLocation || !line || lineText.length === 0) {
		return (
			<Text size="1" color="gray">
				{t("ribbonBar.syncMode.noLineSelected", "未选择歌词行")}
			</Text>
		);
	}

	return (
		<ManualWordSplitter
			word={lineText}
			splitIndices={splitIndices}
			onSplitIndexToggle={handleToggleSplit}
			onClearAllSplits={
				line.words.length > 1 ? handleClearAllSplits : undefined
			}
		/>
	);
};

export const SyncModeRibbonBar: FC = forwardRef<HTMLDivElement>(
	(_props, ref) => {
		const [visualizeTimestampUpdate, setVisualizeTimestampUpdate] = useAtom(
			visualizeTimestampUpdateAtom,
		);
		const [showTouchSyncPanel, setShowTouchSyncPanel] = useAtom(
			showTouchSyncPanelAtom,
		);
		const [showTimestamps, setShowTimestamps] = useAtom(showTimestampsAtom);
		const [highlightErrors, setHighlightErrors] = useAtom(highlightErrorsAtom);
		const [highlightActiveWord, setHighlightActiveWord] = useAtom(
			highlightActiveWordAtom,
		);
		const [displayRomanizationInSync, setdisplayRomanizationInSync] = useAtom(
			displayRomanizationInSyncAtom,
		);
		const [bgLyricIgnoreSync, setBgLyricIgnoreSync] = useAtom(
			bgLyricIgnoreSyncAtom,
		);
		const editLyricLines = useSetImmerAtom(lyricLinesAtom);
		const showWordRomanizationInput = useAtomValue(
			showWordRomanizationInputAtom,
		);
		const [syncTimeOffset, setSyncTimeOffset] = useAtom(syncTimeOffsetAtom);
		const { t } = useTranslation();

		return (
			<RibbonFrame ref={ref}>
				<RibbonSection
					label={t("ribbonBar.syncMode.syncAdjustment", "打轴调整")}
				>
					<Grid columns="0fr 0fr" gap="4" gapY="1" flexGrow="1" align="center">
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.timeOffset", "时间戳位移")}
						</Text>
						<TextField.Root
							type="number"
							step={1}
							size="1"
							style={{
								width: "8em",
							}}
							value={syncTimeOffset}
							onChange={(e) => setSyncTimeOffset(e.target.valueAsNumber)}
						>
							<TextField.Slot />
							<TextField.Slot>ms</TextField.Slot>
						</TextField.Root>
						<EmptyBeatField />
					</Grid>
				</RibbonSection>
				<RibbonSection
					label={t("ribbonBar.syncMode.assistSettings", "辅助设置")}
				>
					<Grid columns="0fr 0fr" gap="2" gapY="1" flexGrow="1" align="center">
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.showTimestampUpdate", "呈现时间戳更新")}
						</Text>
						<Checkbox
							checked={visualizeTimestampUpdate}
							onCheckedChange={(v) => setVisualizeTimestampUpdate(!!v)}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.touchSyncPanel", "触控打轴辅助面板")}
						</Text>
						<Checkbox
							checked={showTouchSyncPanel}
							onCheckedChange={(v) => setShowTouchSyncPanel(!!v)}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.bgLyricIgnoreSync", "背景歌词忽略打轴")}
						</Text>
						<Checkbox
							checked={bgLyricIgnoreSync}
							onCheckedChange={(v) => {
								const next = !!v;
								setBgLyricIgnoreSync(next);
								editLyricLines((state) => {
									for (const line of state.lyricLines) {
										if (line.isBG) {
											line.ignoreSync = next;
										}
									}
									return state;
								});
							}}
						/>
					</Grid>
				</RibbonSection>
				<RibbonSection
					label={t("ribbonBar.syncMode.displayOptions", "显示选项")}
				>
					<Grid columns="0fr 0fr" gap="2" gapY="1" flexGrow="1" align="center">
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.showTimestamps", "显示时间戳")}
						</Text>
						<Checkbox
							checked={showTimestamps}
							onCheckedChange={(v) => setShowTimestamps(!!v)}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.highlightActiveWord", "高亮当前音节")}
						</Text>
						<Checkbox
							checked={highlightActiveWord}
							onCheckedChange={(v) => setHighlightActiveWord(!!v)}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.highlightErrors", "高亮错误")}
						</Text>
						<Checkbox
							checked={highlightErrors}
							onCheckedChange={(v) => setHighlightErrors(!!v)}
						/>
						{showWordRomanizationInput && (
							<>
								<Text wrap="nowrap" size="1">
									{t(
										"ribbonBar.syncMode.showPerWordRomanization",
										"显示逐字音译",
									)}
								</Text>
								<Checkbox
									checked={displayRomanizationInSync}
									onCheckedChange={(v) => setdisplayRomanizationInSync(!!v)}
								/>
							</>
						)}
					</Grid>
				</RibbonSection>
				<RibbonSection
					label={t("ribbonBar.syncMode.keyBindingReference", "打轴键位速查")}
				>
					<Flex gap="4">
						<Grid
							columns="0fr 0fr"
							gap="4"
							gapY="1"
							flexGrow="1"
							align="center"
							justify="center"
						>
							<Text wrap="nowrap" size="1">
								{t("ribbonBar.syncMode.startSync", "起始轴")}
							</Text>
							<KeyBinding kbdAtom={keySyncStartAtom} />
							<Text wrap="nowrap" size="1">
								{t("ribbonBar.syncMode.continuousSync", "连续轴")}
							</Text>
							<KeyBinding kbdAtom={keySyncNextAtom} />
							<Text wrap="nowrap" size="1">
								{t("ribbonBar.syncMode.endSync", "结束轴")}
							</Text>
							<KeyBinding kbdAtom={keySyncEndAtom} />
						</Grid>
					</Flex>
				</RibbonSection>
				<RibbonSection label={t("ribbonBar.syncMode.segmentation", "分词")}>
					<CurrentLineEditor />
				</RibbonSection>
			</RibbonFrame>
		);
	},
);

export default SyncModeRibbonBar;
