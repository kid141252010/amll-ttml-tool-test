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
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { addLanguageDialogAtom } from "$/states/dialogs";

// 同步滚动 hook
const useSyncScroll = (hasOverflow: boolean) => {
	const leftScrollRef = useRef<HTMLDivElement>(null);
	const rightScrollRef = useRef<HTMLDivElement>(null);
	const isScrollingRef = useRef(false);

	const handleLeftScroll = useCallback(() => {
		if (isScrollingRef.current || !leftScrollRef.current || !rightScrollRef.current) return;
		isScrollingRef.current = true;
		
		const leftElement = leftScrollRef.current;
		const rightElement = rightScrollRef.current;
		
		// 直接使用实际滚动值
		rightElement.scrollTop = leftElement.scrollTop;
		
		requestAnimationFrame(() => {
			isScrollingRef.current = false;
		});
	}, []);

	const handleRightScroll = useCallback(() => {
		if (isScrollingRef.current || !leftScrollRef.current || !rightScrollRef.current) return;
		isScrollingRef.current = true;
		
		const leftElement = leftScrollRef.current;
		const rightElement = rightScrollRef.current;
		
		// 直接使用实际滚动值
		leftElement.scrollTop = rightElement.scrollTop;
		
		requestAnimationFrame(() => {
			isScrollingRef.current = false;
		});
	}, []);

	return { leftScrollRef, rightScrollRef, handleLeftScroll, handleRightScroll };
};

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

// 可编辑行组件
interface EditableLineProps {
	value: string;
	isEditing: boolean;
	onStartEdit: () => void;
	onStopEdit: () => void;
	onChange: (value: string) => void;
	onMergeUp?: (currentValue: string) => void;
	onMergeDown?: (currentValue: string, cursorPosition: number) => void;
	onSplit?: (afterCursor: string) => void;
	onPaste?: (currentValue: string, pastedText: string, selectionStart: number, selectionEnd: number) => void;
	onEditNext?: () => void;
	onEditPrevious?: () => void;
	placeholder?: string;
	isOverflow?: boolean;
	cursorPosition?: number | null;
}

