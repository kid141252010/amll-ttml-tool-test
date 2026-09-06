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
	Flex,
	Grid,
	IconButton,
	RadioGroup,
	Select,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import {
	Add16Regular,
	ArrowSwap16Regular,
	ArrowSync16Regular,
	Delete16Regular,
	Edit16Regular,
} from "@fluentui/react-icons";
import { atom, useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	type FC,
	forwardRef,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
	LayoutMode,
	layoutModeAtom,
	showLineRomanizationAtom,
	showLineTranslationAtom,
	showWordRomanizationInputAtom,
} from "$/modules/settings/states";
import { distributeRomanizationByCharCount } from "$/modules/segmentation/utils/Transliteration/distributor";
import {
	customSongPartPresetsAtom,
	editingTimeFieldAtom,
	lyricLinesAtom,
	requestFocusAtom,
	selectedLinesAtom,
	selectedRomanizationLangAtom,
	selectedTranslationLangAtom,
	selectedWordRomanizationLangAtom,
	selectedWordsAtom,
	showEndTimeAsDurationAtom,
} from "$/states/main.ts";
import {
	addLanguageDialogAtom,
	confirmDialogAtom,
	distributeTranslationDialogAtom,
	editLanguageDialogAtom,
} from "$/states/dialogs";
import {
	type LyricLine,
	type LyricWord,
	type TTMLAgent,
	type TTMLLangData,
	type TTMLTranslationWord,
	newLyricLine,
} from "$/types/ttml";
import {
	calculateDuetState,
	calculateDuetOptions,
} from "$/modules/project/logic/ttml-parser";
import { msToTimestamp, parseTimespan } from "$/utils/timestamp.ts";
import { RibbonFrame, RibbonSection } from "./common";

const MULTIPLE_VALUES = Symbol("multiple-values");

function EditField<
	L extends Word extends true ? LyricWord : LyricLine,
	F extends keyof L,
	Word extends boolean | undefined = undefined,
>({
	label,
	isWordField,
	fieldName,
	formatter,
	parser,
	textFieldStyle,
	disabled: disabledProp,
}: {
	label: string;
	isWordField?: Word;
	fieldName: F;
	formatter: (v: L[F]) => string;
	parser: (v: string) => L[F];
	textFieldStyle?: React.CSSProperties;
	disabled?: boolean;
}) {
	const [fieldInput, setFieldInput] = useState<string | undefined>(undefined);
	const [fieldPlaceholder, setFieldPlaceholder] = useState<string>("");
	const [durationInputInvalid, setDurationInputInvalid] = useState(false);
	const [showDurationInput, setShowDurationInput] = useAtom(
		showEndTimeAsDurationAtom,
	);
	const itemAtom = useMemo(
		() => (isWordField ? selectedWordsAtom : selectedLinesAtom),
		[isWordField],
	);

	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const { t } = useTranslation();
	const setEditingTimeField = useSetAtom(editingTimeFieldAtom);

	const [requestFocus, setRequestFocus] = useAtom(requestFocusAtom);
	const inputRef = useRef<HTMLInputElement>(null);
	const durationInvalidTimerRef = useRef<number | null>(null);

	useEffect(() => {
		if (requestFocus === fieldName && !isWordField && inputRef.current) {
			inputRef.current.focus();
			setRequestFocus(null);
		}
	}, [requestFocus, fieldName, isWordField, setRequestFocus]);
	useEffect(
		() => () => {
			if (durationInvalidTimerRef.current !== null) {
				window.clearTimeout(durationInvalidTimerRef.current);
			}
		},
		[],
	);

	const hasErrorAtom = useMemo(
		() =>
			atom((get) => {
				if (fieldName !== "startTime" && fieldName !== "endTime") {
					return false;
				}

				const selectedItems = get(itemAtom);
				if (selectedItems.size === 0) return false;

				const lyricLines = get(lyricLinesAtom);

				if (isWordField) {
					const selectedWords = selectedItems;
					for (const line of lyricLines.lyricLines) {
						for (const word of line.words) {
							if (selectedWords.has(word.id)) {
								if (word.startTime > word.endTime) {
									return true;
								}
							}
						}
					}
				} else {
					const selectedLines = selectedItems;
					for (const line of lyricLines.lyricLines) {
						if (selectedLines.has(line.id)) {
							if (line.startTime > line.endTime) {
								return true;
							}
						}
					}
				}
				return false;
			}),
		[fieldName, isWordField, itemAtom],
	);
	const hasError = useAtomValue(hasErrorAtom);

	const currentValueAtom = useMemo(
		() =>
			atom((get) => {
				const selectedItems = get(itemAtom);
				const lyricLines = get(lyricLinesAtom);
				if (selectedItems.size === 0) return undefined;

				if (isWordField) {
					const selectedWords = selectedItems as Set<string>;
					const values = new Set();
					for (const line of lyricLines.lyricLines) {
						for (const word of line.words) {
							if (selectedWords.has(word.id)) {
								values.add(word[fieldName as keyof LyricWord]);
							}
						}
					}
					if (values.size === 1)
						return formatter(values.values().next().value as L[F]);
					return MULTIPLE_VALUES;
				}
				const selectedLines = selectedItems as Set<string>;
				const values = new Set();
				for (const line of lyricLines.lyricLines) {
					if (selectedLines.has(line.id)) {
						values.add(line[fieldName as keyof LyricLine]);
					}
				}
				if (values.size === 1)
					return formatter(values.values().next().value as L[F]);
				return MULTIPLE_VALUES;
			}),
		[fieldName, formatter, isWordField, itemAtom],
	);
	const currentValue = useAtomValue(currentValueAtom);
	const store = useStore();
	const durationValueAtom = useMemo(
		() =>
			atom((get) => {
				if (fieldName !== "endTime") return undefined;
				const selectedItems = get(itemAtom);
				const lyricLines = get(lyricLinesAtom);
				if (selectedItems.size === 0) return undefined;
				const durations = new Set<number>();
				if (isWordField) {
					const selectedWords = selectedItems as Set<string>;
					for (const line of lyricLines.lyricLines) {
						for (const word of line.words) {
							if (selectedWords.has(word.id)) {
								durations.add(word.endTime - word.startTime);
							}
						}
					}
				} else {
					const selectedLines = selectedItems as Set<string>;
					for (const line of lyricLines.lyricLines) {
						if (selectedLines.has(line.id)) {
							durations.add(line.endTime - line.startTime);
						}
					}
				}
				if (durations.size === 1) return durations.values().next().value;
				return MULTIPLE_VALUES;
			}),
		[fieldName, isWordField, itemAtom],
	);
	const durationValue = useAtomValue(durationValueAtom);
	const compareValue = useMemo(() => {
		if (fieldName === "endTime" && showDurationInput) {
			if (durationValue === MULTIPLE_VALUES) return "";
			if (typeof durationValue === "number") return String(durationValue);
			return "";
		}
		if (typeof currentValue === "string") return currentValue;
		return "";
	}, [currentValue, durationValue, fieldName, showDurationInput]);
	const flashInvalidDurationInput = useCallback(() => {
		setFieldInput("");
		setDurationInputInvalid(true);
		if (durationInvalidTimerRef.current !== null) {
			window.clearTimeout(durationInvalidTimerRef.current);
		}
		durationInvalidTimerRef.current = window.setTimeout(() => {
			setDurationInputInvalid(false);
		}, 300);
		inputRef.current?.animate(
			[
				{ backgroundColor: "var(--red-a5)" },
				{ backgroundColor: "var(--red-a3)" },
				{ backgroundColor: "transparent" },
			],
			{ duration: 300 },
		);
	}, []);

	const onInputFinished = useCallback(
		(rawValue: string) => {
			try {
				const selectedItems = store.get(itemAtom);
				if (fieldName === "endTime" && showDurationInput) {
					const trimmedValue = rawValue.trim();
					if (!/^\d+$/.test(trimmedValue)) {
						flashInvalidDurationInput();
						return;
					}
					const durationValue = Number(trimmedValue);
					if (!Number.isFinite(durationValue) || durationValue <= 0) {
						flashInvalidDurationInput();
						return;
					}
					editLyricLines((state) => {
						for (const line of state.lyricLines) {
							if (isWordField) {
								for (
									let wordIndex = 0;
									wordIndex < line.words.length;
									wordIndex++
								) {
									const word = line.words[wordIndex];
									if (!selectedItems.has(word.id)) continue;
									const nextWord = line.words[wordIndex + 1];
									const nextStartTime = nextWord?.startTime;
									const newEndTime = word.startTime + durationValue;
									if (
										typeof nextStartTime === "number" &&
										newEndTime < nextStartTime
									) {
										continue;
									}
									word.endTime = newEndTime;
								}
							} else if (selectedItems.has(line.id)) {
								line.endTime = line.startTime + durationValue;
							}
						}
						return state;
					});
					return;
				}
				const value = parser(rawValue);
				editLyricLines((state) => {
					for (const line of state.lyricLines) {
						if (isWordField) {
							for (const word of line.words) {
								if (selectedItems.has(word.id)) {
									(word as L)[fieldName] = value;
								}
							}
						} else {
							if (selectedItems.has(line.id)) {
								(line as L)[fieldName] = value;
							}
						}
					}
					return state;
				});
			} catch (err) {
				if (compareValue) setFieldInput(compareValue);
			}
		},
		[
			itemAtom,
			store,
			editLyricLines,
			compareValue,
			fieldName,
			isWordField,
			parser,
			showDurationInput,
			flashInvalidDurationInput,
		],
	);

	useLayoutEffect(() => {
		if (fieldName === "endTime" && showDurationInput) {
			if (durationValue === MULTIPLE_VALUES) {
				setFieldInput("");
				setFieldPlaceholder(
					t("ribbonBar.editMode.multipleValues", "多个值..."),
				);
				return;
			}
			if (typeof durationValue === "number") {
				setFieldInput(String(durationValue));
				setFieldPlaceholder("");
				return;
			}
			setFieldInput(undefined);
			setFieldPlaceholder("");
			return;
		}
		if (currentValue === MULTIPLE_VALUES) {
			setFieldInput("");
			setFieldPlaceholder(t("ribbonBar.editMode.multipleValues", "多个值..."));
			return;
		}
		setFieldInput(currentValue);
		setFieldPlaceholder("");
	}, [currentValue, durationValue, fieldName, showDurationInput, t]);

	return (
		<>
			{fieldName === "endTime" ? (
				<Button
					size="1"
					variant="ghost"
					onClick={() => setShowDurationInput((v) => !v)}
					style={{ justifyContent: "flex-start" }}
				>
					{showDurationInput
						? t("ribbonBar.editMode.duration", "持续时间")
						: label}
				</Button>
			) : (
				<Text wrap="nowrap" size="1">
					{label}
				</Text>
			)}
			<TextField.Root
				ref={inputRef}
				size="1"
				color={durationInputInvalid || hasError ? "red" : undefined}
				variant={durationInputInvalid || hasError ? "soft" : undefined}
				style={{ width: "8em", ...textFieldStyle }}
				value={fieldInput ?? ""}
				placeholder={fieldPlaceholder}
				disabled={disabledProp || fieldInput === undefined}
				onChange={(evt) => setFieldInput(evt.currentTarget.value)}
				onKeyDown={(evt) => {
					if (evt.key !== "Enter") return;
					onInputFinished(evt.currentTarget.value);
				}}
				onFocus={() => {
					if (
						!isWordField &&
						(fieldName === "startTime" || fieldName === "endTime")
					) {
						setEditingTimeField({
							isWord: false,
							field: fieldName as "startTime" | "endTime",
						});
					}
				}}
				onBlur={(evt) => {
					setEditingTimeField(null);

					if (evt.currentTarget.value === compareValue) return;
					onInputFinished(evt.currentTarget.value);
				}}
			/>
		</>
	);
}

