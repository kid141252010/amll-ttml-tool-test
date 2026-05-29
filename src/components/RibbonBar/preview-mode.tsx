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

import {
	Box,
	Button,
	Checkbox,
	Grid,
	IconButton,
	Select,
	Slider,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	addLanguageFontDialogAtom,
	editLanguageDialogAtom,
} from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import {
	alignPositionAtom,
	annotationFontAtom,
	bgLineOpacityAtom,
	fontScaleAtom,
	hideInvalidRomanizationAtom,
	hideObsceneWordsAtom,
	languageFontsAtom,
	lyricWordFadeWidthAtom,
	lyricWidthAtom,
	originalFontAtom,
	romanFontAtom,
	showAnnotationLinesAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
	translationFontAtom,
	type LanguageFont,
} from "$/modules/settings/states/preview";
import { RibbonFrame, RibbonSection } from "./common";
import {
	Add16Regular,
	Delete16Regular,
	Edit16Regular,
} from "@fluentui/react-icons";

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
		const [hideInvalidRomanization, setHideInvalidRomanization] = useAtom(
			hideInvalidRomanizationAtom,
		);
		const [lyricWordFadeWidth, setLyricWordFadeWidth] = useAtom(
			lyricWordFadeWidthAtom,
		);
		// 字体设置
		const [fontScale, setFontScale] = useAtom(fontScaleAtom);
		const [originalFont, setOriginalFont] = useAtom(originalFontAtom);
		const [translationFont, setTranslationFont] = useAtom(translationFontAtom);
		const [romanFont, setRomanFont] = useAtom(romanFontAtom);
		const [annotationFont, setAnnotationFont] = useAtom(annotationFontAtom);
		// 语言字体设置
		const [languageFonts, setLanguageFonts] = useAtom(languageFontsAtom);
		const [selectedLang, setSelectedLang] = useState<string>("");
		const setAddLanguageFontDialog = useSetAtom(addLanguageFontDialogAtom);
	const setEditLanguageDialog = useSetAtom(editLanguageDialogAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
		// 布局设置
		const [alignPosition, setAlignPosition] = useAtom(alignPositionAtom);
		const [bgLineOpacity, setBgLineOpacity] = useAtom(bgLineOpacityAtom);
		const [lyricWidth, setLyricWidth] = useAtom(lyricWidthAtom);
		const { t } = useTranslation();

		// 当歌词语言变化时，自动选择对应的语言字体
	useEffect(() => {
		const currentLyricLang = lyricLines.lyricLang;
		if (currentLyricLang) {
			const hasLanguageFont = languageFonts.some(
				(lf) => lf.lang === currentLyricLang,
			);
			// 只有当当前选中的语言与歌词语言不匹配，且歌词语言有对应的语言字体时，才自动切换
			if (hasLanguageFont && selectedLang !== currentLyricLang) {
				setSelectedLang(currentLyricLang);
			}
		}
	}, [lyricLines, languageFonts, selectedLang]);

		// 获取当前选中的语言字体对象
		const selectedLanguageFont = useMemo(() => {
			if (!selectedLang) return null;
			return languageFonts.find((lf) => lf.lang === selectedLang) || null;
		}, [selectedLang, languageFonts]);

		// 处理添加语言字体
		const handleAddLanguageFont = useCallback(() => {
			setAddLanguageFontDialog({
				open: true,
				existingLangs: languageFonts.map((lf) => lf.lang),
				onSubmit: (lang, font) => {
					const trimmed = lang.trim();
					if (!trimmed || languageFonts.some((lf) => lf.lang === trimmed)) {
						return;
					}
					const newLanguageFont: LanguageFont = { lang: trimmed, font };
					setLanguageFonts([...languageFonts, newLanguageFont]);
					setSelectedLang(trimmed);
				},
			});
		}, [languageFonts, setLanguageFonts, setAddLanguageFontDialog]);

		// 处理编辑语言代码
		const handleEditLanguage = useCallback(() => {
			if (!selectedLang) return;
			// 获取原文行内容
			const originalLines = lyricLines.lyricLines.map((line) =>
				line.words.map((w) => w.word).join(""),
			);
			setEditLanguageDialog({
				open: true,
				target: "translation",
				currentLang: selectedLang,
				originalLines,
				onSubmit: (newLang) => {
					const trimmed = newLang.trim();
					if (!trimmed || trimmed === selectedLang) return;
					// 检查是否已存在
					if (languageFonts.some((lf) => lf.lang === trimmed)) {
						return;
					}
					setLanguageFonts(
						languageFonts.map((lf) =>
							lf.lang === selectedLang ? { ...lf, lang: trimmed } : lf,
						),
					);
					setSelectedLang(trimmed);
				},
			});
		}, [selectedLang, languageFonts, lyricLines.lyricLines, setLanguageFonts, setEditLanguageDialog]);

		// 处理删除语言字体
		const handleDeleteLanguage = useCallback(
			(lang: string) => {
				setLanguageFonts(languageFonts.filter((lf) => lf.lang !== lang));
				if (selectedLang === lang) {
					setSelectedLang("");
				}
			},
			[languageFonts, setLanguageFonts, selectedLang],
		);

		// 处理字体变更
		const handleFontChange = useCallback(
			(font: string) => {
				if (!selectedLang) return;
				setLanguageFonts(
					languageFonts.map((lf) =>
						lf.lang === selectedLang ? { ...lf, font } : lf,
					),
				);
			},
			[selectedLang, languageFonts, setLanguageFonts],
		);

		// 检查当前歌词语言是否匹配语言字体设置
	const matchedLanguageFont = useMemo(() => {
		const currentLyricLang = lyricLines.lyricLang;
		if (!currentLyricLang) return null;
		return languageFonts.find((lf) => lf.lang === currentLyricLang) || null;
	}, [lyricLines, languageFonts]);

		// 获取实际使用的原文字体（考虑语言字体覆盖）
		const effectiveOriginalFont = useMemo(() => {
			if (matchedLanguageFont?.font) {
				return matchedLanguageFont.font;
			}
			return originalFont;
		}, [matchedLanguageFont, originalFont]);

		return (
			<RibbonFrame ref={ref}>
				<RibbonSection label={t("ribbonBar.previewMode.lyrics", "歌词")}>
					<Grid
						columns="0fr 0fr 0fr 0fr 0fr 0fr"
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
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.hideInvalidRoman", "屏蔽无效音译")}
						</Text>
						<Checkbox
							checked={hideInvalidRomanization}
							onCheckedChange={(v) => setHideInvalidRomanization(!!v)}
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
							value={
								lyricWordFadeWidth % 1 === 0
									? lyricWordFadeWidth.toFixed(1)
									: lyricWordFadeWidth.toString()
							}
							onChange={(e) => {
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
				<RibbonSection label={t("ribbonBar.previewMode.font", "默认字体")}>
					<Grid
						columns="0fr 1fr 0fr 1fr"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.originalFont", "原文字体")}
							{matchedLanguageFont && (
								<span style={{ color: "var(--accent-9)", marginLeft: "4px" }}>
									*
								</span>
							)}
						</Text>
						<TextField.Root
							size="1"
							style={{ width: "180px" }}
							value={originalFont}
							onChange={(e) => setOriginalFont(e.target.value)}
							placeholder={
								matchedLanguageFont?.font
									? t("ribbonBar.previewMode.fontPlaceholder", "默认") +
										` (${matchedLanguageFont.font})`
									: t("ribbonBar.previewMode.fontPlaceholder", "默认")
							}
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
				<RibbonSection
					label={t("ribbonBar.previewMode.languageFont", "语言字体")}
				>
					<Grid
						columns="auto 1fr auto"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<IconButton
							variant="soft"
							size="1"
							onClick={handleEditLanguage}
							disabled={!selectedLang}
							aria-label={t("ribbonBar.previewMode.editLanguage", "修改语言")}
						>
							<Edit16Regular />
						</IconButton>
						<Select.Root
							value={selectedLang}
							onValueChange={setSelectedLang}
							size="1"
						>
							<Select.Trigger
								placeholder={t(
									"ribbonBar.previewMode.selectLanguage",
									"选择语言",
								)}
								style={{ width: "120px" }}
							/>
							<Select.Content>
								{languageFonts.map((lf) => (
									<Box key={lf.lang} position="relative">
										<Select.Item value={lf.lang}>
											<Text style={{ paddingRight: "2rem" }}>{lf.lang}</Text>
										</Select.Item>
										<Box
											position="absolute"
											right="6px"
											top="50%"
											style={{
												transform: "translateY(-50%)",
												zIndex: 10,
											}}
										>
											<IconButton
												size="1"
												variant="soft"
												color="red"
												onClick={() => {
													handleDeleteLanguage(lf.lang);
												}}
												aria-label={t(
													"ribbonBar.previewMode.deleteLanguage",
													"删除语言",
												)}
											>
												<Delete16Regular />
											</IconButton>
										</Box>
									</Box>
								))}
							</Select.Content>
						</Select.Root>
						<IconButton
							variant="soft"
							size="1"
							onClick={handleAddLanguageFont}
							aria-label={t(
								"ribbonBar.previewMode.addLanguageFont",
								"添加语言字体",
							)}
						>
							<Add16Regular />
						</IconButton>
						<TextField.Root
							size="1"
							style={{ gridColumn: "1/-1" }}
							value={selectedLanguageFont?.font || ""}
							onChange={(e) => handleFontChange(e.target.value)}
							placeholder={t("ribbonBar.previewMode.fontPlaceholder", "默认")}
							disabled={!selectedLang}
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
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.bgLineOpacity", "背景行透明度")}
						</Text>
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<Slider
								value={[bgLineOpacity]}
								onValueChange={(v) => setBgLineOpacity(v[0])}
								min={0}
								max={100}
								step={1}
								style={{ width: "80px" }}
							/>
							<TextField.Root
								size="1"
								style={{ width: "4em" }}
								value={bgLineOpacity}
								onChange={(e) => {
									const value = Number.parseInt(e.target.value);
									if (Number.isFinite(value) && value >= 0 && value <= 100) {
										setBgLineOpacity(value);
									}
								}}
								onWheel={(e) => {
									e.preventDefault();
									const delta = e.deltaY > 0 ? -1 : 1;
									const newValue = Math.max(
										0,
										Math.min(100, bgLineOpacity + delta),
									);
									setBgLineOpacity(newValue);
								}}
							>
								<TextField.Slot>%</TextField.Slot>
							</TextField.Root>
						</div>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.previewMode.width", "宽度")}
						</Text>
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<Slider
								value={[lyricWidth]}
								onValueChange={(v) => setLyricWidth(v[0])}
								min={0}
								max={100}
								step={1}
								style={{ width: "80px" }}
							/>
							<TextField.Root
								size="1"
								style={{ width: "4em" }}
								value={lyricWidth}
								onChange={(e) => {
									const value = Number.parseInt(e.target.value);
									if (Number.isFinite(value) && value >= 0 && value <= 100) {
										setLyricWidth(value);
									}
								}}
								onWheel={(e) => {
									e.preventDefault();
									const delta = e.deltaY > 0 ? -1 : 1;
									const newValue = Math.max(
										0,
										Math.min(100, lyricWidth + delta),
									);
									setLyricWidth(newValue);
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