const EditableLine = ({
	value,
	isEditing,
	onStartEdit,
	onStopEdit,
	onChange,
	onMergeUp,
	onMergeDown,
	onSplit,
	onPaste,
	onEditNext,
	onEditPrevious,
	placeholder,
	isOverflow,
	cursorPosition
}: EditableLineProps) => {
	const [editValue, setEditValue] = useState(value);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setEditValue(value);
	}, [value]);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			if (cursorPosition !== undefined && cursorPosition !== null) {
				// 设置光标位置
				inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
			} else {
				inputRef.current.select();
			}
		}
	}, [isEditing, cursorPosition]);

	const handleDoubleClick = useCallback((e: React.MouseEvent) => {
		// 避免绑定到宽高可能为0的部分
		const target = e.currentTarget as HTMLElement;
		if (target.offsetWidth === 0 || target.offsetHeight === 0) return;
		onStartEdit();
	}, [onStartEdit]);

	const handleBlur = useCallback(() => {
		onChange(editValue);
		// 退出编辑状态
		onStopEdit();
	}, [editValue, onChange, onStopEdit]);

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			if (e.ctrlKey) {
				// Ctrl+回车 将光标之后的内容拆分为新行
				const target = e.target as HTMLInputElement;
				const currentCursorPosition = target.selectionStart || 0;
				if (onSplit) {
					e.preventDefault();
					// 先保存当前编辑值（trim 后）
					const beforeCursor = editValue.slice(0, currentCursorPosition).trim();
					const afterCursor = editValue.slice(currentCursorPosition).trim();
					// 更新当前行为光标前的内容（trim 后）
					setEditValue(beforeCursor);
					onChange(beforeCursor);
					// 触发拆分，将光标后的内容作为新行（trim 后）
					onSplit(afterCursor);
					// 切换到下一行编辑
					if (onEditNext) {
						setTimeout(() => onEditNext(), 0);
					}
				} else {
					onChange(editValue.trim());
				}
			} else if (e.shiftKey) {
				// Shift+回车，保存当前行并切换到上一行编辑
				e.preventDefault();
				onChange(editValue.trim());
				// 切换到上一行编辑，光标放在行尾
				if (onEditPrevious) {
					setTimeout(() => onEditPrevious(), 0);
				}
			} else {
				// 单独按回车，保存当前行并切换到下一行编辑
				e.preventDefault();
				onChange(editValue.trim());
				// 切换到下一行编辑，光标放在行尾
				if (onEditNext) {
					setTimeout(() => onEditNext(), 0);
				}
			}
		} else if (e.key === "Escape") {
			setEditValue(value);
			onStopEdit();
		} else if (e.key === "Backspace") {
			// 在输入框开头按下退格时，将当前行与前一行合并
			const target = e.target as HTMLInputElement;
			if (target.selectionStart === 0 && target.selectionEnd === 0 && onMergeUp) {
				e.preventDefault();
				// 传递当前编辑的值，而不是使用父组件中可能未同步的旧值
				onMergeUp(editValue);
				// 切换到上一行编辑，光标设置在末尾
				if (onEditPrevious) {
					setTimeout(() => onEditPrevious(), 0);
				}
			}
		} else if (e.key === "Delete") {
			// 在输入框末尾按下 Delete 键时，将下一行合并到当前行（不加空格）
			const target = e.target as HTMLInputElement;
			const cursorPos = target.selectionStart || 0;
			const isAtEnd = cursorPos === editValue.length;
			if (isAtEnd && onMergeDown) {
				e.preventDefault();
				// 传递当前编辑的值和光标位置，而不是使用父组件中可能未同步的旧值
				onMergeDown(editValue, cursorPos);
				// 在 DOM 更新后设置光标位置
				setTimeout(() => {
					if (inputRef.current) {
						inputRef.current.setSelectionRange(cursorPos, cursorPos);
						console.log(`[EditableLine] DOM 光标位置已设置: ${cursorPos}`);
					}
				}, 0);
			}
		}
	}, [editValue, onChange, value, onMergeUp, onMergeDown, onSplit, onEditNext, onEditPrevious, onStopEdit]);

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				value={editValue}
				onChange={(e) => setEditValue(e.target.value)}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				onPaste={(e) => {
					e.preventDefault();
					if (!onPaste || !inputRef.current) return;
					const pastedText = e.clipboardData.getData('text');
					const selectionStart = inputRef.current.selectionStart || 0;
					const selectionEnd = inputRef.current.selectionEnd || 0;
					onPaste(editValue, pastedText, selectionStart, selectionEnd);
				}}
				style={{
					width: "100%",
					padding: "4px 8px",
					border: "1px solid var(--accent-9)",
					borderRadius: "4px",
					backgroundColor: "var(--gray-1)",
					fontSize: "14px",
					lineHeight: "1.5",
					outline: "none",
					color: isOverflow ? "var(--red-9)" : "inherit",
				}}
			/>
		);
	}

	return (
		<div
			onDoubleClick={handleDoubleClick}
			style={{
				padding: "4px 8px",
				backgroundColor: isOverflow ? "var(--red-3)" : "var(--gray-3)",
				borderRadius: "4px",
				height: "28px",
				lineHeight: "20px",
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis",
				cursor: "pointer",
				color: isOverflow ? "var(--red-9)" : value ? "inherit" : "var(--gray-8)",
				fontSize: "14px",
			}}
			title={value || placeholder || "双击编辑"}
		>
			{value || placeholder || "\u00A0"}
		</div>
	);
};