function CheckboxField<
	L extends Word extends true ? LyricWord : LyricLine,
	F extends keyof L,
	Word extends boolean | undefined = undefined,
>({
	label,
	isWordField,
	fieldName,
	defaultValue,
}: {
	label: string;
	isWordField: Word;
	fieldName: F;
	defaultValue: boolean;
}) {
	const itemAtom = useMemo(
		() => (isWordField ? selectedWordsAtom : selectedLinesAtom),
		[isWordField],
	);

	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const store = useStore();

	const currentValueAtom = useMemo(
		() =>
			atom((get) => {
				const selectedItems = get(itemAtom);
				const lyricLines = get(lyricLinesAtom);
				if (selectedItems.size) {
					if (isWordField) {
						const selectedWords = selectedItems as Set<string>;
						const values = new Set();
						for (const line of lyricLines.lyricLines) {
							for (const word of line.words) {
								if (selectedWords.has(word.id)) {
									values.add(word[fieldName as keyof LyricWord]);
								}
							}
						}
						if (values.size === 1) return values.values().next().value as L[F];
						return MULTIPLE_VALUES;
					}
					const selectedLines = selectedItems as Set<string>;
					const values = new Set();
					for (const line of lyricLines.lyricLines) {
						if (selectedLines.has(line.id)) {
							values.add(line[fieldName as keyof LyricLine]);
						}
					}
					if (values.size === 1) return values.values().next().value as L[F];
					return MULTIPLE_VALUES;
				}
				return undefined;
			}),
		[itemAtom, fieldName, isWordField],
	);
	const currentValue = useAtomValue(currentValueAtom);

	// 对于 rubyPhraseStart 字段，检查选中的单词是否有 ruby
	const hasRubyAtom = useMemo(
		() =>
			atom((get) => {
				if (fieldName !== "rubyPhraseStart" || !isWordField) return true;
				const selectedItems = get(itemAtom);
				const lyricLines = get(lyricLinesAtom);
				if (selectedItems.size === 0) return false;
				const selectedWords = selectedItems as Set<string>;
				for (const line of lyricLines.lyricLines) {
					for (const word of line.words) {
						if (selectedWords.has(word.id)) {
							// 如果任何一个选中的单词没有 ruby，则禁用 checkbox
							if (!word.ruby || word.ruby.length === 0) {
								return false;
							}
						}
					}
				}
				return true;
			}),
		[fieldName, isWordField, itemAtom],
	);
	const hasRuby = useAtomValue(hasRubyAtom);

	// 对于 rubyPhraseStart 字段，检查是否强制需要设置为 true（行首或前一个单词没有 ruby）
	const forceRubyPhraseStartAtom = useMemo(
		() =>
			atom((get) => {
				if (fieldName !== "rubyPhraseStart" || !isWordField) return false;
				const selectedItems = get(itemAtom);
				const lyricLines = get(lyricLinesAtom);
				if (selectedItems.size === 0) return false;
				const selectedWords = selectedItems as Set<string>;
				for (const line of lyricLines.lyricLines) {
					for (let i = 0; i < line.words.length; i++) {
						const word = line.words[i];
						if (selectedWords.has(word.id)) {
							// 如果是行首单词，或前一个单词没有 ruby，则强制设置为 true
							const isFirstWord = i === 0;
							const prevWord = i > 0 ? line.words[i - 1] : null;
							const prevWordHasNoRuby =
								!prevWord || !prevWord.ruby || prevWord.ruby.length === 0;
							if (isFirstWord || prevWordHasNoRuby) {
								return true;
							}
						}
					}
				}
				return false;
			}),
		[fieldName, isWordField, itemAtom],
	);
	const forceRubyPhraseStart = useAtomValue(forceRubyPhraseStartAtom);

	const isDisabledAtom = useMemo(
		() => atom((get) => get(itemAtom).size === 0),
		[itemAtom],
	);
	const isDisabledBase = useAtomValue(isDisabledAtom);

	// 对于 isDuet 字段，检查选中的行是否设置了有意义的 agent
	const hasAgentAtom = useMemo(
		() =>
			atom((get) => {
				if (fieldName !== "isDuet" || isWordField) return false;
				const selectedItems = get(itemAtom);
				const lyricLines = get(lyricLinesAtom);
				if (selectedItems.size === 0) return false;

				// 检查 agent 配置是否有意义（足以支持对唱功能）
				const agents = lyricLines.agents ?? [];
				const hasMeaningfulAgents = (() => {
					// 情况1: 没有 Agent
					if (agents.length === 0) return false;

					// 情况2: 只有一个没有 name 的 person Agent
					if (agents.length === 1) {
						const agent = agents[0];
						if (
							agent.type === "person" &&
							(!agent.names ||
								agent.names.length === 0 ||
								agent.names.every((n) => !n.trim()))
						) {
							return false;
						}
					}

					// 情况3: 只有一个没有 name 的 person Agent 和一个没有 name 的 other Agent
					if (agents.length === 2) {
						const personAgent = agents.find((a) => a.type === "person");
						const otherAgent = agents.find((a) => a.type === "other");
						const hasGroupAgent = agents.some((a) => a.type === "group");

						if (personAgent && otherAgent && !hasGroupAgent) {
							const personHasNoName =
								!personAgent.names ||
								personAgent.names.length === 0 ||
								personAgent.names.every((n) => !n.trim());
							const otherHasNoName =
								!otherAgent.names ||
								otherAgent.names.length === 0 ||
								otherAgent.names.every((n) => !n.trim());

							if (personHasNoName && otherHasNoName) return false;
						}
					}

					return true;
				})();

				// 如果 agent 配置无意义，则不禁用对唱歌词选框
				if (!hasMeaningfulAgents) return false;

				const selectedLines = selectedItems as Set<string>;
				for (const line of lyricLines.lyricLines) {
					if (selectedLines.has(line.id)) {
						// 如果任何一个选中的行设置了 agent，则禁用 checkbox
						if (line.agent) {
							return true;
						}
					}
				}
				return false;
			}),
		[fieldName, isWordField, itemAtom],
	);
	const hasAgent = useAtomValue(hasAgentAtom);

	const isDisabled =
		isDisabledBase || !hasRuby || forceRubyPhraseStart || hasAgent;
	const checkboxId = useId();

	return (
		<>
			<Text wrap="nowrap" size="1">
				<label htmlFor={checkboxId}>{label}</label>
			</Text>
			<Checkbox
				disabled={isDisabled}
				id={checkboxId}
				checked={
					forceRubyPhraseStart
						? true
						: isDisabled && fieldName === "rubyPhraseStart"
							? false
							: currentValue
								? currentValue === MULTIPLE_VALUES
									? "indeterminate"
									: (currentValue as boolean)
								: defaultValue
				}
				onCheckedChange={(value) => {
					if (value === "indeterminate") return;
					editLyricLines((state) => {
						const selectedItems = store.get(itemAtom);
						for (const line of state.lyricLines) {
							if (isWordField) {
								for (let i = 0; i < line.words.length; i++) {
									const word = line.words[i];
									if (selectedItems.has(word.id)) {
										// 对于 rubyPhraseStart，特殊处理
										if (fieldName === "rubyPhraseStart") {
											// 如果没有 ruby 则强制设为 false
											if (!word.ruby || word.ruby.length === 0) {
												(word as L)[fieldName] = false as L[F];
											} else {
												// 如果是行首单词，或前一个单词没有 ruby，则强制设为 true
												const isFirstWord = i === 0;
												const prevWord = i > 0 ? line.words[i - 1] : null;
												const prevWordHasNoRuby =
													!prevWord ||
													!prevWord.ruby ||
													prevWord.ruby.length === 0;
												if (isFirstWord || prevWordHasNoRuby) {
													(word as L)[fieldName] = true as L[F];
												} else {
													(word as L)[fieldName] = value as L[F];
												}
											}
										} else {
											(word as L)[fieldName] = value as L[F];
										}
									}
								}
							} else {
								if (selectedItems.has(line.id)) {
									(line as L)[fieldName] = value as L[F];
								}
							}
						}
						return state;
					});
				}}
			/>
		</>
	);
}

function EditModeField({
	simpleModeLabel = "简单模式",
	advanceModeLabel = "高级模式",
}) {
	const [layoutMode, setLayoutMode] = useAtom(layoutModeAtom);
	return (
		<RadioGroup.Root
			value={layoutMode}
			onValueChange={(v) => setLayoutMode(v as LayoutMode)}
			size="1"
		>
			<Flex gapY="3" direction="column">
				<Text wrap="nowrap" size="1">
					<RadioGroup.Item value={LayoutMode.Simple}>
						{simpleModeLabel}
					</RadioGroup.Item>
				</Text>
				<Text wrap="nowrap" size="1">
					<RadioGroup.Item value={LayoutMode.Advance}>
						{advanceModeLabel}
					</RadioGroup.Item>
				</Text>
			</Flex>
		</RadioGroup.Root>
	);
}
// function DropdownField<
// 	L extends Word extends true ? LyricWord : LyricLine,
// 	F extends keyof L,
// 	Word extends boolean | undefined = undefined,
// >({
// 	label,
// 	isWordField,
// 	fieldName,
// 	children,
// 	defaultValue,
// }: {
// 	label: string;
// 	isWordField: Word;
// 	fieldName: F;
// 	defaultValue: L[F];
// 	children?: ReactNode | undefined;
// }) {
// 	const itemAtom = useMemo(
// 		() => (isWordField ? selectedWordsAtom : selectedLinesAtom),
// 		[isWordField],
// 	);
// 	const selectedItems = useAtomValue(itemAtom);

