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

import { Checkbox, Grid, Slider, Text, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import {
	alignPositionAtom,
	annotationFontAtom,
	fontScaleAtom,
	hideObsceneWordsAtom,
	lyricWordFadeWidthAtom,
	originalFontAtom,
	romanFontAtom,
	showAnnotationLinesAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
	translationFontAtom,
} from "$/modules/settings/states/preview";
import { RibbonFrame, RibbonSection } from "./common";

export const PreviewModeRibbonBar = forwardRef<HTMLDivElement>(
	(_props, ref) => {
		const [showTranslationLine, setShowTranslationLine] = useAtom(
			showTranslationLinesAtom,
		);
		const [showRomanLine, setShowRomanLine] = useAtom(showRomanLinesAtom);
		const [showAnnotationLine, setShowAnnotationLine] = useAtom(
			showAnnotationLinesAtom,
		);
		const [hideObsceneWords, setHideObsceneWords] =
			useAtom(hideObsceneWordsAtom);
		const [lyricWordFadeWidth, setLyricWordFadeWidth] = useAtom(
			lyricWordFadeWidthAtom,
		);
		// 字体设置
		const [fontScale, setFontScale] = useAtom(fontScaleAtom);
		const [originalFont, setOriginalFont] = useAtom(originalFontAtom);
		const [translationFont, setTranslationFont] = useAtom(translationFontAtom);
		const [romanFont, setRomanFont] = useAtom(romanFontAtom);
		const [annotationFont, setAnnotationFont] = useAtom(annotationFontAtom);
		// 布局设置
		const [alignPosition, setAlignPosition] = useAtom(alignPositionAtom);
		const { t } = useTranslation();

		return (
			<RibbonFrame ref={ref}>
				<RibbonSection label={t("ribbonBar.previewMode.lyrics", "歌词")}>
					<Grid
						columns="0fr 0fr 0fr 0fr"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.showTranslation", "显示翻译")}
						</Text>
						<Checkbox
							checked={showTranslationLine}
							onCheckedChange={(v) => setShowTranslationLine(!!v)}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.showAnnotation", "显示标注")}
						</Text>
						<Checkbox
							checked={showAnnotationLine}
							onCheckedChange={(v) => setShowAnnotationLine(!!v)}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.showRoman", "显示音译")}
						</Text>
						<Checkbox
							checked={showRomanLine}
							onCheckedChange={(v) => setShowRomanLine(!!v)}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.maskObsceneWords", "屏蔽不雅用语")}
						</Text>
						<Checkbox
							checked={hideObsceneWords}
							onCheckedChange={(v) => setHideObsceneWords(!!v)}
						/>
					</Grid>
				</RibbonSection>
				<RibbonSection label={t("ribbonBar.previewMode.word", "单词")}>
					<Grid columns="0fr 0fr" gap="2" gapY="1" flexGrow="1" align="center">
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.fadeWidth", "过渡宽度")}
						</Text>
						<TextField.Root
							min={0}
							step={0}
							size="1"
							style={{
								width: "4em",
							}}
							defaultValue={lyricWordFadeWidth}
							onBlur={(e) => {
								const value = Number.parseFloat(e.target.value);
								if (Number.isFinite(value)) {
									setLyricWordFadeWidth(value);
								}
							}}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.fontScale", "字号倍率")}
						</Text>
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<Slider
								value={[fontScale]}
								onValueChange={(v) => setFontScale(v[0])}
								min={25}
								max={200}
								step={1}
								style={{ width: "80px" }}
							/>
							<TextField.Root
								size="1"
								style={{ width: "4em" }}
								value={fontScale}
								onChange={(e) => {
									const value = Number.parseInt(e.target.value);
									if (Number.isFinite(value) && value >= 25 && value <= 400) {
										setFontScale(value);
									}
								}}
								onWheel={(e) => {
									e.preventDefault();
									const delta = e.deltaY > 0 ? -1 : 1;
									const newValue = Math.max(
										25,
										Math.min(400, fontScale + delta),
									);
									setFontScale(newValue);
								}}
							>
								<TextField.Slot>%</TextField.Slot>
							</TextField.Root>
						</div>
					</Grid>
				</RibbonSection>
				<RibbonSection label={t("ribbonBar.previewMode.font", "字体")}>
					<Grid
						columns="0fr 1fr 0fr 1fr"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.originalFont", "原文字体")}
						</Text>
						<TextField.Root
							size="1"
							style={{ width: "180px" }}
							value={originalFont}
							onChange={(e) => setOriginalFont(e.target.value)}
							placeholder={t("ribbonBar.previewMode.fontPlaceholder", "默认")}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.annotationFont", "标注字体")}
						</Text>
						<TextField.Root
							size="1"
							style={{ width: "180px" }}
							value={annotationFont}
							onChange={(e) => setAnnotationFont(e.target.value)}
							placeholder={t("ribbonBar.previewMode.fontPlaceholder", "默认")}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.translationFont", "翻译字体")}
						</Text>
						<TextField.Root
							size="1"
							style={{ width: "180px" }}
							value={translationFont}
							onChange={(e) => setTranslationFont(e.target.value)}
							placeholder={t("ribbonBar.previewMode.fontPlaceholder", "默认")}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.romanFont", "音译字体")}
						</Text>
						<TextField.Root
							size="1"
							style={{ width: "180px" }}
							value={romanFont}
							onChange={(e) => setRomanFont(e.target.value)}
							placeholder={t("ribbonBar.previewMode.fontPlaceholder", "默认")}
						/>
					</Grid>
				</RibbonSection>
				<RibbonSection label={t("ribbonBar.previewMode.layout", "布局")}>
					<Grid columns="0fr 0fr" gap="2" gapY="1" flexGrow="1" align="center">
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.verticalAlign", "垂直对齐")}
						</Text>
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<Slider
								value={[alignPosition]}
								onValueChange={(v) => setAlignPosition(v[0])}
								min={0}
								max={100}
								step={1}
								style={{ width: "80px" }}
							/>
							<TextField.Root
								size="1"
								style={{ width: "4em" }}
								value={alignPosition}
								onChange={(e) => {
									const value = Number.parseInt(e.target.value);
									if (Number.isFinite(value) && value >= 0 && value <= 100) {
										setAlignPosition(value);
									}
								}}
								onWheel={(e) => {
									e.preventDefault();
									const delta = e.deltaY > 0 ? -1 : 1;
									const newValue = Math.max(
										0,
										Math.min(100, alignPosition + delta),
									);
									setAlignPosition(newValue);
								}}
							>
								<TextField.Slot>%</TextField.Slot>
							</TextField.Root>
						</div>
					</Grid>
				</RibbonSection>
			</RibbonFrame>
		);
	},
);

export default PreviewModeRibbonBar;
