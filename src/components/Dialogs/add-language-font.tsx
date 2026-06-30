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
	Button,
	Dialog,
	Flex,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addLanguageFontDialogAtom } from "$/states/dialogs";

const COMMON_LANGUAGE_CODES = [
	"af",
	"ar",
	"be",
	"bg",
	"bn",
	"ca",
	"cs",
	"cy",
	"da",
	"de",
	"el",
	"en",
	"eo",
	"es-419",
	"es",
	"et",
	"fa",
	"fi",
	"fr-CA",
	"fr",
	"ga",
	"gl",
	"gu",
	"he",
	"hi",
	"hr",
	"ht",
	"hu",
	"id",
	"is",
	"it",
	"ja",
	"ka",
	"kn",
	"ko",
	"lt",
	"lv",
	"mk",
	"mr",
	"ms",
	"mt",
	"nl",
	"no",
	"pl",
	"pt-BR",
	"pt-PT",
	"pt",
	"ro",
	"ru",
	"sk",
	"sl",
	"sq",
	"sv",
	"sw",
	"ta",
	"te",
	"th",
	"tl",
	"tr",
	"uk",
	"ur",
	"vi",
	"zh-Hans",
	"zh-Hant",
	"zh",
];

export const AddLanguageFontDialog = () => {
	const { t } = useTranslation();
	const [dialogState, setDialogState] = useAtom(addLanguageFontDialogAtom);
	const [customLang, setCustomLang] = useState("");
	const [font, setFont] = useState("");

	useEffect(() => {
		if (!dialogState.open) return;
		setCustomLang("");
		setFont("");
	}, [dialogState.open]);

	// 确认按钮是否禁用
	const canSubmit = useMemo(() => {
		const trimmed = customLang.trim();
		if (trimmed.length === 0 || trimmed === "und") return false;
		// 检查是否已存在
		if (dialogState.existingLangs.includes(trimmed)) return false;
		return true;
	}, [customLang, dialogState.existingLangs]);

	const handleClose = () => {
		setDialogState({ ...dialogState, open: false });
	};

	const handleSubmit = () => {
		const trimmed = customLang.trim();
		if (!trimmed || trimmed === "und") return;
		if (dialogState.existingLangs.includes(trimmed)) return;
		dialogState.onSubmit?.(trimmed, font.trim());
		setCustomLang("");
		setFont("");
		setDialogState({ ...dialogState, open: false });
	};

	const handleSelectCode = (code: string) => {
		setCustomLang(code);
	};

	return (
		<Dialog.Root open={dialogState.open} onOpenChange={handleClose}>
			<Dialog.Content maxWidth="500px">
				<Dialog.Title>
					{t("addLanguageFontDialog.title", "添加语言字体")}
				</Dialog.Title>
				<Flex direction="column" gap="4">
					{/* 语言代码选择区域 */}
					<Flex direction="column" gap="2">
						<Text size="2" weight="bold">
							{t("addLanguageFontDialog.languageCode", "语言代码")}
						</Text>
						<Text size="2">
							{t("addLanguageFontDialog.commonCodes", "常用语言代码")}
						</Text>
						<Flex gap="2" wrap="wrap">
							{COMMON_LANGUAGE_CODES.map((code) => (
								<Button
									key={code}
									variant={customLang === code ? "solid" : "soft"}
									size="1"
									onClick={() => handleSelectCode(code)}
									disabled={dialogState.existingLangs.includes(code)}
								>
									{code}
								</Button>
							))}
						</Flex>
						<Text size="2">
							{t("addLanguageFontDialog.customCode", "自定义语言代码")}
						</Text>
						<TextField.Root
							value={customLang}
							placeholder={t(
								"addLanguageFontDialog.customPlaceholder",
								"输入语言代码（如 en、ja、zh-CN）",
							)}
							onChange={(e) => setCustomLang(e.currentTarget.value)}
						/>
						{customLang.trim() && dialogState.existingLangs.includes(customLang.trim()) && (
							<Text size="2" color="red">
								{t("addLanguageFontDialog.alreadyExists", "该语言代码已存在")}
							</Text>
						)}
					</Flex>

					{/* 字体选择区域 */}
					<Flex direction="column" gap="2">
						<Text size="2" weight="bold">
							{t("addLanguageFontDialog.font", "字体")}
						</Text>
						<TextField.Root
							value={font}
							placeholder={t(
								"addLanguageFontDialog.fontPlaceholder",
								"输入字体名称（如 Arial, Microsoft YaHei）",
							)}
							onChange={(e) => setFont(e.currentTarget.value)}
						/>
						<Text size="1" color="gray">
							{t(
								"addLanguageFontDialog.fontHint",
								"留空将使用默认字体",
							)}
						</Text>
					</Flex>
				</Flex>
				<Flex gap="3" mt="4" justify="end">
					<Button variant="soft" color="gray" onClick={handleClose}>
						{t("common.cancel", "取消")}
					</Button>
					<Button onClick={handleSubmit} disabled={!canSubmit}>
						{t("common.add", "添加")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