// 	const [lyricLines, editLyricLines] = useAtom(currentLyricLinesAtom);

// 	const currentValue = useMemo(() => {
// 		if (selectedItems.size) {
// 			if (isWordField) {
// 				const selectedWords = selectedItems as Set<string>;
// 				const values = new Set();
// 				for (const line of lyricLines.lyricLines) {
// 					for (const word of line.words) {
// 						if (selectedWords.has(word.id)) {
// 							values.add(word[fieldName as keyof LyricWord]);
// 						}
// 					}
// 				}
// 				if (values.size === 1)
// 					return {
// 						multiplieValues: false,
// 						value: values.values().next().value as L[F],
// 					} as const;
// 				return {
// 					multiplieValues: true,
// 					value: "",
// 				} as const;
// 			}
// 			const selectedLines = selectedItems as Set<string>;
// 			const values = new Set();
// 			for (const line of lyricLines.lyricLines) {
// 				if (selectedLines.has(line.id)) {
// 					values.add(line[fieldName as keyof LyricLine]);
// 				}
// 			}
// 			if (values.size === 1)
// 				return {
// 					multiplieValues: false,
// 					value: values.values().next().value as L[F],
// 				} as const;
// 			return {
// 				multiplieValues: true,
// 				value: "",
// 			} as const;
// 		}
// 		return undefined;
// 	}, [selectedItems, fieldName, isWordField, lyricLines]);

// 	return (
// 		<>
// 			<Text wrap="nowrap" size="1">
// 				{label}
// 			</Text>
// 			<Select.Root
// 				size="1"
// 				disabled={selectedItems.size === 0}
// 				defaultValue={defaultValue as string}
// 				value={(currentValue?.value as string) ?? ""}
// 				onValueChange={(value) => {
// 					editLyricLines((state) => {
// 						for (const line of state.lyricLines) {
// 							if (isWordField) {
// 								for (const word of line.words) {
// 									if (selectedItems.has(word.id)) {
// 										(word as L)[fieldName] = value as L[F];
// 									}
// 								}
// 							} else {
// 								if (selectedItems.has(line.id)) {
// 									(line as L)[fieldName] = value as L[F];
// 								}
// 							}
// 						}
// 						return state;
// 					});
// 				}}
// 			>
// 				<Select.Trigger
// 					placeholder={selectedItems.size > 0 ? "多个值..." : undefined}
// 				/>
// 				<Select.Content>{children}</Select.Content>
// 			</Select.Root>
// 		</>
// 	);
// }

// 内置的预设 song-part 列表
const BUILTIN_SONG_PART_OPTIONS = [
	{ value: "Verse", label: "Verse" },
	{ value: "Chorus", label: "Chorus" },
	{ value: "PreChorus", label: "PreChorus" },
	{ value: "Bridge", label: "Bridge" },
	{ value: "Intro", label: "Intro" },
	{ value: "Outro", label: "Outro" },
	{ value: "Refrain", label: "Refrain" },
	{ value: "Instrumental", label: "Instrumental" },
	{ value: "Hook", label: "Hook" },
	{ value: "Reprise", label: "Reprise" },
	{ value: "Transition", label: "Transition" },
	{ value: "FalseChorus", label: "FalseChorus" },
];

const NONE_VALUE = "__none__";

const SongPartField: FC = () => {
	const { t } = useTranslation();
	const selectedLines = useAtomValue(selectedLinesAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [customSongPartPresets, setCustomSongPartPresets] = useAtom(
		customSongPartPresetsAtom,
	);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);

	// 获取当前选中行的 songPart 值
	const currentSongPart = useMemo(() => {
		if (selectedLines.size === 0) return undefined;
		const values = new Set<string | undefined>();
		for (const line of lyricLines.lyricLines) {
			if (selectedLines.has(line.id)) {
				values.add(line.songPart);
			}
		}
		if (values.size === 1) {
			const value = values.values().next().value;
			return value ?? NONE_VALUE;
		}
		return undefined; // 多个值
	}, [selectedLines, lyricLines]);

	const handleSongPartChange = useCallback(
		(value: string) => {
			editLyricLines((state) => {
				for (const line of state.lyricLines) {
					if (selectedLines.has(line.id)) {
						line.songPart = value === NONE_VALUE ? undefined : value;
					}
				}
				return state;
			});
		},
		[editLyricLines, selectedLines],
	);

	// 处理添加自定义预设 - 使用弹窗
	const handleAddCustomPreset = useCallback(() => {
		setConfirmDialog({
			open: true,
			title: t("ribbonBar.editMode.addCustomPart", "Add custom part"),
			description: t(
				"ribbonBar.editMode.addCustomPartDescription",
				"Enter a new song part name:",
			),
			input: {
				placeholder: t(
					"ribbonBar.editMode.customPartPlaceholder",
					"Custom part",
				),
				validate: (value: string) => {
					if (!value.trim()) {
						return t("ribbonBar.editMode.emptyValue", "Value cannot be empty");
					}
					// 检查是否已存在于内置预设或自定义预设中
					const allPresets = [
						...BUILTIN_SONG_PART_OPTIONS.map((o) => o.value),
						...customSongPartPresets,
					];
					if (allPresets.includes(value.trim())) {
						return t(
							"ribbonBar.editMode.duplicateValue",
							"Value already exists",
						);
					}
					return null;
				},
			},
			onConfirm: (value) => {
				if (value?.trim()) {
					// 添加到自定义预设列表
					setCustomSongPartPresets((prev) => [...prev, value.trim()]);
					// 设置为当前选中行的 songPart
					handleSongPartChange(value.trim());
				}
			},
		});
	}, [
		setConfirmDialog,
		t,
		customSongPartPresets,
		setCustomSongPartPresets,
		handleSongPartChange,
	]);

	// 处理将自定义 song-part 转换为预设值（添加到预设列表）
	const handleConvertToPreset = useCallback(
		(customValue: string) => {
			// 添加到自定义预设列表
			setCustomSongPartPresets((prev) => {
				if (prev.includes(customValue)) return prev;
				return [...prev, customValue];
			});
			// 从 customSongParts 中移除
			editLyricLines((state) => {
				if (state.customSongParts) {
					state.customSongParts = state.customSongParts.filter(
						(p) => p !== customValue,
					);
				}
				return state;
			});
		},
		[editLyricLines, setCustomSongPartPresets],
	);

	const displayValue =
		currentSongPart === undefined ? NONE_VALUE : currentSongPart;
	const songPartLabelId = useId();

	// 获取文件中解析出的自定义 song-part 列表
	const customSongParts = lyricLines.customSongParts || [];

	// 处理删除预设
	const handleDeletePreset = useCallback(
		(presetValue: string) => {
			// 从自定义预设列表中移除
			setCustomSongPartPresets((prev) => prev.filter((p) => p !== presetValue));
			// 将所有使用该预设的行的 songPart 设置为 undefined（无）
			editLyricLines((state) => {
				for (const line of state.lyricLines) {
					if (line.songPart === presetValue) {
						line.songPart = undefined;
					}
				}
				return state;
			});
		},
		[editLyricLines, setCustomSongPartPresets],
	);

	return (
		<>
			<Text size="1" id={songPartLabelId}>
				{t("ribbonBar.editMode.songPart", "Song Part")}
			</Text>
			<Select.Root
				value={displayValue}
				onValueChange={handleSongPartChange}
				size="1"
			>
				<Select.Trigger
					placeholder={
						selectedLines.size === 0
							? t("ribbonBar.editMode.noSelection", "No selection")
							: currentSongPart === undefined
								? t("ribbonBar.editMode.multipleValues", "Multiple values...")
								: t("ribbonBar.editMode.none", "None")
					}
					disabled={selectedLines.size === 0}
					style={{ minWidth: "6em" }}
					aria-labelledby={songPartLabelId}
				/>
				<Select.Content>
					<Select.Item value={NONE_VALUE}>
						{t("ribbonBar.editMode.none", "None")}
					</Select.Item>
					<Select.Separator />
					{/* 内置预设 - 不可删除 */}
					{BUILTIN_SONG_PART_OPTIONS.map((option) => (
						<Select.Item key={option.value} value={option.value}>
							{option.label}
						</Select.Item>
					))}
					{/* 用户自定义预设 - 可删除 */}
					{customSongPartPresets.map((presetValue) => (
						<Box key={presetValue} position="relative">
							<Select.Item value={presetValue}>
								<Text style={{ paddingRight: "2rem" }}>{presetValue}</Text>
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
										handleDeletePreset(presetValue);
									}}
								>
									<Delete16Regular />
								</IconButton>
							</Box>
						</Box>
					))}
					{customSongParts.length > 0 && (
						<>
							<Select.Separator />
							{customSongParts.map((customPart) => (
								<Box key={customPart} position="relative">
									<Select.Item value={customPart}>
										<Text style={{ paddingRight: "2rem" }}>{customPart}</Text>
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
											onClick={() => {
												handleConvertToPreset(customPart);
											}}
										>
											<ArrowSwap16Regular />
										</IconButton>
									</Box>
								</Box>
							))}
						</>
					)}
					<Select.Separator />
					<Box position="relative">
						<Select.Item value="__add_custom__" disabled>
							<Text style={{ paddingRight: "2rem" }}>
								{t("ribbonBar.editMode.addCustomPart", "Add custom")}
							</Text>
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
								onClick={() => {
									handleAddCustomPreset();
								}}
							>
								<Add16Regular />
							</IconButton>
						</Box>
					</Box>
				</Select.Content>
			</Select.Root>
		</>
	);
};

