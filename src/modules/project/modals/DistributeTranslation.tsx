import { InfoRegular } from "@fluentui/react-icons";
import {
	Button,
	Card,
	Checkbox,
	Dialog,
	Flex,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { distributeRomanizationByCharCount } from "$/modules/segmentation/utils/Transliteration/distributor";
import { distributeTranslationDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import type { TTMLTranslationWord } from "$/types/ttml";

export const DistributeTranslationDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(distributeTranslationDialogAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const setLyricLines = useSetImmerAtom(lyricLinesAtom);

	const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set());

	// 获取可用的逐行翻译语言（只返回符合要求的：歌词语言和翻译语言都以 "zh" 开头）
	const availableTranslationLangs = useMemo(() => {
		const lyricLang = lyricLines.lyricLang ?? "";
		const langs = new Set<string>();
		// 如果歌词语言不是中文，则不返回任何语言
		if (!lyricLang.startsWith("zh")) {
			return langs;
		}
		for (const line of lyricLines.lyricLines) {
			if (line.translatedLyricByLang) {
				for (const [lang, value] of Object.entries(line.translatedLyricByLang)) {
					// 只添加中文翻译语言
					if (!lang.startsWith("zh")) continue;
					const data = typeof value === "string" ? value : value?.data ?? "";
					if (data.trim().length > 0) {
						langs.add(lang);
					}
				}
			}
		}
		return langs;
	}, [lyricLines.lyricLang, lyricLines.lyricLines]);

	useEffect(() => {
		if (open) {
			// 默认选中所有可用语言
			setSelectedLangs(new Set(availableTranslationLangs));
		}
	}, [open, availableTranslationLangs]);

	const toggleLang = (lang: string) => {
		setSelectedLangs((prev) => {
			const next = new Set(prev);
			if (next.has(lang)) {
				next.delete(lang);
			} else {
				next.add(lang);
			}
			return next;
		});
	};

	const handleConfirm = () => {
		if (selectedLangs.size === 0) return;

		setLyricLines((draft) => {
			draft.lyricLines.forEach((line) => {
				for (const targetLang of selectedLangs) {
					const translationValue = line.translatedLyricByLang?.[targetLang];
					const fullTranslation =
						typeof translationValue === "string"
							? translationValue
							: translationValue?.data ?? "";

					if (line.words.length > 0 && fullTranslation.trim() !== "") {
						try {
							// 使用按字数分配算法将逐行翻译分配到逐字
							const distributed = distributeRomanizationByCharCount(
								line.words,
								fullTranslation,
							);

							// 构建逐字翻译数据
							const wordTranslations: TTMLTranslationWord[] = [];
							line.words.forEach((word, wordIndex) => {
								const text = distributed[wordIndex] ?? "";
								if (text.trim().length > 0) {
									wordTranslations.push({
										startTime: word.startTime,
										endTime: word.endTime,
										text: text,
									});
								}
							});

							// 保存到 wordTranslationByLang
							if (wordTranslations.length > 0) {
								line.wordTranslationByLang ??= {};
								line.wordTranslationByLang[targetLang] = {
									data: wordTranslations,
									isAutoFilled: false,
								};
							}

							// 删除逐行翻译数据
							if (line.translatedLyricByLang?.[targetLang]) {
								delete line.translatedLyricByLang[targetLang];
								if (
									Object.keys(line.translatedLyricByLang).length === 0
								) {
									delete line.translatedLyricByLang;
								}
							}
							// 如果当前显示的翻译是该语言，清空显示
							if (line.translatedLyric === fullTranslation) {
								line.translatedLyric = "";
							}
						} catch (e) {
							console.error(
								`Failed to distribute translation for line`,
								e,
							);
						}
					}
				}
			});
		});

		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="350px">
				<Dialog.Title>
					{t("distributeTranslationDialog.title", "将逐行翻译转为逐字")}
				</Dialog.Title>

				<Flex direction="column" gap="4">
					<Card>
						<Flex gap="2" align="start">
							<InfoRegular />
							<Text size="2" color="gray">
								{t(
									"distributeTranslationDialog.warning",
									"此功能将读取整行翻译并按字数自动分配给每个单词。转换后，逐行翻译数据将被删除并替换为逐字翻译数据。",
								)}
							</Text>
						</Flex>
					</Card>

					<Flex direction="column" gap="2">
						<Text size="2" weight="bold">
							{t("distributeTranslationDialog.targetLang", "选择要转换的语言")}
						</Text>
						<Flex direction="column" gap="2" ml="2">
							{Array.from(availableTranslationLangs).map((lang) => (
								<label key={lang}>
									<Flex gap="2" align="center">
										<Checkbox
											checked={selectedLangs.has(lang)}
											onCheckedChange={() => toggleLang(lang)}
										/>
										<Text size="2">{lang}</Text>
									</Flex>
								</label>
								))}
							</Flex>
						{availableTranslationLangs.size === 0 && (
							<Text size="2" color="gray">
								{t(
									"distributeTranslationDialog.noTranslation",
									"没有可用的逐行翻译",
								)}
							</Text>
						)}
					</Flex>
				</Flex>

				<Flex gap="3" mt="5" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "取消")}
						</Button>
					</Dialog.Close>
					<Button
						onClick={handleConfirm}
						disabled={availableTranslationLangs.size === 0 || selectedLangs.size === 0}
					>
						{t("common.apply", "应用")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
