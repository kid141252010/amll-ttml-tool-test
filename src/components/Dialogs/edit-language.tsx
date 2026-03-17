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

import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { editLanguageDialogAtom } from "$/states/dialogs";

const COMMON_LANGUAGE_CODES = [
	"af", "ar", "be", "bg", "bn", "ca", "cs", "cy", "da", "de", "el", "en",
	"eo", "es-419", "es", "et", "fa", "fi", "fr-CA", "fr", "ga", "gl", "gu",
	"he", "hi", "hr", "ht", "hu", "id", "is", "it", "ja", "ka", "kn", "ko",
	"lt", "lv", "mk", "mr", "ms", "mt", "nl", "no", "pl", "pt-BR", "pt-PT",
	"pt", "ro", "ru", "sk", "sl", "sq", "sv", "sw", "ta", "te", "th", "tl",
	"tr", "uk", "ur", "vi", "zh-Hans", "zh-Hant", "zh"
];

export const EditLanguageDialog = () => {
	const { t } = useTranslation();
	const [dialogState, setDialogState] = useAtom(editLanguageDialogAtom);
	const [newLang, setNewLang] = useState("");

	useEffect(() => {
		if (!dialogState.open) return;
		setNewLang(dialogState.currentLang);
	}, [dialogState.open, dialogState.currentLang]);

	const handleClose = () => {
		setDialogState({ ...dialogState, open: false });
	};

	const handleSelect = (lang: string) => {
		const trimmed = lang.trim();
		if (!trimmed || trimmed === "und") return;
		dialogState.onSubmit?.(trimmed);
		setDialogState({ ...dialogState, open: false });
	};

	const canSubmit = useMemo(() => {
		const trimmed = newLang.trim();
		return trimmed.length > 0 && trimmed !== "und" && trimmed !== dialogState.currentLang;
	}, [newLang, dialogState.currentLang]);

	const getTargetLabel = () => {
		switch (dialogState.target) {
			case "primary":
				return t("editLanguageDialog.targetPrimary", "主要内容");
			case "translation":
				return t("editLanguageDialog.targetTranslation", "翻译");
			case "romanization":
				return t("editLanguageDialog.targetRomanization", "音译");
			case "word-romanization":
				return t("editLanguageDialog.targetWordRomanization", "逐字音译");
			default:
				return "";
		}
	};

	return (
		<Dialog.Root open={dialogState.open} onOpenChange={handleClose}>
			<Dialog.Content>
				<Dialog.Title>
					{t("editLanguageDialog.title", "修改语言代码")}
				</Dialog.Title>
				<Flex direction="column" gap="3">
					<Text size="2">
						{t("editLanguageDialog.currentLang", "当前语言代码")}: <strong>{dialogState.currentLang}</strong>
						({getTargetLabel()})
					</Text>
					<Text size="2">
						{t("editLanguageDialog.commonCodes", "常用语言代码")}
					</Text>
					<Flex
						gap="2"
						wrap="wrap"
					>
						{COMMON_LANGUAGE_CODES.map((code) => (
							<Button
								key={code}
								variant="soft"
								size="1"
								onClick={() => handleSelect(code)}
								disabled={code === dialogState.currentLang}
							>
								{code}
							</Button>
						))}
					</Flex>
					<Text size="2">
						{t("editLanguageDialog.newCode", "新语言代码")}
					</Text>
					<TextField.Root
						value={newLang}
						placeholder={t(
							"editLanguageDialog.newPlaceholder",
							"输入新语言代码（如 en、ja、zh-CN）",
						)}
						onChange={(e) => setNewLang(e.currentTarget.value)}
						onKeyDown={(e) => {
							if (e.key !== "Enter") return;
							if (!canSubmit) return;
							handleSelect(newLang);
						}}
					/>
				</Flex>
				<Flex gap="3" mt="4" justify="end">
					<Button variant="soft" color="gray" onClick={handleClose}>
						{t("common.cancel", "取消")}
					</Button>
					<Button
						onClick={() => handleSelect(newLang)}
						disabled={!canSubmit}
					>
						{t("editLanguageDialog.confirm", "确认")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