export const AddLanguageDialog = () => {
	const { t } = useTranslation();
	const [dialogState, setDialogState] = useAtom(addLanguageDialogAtom);
	const [customLang, setCustomLang] = useState("");
	const [contentLines, setContentLines] = useState<string[]>([]);
	// 当前编辑行的索引
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	// 光标位置（用于合并后定位）
	const [cursorPosition, setCursorPosition] = useState<number | null>(null);

	useEffect(() => {
		if (!dialogState.open) return;
		setCustomLang("");
		// 初始化内容行数组，长度与原文行数相同，初始为空字符串
		setContentLines(new Array(dialogState.originalLines.length).fill(""));
		setEditingIndex(null);
		setCursorPosition(null);
	}, [dialogState.open, dialogState.originalLines.length]);

	// 检查是否有溢出的行（用户手动添加的超出原文行数的行）
	const hasOverflow = contentLines.length > dialogState.originalLines.length;

	// 使用同步滚动 hook
	const { leftScrollRef, rightScrollRef, handleLeftScroll, handleRightScroll } = useSyncScroll(hasOverflow);

	// 获取有效的翻译行（不超过原文行数）
	const validContentLines = useMemo(() => {
		return contentLines.slice(0, dialogState.originalLines.length);
	}, [contentLines, dialogState.originalLines.length]);

	// 确认按钮是否禁用
	const canSubmit = useMemo(() => {
		const trimmed = customLang.trim();
		// 语言代码不能为空，不能是 und，且必须有内容
		const hasContent = validContentLines.some(line => line.trim().length > 0);
		return (
			trimmed.length > 0 &&
			trimmed !== "und" &&
			hasContent &&
			!hasOverflow
		);
	}, [customLang, validContentLines, hasOverflow]);

	const handleClose = () => {
		setDialogState({ ...dialogState, open: false });
	};

	const handleSubmit = () => {
		const trimmed = customLang.trim();
		if (!trimmed || trimmed === "und") return;
		dialogState.onSubmit?.(trimmed, validContentLines);
		setCustomLang("");
		setContentLines([]);
		setDialogState({ ...dialogState, open: false });
	};

	const handleSelectCode = (code: string) => {
		setCustomLang(code);
	};

	const handleLineChange = useCallback((index: number, value: string) => {
		setContentLines(prev => {
			const newLines = [...prev];
			newLines[index] = value;
			return newLines;
		});
	}, []);

	const handleMergeUp = useCallback((index: number, currentEditValue?: string) => {
		if (index === 0) return; // 第一行无法向上合并
		const previousValue = contentLines[index - 1] || "";
		// 使用传入的当前编辑值（如果有），否则使用 contentLines 中的值
		const currentValue = currentEditValue !== undefined ? currentEditValue : (contentLines[index] || "");
		// 合并时添加空格（如果前一行不为空）
		const separator = previousValue.length > 0 ? " " : "";
		const mergedValue = previousValue + separator + currentValue;
		setContentLines(prev => {
			const newLines = [...prev];
			// 将当前行合并到前一行（trim 后）
			newLines[index - 1] = mergedValue.trim();
			// 删除当前行
			newLines.splice(index, 1);
			return newLines;
		});
		// 设置光标位置为前一行的末尾（合并后的位置）
		setCursorPosition(previousValue.length + separator.length);
	}, [contentLines]);

	// 递归插入行：如果目标位置为空行则直接设置，否则递归后移内容
	const insertLineRecursive = useCallback((lines: string[], targetIndex: number, value: string): string[] => {
		// 如果超出当前数组长度，直接添加到末尾
		if (targetIndex >= lines.length) {
			lines.push(value);
			return lines;
		}
		
		const targetValue = lines[targetIndex] || "";
		
		// 如果目标位置是空行，直接设置
		if (targetValue.trim().length === 0) {
			lines[targetIndex] = value;
			return lines;
		}
		
		// 如果不是空行，递归调用尝试将目标行内容插入到后一行
		insertLineRecursive(lines, targetIndex + 1, targetValue);
		
		// 递归结束后替换行内容
		lines[targetIndex] = value;
		return lines;
	}, []);

	const handleSplit = useCallback((index: number, afterCursor: string) => {
		setContentLines(prev => {
			const newLines = [...prev];

			// 将光标后的内容按行分割，遍历添加每一行
			const linesToInsert = afterCursor.split('\n').map(line => line.trim());
			let insertIndex = index + 1;
			
			for (const line of linesToInsert) {
				insertLineRecursive(newLines, insertIndex, line);
				insertIndex++;
			}

			// 清除溢出部分尾部的空内容
			const originalLength = dialogState.originalLines.length;
			while (newLines.length > originalLength) {
				const lastIndex = newLines.length - 1;
				if (newLines[lastIndex]?.trim().length === 0) {
					newLines.pop();
				} else {
					break;
				}
			}

			return newLines;
		});
		// 设置光标位置为 0（新行的开头）
		setCursorPosition(0);
	}, [insertLineRecursive, dialogState.originalLines.length]);

	// 将下一行合并到当前行（不加空格）
	const handleMergeDown = useCallback((index: number, currentEditValue?: string, cursorPos?: number) => {
		if (index >= contentLines.length - 1) return; // 最后一行无法向下合并
		// 使用传入的当前编辑值（如果有），否则使用 contentLines 中的值
		const currentValue = currentEditValue !== undefined ? currentEditValue : (contentLines[index] || "");
		const nextValue = contentLines[index + 1] || "";
		console.log(`[MergeDown] 合并前光标位置: ${cursorPos}, 当前行长度: ${currentValue.length}, 下一行长度: ${nextValue.length}`);
		setContentLines(prev => {
			const newLines = [...prev];
			// 将下一行合并到当前行（不加空格）
			newLines[index] = (currentValue + nextValue).trim();
			// 删除下一行
			newLines.splice(index + 1, 1);
			return newLines;
		});
		const finalCursorPos = cursorPos !== undefined ? cursorPos : currentValue.length;
		console.log(`[MergeDown] 合并后光标位置: ${finalCursorPos}`);
		// 光标保持在原来的位置
		setCursorPosition(finalCursorPos);
	}, [contentLines]);

	// 切换到下一行编辑
	const handleEditNext = useCallback((index: number) => {
		const nextIndex = index + 1;
		if (nextIndex < contentLines.length) {
			setEditingIndex(nextIndex);
			// 设置光标位置为下一行的末尾
			const nextLineValue = contentLines[nextIndex] || "";
			setCursorPosition(nextLineValue.length);
		}
	}, [contentLines]);

	// 切换到上一行编辑
	const handleEditPrevious = useCallback((index: number) => {
		if (index > 0) {
			const prevIndex = index - 1;
			setEditingIndex(prevIndex);
			// 设置光标位置为上一行的末尾
			const prevLineValue = contentLines[prevIndex] || "";
			setCursorPosition(prevLineValue.length);
		}
	}, [contentLines]);

	// 处理粘贴事件
	const handlePaste = useCallback((index: number, currentValue: string, pastedText: string, selectionStart: number, selectionEnd: number) => {
		// 将粘贴内容插入到光标位置（替换选中的文本）
		const beforeSelection = currentValue.slice(0, selectionStart);
		const afterSelection = currentValue.slice(selectionEnd);
		const newValue = beforeSelection + pastedText + afterSelection;
		
		// 检查是否包含换行符
		if (newValue.includes('\n')) {
			// 有换行符，需要分行处理
			const lines = newValue.split('\n').map(line => line.trim());
			setContentLines(prev => {
				const newLines = [...prev];
				
				// 第一行直接替换当前行
				newLines[index] = lines[0];
				
				// 从第二行开始，递归插入后续行
				for (let i = 1; i < lines.length; i++) {
					insertLineRecursive(newLines, index + i, lines[i]);
				}

				// 清除溢出部分尾部的空内容
				const originalLength = dialogState.originalLines.length;
				while (newLines.length > originalLength) {
					const lastIndex = newLines.length - 1;
					if (newLines[lastIndex]?.trim().length === 0) {
						newLines.pop();
					} else {
						break;
					}
				}

				return newLines;
			});
			// 切换到最后一行输入的位置，光标放在行尾
			const lastIndex = index + lines.length - 1;
			if (lastIndex < contentLines.length) {
				setEditingIndex(lastIndex);
				const lastLineValue = contentLines[lastIndex] || "";
				setCursorPosition(lastLineValue.length);
			}
		} else {
			// 没有换行符，直接更新当前行
			setContentLines(prev => {
				const newLines = [...prev];
				newLines[index] = newValue.trim();
				return newLines;
			});
			// 设置光标位置到粘贴内容之后
			setCursorPosition(selectionStart + pastedText.length);
		}
	}, [contentLines, insertLineRecursive, dialogState.originalLines.length]);

	const getTargetLabel = () => {
		switch (dialogState.target) {
			case "translation":
				return t("addLanguageDialog.targetTranslation", "翻译");
			case "romanization":
				return t("addLanguageDialog.targetRomanization", "音译");
			default:
				return "";
		}
	};

	return (
		<Dialog.Root open={dialogState.open} onOpenChange={handleClose}>
			<Dialog.Content
				maxWidth="800px"
				maxHeight="90vh"
				onKeyDown={(e) => {
					// 拦截 Ctrl+Z 和 Ctrl+Y，防止编辑页面响应撤销/重做
					if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y')) {
						e.stopPropagation();
					}
				}}
			>
				<Dialog.Title>
					{t("addLanguageDialog.title", "新增语言代码")} - {getTargetLabel()}
				</Dialog.Title>
				<Flex direction="column" gap="3" style={{ maxHeight: "calc(90vh - 200px)" }}>
					<Text size="2">
						{t("addLanguageDialog.commonCodes", "常用语言代码")}
					</Text>
					<Flex gap="2" wrap="wrap">
						{COMMON_LANGUAGE_CODES.map((code) => (
							<Button
								key={code}
								variant={customLang === code ? "solid" : "soft"}
								size="1"
								onClick={() => handleSelectCode(code)}
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
					/>
					<Text size="2">
						{t("addLanguageDialog.content", "内容")}
						{hasOverflow && (
							<Text size="2" color="red" ml="2">
								{t(
									"addLanguageDialog.overflowWarning",
									"警告：翻译/音译行数超过原文行数",
								)}
							</Text>
						)}
					</Text>
					<Flex gap="2" style={{ flex: 1, minHeight: 0 }}>
						{/* 原文列 */}
						<Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
							<Text size="1" weight="bold">
								{t("addLanguageDialog.original", "原文")}
							</Text>
							<div
								ref={leftScrollRef}
								onScroll={handleLeftScroll}
								style={{
									flex: 1,
									maxHeight: "400px",
									overflow: "auto",
									scrollbarWidth: "none",
									msOverflowStyle: "none",
								}}
							>
								<style>{`
									div[ref="${leftScrollRef}"]::-webkit-scrollbar {
										display: none;
									}
								`}</style>
								<Flex direction="column" gap="1">
									{dialogState.originalLines.map((line, index) => (
										<div
											key={index}
											style={{
												padding: "4px 8px",
											backgroundColor: "var(--gray-3)",
											borderRadius: "4px",
											height: "28px",
											lineHeight: "20px",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
											fontSize: "14px",
										}}
											title={line}
										>
											{line || "\u00A0"}
										</div>
									))}
								</Flex>
							</div>
						</Flex>
						{/* 翻译/音译列 */}
						<Flex
							direction="column"
							gap="1"
							style={{ flex: 1, minWidth: 0 }}
						>
							<Text size="1" weight="bold">
								{getTargetLabel()}
								<Text size="1" color="gray" ml="2">
									({t("addLanguageDialog.doubleClickToEdit", "双击编辑")})
								</Text>
							</Text>
							<div
								ref={rightScrollRef}
								onScroll={handleRightScroll}
								style={{
									flex: 1,
									maxHeight: "400px",
									overflow: "auto",
									scrollbarWidth: "none",
									msOverflowStyle: "none",
								}}
							>
								<style>{`
									div[ref="${rightScrollRef}"]::-webkit-scrollbar {
										display: none;
									}
								`}</style>
								<Flex direction="column" gap="1">
							{dialogState.originalLines.map((_, index) => (
								<EditableLine
									key={index}
									value={contentLines[index] || ""}
									isEditing={editingIndex === index}
									onStartEdit={() => {
										setEditingIndex(index);
										setCursorPosition(null);
									}}
									onStopEdit={() => setEditingIndex(null)}
									onChange={(value) => handleLineChange(index, value)}
									onMergeUp={(currentValue) => handleMergeUp(index, currentValue)}
									onMergeDown={(currentValue, cursorPos) => handleMergeDown(index, currentValue, cursorPos)}
									onSplit={(afterCursor) => handleSplit(index, afterCursor)}
									onPaste={(currentValue, pastedText, selectionStart, selectionEnd) => handlePaste(index, currentValue, pastedText, selectionStart, selectionEnd)}
									onEditNext={() => handleEditNext(index)}
									onEditPrevious={() => handleEditPrevious(index)}
									placeholder={t("addLanguageDialog.clickToEdit", "点击编辑")}
									cursorPosition={editingIndex === index ? cursorPosition : null}
								/>
							))}
							{hasOverflow && contentLines.slice(dialogState.originalLines.length).map((line, index) => {
								const actualIndex = dialogState.originalLines.length + index;
								return (
									<EditableLine
										key={`overflow-${index}`}
										value={line}
										isEditing={editingIndex === actualIndex}
										onStartEdit={() => {
											setEditingIndex(actualIndex);
											setCursorPosition(null);
										}}
										onStopEdit={() => setEditingIndex(null)}
										onChange={(value) => {
										setContentLines(prev => {
											const newLines = [...prev];
											newLines[actualIndex] = value;

											// 清除溢出部分尾部的空内容
											const originalLength = dialogState.originalLines.length;
											while (newLines.length > originalLength) {
												const lastIndex = newLines.length - 1;
												if (newLines[lastIndex]?.trim().length === 0) {
													newLines.pop();
												} else {
													break;
												}
											}

											return newLines;
										});
									}}
										onMergeUp={(currentValue) => handleMergeUp(actualIndex, currentValue)}
											onMergeDown={(currentValue, cursorPos) => handleMergeDown(actualIndex, currentValue, cursorPos)}
											onSplit={(afterCursor) => handleSplit(actualIndex, afterCursor)}
											onPaste={(currentValue, pastedText, selectionStart, selectionEnd) => handlePaste(actualIndex, currentValue, pastedText, selectionStart, selectionEnd)}
											onEditNext={() => handleEditNext(actualIndex)}
										onEditPrevious={() => handleEditPrevious(actualIndex)}
										isOverflow={true}
										cursorPosition={editingIndex === actualIndex ? cursorPosition : null}
									/>
								);
							})}
						</Flex>
							</div>
						</Flex>
					</Flex>
				</Flex>
				<Flex gap="3" mt="4" justify="end">
					<Button variant="soft" color="gray" onClick={handleClose}>
						{t("common.cancel", "取消")}
					</Button>
					<Button onClick={handleSubmit} disabled={!canSubmit}>
						{t("addLanguageDialog.add", "新增")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