const AgentField: FC = () => {
	const { t } = useTranslation();
	const selectedLines = useAtomValue(selectedLinesAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const agentLabelId = useId();

	// 按类型分类 agent，保持原有顺序
	const groupedAgents = useMemo(() => {
		const person: TTMLAgent[] = [];
		const group: TTMLAgent[] = [];
		const other: TTMLAgent[] = [];

		// 兼容旧数据：如果 agents 不存在，使用空数组
		const agents = lyricLines.agents ?? [];

		for (const agent of agents) {
			if (agent.type === "person") person.push(agent);
			else if (agent.type === "group") group.push(agent);
			else other.push(agent);
		}

		return { person, group, other };
	}, [lyricLines.agents]);

	// 检查 agent 配置是否有意义（足以支持对唱功能）
	const hasMeaningfulAgents = useMemo(() => {
		const agents = lyricLines.agents ?? [];

		// 情况1: 没有 Agent
		if (agents.length === 0) return false;

		// 情况2: 只有一个没有 name 的 person Agent
		if (agents.length === 1) {
			const agent = agents[0];
			if (
				agent.type === "person" &&
				(!agent.names ||
					agent.names.length === 0 ||
					agent.names.every((n) => !n.trim()))
			) {
				return false;
			}
		}

		// 情况3: 只有一个没有 name 的 person Agent 和一个没有 name 的 other Agent
		if (agents.length === 2) {
			const personAgent = agents.find((a) => a.type === "person");
			const otherAgent = agents.find((a) => a.type === "other");
			const hasGroupAgent = agents.some((a) => a.type === "group");

			if (personAgent && otherAgent && !hasGroupAgent) {
				const personHasNoName =
					!personAgent.names ||
					personAgent.names.length === 0 ||
					personAgent.names.every((n) => !n.trim());
				const otherHasNoName =
					!otherAgent.names ||
					otherAgent.names.length === 0 ||
					otherAgent.names.every((n) => !n.trim());

				if (personHasNoName && otherHasNoName) return false;
			}
		}

		return true;
	}, [lyricLines.agents]);

	// 获取当前选中行的 agent 值（包括背景行）
	const currentAgent = useMemo(() => {
		if (selectedLines.size === 0) return undefined;
		// 如果 agent 配置无意义，不显示行的 agent 值
		if (!hasMeaningfulAgents) return NONE_VALUE;
		const values = new Set<string | undefined>();
		for (const line of lyricLines.lyricLines) {
			if (selectedLines.has(line.id)) {
				// 从行的 agent 字段获取值（包括背景行）
				values.add(line.agent);
			}
		}
		if (values.size === 1) {
			const value = values.values().next().value;
			return value ?? NONE_VALUE;
		}
		return undefined;
	}, [selectedLines, lyricLines, hasMeaningfulAgents]);

	const handleAgentChange = useCallback(
		(value: string) => {
			editLyricLines((state) => {
				// 创建 agent 查找映射
				const agentMap = new Map<string, TTMLAgent>();
				for (const agent of state.agents) {
					agentMap.set(agent.id, agent);
				}

				// 首先更新选中行的 agent（包括背景行）
				for (const line of state.lyricLines) {
					if (selectedLines.has(line.id)) {
						line.agent = value === NONE_VALUE ? undefined : value;
					}
				}

				// 初始化对唱处理选项
				const duetOptionsBase = calculateDuetOptions(state.agents ?? []);
				const duetState = {
					...duetOptionsBase,
					currentAgentId: duetOptionsBase.mainAgentId,
					duetToggle: false,
				};

				// 记录主行的对唱状态，供背景行继承
				let lastMainLineIsDuet = false;

				// 重新计算所有行的对唱状态
				for (const line of state.lyricLines) {
					if (line.isBG) {
						// 背景行继承主行的对唱状态
						line.isDuet = lastMainLineIsDuet;
						continue;
					}

					// 使用新的对唱状态计算函数
					const result = calculateDuetState(line.agent, duetState);
					line.isDuet = result.isDuet;
					duetState.currentAgentId = result.newCurrentAgentId;
					duetState.duetToggle = result.newDuetToggle;
					lastMainLineIsDuet = line.isDuet;
				}

				return state;
			});
		},
		[editLyricLines, selectedLines],
	);

	const displayValue = currentAgent === undefined ? NONE_VALUE : currentAgent;

	// 构建下拉选项（只显示 id，names 用于 Tooltip）
	const agentOptions = useMemo(() => {
		const options: {
			value: string;
			label: string;
			type: string;
			names: string[];
		}[] = [];

		// Person 类型
		for (const agent of groupedAgents.person) {
			options.push({
				value: agent.id,
				label: agent.id,
				type: "person",
				names: agent.names,
			});
		}

		// Group 类型（添加分隔线标记）
		if (groupedAgents.group.length > 0) {
			if (options.length > 0) {
				options.push({
					value: "__sep_group__",
					label: "",
					type: "separator",
					names: [],
				});
			}
			for (const agent of groupedAgents.group) {
				options.push({
					value: agent.id,
					label: agent.id,
					type: "group",
					names: agent.names,
				});
			}
		}

		// Other 类型（添加分隔线标记）
		if (groupedAgents.other.length > 0) {
			if (options.length > 0) {
				options.push({
					value: "__sep_other__",
					label: "",
					type: "separator",
					names: [],
				});
			}
			for (const agent of groupedAgents.other) {
				options.push({
					value: agent.id,
					label: agent.id,
					type: "other",
					names: agent.names,
				});
			}
		}

		return options;
	}, [groupedAgents]);

	// 如果没有 agent，显示禁用状态的下拉框
	const agentsList = lyricLines.agents ?? [];
	const hasAgents = agentsList.length > 0;

	const isAgentSelectDisabled = selectedLines.size === 0 || !hasMeaningfulAgents;

	return (
		<>
			<Text size="1" id={agentLabelId}>
				{t("ribbonBar.editMode.agent", "Agent")}
			</Text>
			<Select.Root
				value={displayValue}
				onValueChange={handleAgentChange}
				size="1"
				disabled={isAgentSelectDisabled}
			>
				<Select.Trigger
					placeholder={
						!hasAgents
							? t("ribbonBar.editMode.noAgents", "No agents")
							: selectedLines.size === 0
								? t("ribbonBar.editMode.noSelection", "No selection")
								: t("ribbonBar.editMode.none", "None")
					}
					aria-labelledby={agentLabelId}
				/>
				<Select.Content>
					{agentOptions.map((option) =>
						option.type === "separator" ? (
							<Select.Separator key={option.value} />
						) : (
							<Tooltip
								key={option.value}
								content={option.names.join(", ") || option.value}
								side="left"
								align="center"
							>
								<Select.Item value={option.value}>{option.label}</Select.Item>
							</Tooltip>
						),
					)}
				</Select.Content>
			</Select.Root>
		</>
	);
};

const AuxiliaryDisplayField: FC = () => {
	const [showTranslation, setShowTranslation] = useAtom(
		showLineTranslationAtom,
	);
	const [showRomanization, setShowRomanization] = useAtom(
		showLineRomanizationAtom,
	);
	const [showWordRomanizationInput, setShowWordRomanizationInput] = useAtom(
		showWordRomanizationInputAtom,
	);
	const { t } = useTranslation();

	const idTranslation = useId();
	const idRomanization = useId();
	const idPerWord = useId();

	return (
		<Grid columns="1fr auto" gapX="4" gapY="1" flexGrow="1" align="center">
			<Text size="1" asChild>
				<label htmlFor={idTranslation}>
					{t("ribbonBar.editMode.showTranslation", "显示翻译行")}
				</label>
			</Text>
			<Checkbox
				id={idTranslation}
				checked={showTranslation}
				onCheckedChange={(c) => setShowTranslation(Boolean(c))}
			/>
			<Text size="1" asChild>
				<label htmlFor={idRomanization}>
					{t("ribbonBar.editMode.showRomanization", "显示音译行")}
				</label>
			</Text>
			<Checkbox
				id={idRomanization}
				checked={showRomanization}
				onCheckedChange={(c) => setShowRomanization(Boolean(c))}
			/>
			<Text size="1" asChild>
				<label htmlFor={idPerWord}>
					{t("ribbonBar.editMode.showWordRomanizationInput", "显示逐字音译")}
				</label>
			</Text>
			<Checkbox
				id={idPerWord}
				checked={showWordRomanizationInput}
				onCheckedChange={(c) => setShowWordRomanizationInput(Boolean(c))}
			/>
		</Grid>
	);
};

const PrimaryContentField: FC = () => {
	const { t } = useTranslation();
	const primaryContentLabelId = useId();
	const lyricLines = useAtomValue(lyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setEditLanguageDialog = useSetAtom(editLanguageDialogAtom);
	const [selectedPrimaryLang, setSelectedPrimaryLang] = useState<string>("");

	// 获取所有逐字翻译的语言代码
	const wordTranslationLanguages = useMemo(() => {
		const languages = new Set<string>();
		for (const line of lyricLines.lyricLines) {
			if (!line.wordTranslationByLang) continue;
			for (const [lang, wordsData] of Object.entries(line.wordTranslationByLang)) {
				const words = wordsData?.data ?? [];
				if (words.length > 0) {
					languages.add(lang);
				}
			}
		}
		return Array.from(languages);
	}, [lyricLines]);

	// 构建下拉框选项：歌词语言代码 + 所有逐字翻译的语言代码
	const languageOptions = useMemo(() => {
		const options: string[] = [];
		// 添加歌词语言代码（如果有）
		if (lyricLines.lyricLang) {
			options.push(lyricLines.lyricLang);
		}
		// 添加所有逐字翻译的语言代码
		for (const lang of wordTranslationLanguages) {
			if (!options.includes(lang)) {
				options.push(lang);
			}
		}
		return options;
	}, [lyricLines.lyricLang, wordTranslationLanguages]);

	// 默认选中歌词语言代码
	// 使用 ref 跟踪 lyricLines 的引用，以便检测是否加载了新文件
	const prevLyricLinesRef = useRef(lyricLines);
	useEffect(() => {
		// 检测是否加载了新文件（lyricLines 对象引用改变）
		const isNewFile = prevLyricLinesRef.current !== lyricLines;
		prevLyricLinesRef.current = lyricLines;

		if (languageOptions.length > 0) {
			// 如果是新文件，或者当前选中的语言不在选项中，则重置为歌词语言
			if (
				isNewFile ||
				!selectedPrimaryLang ||
				!languageOptions.includes(selectedPrimaryLang)
			) {
				setSelectedPrimaryLang(lyricLines.lyricLang || languageOptions[0]);
			}
		}
	}, [languageOptions, lyricLines, selectedPrimaryLang]);

	// 处理语言切换：调换歌词语言和选中语言，互换 words 和 wordTranslationByLang
	const handleLanguageChange = useCallback(
		(targetLang: string) => {
			const currentLyricLang = lyricLines.lyricLang || "zh-Hans";

			// 如果选中的就是当前歌词语言，不需要切换
			if (targetLang === currentLyricLang) {
				setSelectedPrimaryLang(targetLang);
				return;
			}

			editLyricLines((state) => {
				// 1. 调换歌词语言
				state.lyricLang = targetLang;

				// 2. 对每一行，逐个音节互换 words 和 wordTranslationByLang[targetLang]
				for (const line of state.lyricLines) {
					const targetWordTranslationsData =
						line.wordTranslationByLang?.[targetLang];
					// 兼容旧数据：获取 data 数组
					const targetWordTranslations: TTMLTranslationWord[] =
						targetWordTranslationsData?.data ?? [];

					if (targetWordTranslations.length === 0) {
						// 如果目标语言没有逐字翻译，跳过
						continue;
					}

					// 确保 wordTranslationByLang 存在
					if (!line.wordTranslationByLang) {
						line.wordTranslationByLang = {};
					}

					// 初始化当前歌词语言的逐字翻译数组（如果不存在）
					if (!line.wordTranslationByLang[currentLyricLang]) {
						line.wordTranslationByLang[currentLyricLang] = {
							data: [],
							isAutoFilled: false,
						};
					}

					// 获取当前歌词语言的逐字翻译数组
					const currentWordTranslationsData =
						line.wordTranslationByLang[currentLyricLang];
					// 兼容旧数据：如果 data 不是数组，则初始化为空数组
					const currentWordTranslations: TTMLTranslationWord[] =
						Array.isArray(currentWordTranslationsData.data)
							? currentWordTranslationsData.data
							: [];

					// 收集非空格单词的索引（这些是有对应翻译的音节）
					const nonSpaceWordIndices: number[] = [];
					for (let i = 0; i < line.words.length; i++) {
						if (line.words[i].word.trim().length > 0) {
							nonSpaceWordIndices.push(i);
						}
					}

					// 逐个非空格音节互换
					const swapCount = Math.min(
						nonSpaceWordIndices.length,
						targetWordTranslations.length,
					);

					for (let i = 0; i < swapCount; i++) {
						const wordIndex = nonSpaceWordIndices[i];
						const word = line.words[wordIndex];
						const targetTrans = targetWordTranslations[i];

						if (!word || !targetTrans) {
							continue;
						}

						// 保存当前歌词内容到当前语言的逐字翻译（使用相同的索引 i）
						currentWordTranslations[i] = {
							startTime: word.startTime,
							endTime: word.endTime,
							text: word.word,
						};

						// 将目标语言的翻译内容放入 words
						word.word = targetTrans.text;
					}

					// 删除原来的 targetLang 的 wordTranslationByLang（因为已经交换了）
					delete line.wordTranslationByLang[targetLang];

					// 清理：如果 currentWordTranslations 中有 undefined 项，过滤掉
					const filteredTranslations = currentWordTranslations.filter(
						(t): t is TTMLTranslationWord => t !== undefined,
					);

					// 赋值给当前歌词语言的逐字翻译
					line.wordTranslationByLang[currentLyricLang] = {
						data: filteredTranslations,
						isAutoFilled: false,
					};

					// 如果 wordTranslationByLang 为空，删除整个属性
					if (Object.keys(line.wordTranslationByLang).length === 0) {
						delete line.wordTranslationByLang;
					}
				}
			});

			setSelectedPrimaryLang(targetLang);
		},
		[lyricLines.lyricLang, editLyricLines],
	);

	const placeholder = t(
		"ribbonBar.editMode.primaryContentPlaceholder",
		"请选择主要内容语言",
	);

	const openEditPrimaryLangDialog = useCallback(() => {
		const currentLang = lyricLines.lyricLang || selectedPrimaryLang;
		if (!currentLang) return;
		// 获取原文行内容
		const originalLines = lyricLines.lyricLines.map((line) =>
			line.words.map((w) => w.word).join(""),
		);
		setEditLanguageDialog({
			open: true,
			target: "primary",
			currentLang,
			originalLines,
			onSubmit: (newLang) => {
				const trimmed = newLang.trim();
				if (!trimmed || trimmed === currentLang) return;

				// 检查新语言代码是否已存在
				const existingLangs = new Set(languageOptions);
				if (existingLangs.has(trimmed)) {
					// 如果目标语言已存在，执行互换
					handleLanguageChange(trimmed);
				} else {
					// 否则直接更改语言代码
					editLyricLines((state) => {
						state.lyricLang = trimmed;
					});
					setSelectedPrimaryLang(trimmed);
				}
			},
		});
	}, [
		lyricLines.lyricLang,
		lyricLines.lyricLines,
		selectedPrimaryLang,
		languageOptions,
		setEditLanguageDialog,
		editLyricLines,
		handleLanguageChange,
	]);

	return (
		<>
			<Flex align="center" gap="1">
				<IconButton
					variant="soft"
					size="1"
					onClick={openEditPrimaryLangDialog}
					disabled={!selectedPrimaryLang}
					aria-label={t("editLanguageDialog.editPrimary", "修改主要内容语言代码")}
				>
					<Edit16Regular />
				</IconButton>
				<Text size="1" id={primaryContentLabelId} wrap="nowrap">
					{t("ribbonBar.editMode.primaryContent", "主要内容")}
				</Text>
			</Flex>
			<Select.Root
				value={selectedPrimaryLang}
				onValueChange={handleLanguageChange}
				disabled={languageOptions.length === 0}
				size="1"
			>
				<Select.Trigger
					placeholder={placeholder}
					style={{ minWidth: "6em" }}
					aria-labelledby={primaryContentLabelId}
				/>
				<Select.Content>
					{languageOptions.map((lang) => (
						<Box key={lang} position="relative">
							<Select.Item value={lang}>
								<Text
									style={{
										paddingRight:
											languageOptions.length > 1 ? "2rem" : undefined,
									}}
								>
									{lang}
								</Text>
							</Select.Item>
							{languageOptions.length > 1 && (
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
											// 删除该语言的逐字翻译数据
											editLyricLines((state) => {
												for (const line of state.lyricLines) {
													if (line.wordTranslationByLang?.[lang]) {
														delete line.wordTranslationByLang[lang];
														if (
															Object.keys(line.wordTranslationByLang).length ===
															0
														) {
															delete line.wordTranslationByLang;
														}
													}
												}
												// 如果删除的是当前歌词语言，需要特殊处理
												if (state.lyricLang === lang) {
													// 尝试切换到其他可用语言
													const remainingLangs = Object.keys(
														state.lyricLines[0]?.wordTranslationByLang || {},
													);
													if (remainingLangs.length > 0) {
														state.lyricLang = remainingLangs[0];
													}
												}
											});
										}}
										aria-label={t(
											"ribbonBar.editMode.deleteLanguage",
											"删除语言",
										)}
									>
										<Delete16Regular />
									</IconButton>
								</Box>
							)}
						</Box>
					))}
				</Select.Content>
			</Select.Root>
		</>
	);
};

