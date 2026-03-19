import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addLanguageDialogAtom } from "$/states/dialogs";

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

export const AddLanguageDialog = () => {
	const { t } = useTranslation();
	const [dialogState, setDialogState] = useAtom(addLanguageDialogAtom);
	const [customLang, setCustomLang] = useState("");

	useEffect(() => {
		if (!dialogState.open) return;
		setCustomLang("");
	}, [dialogState.open]);

	const handleClose = () => {
		setDialogState({ ...dialogState, open: false });
	};

	const handleSelect = (lang: string) => {
		const trimmed = lang.trim();
		if (!trimmed || trimmed === "und") return;
		dialogState.onSubmit?.(trimmed);
		setCustomLang("");
		setDialogState({ ...dialogState, open: false });
	};

	const canSubmitCustom = useMemo(() => {
		const trimmed = customLang.trim();
		return trimmed.length > 0 && trimmed !== "und";
	}, [customLang]);

	return (
		<Dialog.Root open={dialogState.open} onOpenChange={handleClose}>
			<Dialog.Content>
				<Dialog.Title>
					{t("addLanguageDialog.title", "新增语言代码")}
				</Dialog.Title>
				<Flex direction="column" gap="3">
					<Text size="2">
						{t("addLanguageDialog.commonCodes", "常用语言代码")}
					</Text>
					<Flex gap="2" wrap="wrap">
						{COMMON_LANGUAGE_CODES.map((code) => (
							<Button
								key={code}
								variant="soft"
								size="1"
								onClick={() => handleSelect(code)}
							>
								{code}
							</Button>
						))}
					</Flex>
					<Text size="2">
						{t("addLanguageDialog.customCode", "自定义语言代码")}
					</Text>
					<TextField.Root
						value={customLang}
						placeholder={t(
							"addLanguageDialog.customPlaceholder",
							"输入语言代码（如 en、ja、zh-CN）",
						)}
						onChange={(e) => setCustomLang(e.currentTarget.value)}
						onKeyDown={(e) => {
							if (e.key !== "Enter") return;
							if (!canSubmitCustom) return;
							handleSelect(customLang);
						}}
					/>
				</Flex>
				<Flex gap="3" mt="4" justify="end">
					<Button variant="soft" color="gray" onClick={handleClose}>
						{t("common.cancel", "取消")}
					</Button>
					<Button
						onClick={() => handleSelect(customLang)}
						disabled={!canSubmitCustom}
					>
						{t("addLanguageDialog.add", "新增")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
