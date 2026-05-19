import {
	Checkmark16Regular,
	Dismiss16Regular,
	DismissCircle16Regular,
	Edit16Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Dialog,
	Flex,
	IconButton,
	ScrollArea,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { uid } from "uid";
import {
	metadataEditorDialogAtom,
	metadataRenameDialogAtom,
} from "$/states/dialogs";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main";
import type { TTMLMetadata } from "$/types/ttml";

interface TagItem {
	id: string;
	type: "text" | "metadata" | "punctuation";
	value: string;
	key?: string;
}

interface MetadataValueItem {
	id: string;
	key: string;
	value: string;
	enabled: boolean;
	isKey?: boolean; // 标记是否为 key 项
}

export const MetadataRenameDialog = () => {
	const { t } = useTranslation();
	const [dialogState, setDialogState] = useAtom(metadataRenameDialogAtom);
	const [metadataEditorOpen, setMetadataEditorOpen] = useAtom(
		metadataEditorDialogAtom,
	);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const [currentFileName, setFilename] = useAtom(saveFileNameAtom);
	const [tags, setTags] = useState<TagItem[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [metadataValues, setMetadataValues] = useState<MetadataValueItem[]>([]);
	const [keepOpen, setKeepOpen] = useState(false);
	const [draggedTagId, setDraggedTagId] = useState<string | null>(null);
	const [dragOverTagId, setDragOverTagId] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// 标点符号列表（Windows 路径安全字符）
	const punctuations = [".", "-", "_", " ", "＆", "／", "【", "】", "(", ")"];

	const suffix = ".ttml";

	// 获取基础文件名（不含扩展名）
	const getBaseName = useCallback((value: string) => {
		return value.toLowerCase().endsWith(suffix)
			? value.slice(0, -suffix.length)
			: value;
	}, []);

	// 初始化 tags 和 metadataValues
	useEffect(() => {
		if (!dialogState.open) return;

		const baseName = getBaseName(currentFileName);

		// 初始化为一个包含原文件名的 text tag
		setTags([
			{
				id: uid(),
				type: "text",
				value: baseName,
			},
		]);

		// 从 lyricLines.metadata 构建 metadataValues
		const values: MetadataValueItem[] = [];
		lyricLines.metadata.forEach((entry) => {
			// 添加 key 项
			values.push({
				id: uid(),
				key: entry.key,
				value: entry.key,
				enabled: false,
				isKey: true,
			});
			// 添加 value 项
			entry.value.forEach((v) => {
				if (v.trim()) {
					values.push({
						id: uid(),
						key: entry.key,
						value: v,
						enabled: false,
					});
				}
			});
		});
		setMetadataValues(values);
		setInputValue("");
		setKeepOpen(false);
	}, [dialogState.open, lyricLines, getBaseName]);

	// 按 key 分组的 metadata
	const groupedMetadata = useMemo(() => {
		const groups = new Map<string, MetadataValueItem[]>();
		metadataValues.forEach((item) => {
			if (!groups.has(item.key)) {
				groups.set(item.key, []);
			}
			groups.get(item.key)!.push(item);
		});
		return groups;
	}, [metadataValues]);

	// 将输入框内容转换为 tag
	const convertInputToTag = useCallback(() => {
		const trimmed = inputValue.trim();
		if (trimmed) {
			setTags((prev) => [...prev, { id: uid(), type: "text", value: trimmed }]);
			setInputValue("");
		}
	}, [inputValue]);

	// 处理输入框键盘事件
	const handleInputKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				convertInputToTag();
			}
		},
		[convertInputToTag],
	);

	// 处理输入框失去焦点
	const handleInputBlur = useCallback(() => {
		convertInputToTag();
	}, [convertInputToTag]);

	// 删除 tag
	const removeTag = useCallback(
		(id: string) => {
			setTags((prev) => prev.filter((tag) => tag.id !== id));
			// 如果是 metadata tag，需要更新对应 metadata value 的 enabled 状态
			const tagToRemove = tags.find((t) => t.id === id);
			if (tagToRemove?.type === "metadata" && tagToRemove.key) {
				setMetadataValues((prev) =>
					prev.map((item) =>
						item.id === id ? { ...item, enabled: false } : item,
					),
				);
			}
		},
		[tags],
	);

	// 添加 metadata value 到输入框
	const addMetadataValue = useCallback((item: MetadataValueItem) => {
		setMetadataValues((prev) =>
			prev.map((m) => (m.id === item.id ? { ...m, enabled: true } : m)),
		);
		setTags((prev) => [
			...prev,
			{
				id: item.id,
				type: "metadata",
				value: item.value,
				key: item.key,
			},
		]);
	}, []);

	// 全选某个 key 的所有 value（不包括 key 本身）
	const selectAllForKey = useCallback(
		(key: string) => {
			const itemsForKey = metadataValues.filter(
				(m) => m.key === key && !m.isKey,
			);
			itemsForKey.forEach((item) => {
				if (!item.enabled) {
					addMetadataValue(item);
				}
			});
		},
		[metadataValues, addMetadataValue],
	);

	// 全不选某个 key 的所有 value（不包括 key 本身）
	const deselectAllForKey = useCallback(
		(key: string) => {
			const itemsForKey = metadataValues.filter(
				(m) => m.key === key && !m.isKey,
			);
			itemsForKey.forEach((item) => {
				if (item.enabled) {
					setMetadataValues((prev) =>
						prev.map((m) => (m.id === item.id ? { ...m, enabled: false } : m)),
					);
					setTags((prev) => prev.filter((t) => t.id !== item.id));
				}
			});
		},
		[metadataValues],
	);

	// 清空所有 tags
	const clearAllTags = useCallback(() => {
		setTags([]);
		setMetadataValues((prev) => prev.map((m) => ({ ...m, enabled: false })));
	}, []);

	// 添加标点符号
	const addPunctuation = useCallback((punctuation: string) => {
		setTags((prev) => [
			...prev,
			{ id: uid(), type: "punctuation", value: punctuation },
		]);
	}, []);

	// 使用自定义鼠标拖动代替 HTML5 拖放 API，以支持滚轮事件
	const containerRef = useRef<HTMLDivElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const dragStartPos = useRef({ x: 0, y: 0 });
	const draggedTagIdRef = useRef<string | null>(null);

	// 处理鼠标按下开始拖动
	const handleMouseDown = useCallback((e: React.MouseEvent, tagId: string) => {
		// 只有左键才触发拖动
		if (e.button !== 0) return;
		e.preventDefault();
		draggedTagIdRef.current = tagId;
		setDraggedTagId(tagId);
		setIsDragging(true);
		dragStartPos.current = { x: e.clientX, y: e.clientY };
	}, []);

	// 计算插入位置（基于鼠标 X 和 Y 坐标）
	const calculateInsertIndex = useCallback(
		(clientX: number, clientY: number): number => {
			if (tags.length === 0) return 0;

			// 获取所有 tag 元素的位置
			const tagElements = document.querySelectorAll("[data-tag-id]");
			if (tagElements.length === 0) return tags.length;

			// 按行分组 tag
			const rows: Element[][] = [];
			let currentRow: Element[] = [];
			let currentRowY = 0;

			for (const el of tagElements) {
				const rect = el.getBoundingClientRect();
				if (currentRow.length === 0) {
					currentRow.push(el);
					currentRowY = rect.top;
				} else if (Math.abs(rect.top - currentRowY) < 10) {
					// 同一行（允许 10px 误差）
					currentRow.push(el);
				} else {
					// 新行
					rows.push(currentRow);
					currentRow = [el];
					currentRowY = rect.top;
				}
			}
			if (currentRow.length > 0) {
				rows.push(currentRow);
			}

			// 找到鼠标所在的行
			let targetRowIndex = 0;
			for (let i = 0; i < rows.length; i++) {
				const rowRect = rows[i][0].getBoundingClientRect();
				if (clientY < rowRect.top + rowRect.height / 2) {
					targetRowIndex = i;
					break;
				}
				targetRowIndex = i + 1;
			}

			// 计算目标行之前的所有 tag 数量
			let insertIndex = 0;
			for (let i = 0; i < targetRowIndex && i < rows.length; i++) {
				insertIndex += rows[i].length;
			}

			// 在目标行内找到具体插入位置
			if (targetRowIndex < rows.length) {
				const targetRow = rows[targetRowIndex];
				for (const el of targetRow) {
					const rect = el.getBoundingClientRect();
					const centerX = rect.left + rect.width / 2;
					if (clientX < centerX) {
						break;
					}
					insertIndex++;
				}
			}

			return Math.min(insertIndex, tags.length);
		},
		[tags],
	);

	// 处理鼠标移动（拖动中）
	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			const insertIndex = calculateInsertIndex(e.clientX, e.clientY);

			// 找到插入位置对应的 tag id
			if (insertIndex >= tags.length) {
				setDragOverTagId("__end__");
			} else {
				setDragOverTagId(tags[insertIndex].id);
			}
		};

		const handleMouseUp = (e: MouseEvent) => {
			const draggedId = draggedTagIdRef.current;
			if (!draggedId) {
				setIsDragging(false);
				setDraggedTagId(null);
				setDragOverTagId(null);
				return;
			}

			const insertIndex = calculateInsertIndex(e.clientX, e.clientY);

			setTags((prev) => {
				const draggedIndex = prev.findIndex((t) => t.id === draggedId);
				if (draggedIndex === -1) return prev;

				const newTags = [...prev];
				const [draggedTag] = newTags.splice(draggedIndex, 1);

				// 调整插入索引（如果拖动元素在插入位置之前）
				const adjustedIndex =
					draggedIndex < insertIndex ? insertIndex - 1 : insertIndex;
				newTags.splice(adjustedIndex, 0, draggedTag);
				return newTags;
			});

			setIsDragging(false);
			setDraggedTagId(null);
			setDragOverTagId(null);
			draggedTagIdRef.current = null;
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isDragging, tags, calculateInsertIndex]);

	// 确认重命名
	const handleConfirm = useCallback(() => {
		const newName = tags.map((t) => t.value).join("");
		if (newName.trim()) {
			setFilename(`${newName.trim()}${suffix}`);
		}
		setDialogState({ open: false });
	}, [tags, setFilename, setDialogState]);

	// 取消
	const handleCancel = useCallback(() => {
		setDialogState({ open: false });
	}, [setDialogState]);

	// 前往编辑元数据
	const handleEditMetadata = useCallback(() => {
		setKeepOpen(true);
		setMetadataEditorOpen(true);
	}, [setMetadataEditorOpen]);

	// 监听元数据编辑器关闭，刷新元数据列表
	useEffect(() => {
		if (keepOpen && !metadataEditorOpen) {
			// 刷新 metadataValues
			const values: MetadataValueItem[] = [];
			lyricLines.metadata.forEach((entry) => {
				// 添加 key 项
				const existingKeyTag = tags.find(
					(t) =>
						t.type === "metadata" &&
						t.key === entry.key &&
						t.value === entry.key,
				);
				values.push({
					id: existingKeyTag?.id || uid(),
					key: entry.key,
					value: entry.key,
					enabled: !!existingKeyTag,
					isKey: true,
				});
				// 添加 value 项
				entry.value.forEach((v) => {
					if (v.trim()) {
						// 检查是否已在 tags 中
						const existingTag = tags.find(
							(t) =>
								t.type === "metadata" && t.key === entry.key && t.value === v,
						);
						values.push({
							id: existingTag?.id || uid(),
							key: entry.key,
							value: v,
							enabled: !!existingTag,
						});
					}
				});
			});
			setMetadataValues(values);
			setKeepOpen(false);
		}
	}, [keepOpen, metadataEditorOpen, lyricLines.metadata, tags]);

	// 构建文件名预览
	const fileNamePreview = useMemo(() => {
		const name = tags.map((t) => t.value).join("");
		return name ? `${name}${suffix}` : suffix;
	}, [tags]);

	return (
		<Dialog.Root
			open={dialogState.open}
			onOpenChange={(open) => {
				if (!open && keepOpen) return;
				setDialogState({ open });
			}}
		>
			<Dialog.Content
				style={{
					maxWidth: "600px",
					maxHeight: "80vh",
					display: "flex",
					flexDirection: "column",
				}}
				onPointerDownOutside={(e) => {
					if (keepOpen) {
						e.preventDefault();
					}
				}}
				onInteractOutside={(e) => {
					if (keepOpen) {
						e.preventDefault();
					}
				}}
			>
				<Dialog.Title>
					{t("metadataRename.title", "使用元数据重命名")}
				</Dialog.Title>

				<Flex direction="column" gap="4" style={{ flex: 1, minHeight: 0 }}>
					{/* 文件名输入区域 */}
					<Box>
						<Text as="label" size="2" weight="bold" mb="2">
							{t("metadataRename.fileName", "文件名")}
						</Text>
						<Flex
							ref={containerRef}
							gap="2"
							align="center"
							style={{
								padding: "8px",
								border: "1px solid var(--gray-6)",
								borderRadius: "var(--radius-3)",
								backgroundColor: "var(--gray-2)",
								minHeight: "44px",
								maxHeight: "120px",
								overflowY: "auto",
								flexWrap: "wrap",
								alignContent: "flex-start",
							}}
						>
							{tags.map((tag, index) => (
								<Flex
									key={tag.id}
									data-tag-id={tag.id}
									onMouseDown={(e) => handleMouseDown(e, tag.id)}
									align="center"
									gap="1"
									style={{
										position: "relative",
										padding: "2px 8px",
										borderRadius: "var(--radius-2)",
										backgroundColor:
											tag.type === "metadata"
												? "var(--accent-3)"
												: tag.type === "punctuation"
													? "var(--orange-3)"
													: "var(--gray-4)",
										fontSize: "14px",
										cursor: isDragging ? "grabbing" : "grab",
										opacity: draggedTagId === tag.id ? 0.5 : 1,
										transition: "all 0.2s ease",
										border: "2px solid transparent",
										userSelect: "none",
									}}
								>
									{/* 插入位置指示器 - 绝对定位在左侧 */}
									{draggedTagId && dragOverTagId === tag.id && (
										<Box
											style={{
												position: "absolute",
												left: "-3px",
												top: "50%",
												transform: "translateY(-50%)",
												width: "4px",
												height: "24px",
												backgroundColor: "var(--accent-9)",
												borderRadius: "2px",
												pointerEvents: "none",
												zIndex: 10,
											}}
										/>
									)}
									<Text
										size="2"
										style={{
											color:
												tag.type === "metadata"
													? "var(--accent-11)"
													: tag.type === "punctuation"
														? "var(--orange-11)"
														: "var(--gray-11)",
										}}
									>
										{tag.value}
									</Text>
									<IconButton
										size="1"
										variant="ghost"
										onClick={() => removeTag(tag.id)}
										style={{
											color:
												tag.type === "metadata"
													? "var(--accent-11)"
													: tag.type === "punctuation"
														? "var(--orange-11)"
														: "var(--gray-11)",
											cursor: "pointer",
										}}
									>
										<Dismiss16Regular />
									</IconButton>
								</Flex>
							))}
							{/* 最后的放置区域 */}
							<Box
								style={{
									flex: 1,
									minWidth: "40px",
									height: "32px",
									borderRadius: "var(--radius-2)",
									backgroundColor:
										dragOverTagId === "__end__"
											? "var(--accent-4)"
											: "transparent",
									border:
										dragOverTagId === "__end__"
											? "2px dashed var(--accent-9)"
											: "2px dashed transparent",
									transition: "all 0.2s ease",
								}}
							/>
							<TextField.Root
								ref={inputRef}
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								onKeyDown={handleInputKeyDown}
								onBlur={handleInputBlur}
								placeholder={
									tags.length === 0
										? t("metadataRename.inputPlaceholder", "输入文字")
										: ""
								}
								style={{
									flex: 1,
									minWidth: "60px",
									backgroundColor: "transparent",
									border: "none",
								}}
								variant="soft"
							/>
							<Text size="2" color="gray">
								{suffix}
							</Text>
							{tags.length > 0 && (
								<IconButton
									size="1"
									variant="ghost"
									color="red"
									onClick={clearAllTags}
									style={{ marginLeft: "auto" }}
								>
									<DismissCircle16Regular />
								</IconButton>
							)}
						</Flex>
						<Text size="1" color="gray" mt="1">
							{t("metadataRename.preview", "预览")}: {fileNamePreview}
						</Text>
					</Box>

					{/* 元数据列表 */}
					<Box style={{ flex: 1, minHeight: 0 }}>
						<Text as="label" size="2" weight="bold" mb="2">
							{t("metadataRename.metadataValues", "元数据")}
						</Text>
						<ScrollArea style={{ height: "250px" }}>
							<Flex direction="column" gap="3" style={{ paddingRight: "12px" }}>
								{Array.from(groupedMetadata.entries()).map(([key, values]) => {
									// 分离 key item 和 value items
									const keyItem = values.find((v) => v.isKey);
									const valueItems = values.filter((v) => !v.isKey);
									// key 是否全部启用（包括 key 本身和所有 values）
									const allEnabled =
										keyItem?.enabled && valueItems.every((v) => v.enabled);

									return (
										<Box key={key} style={{ marginTop: "16px" }}>
											<Flex align="center" gap="2" mb="2">
												{/* Key tag */}
												{keyItem && (
													<Flex
														align="center"
														gap="1"
														style={{
															padding: "2px 8px",
															borderRadius: "var(--radius-2)",
															backgroundColor: keyItem.enabled
																? "var(--accent-3)"
																: "var(--gray-3)",
															opacity: keyItem.enabled ? 1 : 0.6,
															cursor: "pointer",
														}}
														onClick={() => {
															if (!keyItem.enabled) {
																addMetadataValue(keyItem);
															}
														}}
													>
														<Text
															size="2"
															weight="bold"
															style={{
																color: keyItem.enabled
																	? "var(--accent-11)"
																	: "var(--gray-11)",
															}}
														>
															{keyItem.value}
														</Text>
													</Flex>
												)}
												<Flex gap="2" style={{ marginLeft: "auto" }}>
													<Button
														size="1"
														variant="soft"
														onClick={() => selectAllForKey(key)}
													>
														{t("metadataRename.selectAll", "全选")}
													</Button>
													<Button
														size="1"
														variant="soft"
														color="gray"
														onClick={() => deselectAllForKey(key)}
													>
														{t("metadataRename.deselectAll", "全不选")}
													</Button>
												</Flex>
											</Flex>
											<Flex gap="2" wrap="wrap">
												{valueItems.map((item) => (
													<Flex
														key={item.id}
														align="center"
														gap="1"
														style={{
															padding: "2px 8px",
															borderRadius: "var(--radius-2)",
															backgroundColor: item.enabled
																? "var(--accent-3)"
																: "var(--gray-3)",
															opacity: item.enabled ? 1 : 0.6,
															cursor: item.enabled ? "default" : "pointer",
														}}
														onClick={() => {
															if (!item.enabled) {
																addMetadataValue(item);
															}
														}}
													>
														<Text
															size="2"
															style={{
																color: item.enabled
																	? "var(--accent-11)"
																	: "var(--gray-11)",
															}}
														>
															{item.value}
														</Text>
													</Flex>
												))}
											</Flex>
										</Box>
									);
								})}
								{metadataValues.length === 0 && (
									<Text size="2" color="gray">
										{t("metadataRename.noMetadata", "暂无元数据")}
									</Text>
								)}
							</Flex>
						</ScrollArea>

						{/* 标点符号区域 */}
						<Box mt="3">
							<Text as="label" size="2" weight="bold" mb="2">
								{t("metadataRename.punctuations", "标点符号")}
							</Text>
							<Flex gap="2" wrap="wrap" mt="2">
								{punctuations.map((p) => (
									<Button
										key={p}
										size="1"
										variant="soft"
										color="orange"
										onClick={() => addPunctuation(p)}
									>
										{p}
									</Button>
								))}
							</Flex>
						</Box>
					</Box>

					{/* 按钮区域 */}
					<Flex justify="between" align="center" mt="4">
						<Button
							variant="soft"
							onClick={handleEditMetadata}
							style={{ display: "flex", alignItems: "center", gap: "4px" }}
						>
							<Edit16Regular />
							{t("metadataRename.editMetadata", "前往编辑元数据")}
						</Button>
						<Flex gap="2">
							<Button variant="soft" color="gray" onClick={handleCancel}>
								{t("common.cancel", "取消")}
							</Button>
							<Button onClick={handleConfirm}>
								<Checkmark16Regular />
								{t("common.confirm", "确认")}
							</Button>
						</Flex>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