const MultilingualField: FC = () => {
	const { t } = useTranslation();
	const lyricLines = useAtomValue(lyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setAddLanguageDialog = useSetAtom(addLanguageDialogAtom);
	const setEditLanguageDialog = useSetAtom(editLanguageDialogAtom);
	const setDistributeTranslationDialog = useSetAtom(distributeTranslationDialogAtom);
	const [selectedTranslationLang, setSelectedTranslationLang] = useAtom(
		selectedTranslationLangAtom,
	);
	const [selectedRomanizationLang, setSelectedRomanizationLang] = useAtom(
		selectedRomanizationLangAtom,
	);
	const [selectedWordRomanizationLang, setSelectedWordRomanizationLang] =
		useAtom(selectedWordRomanizationLangAtom);
	const placeholder = t(
		"ribbonBar.editMode.multilingualPlaceholder",
		"请选择语言",
	);

	const translationLanguages = useMemo(() => {
		const languages = new Set<string>();
		let hasUndFallback = false;
		for (const line of lyricLines.lyricLines) {
			if (!line.translatedLyricByLang) continue;
			const entries = Object.entries(line.translatedLyricByLang);
			if (entries.length === 1 && entries[0][0] === "und") {
				hasUndFallback = true;
				continue;
			}
			for (const [lang, value] of entries) {
				// 兼容旧数据：如果 value 是字符串，则直接使用
				const data = typeof value === "string" ? value : value?.data ?? "";
				if (data.trim().length > 0) {
					languages.add(lang);
				}
			}
		}
		if (languages.size === 0 && hasUndFallback) {
			languages.add("und");
		}
		return Array.from(languages);
	}, [lyricLines]);

	const romanizationLanguages = useMemo(() => {
		const languages = new Set<string>();
		let hasUndFallback = false;
		for (const line of lyricLines.lyricLines) {
			if (!line.romanLyricByLang) continue;
			const entries = Object.entries(line.romanLyricByLang);
			if (entries.length === 1 && entries[0][0] === "und") {
				hasUndFallback = true;
				continue;
			}
			for (const [lang, value] of entries) {
				// 兼容旧数据：如果 value 是字符串，则直接使用
				const data = typeof value === "string" ? value : value?.data ?? "";
				if (data.trim().length > 0) {
					languages.add(lang);
				}
			}
		}
		if (languages.size === 0 && hasUndFallback) {
			languages.add("und");
		}
		return Array.from(languages);
	}, [lyricLines]);

	const wordRomanizationLanguages = useMemo(() => {
		const languages = new Set<string>();
		for (const line of lyricLines.lyricLines) {
			if (!line.wordRomanizationByLang) continue;
			for (const [lang, words] of Object.entries(line.wordRomanizationByLang)) {
				// 兼容旧数据：如果 words 是数组，则直接使用
				const data = Array.isArray(words) ? words : words?.data ?? [];
				if (data.length > 0) {
					languages.add(lang);
				}
			}
		}
		return Array.from(languages);
	}, [lyricLines]);

	const applyTranslationLang = useCallback(
		function applyTranslationLangInner(lang: string) {
			if (lang === "und") {
				// 获取原文行内容
				const originalLines = lyricLines.lyricLines.map((line) =>
					line.words.map((w) => w.word).join(""),
				);
				setAddLanguageDialog({
					open: true,
					target: "translation",
					originalLines,
					onSubmit: (nextLang, contentLines) => {
						editLyricLines((state) => {
							for (let i = 0; i < state.lyricLines.length; i++) {
								const line = state.lyricLines[i];
								const byLang = line.translatedLyricByLang;
								if (!byLang || !byLang.und) continue;
								// 获取当前语言的值
								const currentValue = byLang.und;
								// 兼容旧数据：如果 currentValue 是字符串，则转换为对象
								const currentData = typeof currentValue === "string"
									? { data: currentValue, isAutoFilled: false }
									: { ...currentValue, isAutoFilled: false };
								// 如果有提供内容，则更新内容
								if (contentLines[i] !== undefined) {
									byLang[nextLang] = { data: contentLines[i], isAutoFilled: false };
								} else {
									byLang[nextLang] = currentData;
								}
								delete byLang.und;
							}
						});
						applyTranslationLangInner(nextLang);
					},
				});
				return;
			}
			setSelectedTranslationLang(lang);
			editLyricLines((state) => {
				for (const line of state.lyricLines) {
					const value = line.translatedLyricByLang?.[lang];
					// 兼容旧数据：如果 value 是字符串，则直接使用
					line.translatedLyric = typeof value === "string" ? value : value?.data ?? "";
				}
			});
		},
		[lyricLines.lyricLines, editLyricLines, setAddLanguageDialog, setSelectedTranslationLang],
	);

	// 将逐行翻译转为逐字翻译
	const distributeTranslation = useCallback(
		function distributeTranslationInner(lang: string) {
			editLyricLines((state) => {
				for (const line of state.lyricLines) {
					const value = line.translatedLyricByLang?.[lang];
					if (!value) continue;
					// 兼容旧数据：如果 value 是字符串，则直接使用
					const translationText = typeof value === "string" ? value : value?.data ?? "";
					if (!translationText.trim()) continue;

					// 使用 distributor 分配翻译
					const distributed = distributeRomanizationByCharCount(line.words, translationText);

					// 创建逐字翻译
					const wordTranslation: TTMLTranslationWord[] = distributed.map((text, i) => ({
						text,
						startTime: line.words[i]?.startTime ?? line.startTime,
						endTime: line.words[i]?.endTime ?? line.endTime,
					}));

					// 设置逐字翻译
					if (!line.wordTranslationByLang) {
						line.wordTranslationByLang = {};
					}
					line.wordTranslationByLang[lang] = {
						data: wordTranslation,
						isAutoFilled: false,
					};

					// 删除逐行翻译
					if (line.translatedLyricByLang?.[lang]) {
						delete line.translatedLyricByLang[lang];
						// 如果该语言没有翻译了，删除整个对象
						if (Object.keys(line.translatedLyricByLang).length === 0) {
							delete line.translatedLyricByLang;
						}
					}
					// 如果当前显示的翻译是该语言，清空显示
					if (line.translatedLyric === translationText) {
						line.translatedLyric = "";
					}
				}
			});
		},
		[editLyricLines],
	);

	// 检查语言是否符合转换为逐字翻译的条件（歌词语言和翻译语言都以 "zh" 开头）
	const isDistributableLang = useCallback(
		function isDistributableLangInner(lang: string) {
			const lyricLang = lyricLines.lyricLang ?? "";
			return lyricLang.startsWith("zh") && lang.startsWith("zh");
		},
		[lyricLines.lyricLang],
	);

	const applyRomanizationLang = useCallback(
		function applyRomanizationLangInner(lang: string) {
			if (lang === "und") {
				// 获取原文行内容
				const originalLines = lyricLines.lyricLines.map((line) =>
					line.words.map((w) => w.word).join(""),
				);
				setAddLanguageDialog({
					open: true,
					target: "romanization",
					originalLines,
					onSubmit: (nextLang, contentLines) => {
						editLyricLines((state) => {
							for (let i = 0; i < state.lyricLines.length; i++) {
								const line = state.lyricLines[i];
								const byLang = line.romanLyricByLang;
								if (!byLang || !byLang.und) continue;
								// 获取当前语言的值
								const currentValue = byLang.und;
								// 兼容旧数据：如果 currentValue 是字符串，则转换为对象
								const currentData = typeof currentValue === "string"
									? { data: currentValue, isAutoFilled: false }
									: { ...currentValue, isAutoFilled: false };
								// 如果有提供内容，则更新内容
								if (contentLines[i] !== undefined) {
									byLang[nextLang] = { data: contentLines[i], isAutoFilled: false };
								} else {
									byLang[nextLang] = currentData;
								}
								delete byLang.und;
							}
						});
						applyRomanizationLangInner(nextLang);
					},
				});
				return;
			}
			setSelectedRomanizationLang(lang);
			editLyricLines((state) => {
				for (const line of state.lyricLines) {
					const value = line.romanLyricByLang?.[lang];
					// 兼容旧数据：如果 value 是字符串，则直接使用
					line.romanLyric = typeof value === "string" ? value : value?.data ?? "";
				}
			});
		},
		[lyricLines.lyricLines, editLyricLines, setAddLanguageDialog, setSelectedRomanizationLang],
	);

	const applyWordRomanizationLang = useCallback(
		function applyWordRomanizationLangInner(lang: string) {
			if (lang === "und") {
				// 获取原文行内容
				const originalLines = lyricLines.lyricLines.map((line) => line.words.map((w) => w.word).join(""));
				setEditLanguageDialog({
					open: true,
					target: "word-romanization",
					currentLang: "und",
					originalLines,
					onSubmit: (nextLang) => {
						editLyricLines((state) => {
							for (const line of state.lyricLines) {
								const byLang = line.wordRomanizationByLang;
								if (!byLang || !byLang.und) continue;
								// 获取当前语言的值
								const currentValue = byLang.und;
								// 兼容旧数据：如果 currentValue 是数组，则转换为对象
								const currentData = Array.isArray(currentValue)
									? { data: currentValue, isAutoFilled: false }
									: { ...currentValue, isAutoFilled: false };
								// 重命名时设置 isAutoFilled 为 false
								byLang[nextLang] = currentData;
								delete byLang.und;
							}
						});
						applyWordRomanizationLangInner(nextLang);
					},
				});
				return;
			}
			setSelectedWordRomanizationLang(lang);
			editLyricLines((state) => {
				for (const line of state.lyricLines) {
					const value = line.wordRomanizationByLang?.[lang];
					// 兼容旧数据：如果 value 是数组，则直接使用
					const romanWords = Array.isArray(value) ? value : value?.data ?? [];
					if (romanWords.length === 0) {
						for (const word of line.words) {
							word.romanWord = "";
						}
						continue;
					}
					for (let wordIndex = 0; wordIndex < line.words.length; wordIndex++) {
						const word = line.words[wordIndex];
						if (word.word.trim().length === 0) {
							word.romanWord = "";
							continue;
						}
						const match = romanWords.find(
							(r) =>
								r.startTime === word.startTime && r.endTime === word.endTime,
						);
						word.romanWord = match?.text ?? "";
					}
				}
			});
		},
		[editLyricLines, lyricLines.lyricLines, setEditLanguageDialog, setSelectedWordRomanizationLang],
	);

	const openAddTranslationDialog = useCallback(() => {
		// 获取原文行内容
		const originalLines = lyricLines.lyricLines.map((line) => line.words.map((w) => w.word).join(""));
		setAddLanguageDialog({
			open: true,
			target: "translation",
			originalLines,
			onSubmit: (lang, contentLines) => {
					editLyricLines((state) => {
						for (let i = 0; i < state.lyricLines.length; i++) {
							const line = state.lyricLines[i];
							line.translatedLyricByLang ??= {};
							const data = contentLines[i] ?? "";
							line.translatedLyricByLang[lang] = { data, isAutoFilled: false };
							// 更新当前显示的翻译
							line.translatedLyric = data;
						}
					});
					setSelectedTranslationLang(lang);
				},
		});
	}, [lyricLines.lyricLines, editLyricLines, setAddLanguageDialog, setSelectedTranslationLang]);

	const openAddRomanizationDialog = useCallback(() => {
		// 获取原文行内容
		const originalLines = lyricLines.lyricLines.map((line) => line.words.map((w) => w.word).join(""));
		setAddLanguageDialog({
			open: true,
			target: "romanization",
			originalLines,
			onSubmit: (lang, contentLines) => {
					editLyricLines((state) => {
						for (let i = 0; i < state.lyricLines.length; i++) {
							const line = state.lyricLines[i];
							line.romanLyricByLang ??= {};
							const data = contentLines[i] ?? "";
							line.romanLyricByLang[lang] = { data, isAutoFilled: false };
							// 更新当前显示的音译
							line.romanLyric = data;
						}
					});
					setSelectedRomanizationLang(lang);
				},
		});
	}, [lyricLines.lyricLines, editLyricLines, setAddLanguageDialog, setSelectedRomanizationLang]);

	// 当歌词解析完成后，自动选择第一个可用语言
	useEffect(() => {
		// 自动选择第一个翻译语言
		if (translationLanguages.length > 0 && !selectedTranslationLang) {
			applyTranslationLang(translationLanguages[0]);
		}
	}, [translationLanguages, selectedTranslationLang, applyTranslationLang]);

	useEffect(() => {
		// 自动选择第一个音译语言
		if (romanizationLanguages.length > 0 && !selectedRomanizationLang) {
			applyRomanizationLang(romanizationLanguages[0]);
		}
	}, [romanizationLanguages, selectedRomanizationLang, applyRomanizationLang]);

	useEffect(() => {
		// 自动选择第一个逐字音译语言
		if (wordRomanizationLanguages.length > 0 && !selectedWordRomanizationLang) {
			applyWordRomanizationLang(wordRomanizationLanguages[0]);
		}
	}, [
		wordRomanizationLanguages,
		selectedWordRomanizationLang,
		applyWordRomanizationLang,
	]);

	const openEditTranslationLangDialog = useCallback(() => {
		if (!selectedTranslationLang) return;
		// 获取原文行内容
		const originalLines = lyricLines.lyricLines.map((line) => line.words.map((w) => w.word).join(""));
		// 获取当前翻译内容
		const currentContentLines = lyricLines.lyricLines.map((line) => {
			const value = line.translatedLyricByLang?.[selectedTranslationLang];
			return typeof value === "string" ? value : value?.data ?? "";
		});
		setEditLanguageDialog({
			open: true,
			target: "translation",
			currentLang: selectedTranslationLang,
			originalLines,
			currentContent: currentContentLines.join("\n"),
			onSubmit: (newLang, contentLines) => {
				const trimmed = newLang.trim();
				if (!trimmed || trimmed === selectedTranslationLang) return;
				editLyricLines((state) => {
					for (let i = 0; i < state.lyricLines.length; i++) {
						const line = state.lyricLines[i];
						const byLang = line.translatedLyricByLang;
						if (!byLang || !byLang[selectedTranslationLang]) continue;
						// 获取当前语言的值
						const currentValue = byLang[selectedTranslationLang];
						// 兼容旧数据：如果 currentValue 是字符串，则转换为对象
						const currentData = typeof currentValue === "string"
							? { data: currentValue, isAutoFilled: false }
							: { ...currentValue, isAutoFilled: false };
						// 如果目标语言已存在，互换内容
						if (byLang[trimmed]) {
							const temp = byLang[trimmed];
							byLang[selectedTranslationLang] = temp;
							byLang[trimmed] = currentData;
						} else {
							// 否则直接重命名，并将 isAutoFilled 设置为 false
							byLang[trimmed] = currentData;
							delete byLang[selectedTranslationLang];
						}
						// 更新内容
						const newData = contentLines[i] ?? "";
						byLang[trimmed] = { data: newData, isAutoFilled: false };
						// 更新当前显示的翻译
						line.translatedLyric = newData;
					}
				});
				setSelectedTranslationLang(trimmed);
			},
		});
	}, [
		selectedTranslationLang,
		lyricLines.lyricLines,
		setEditLanguageDialog,
		editLyricLines,
		setSelectedTranslationLang,
	]);

	const openEditRomanizationLangDialog = useCallback(() => {
		if (!selectedRomanizationLang) return;
		// 获取原文行内容
		const originalLines = lyricLines.lyricLines.map((line) => line.words.map((w) => w.word).join(""));
		// 获取当前音译内容
		const currentContentLines = lyricLines.lyricLines.map((line) => {
			const value = line.romanLyricByLang?.[selectedRomanizationLang];
			return typeof value === "string" ? value : value?.data ?? "";
		});
		setEditLanguageDialog({
			open: true,
			target: "romanization",
			currentLang: selectedRomanizationLang,
			originalLines,
			currentContent: currentContentLines.join("\n"),
			onSubmit: (newLang, contentLines) => {
				const trimmed = newLang.trim();
				if (!trimmed || trimmed === selectedRomanizationLang) return;
				editLyricLines((state) => {
					for (let i = 0; i < state.lyricLines.length; i++) {
						const line = state.lyricLines[i];
						const byLang = line.romanLyricByLang;
						if (!byLang || !byLang[selectedRomanizationLang]) continue;
						// 获取当前语言的值
						const currentValue = byLang[selectedRomanizationLang];
						// 兼容旧数据：如果 currentValue 是字符串，则转换为对象
						const currentData = typeof currentValue === "string"
							? { data: currentValue, isAutoFilled: false }
							: { ...currentValue, isAutoFilled: false };
						// 如果目标语言已存在，互换内容
						if (byLang[trimmed]) {
							const temp = byLang[trimmed];
							byLang[selectedRomanizationLang] = temp;
							byLang[trimmed] = currentData;
						} else {
							// 否则直接重命名，并将 isAutoFilled 设置为 false
							byLang[trimmed] = currentData;
							delete byLang[selectedRomanizationLang];
						}
						// 更新内容
						const newData = contentLines[i] ?? "";
						byLang[trimmed] = { data: newData, isAutoFilled: false };
						// 更新当前显示的音译
						line.romanLyric = newData;
					}
				});
				setSelectedRomanizationLang(trimmed);
			},
		});
	}, [
		selectedRomanizationLang,
		lyricLines.lyricLines,
		setEditLanguageDialog,
		editLyricLines,
		setSelectedRomanizationLang,
	]);

	const openEditWordRomanizationLangDialog = useCallback(() => {
		if (!selectedWordRomanizationLang) return;
		// 获取原文行内容（逐字音译不需要显示内容编辑，但为了满足类型要求）
		const originalLines = lyricLines.lyricLines.map((line) => line.words.map((w) => w.word).join(""));
		setEditLanguageDialog({
			open: true,
			target: "word-romanization",
			currentLang: selectedWordRomanizationLang,
			originalLines,
			onSubmit: (newLang) => {
				const trimmed = newLang.trim();
				if (!trimmed || trimmed === selectedWordRomanizationLang) return;
				editLyricLines((state) => {
					for (const line of state.lyricLines) {
						const byLang = line.wordRomanizationByLang;
						if (!byLang || !byLang[selectedWordRomanizationLang]) continue;
						// 获取当前语言的值
						const currentValue = byLang[selectedWordRomanizationLang];
						// 兼容旧数据：如果 currentValue 是数组，则转换为对象
						const currentData = Array.isArray(currentValue)
							? { data: currentValue, isAutoFilled: false }
							: { ...currentValue, isAutoFilled: false };
						// 如果目标语言已存在，互换内容
						if (byLang[trimmed]) {
							const temp = byLang[trimmed];
							byLang[selectedWordRomanizationLang] = temp;
							byLang[trimmed] = currentData;
						} else {
							// 否则直接重命名，并将 isAutoFilled 设置为 false
							byLang[trimmed] = currentData;
							delete byLang[selectedWordRomanizationLang];
						}
						// 更新当前显示的逐字音译
						const newValue = byLang[trimmed];
						// 兼容旧数据：如果 newValue 是数组，则直接使用
						const romanWords = Array.isArray(newValue) ? newValue : newValue?.data ?? [];
						for (
							let wordIndex = 0;
							wordIndex < line.words.length;
							wordIndex++
						) {
							const word = line.words[wordIndex];
							if (word.word.trim().length === 0) {
								word.romanWord = "";
								continue;
							}
							const match = romanWords.find(
								(r) =>
									r.startTime === word.startTime && r.endTime === word.endTime,
							);
							word.romanWord = match?.text ?? "";
						}
					}
				});
				setSelectedWordRomanizationLang(trimmed);
			},
		});
	}, [
		selectedWordRomanizationLang,
		lyricLines.lyricLines,
		setEditLanguageDialog,
		editLyricLines,
		setSelectedWordRomanizationLang,
	]);

	return (<>
		<Grid
			columns="auto 0fr 1fr auto"
			gap="2"
			gapY="1"
			flexGrow="1"
			align="center"
		>
			<IconButton
				variant="soft"
				size="1"
				onClick={openEditTranslationLangDialog}
				disabled={!selectedTranslationLang}
				aria-label={t("editLanguageDialog.editTranslation", "修改翻译语言代码")}
			>
				<Edit16Regular />
			</IconButton>
			<Text wrap="nowrap" size="1">
				{t("ribbonBar.editMode.translation", "翻译")}
			</Text>
			<Select.Root
				value={selectedTranslationLang}
				onValueChange={applyTranslationLang}
				disabled={translationLanguages.length === 0}
				size="1"
			>
				<Select.Trigger placeholder={placeholder} />
				<Select.Content>
					{translationLanguages.map((lang) => (
						<Box key={lang} position="relative">
							<Select.Item value={lang}>
								<Text style={{ paddingRight: isDistributableLang(lang) ? "4rem" : "2rem" }}>{lang}</Text>
							</Select.Item>
							<Flex
								position="absolute"
								right="6px"
								top="50%"
								gap="1"
								style={{
									transform: "translateY(-50%)",
									zIndex: 10,
								}}
							>
								{isDistributableLang(lang) && (
								<Tooltip
									content={t(
										"ribbonBar.editMode.distributeTranslation",
										"将逐行翻译转为逐字",
									)}
								>
									<IconButton
										size="1"
										variant="soft"
										color="blue"
										onClick={(e) => {
											e.stopPropagation();
											distributeTranslation(lang);
										}}
										aria-label={t(
											"ribbonBar.editMode.distributeTranslation",
											"将逐行翻译转为逐字",
										)}
									>
										<ArrowSync16Regular />
									</IconButton>
								</Tooltip>
								)}
								<IconButton
								size="1"
								variant="soft"
								color="red"
								onClick={(e) => {
									e.stopPropagation();
									// 删除该语言的翻译数据
									editLyricLines((state) => {
										for (const line of state.lyricLines) {
											if (line.translatedLyricByLang?.[lang]) {
												// 获取数据以进行比较
												const value = line.translatedLyricByLang[lang];
												// 兼容旧数据：如果 value 是字符串，则直接使用
												const data = typeof value === "string" ? value : value?.data ?? "";
												delete line.translatedLyricByLang[lang];
												if (
													Object.keys(line.translatedLyricByLang).length === 0
												) {
													delete line.translatedLyricByLang;
												}
												// 如果当前显示的翻译是该语言，清空显示
												if (line.translatedLyric === data) {
													line.translatedLyric = "";
												}
											}
										}
									});
									// 如果删除的是当前选中的语言，重置选择
									if (lang === selectedTranslationLang) {
										setSelectedTranslationLang("");
									}
								}}
									aria-label={t(
										"ribbonBar.editMode.deleteLanguage",
										"删除语言",
									)}
								>
									<Delete16Regular />
								</IconButton>
							</Flex>
						</Box>
					))}
				</Select.Content>
			</Select.Root>
			<Flex gap="1">
				<IconButton
					variant="soft"
					size="1"
					onClick={openAddTranslationDialog}
					aria-label={t("addLanguageDialog.addTranslation", "新增翻译语言")}
				>
					<Add16Regular />
				</IconButton>
			</Flex>
			<IconButton
				variant="soft"
				size="1"
				onClick={openEditRomanizationLangDialog}
				disabled={!selectedRomanizationLang}
				aria-label={t(
					"editLanguageDialog.editRomanization",
					"修改音译语言代码",
				)}
			>
				<Edit16Regular />
			</IconButton>
			<Text wrap="nowrap" size="1">
				{t("ribbonBar.editMode.romanization", "音译")}
			</Text>
			<Select.Root
				value={selectedRomanizationLang}
				onValueChange={applyRomanizationLang}
				disabled={romanizationLanguages.length === 0}
				size="1"
			>
				<Select.Trigger placeholder={placeholder} />
				<Select.Content>
					{romanizationLanguages.map((lang) => (
						<Box key={lang} position="relative">
							<Select.Item value={lang}>
								<Text style={{ paddingRight: "2rem" }}>{lang}</Text>
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
									// 删除该语言的音译数据
									editLyricLines((state) => {
										for (const line of state.lyricLines) {
											if (line.romanLyricByLang?.[lang]) {
												// 获取数据以进行比较
												const value = line.romanLyricByLang[lang];
												// 兼容旧数据：如果 value 是字符串，则直接使用
												const data = typeof value === "string" ? value : value?.data ?? "";
												delete line.romanLyricByLang[lang];
												if (Object.keys(line.romanLyricByLang).length === 0) {
													delete line.romanLyricByLang;
												}
												// 如果当前显示的音译是该语言，清空显示
												if (line.romanLyric === data) {
													line.romanLyric = "";
												}
											}
										}
									});
									// 如果删除的是当前选中的语言，重置选择
									if (lang === selectedRomanizationLang) {
										setSelectedRomanizationLang("");
									}
								}}
									aria-label={t(
										"ribbonBar.editMode.deleteLanguage",
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
				onClick={openAddRomanizationDialog}
				aria-label={t("addLanguageDialog.addRomanization", "新增音译语言")}
			>
				<Add16Regular />
			</IconButton>
			<IconButton
				variant="soft"
				size="1"
				onClick={openEditWordRomanizationLangDialog}
				disabled={!selectedWordRomanizationLang}
				aria-label={t(
					"editLanguageDialog.editWordRomanization",
					"修改逐字音译语言代码",
				)}
			>
				<Edit16Regular />
			</IconButton>
			<Text wrap="nowrap" size="1">
				{t("ribbonBar.editMode.wordRomanization", "逐字音译")}
			</Text>
			<Select.Root
				value={selectedWordRomanizationLang}
				onValueChange={applyWordRomanizationLang}
				disabled={wordRomanizationLanguages.length === 0}
				size="1"
			>
				<Select.Trigger placeholder={placeholder} />
				<Select.Content>
					{wordRomanizationLanguages.map((lang) => (
						<Box key={lang} position="relative">
							<Select.Item value={lang}>
								<Text style={{ paddingRight: "2rem" }}>{lang}</Text>
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
									// 删除该语言的逐字音译数据
									editLyricLines((state) => {
										for (const line of state.lyricLines) {
											if (line.wordRomanizationByLang?.[lang]) {
												delete line.wordRomanizationByLang[lang];
												if (
													Object.keys(line.wordRomanizationByLang).length ===
													0
												) {
													delete line.wordRomanizationByLang;
												}
												// 如果当前显示的是该语言的逐字音译，清空显示
												for (const word of line.words) {
													if (word.romanWord) {
														word.romanWord = "";
													}
												}
											}
										}
									});
									// 如果删除的是当前选中的语言，重置选择
									if (lang === selectedWordRomanizationLang) {
										setSelectedWordRomanizationLang("");
									}
								}}
									aria-label={t(
										"ribbonBar.editMode.deleteLanguage",
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
				onClick={() => {
					// 获取原文行内容
					const originalLines = lyricLines.lyricLines.map((line) =>
						line.words.map((w) => w.word).join(""),
					);
					setAddLanguageDialog({
						open: true,
						target: "word-romanization",
						originalLines,
						onSubmit: (lang) => {
							editLyricLines((state) => {
								for (const line of state.lyricLines) {
									// 如果该行已经有这个语言的逐字音译，跳过
									if (line.wordRomanizationByLang?.[lang]) {
										continue;
									}

									// 创建空的逐字音译数据
									const emptyWordRomanization = line.words.map((word) => ({
										startTime: word.startTime,
										endTime: word.endTime,
										text: "",
									}));

									line.wordRomanizationByLang ??= {};
									line.wordRomanizationByLang[lang] = {
										data: emptyWordRomanization,
										isAutoFilled: false,
									};
								}
							});
							setSelectedWordRomanizationLang(lang);
						},
					});
				}}
				aria-label={t("ribbonBar.editMode.addWordRomanization", "添加逐字音译")}
			>
				<Add16Regular />
			</IconButton>
		</Grid>
		</>
	);
};

export const EditModeRibbonBar: FC = forwardRef<HTMLDivElement>(
	(_props, ref) => {
		const editLyricLines = useSetImmerAtom(lyricLinesAtom);
		const { t } = useTranslation();
		const selectedTranslationLang = useAtomValue(selectedTranslationLangAtom);
		const selectedRomanizationLang = useAtomValue(selectedRomanizationLangAtom);
		const selectedWordRomanizationLang = useAtomValue(selectedWordRomanizationLangAtom);

		return (
			<RibbonFrame ref={ref}>
				<RibbonSection label={t("ribbonBar.editMode.new", "新建")}>
					<Grid columns="1" gap="1" gapY="1" flexGrow="1" align="center">
						<Button
							size="1"
							variant="soft"
							onClick={() =>
								editLyricLines((draft) => {
									draft.lyricLines.push(newLyricLine());
								})
							}
						>
							{t("ribbonBar.editMode.lyricLine", "歌词行")}
						</Button>
					</Grid>
				</RibbonSection>
				<RibbonSection label={t("ribbonBar.editMode.lineTiming", "行时间戳")}>
					<Grid columns="0fr 1fr" gap="2" gapY="1" flexGrow="1" align="center">
						<EditField
							label={t("ribbonBar.editMode.startTime", "起始时间")}
							fieldName="startTime"
							parser={parseTimespan}
							formatter={msToTimestamp}
						/>
						<EditField
							label={t("ribbonBar.editMode.endTime", "结束时间")}
							fieldName="endTime"
							parser={parseTimespan}
							formatter={msToTimestamp}
						/>
					</Grid>
				</RibbonSection>
				<RibbonSection label={t("ribbonBar.editMode.lineProperties", "行属性")}>
					<Grid
						columns="0fr 0fr 0fr 0fr"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<CheckboxField
							label={t("ribbonBar.editMode.bgLyric", "背景歌词")}
							defaultValue={false}
							isWordField={false}
							fieldName="isBG"
						/>
						<CheckboxField
							label={t("ribbonBar.editMode.duetLyric", "对唱歌词")}
							isWordField={false}
							fieldName="isDuet"
							defaultValue={false}
						/>
						<CheckboxField
							label={t("ribbonBar.editMode.ignoreSync", "忽略打轴")}
							isWordField={false}
							fieldName="ignoreSync"
							defaultValue={false}
						/>
						<CheckboxField
							label={t("ribbonBar.editMode.rtlLyric", "RTL")}
							isWordField={false}
							fieldName="isRtl"
							defaultValue={false}
						/>
					</Grid>
				</RibbonSection>
				<RibbonSection label={t("ribbonBar.editMode.wordTiming", "词时间戳")}>
					<Grid columns="0fr 1fr" gap="2" gapY="1" flexGrow="1" align="center">
						<EditField
							label={t("ribbonBar.editMode.startTime", "起始时间")}
							fieldName="startTime"
							isWordField
							parser={parseTimespan}
							formatter={msToTimestamp}
						/>
						<EditField
							label={t("ribbonBar.editMode.endTime", "结束时间")}
							fieldName="endTime"
							isWordField
							parser={parseTimespan}
							formatter={msToTimestamp}
						/>
						<EditField
							label={t("ribbonBar.editMode.emptyBeatCount", "空拍数量")}
							fieldName="emptyBeat"
							isWordField
							parser={(v) => {
								const parsed = Number.parseInt(v, 10);
								return Number.isNaN(parsed) ? 0 : parsed;
							}}
							formatter={String}
						/>
					</Grid>
				</RibbonSection>
				<RibbonSection
					label={t("ribbonBar.editMode.wordProperties", "单词属性")}
				>
					<Grid
						columns="0fr 0fr 0fr 0fr"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<EditField
							label={t("ribbonBar.editMode.wordContent", "单词内容")}
							fieldName="word"
							isWordField
							parser={(v) => v}
							formatter={(v) => v}
						/>
						<CheckboxField
							label={t("ribbonBar.editMode.obscene", "不雅用语")}
							isWordField
							fieldName="obscene"
							defaultValue={false}
						/>
						<EditField
							label={t("ribbonBar.editMode.romanWord", "单词音译")}
							fieldName="romanWord"
							isWordField
							parser={(v) => v}
							formatter={(v) => v || ""}
							disabled={!selectedWordRomanizationLang}
						/>
						<CheckboxField
							label={t("ribbonBar.editMode.rubyPhraseStart", "Start Ruby")}
							isWordField
							fieldName="rubyPhraseStart"
							defaultValue={false}
						/>
					</Grid>
				</RibbonSection>
				<RibbonSection
					label={t("ribbonBar.editMode.secondaryContent", "次要内容")}
				>
					<Grid columns="0fr 1fr" gap="2" gapY="1" flexGrow="1" align="center">
						<EditField
							label={t("ribbonBar.editMode.translatedLyric", "翻译歌词")}
							fieldName="translatedLyric"
							parser={(v) => v}
							formatter={(v) => v}
							textFieldStyle={{ width: "20em" }}
							disabled={!selectedTranslationLang}
						/>
						<EditField
							label={t("ribbonBar.editMode.romanLyric", "音译歌词")}
							fieldName="romanLyric"
							parser={(v) => v}
							formatter={(v) => v}
							textFieldStyle={{ width: "20em" }}
							disabled={!selectedRomanizationLang}
						/>
					</Grid>
				</RibbonSection>
				<RibbonSection label={t("ribbonBar.editMode.multilingual", "附加内容")}>
					<MultilingualField />
				</RibbonSection>
				<RibbonSection label={t("ribbonBar.editMode.layoutMode", "布局模式")}>
					<EditModeField
						simpleModeLabel={t(
							"settings.common.layoutModeOptions.simple",
							"简单模式",
						)}
						advanceModeLabel={t(
							"settings.common.layoutModeOptions.advance",
							"高级模式",
						)}
					/>
				</RibbonSection>
				<RibbonSection
					label={t("ribbonBar.editMode.auxiliaryLineDisplay", "辅助行显示")}
				>
					<AuxiliaryDisplayField />
				</RibbonSection>
				<RibbonSection label={t("ribbonBar.editMode.amllTags", "标记声明")}>
					<Grid columns="auto 1fr" gap="2" gapY="1" flexGrow="1" align="center">
						<PrimaryContentField />
						<SongPartField />
						<AgentField />
					</Grid>
				</RibbonSection>
			</RibbonFrame>
		);
	},
);

export default EditModeRibbonBar;
