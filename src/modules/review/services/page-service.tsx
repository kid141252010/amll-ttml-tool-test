import {
	Box,
	Button,
	Card,
	Flex,
	Spinner,
	Text,
	TextField,
	Avatar,
} from "@radix-ui/themes";
import {
	Search20Regular,
	Target20Regular,
	Filter20Regular,
	Eye20Regular,
	EyeOff20Regular,
} from "@fluentui/react-icons";
import { useAtomValue, useSetAtom } from "jotai";
import {
	type CSSProperties,
	type DragEvent,
	type MouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useDeferredValue,
} from "react";
import { NeteaseIdSelectDialog } from "$/modules/ncm/modals/NeteaseIdSelectDialog";
import { ReviewExpandedContent } from "$/modules/review/modals/ReviewCardGroup";
import {
	extractMentions,
	parseReviewMetadata,
	renderCardContent,
	type ReviewMetadata,
	type ReviewPullRequest,
} from "./card-service";
import { useReviewPageLogic } from "./page-hooks";
import { useLyricsSiteAuth } from "./remote-service";
import { pushNotificationAtom } from "$/states/notifications";
import { reviewReportDialogAtom } from "$/states/dialogs";
import { githubLoginAtom } from "$/modules/settings/states";
import styles from "../index.module.css";

type ReviewCardGroupItem = ReviewPullRequest[];

const GROUP_PICKER_PAGE_SIZE = 12;
const MAIN_REVIEW_PAGE_SIZE = 60;

const getMetadataIds = (metadata: ReviewMetadata) =>
	[
		...metadata.ncmId.map((id) => `ncm:${id}`),
		...metadata.qqMusicId.map((id) => `qq:${id}`),
		...metadata.spotifyId.map((id) => `spotify:${id}`),
		...metadata.appleMusicId.map((id) => `apple:${id}`),
	]
		.map((id) => id.trim().toLowerCase())
		.filter(Boolean);

const groupPullRequestsBySharedIds = (
	items: ReviewPullRequest[],
): ReviewCardGroupItem[] => {
	const idToIndexes = new Map<string, Set<number>>();
	const prIds = items.map((pr, index) => {
		const ids = Array.from(new Set(getMetadataIds(parseReviewMetadata(pr.body))));
		for (const id of ids) {
			const indexes = idToIndexes.get(id) ?? new Set<number>();
			indexes.add(index);
			idToIndexes.set(id, indexes);
		}
		return ids;
	});
	const visited = new Set<number>();
	return items.flatMap((_, index) => {
		if (visited.has(index)) return [];
		const groupIndexes = new Set([index]);
		const queue = [index];
		visited.add(index);
		for (let cursor = 0; cursor < queue.length; cursor += 1) {
			const currentIndex = queue[cursor];
			for (const id of prIds[currentIndex] ?? []) {
				for (const linkedIndex of idToIndexes.get(id) ?? []) {
					if (visited.has(linkedIndex)) continue;
					visited.add(linkedIndex);
					groupIndexes.add(linkedIndex);
					queue.push(linkedIndex);
				}
			}
		}
		return [
			Array.from(groupIndexes)
				.sort((a, b) => a - b)
				.map((itemIndex) => items[itemIndex])
				.filter((item): item is ReviewPullRequest => Boolean(item)),
		];
	});
};

const getGroupKey = (group: ReviewCardGroupItem) =>
	group.map((item) => item.number).join("-");

const getGroupSharedIds = (group: ReviewCardGroupItem) =>
	Array.from(
		new Set(group.flatMap((item) => getMetadataIds(parseReviewMetadata(item.body)))),
	);

const isOwnPr = (pr: ReviewPullRequest, login: string) => {
	if (!login) return false;
	const lowerLogin = login.trim().toLowerCase();
	if (!lowerLogin) return false;
	if (pr.author?.toLowerCase() === lowerLogin) return true;
	const mentions = extractMentions(pr.body);
	if (mentions[0]?.toLowerCase() === lowerLogin) return true;
	return false;
};

const ReviewPage = () => {
	const closeTimerRef = useRef<number | null>(null);
	const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
	const groupSlotNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
	const groupWheelHandlersRef = useRef<
		Map<string, (event: WheelEvent) => void>
	>(new Map());
	const [expandedCard, setExpandedCard] = useState<{
		pr: ReviewPullRequest;
		from: DOMRect;
		to: DOMRect;
		phase: "opening" | "open" | "closing";
		overlayTopInset: number;
		onAfterClose?: () => void;
	} | null>(null);
	const [expandedGroup, setExpandedGroup] = useState<{
		group: ReviewCardGroupItem;
		from: DOMRect;
		to: DOMRect;
		phase: "opening" | "open" | "closing";
		overlayTopInset: number;
	} | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const deferredSearchQuery = useDeferredValue(searchQuery);
	const [showOwnPrsOnly, setShowOwnPrsOnly] = useState(false);
	const [mainReviewPage, setMainReviewPage] = useState(1);
	const [mainPageInput, setMainPageInput] = useState("");
	const [groupPickerPage, setGroupPickerPage] = useState(1);
	const [isTargetDialogOpen, setIsTargetDialogOpen] = useState(false);
	const [targetPrNumber, setTargetPrNumber] = useState("");
	const [pendingTargetPrNumber, setPendingTargetPrNumber] = useState<number | null>(null);
	const [preferredDisplayPrByGroup, setPreferredDisplayPrByGroup] = useState<
		Record<string, number>
	>({});
	const [flashingPrNumber, setFlashingPrNumber] = useState<number | null>(null);
	const [isLabelFilterDialogOpen, setIsLabelFilterDialogOpen] = useState(false);
	const [draggingLabel, setDraggingLabel] = useState<string | null>(null);
	const [dragOverZone, setDragOverZone] = useState<"sufficient" | "necessary" | null>(null);
	const {
		audioLoadPendingId,
		error,
		filteredItems,
		hasAccess,
		hiddenLabelSet,
		items,
		labels,
		lastNeteaseIdByPr,
		loading,
		necessaryLabels,
		neteaseIdDialog,
		openReviewFile,
		downloadReviewFile,
		refreshReviewTimeline,
		reviewedByUserMap,
		reviewSession,
		reviewStateMap,
		selectedUser,
		setSelectedUser,
		setNecessaryLabels,
		setSufficientLabels,
		sufficientLabels,
	} = useReviewPageLogic();
	const pushNotification = useSetAtom(pushNotificationAtom);
	const setReviewReportDialog = useSetAtom(reviewReportDialogAtom);
	const githubLogin = useAtomValue(githubLoginAtom);
	const {
		user: lyricsSiteUser,
		isLoggedIn: isLyricsSiteLoggedIn,
		hasReviewPermission: hasLyricsSiteReviewPermission,
		initiateLogin: initiateLyricsSiteLogin,
		logout: logoutLyricsSite,
	} = useLyricsSiteAuth();

	// === 标签筛选对话框相关 ===
	const labelColorMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const label of labels) {
			map.set(label.name, label.color);
		}
		return map;
	}, [labels]);
	const getLabelColor = useCallback(
		(name: string) => labelColorMap.get(name) ?? "gray",
		[labelColorMap],
	);
	// 在对话框内移除标签(从任一条件中移除)
	const handleRemoveLabel = useCallback(
		(name: string) => {
			setSufficientLabels((prev) => prev.filter((l) => l !== name));
			setNecessaryLabels((prev) => prev.filter((l) => l !== name));
		},
		[setNecessaryLabels, setSufficientLabels],
	);
	// 拖拽起点
	const handleDragStart = useCallback(
		(event: DragEvent<HTMLDivElement>, name: string) => {
			setDraggingLabel(name);
			event.dataTransfer.effectAllowed = "move";
			event.dataTransfer.setData("text/plain", name);
		},
		[],
	);
	const handleDragEnd = useCallback(() => {
		setDraggingLabel(null);
		setDragOverZone(null);
	}, []);
	// 拖拽悬停
	const handleDragOver = useCallback(
		(event: DragEvent<HTMLDivElement>, zone: "sufficient" | "necessary") => {
			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
			setDragOverZone(zone);
		},
		[],
	);
	const handleDragLeave = useCallback(
		(event: DragEvent<HTMLDivElement>, zone: "sufficient" | "necessary") => {
			// 仅当离开整个 drop zone 时才清空(避免子元素切换导致闪烁)
			const related = event.relatedTarget as Node | null;
			if (related && event.currentTarget.contains(related)) return;
			setDragOverZone((prev) => (prev === zone ? null : prev));
		},
		[],
	);
	// 放置: 从原条件移除, 加入目标条件
	const handleDrop = useCallback(
		(event: DragEvent<HTMLDivElement>, zone: "sufficient" | "necessary") => {
			event.preventDefault();
			const name = draggingLabel;
			setDraggingLabel(null);
			setDragOverZone(null);
			if (!name) return;
			if (zone === "sufficient") {
				setSufficientLabels((prev) =>
					prev.includes(name) ? prev : [...prev, name],
				);
				setNecessaryLabels((prev) => prev.filter((l) => l !== name));
			} else {
				setNecessaryLabels((prev) =>
					prev.includes(name) ? prev : [...prev, name],
				);
				setSufficientLabels((prev) => prev.filter((l) => l !== name));
			}
		},
		[draggingLabel, setNecessaryLabels, setSufficientLabels],
	);
	const labelFilterTotal = sufficientLabels.length + necessaryLabels.length;

	const priorityLabelName = "参与审核招募";
	const priorityPrNumbers = useMemo(
		() =>
			new Set(
				items
					.filter((pr) =>
						pr.labels.some(
							(label) => label.name.trim() === priorityLabelName,
						),
					)
					.map((pr) => pr.number),
			),
		[items],
	);
	const reviewRays = useMemo(() => {
		const allRays: Array<{
			prNumber: number;
			reviewer: string;
			type: "approved" | "changes_requested";
			submittedAt: string;
		}> = [];
		for (const prNumber of priorityPrNumbers) {
			const state = reviewStateMap[prNumber];
			if (state?.reviews) {
				for (const review of state.reviews) {
					allRays.push({
						prNumber,
						reviewer: review.user,
						type: review.type,
						submittedAt: review.submittedAt,
					});
				}
			}
		}
		allRays.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
		return { rays: allRays };
	}, [priorityPrNumbers, reviewStateMap]);
	const sortedItems = useMemo(() => {
		const itemsWithPriority = filteredItems.map((pr, index) => ({
			pr,
			index,
			hasPriorityLabel: pr.labels.some(
				(label) => label.name.trim() === priorityLabelName,
			),
		}));
		itemsWithPriority.sort((a, b) => {
			if (a.hasPriorityLabel === b.hasPriorityLabel) {
				return a.index - b.index;
			}
			return a.hasPriorityLabel ? -1 : 1;
		});
		return itemsWithPriority.map((item) => item.pr);
	}, [filteredItems]);
	const rawGroupedItems = useMemo(
		() => groupPullRequestsBySharedIds(sortedItems),
		[sortedItems],
	);
	const searchedGroupedItems = useMemo(() => {
		const searchLower = deferredSearchQuery.trim().toLowerCase();
		if (!searchLower) return rawGroupedItems;
		return rawGroupedItems.filter((group) =>
			group.some((pr) => pr.title.toLowerCase().includes(searchLower)),
		);
	}, [rawGroupedItems, deferredSearchQuery]);
	const filteredGroupedItems = useMemo(() => {
		if (!showOwnPrsOnly || !githubLogin) return searchedGroupedItems;
		return searchedGroupedItems.filter((group) =>
			group.some((pr) => isOwnPr(pr, githubLogin)),
		);
	}, [searchedGroupedItems, showOwnPrsOnly, githubLogin]);
	const currentReviewPrNumber = reviewSession?.prNumber;
	const groupedItems = useMemo(() => {
		if (!currentReviewPrNumber) return filteredGroupedItems;
		const currentGroupIndex = filteredGroupedItems.findIndex((group) =>
			group.some((pr) => pr.number === currentReviewPrNumber),
		);
		if (currentGroupIndex <= 0) return filteredGroupedItems;
		const currentGroup = filteredGroupedItems[currentGroupIndex];
		if (!currentGroup) return filteredGroupedItems;
		return [
			currentGroup,
			...filteredGroupedItems.slice(0, currentGroupIndex),
			...filteredGroupedItems.slice(currentGroupIndex + 1),
		];
	}, [filteredGroupedItems, currentReviewPrNumber]);
	const mainReviewPageCount = Math.max(
		1,
		Math.ceil(groupedItems.length / MAIN_REVIEW_PAGE_SIZE),
	);
	const currentMainReviewPage = Math.min(mainReviewPage, mainReviewPageCount);
	const mainPagerNumbers = useMemo(
		() =>
			Array.from(
				new Set([
					...Array.from({ length: Math.min(3, mainReviewPageCount) }, (_, index) =>
						index + 1,
					),
					...Array.from({ length: Math.min(3, mainReviewPageCount) }, (_, index) =>
						mainReviewPageCount - Math.min(3, mainReviewPageCount) + index + 1,
					),
				]),
			).sort((a, b) => a - b),
		[mainReviewPageCount],
	);
	const pagedGroupedItems = groupedItems.slice(
		(currentMainReviewPage - 1) * MAIN_REVIEW_PAGE_SIZE,
		currentMainReviewPage * MAIN_REVIEW_PAGE_SIZE,
	);
	const groupPickerPageCount = expandedGroup
		? Math.max(1, Math.ceil(expandedGroup.group.length / GROUP_PICKER_PAGE_SIZE))
		: 1;
	const currentGroupPickerPage = Math.min(groupPickerPage, groupPickerPageCount);
	const groupPickerPageItems = expandedGroup
		? expandedGroup.group.slice(
				(currentGroupPickerPage - 1) * GROUP_PICKER_PAGE_SIZE,
				currentGroupPickerPage * GROUP_PICKER_PAGE_SIZE,
			)
		: [];

	useEffect(() => {
		setMainReviewPage(1);
	}, [deferredSearchQuery, selectedUser, currentReviewPrNumber, showOwnPrsOnly]);

	useEffect(() => {
		setMainReviewPage((page) => Math.min(page, mainReviewPageCount));
	}, [mainReviewPageCount]);

	const jumpToMainPage = useCallback(() => {
		const page = Number.parseInt(mainPageInput, 10);
		if (Number.isNaN(page)) return;
		setMainReviewPage(Math.min(mainReviewPageCount, Math.max(1, page)));
		setMainPageInput("");
	}, [mainPageInput, mainReviewPageCount]);

	const closeExpanded = useCallback(() => {
		if (!expandedCard || expandedCard.phase === "closing") return;
		if (closeTimerRef.current) {
			window.clearTimeout(closeTimerRef.current);
		}
		const onAfterClose = expandedCard.onAfterClose;
		setExpandedCard((prev) => (prev ? { ...prev, phase: "closing" } : prev));
		closeTimerRef.current = window.setTimeout(() => {
			setExpandedCard(null);
			closeTimerRef.current = null;
			onAfterClose?.();
		}, 200);
	}, [expandedCard]);

	const handleDirectReview = useCallback(
		(pr: ReviewPullRequest) => {
			setReviewReportDialog({
				open: true,
				prNumber: pr.number,
				prTitle: pr.title,
				report: "",
				draftId: null,
			});
			closeExpanded();
		},
		[setReviewReportDialog, closeExpanded],
	);

	const closeExpandedGroup = useCallback(() => {
		if (!expandedGroup || expandedGroup.phase === "closing") return;
		if (closeTimerRef.current) {
			window.clearTimeout(closeTimerRef.current);
		}
		setExpandedGroup((prev) => (prev ? { ...prev, phase: "closing" } : prev));
		closeTimerRef.current = window.setTimeout(() => {
			setExpandedGroup(null);
			closeTimerRef.current = null;
		}, 200);
	}, [expandedGroup]);

	const handleTargetPr = useCallback(() => {
		const prNumber = Number.parseInt(targetPrNumber, 10);
		if (Number.isNaN(prNumber)) return;

		// 在所有项目中查找（而不仅是筛选后的）
		const targetPr = items.find((pr) => pr.number === prNumber);
		if (!targetPr) {
			pushNotification({
				title: "未找到 PR",
				description: `编号 #${prNumber} 的 PR 不存在`,
				level: "warning",
				source: "审阅",
			});
			return;
		}

		// 清除搜索词和用户筛选，确保目标 PR 可见
		setSearchQuery("");
		setSelectedUser(null);
		setShowOwnPrsOnly(false);
		setPendingTargetPrNumber(prNumber);

		// 关闭对话框
		setIsTargetDialogOpen(false);
		setTargetPrNumber("");
	}, [
		targetPrNumber,
		items,
		pushNotification,
		setSearchQuery,
		setSelectedUser,
	]);

	useEffect(() => {
		if (pendingTargetPrNumber === null) return;
		if (searchQuery || deferredSearchQuery || selectedUser) return;

		const targetGroupIndex = groupedItems.findIndex((group) =>
			group.some((pr) => pr.number === pendingTargetPrNumber),
		);
		if (targetGroupIndex < 0) {
			pushNotification({
				title: "定位失败",
				description: `无法定位到 PR #${pendingTargetPrNumber}，可能不在当前列表中`,
				level: "warning",
				source: "审阅",
			});
			setPendingTargetPrNumber(null);
			return;
		}

		const targetPage =
			Math.floor(targetGroupIndex / MAIN_REVIEW_PAGE_SIZE) + 1;
		if (currentMainReviewPage !== targetPage) {
			setMainReviewPage(targetPage);
			return;
		}

		requestAnimationFrame(() => {
			const cardNode = cardRefs.current.get(pendingTargetPrNumber);
			if (cardNode) {
				cardNode.scrollIntoView({ behavior: "smooth", block: "center" });
				setFlashingPrNumber(pendingTargetPrNumber);
				setTimeout(() => setFlashingPrNumber(null), 2000);
				const targetGroup = groupedItems[targetGroupIndex];
				if (targetGroup) {
					const groupKey = getGroupKey(targetGroup);
					setPreferredDisplayPrByGroup((prev) => ({
						...prev,
						[groupKey]: pendingTargetPrNumber,
					}));
				}
			} else {
				pushNotification({
					title: "定位失败",
					description: `无法定位到 PR #${pendingTargetPrNumber}，可能不在当前页中`,
					level: "warning",
					source: "审阅",
				});
			}
			setPendingTargetPrNumber(null);
		});
	}, [
		pendingTargetPrNumber,
		searchQuery,
		deferredSearchQuery,
		selectedUser,
		groupedItems,
		currentMainReviewPage,
		pushNotification,
	]);

	const setCardRef = useCallback(
		(prNumber: number) => (node: HTMLDivElement | null) => {
			if (node) {
				cardRefs.current.set(prNumber, node);
			} else {
				cardRefs.current.delete(prNumber);
			}
		},
		[],
	);

	const setGroupRef = useCallback(
		(group: ReviewCardGroupItem) => (node: HTMLDivElement | null) => {
			const groupKey = getGroupKey(group);

			for (const pr of group) {
				if (node) {
					cardRefs.current.set(pr.number, node);
				} else {
					cardRefs.current.delete(pr.number);
				}
			}

			const prevNode = groupSlotNodesRef.current.get(groupKey);
			const prevHandler = groupWheelHandlersRef.current.get(groupKey);
			if (prevNode && prevHandler) {
				prevNode.removeEventListener("wheel", prevHandler);
			}

			if (node) {
				groupSlotNodesRef.current.set(groupKey, node);

				if (group.length > 1) {
					const handler = (event: WheelEvent) => {
					if (Math.abs(event.deltaY) < 1) return;
					event.preventDefault();
					const now = Date.now();
					const lastTime =
						lastWheelTimeRef.current.get(groupKey) ?? 0;
					if (now - lastTime < 220) return;
					lastWheelTimeRef.current.set(groupKey, now);

					const currentDisplay =
						preferredDisplayPrByGroupRef.current[groupKey];
					const currentIndex = group.findIndex(
						(pr) => pr.number === currentDisplay,
					);
					const startIndex =
						currentIndex >= 0 ? currentIndex : 0;
					const direction = event.deltaY > 0 ? 1 : -1;
					const nextIndex =
						(startIndex + direction + group.length) %
						group.length;
					const nextPr = group[nextIndex];
					if (nextPr) {
						setPreferredDisplayPrByGroup((prev) => ({
							...prev,
							[groupKey]: nextPr.number,
						}));
					}
				};

					node.addEventListener("wheel", handler, {
						passive: false,
					});
					groupWheelHandlersRef.current.set(groupKey, handler);
				} else {
					groupWheelHandlersRef.current.delete(groupKey);
				}
			} else {
				groupSlotNodesRef.current.delete(groupKey);
				groupWheelHandlersRef.current.delete(groupKey);
			}
		},
		[],
	);

	const preferredDisplayPrByGroupRef = useRef<Record<string, number>>({});
	useEffect(() => {
		preferredDisplayPrByGroupRef.current = preferredDisplayPrByGroup;
	}, [preferredDisplayPrByGroup]);

	const lastWheelTimeRef = useRef<Map<string, number>>(new Map());

	const getOverlayTopInset = useCallback(() => {
		if (typeof document === "undefined") return 52;
		const ribbonBar = document.querySelector("[data-ribbon-bar]");
		if (ribbonBar instanceof HTMLElement) {
			const top = ribbonBar.getBoundingClientRect().top;
			if (Number.isFinite(top)) {
				return Math.round(top);
			}
		}
		return 52;
	}, []);

	const openExpanded = useCallback(
		(
			pr: ReviewPullRequest,
			rect: DOMRect,
			onAfterClose?: () => void,
		) => {
			if (closeTimerRef.current) {
				window.clearTimeout(closeTimerRef.current);
				closeTimerRef.current = null;
			}
			const overlayTopInset = getOverlayTopInset();
			const containerRect = new DOMRect(
				0,
				overlayTopInset,
				window.innerWidth,
				Math.max(0, window.innerHeight - overlayTopInset),
			);
			const padding = 24;
			const maxWidth = Math.max(0, containerRect.width - padding * 2);
			const maxHeight = Math.max(0, containerRect.height - padding * 2);
			const targetWidth = Math.min(730, maxWidth);
			const targetHeight = Math.min(460, maxHeight);
			const centerX = containerRect.left + containerRect.width / 2;
			const centerY = containerRect.top + containerRect.height / 2;
			const left = centerX - targetWidth / 2;
			const top = centerY - targetHeight / 2;
			const toRect = new DOMRect(left, top, targetWidth, targetHeight);
			setExpandedCard({
				pr,
				from: rect,
				to: toRect,
				phase: "opening",
				overlayTopInset,
				onAfterClose,
			});
			requestAnimationFrame(() => {
				setExpandedCard((prev) =>
					prev && prev.phase === "opening" ? { ...prev, phase: "open" } : prev,
				);
			});
		},
		[getOverlayTopInset],
	);

	const openExpandedGroup = useCallback(
		(group: ReviewCardGroupItem, rect: DOMRect) => {
			const overlayTopInset = getOverlayTopInset();
			const containerRect = new DOMRect(
				0,
				overlayTopInset,
				window.innerWidth,
				Math.max(0, window.innerHeight - overlayTopInset),
			);
			const padding = 24;
			const targetWidth = Math.min(
				760,
				Math.max(0, containerRect.width - padding * 2),
			);
			const targetHeight = Math.min(
				Math.max(220, 132 + group.length * 108),
				Math.max(0, containerRect.height - padding * 2),
			);
			const left = containerRect.left + containerRect.width / 2 - targetWidth / 2;
			const top = containerRect.top + containerRect.height / 2 - targetHeight / 2;
			setGroupPickerPage(1);
			setExpandedGroup({
				group,
				from: rect,
				to: new DOMRect(left, top, targetWidth, targetHeight),
				phase: "opening",
				overlayTopInset,
			});
			requestAnimationFrame(() => {
				setExpandedGroup((prev) =>
					prev && prev.phase === "opening" ? { ...prev, phase: "open" } : prev,
				);
			});
		},
		[getOverlayTopInset],
	);

	const handleCardClick = useCallback(
		(pr: ReviewPullRequest, event: MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			void refreshReviewTimeline(pr.number);
			const rect = event.currentTarget.getBoundingClientRect();
			openExpanded(pr, rect);
		},
		[openExpanded, refreshReviewTimeline],
	);

	const handleGroupClick = useCallback(
		(group: ReviewCardGroupItem, event: MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			const rect = event.currentTarget.getBoundingClientRect();
			if (group.length <= 1) {
				const pr = group[0];
				if (!pr) return;
				void refreshReviewTimeline(pr.number);
				openExpanded(pr, rect);
				return;
			}
			openExpandedGroup(group, rect);
		},
		[openExpanded, openExpandedGroup, refreshReviewTimeline],
	);

	const handleGroupItemClick = useCallback(
		(pr: ReviewPullRequest, event: MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			if (!expandedGroup) return;
			const groupToRestore = expandedGroup;
			void refreshReviewTimeline(pr.number);
			const rect = event.currentTarget.getBoundingClientRect();
			setExpandedGroup(null);
			openExpanded(pr, rect, () => {
				setExpandedGroup({ ...groupToRestore, phase: "open" });
			});
		},
		[expandedGroup, openExpanded, refreshReviewTimeline],
	);

	useEffect(() => {
		return () => {
			if (closeTimerRef.current) {
				window.clearTimeout(closeTimerRef.current);
			}
		};
	}, []);

	// 检查是否有权限（GitHub PAT 或歌词站登录）
	const hasReviewAccess = hasAccess || hasLyricsSiteReviewPermission;

	if (!hasReviewAccess) {
		return (
			<Box className={styles.emptyState}>
				<Flex direction="column" align="center" gap="4">
					{isLyricsSiteLoggedIn && !hasLyricsSiteReviewPermission ? (
						<>
							<Text color="gray">当前账号无审阅权限</Text>
							<Text size="2" color="gray">
								你当前不是歌词库审核员，无法参与审阅
							</Text>
							<Button
								size="1"
								variant="soft"
								color="gray"
								onClick={logoutLyricsSite}
							>
								登出并切换账号
							</Button>
						</>
					) : (
						<>
							<Text color="gray">当前账号无审阅权限</Text>
							<Text size="2" color="gray">
								请先登录以获取审阅权限
							</Text>
							<Button variant="soft" onClick={initiateLyricsSiteLogin}>
								登录歌词站
							</Button>
						</>
					)}
				</Flex>
			</Box>
		);
	}

	return (
		<Box className={styles.container}>
			{/* 用户信息栏 */}
			<Flex align="center" justify="between" className={styles.userBar}>
				<Flex align="center" gap="2">
					{isLyricsSiteLoggedIn && lyricsSiteUser ? (
						<>
							<Avatar
								size="2"
								src={lyricsSiteUser.avatarUrl}
								fallback={lyricsSiteUser.displayName?.[0] || "U"}
								radius="full"
							/>
							<Flex direction="column">
								<Text size="2" weight="medium">
									{lyricsSiteUser.displayName}
								</Text>
								<Text size="1" color="gray">
									@{lyricsSiteUser.username}
									{lyricsSiteUser.reviewPermission === 1 && (
										<span
											style={{ color: "var(--green-9)", marginLeft: "8px" }}
										>
											✓ 审核员
										</span>
									)}
								</Text>
							</Flex>
							<Button
								size="1"
								variant="soft"
								color="gray"
								onClick={logoutLyricsSite}
							>
								登出
							</Button>
						</>
					) : (
						<Button size="2" variant="soft" onClick={initiateLyricsSiteLogin}>
							登录歌词站
						</Button>
					)}
				</Flex>
			</Flex>

			{loading && items.length === 0 && (
				<Flex align="center" gap="2" className={styles.loading}>
					<Spinner size="2" />
					<Text size="2" color="gray">
						正在获取 PR 列表...
					</Text>
				</Flex>
			)}
			{error && (
				<Text size="2" color="red" className={styles.error}>
					{error}
				</Text>
			)}
			{selectedUser && (
				<Flex align="center" gap="2" className={styles.filterBar}>
					<Text size="2" color="gray">
						用户筛选
					</Text>
					<Box className={styles.filterChip}>
						<Flex align="center" gap="1">
							<Text size="2" weight="medium">
								@{selectedUser}
							</Text>
							<Box className={styles.filterCount}>
								<Text size="1" weight="medium">
									{filteredItems.length}
								</Text>
							</Box>
						</Flex>
					</Box>
					<Button
						size="1"
						variant="soft"
						color="gray"
						onClick={() => setSelectedUser(null)}
					>
						清除
					</Button>
				</Flex>
			)}
			<Box className={styles.searchBar}>
				<TextField.Root
					size="2"
					placeholder="搜索 PR 标题..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				>
					<TextField.Slot>
						<Search20Regular />
					</TextField.Slot>
					{searchQuery && (
						<TextField.Slot>
							<Button
								size="1"
								variant="ghost"
								color="gray"
								onClick={() => setSearchQuery("")}
							>
								清除
							</Button>
						</TextField.Slot>
					)}
					<TextField.Slot>
					<Button
						size="1"
						variant="ghost"
						color="gray"
						onClick={() => setIsTargetDialogOpen(true)}
						title="定位到指定 PR"
					>
						<Target20Regular />
					</Button>
				</TextField.Slot>
				<TextField.Slot>
					<Button
						size="1"
						variant={labelFilterTotal > 0 ? "soft" : "ghost"}
						color={labelFilterTotal > 0 ? "blue" : "gray"}
						onClick={() => setIsLabelFilterDialogOpen(true)}
						title="标签筛选"
					>
						<Filter20Regular />
						{labelFilterTotal > 0 && (
							<Box className={styles.filterBadge}>{labelFilterTotal}</Box>
						)}
					</Button>
				</TextField.Slot>
				<TextField.Slot>
					<Button
						size="1"
						variant={showOwnPrsOnly ? "soft" : "ghost"}
						color={showOwnPrsOnly ? "green" : "gray"}
						onClick={() => setShowOwnPrsOnly((prev) => !prev)}
						title={showOwnPrsOnly ? "正在显示自己的 PR" : "显示自己的 PR"}
						disabled={!githubLogin}
					>
						{showOwnPrsOnly ? (
							<Eye20Regular />
						) : (
							<EyeOff20Regular />
						)}
					</Button>
				</TextField.Slot>
				</TextField.Root>
			</Box>
			<Box className={styles.grid}>
				{pagedGroupedItems.map((group) => {
					const groupKey = getGroupKey(group);
					const primaryPr =
						group.find(
							(pr) => pr.number === preferredDisplayPrByGroup[groupKey],
						) ??
						group.find((pr) => pr.number === pendingTargetPrNumber) ??
						group.find((pr) => pr.number === currentReviewPrNumber) ??
						group[0];
					if (!primaryPr) return null;
					const isExpanded = group.some(
						(pr) => expandedCard?.pr.number === pr.number,
					);
					const isGroupExpanded = expandedGroup
						? getGroupKey(expandedGroup.group) === groupKey
						: false;
					const isPlaceholder =
						(isExpanded && expandedCard?.phase === "open") ||
						(isGroupExpanded && expandedGroup?.phase === "open");
					const placeholderStyle =
						isPlaceholder && (expandedCard || expandedGroup)
							? { height: (expandedCard ?? expandedGroup)?.from.height }
							: undefined;
					const isFlashing = group.some(
						(pr) => flashingPrNumber === pr.number,
					);
					const isCurrentReviewGroup = group.some(
						(pr) => pr.number === currentReviewPrNumber,
					);
					const isGrouped = group.length > 1;
					const stackCount = isGrouped ? group.length : 0;
					return (
						<Box
							key={groupKey}
							className={`${styles.groupSlot} ${
								isPlaceholder ? styles.cardPlaceholder : ""
							} ${isFlashing ? styles.flashingCard : ""} ${
								isCurrentReviewGroup ? styles.currentReviewGroup : ""
							}`}
							onClick={(event) => handleGroupClick(group, event)}
							ref={setGroupRef(group)}
							style={placeholderStyle}
						>
							{isPlaceholder ? null : (
								<Box
									className={isGrouped ? styles.groupStack : undefined}
									style={
										isGrouped
											? ({ "--stack-count": String(stackCount) } as CSSProperties)
											: undefined
									}
								>
									{isGrouped && (
										<div className={styles.groupStackBackdrop}>
											{Array.from({ length: stackCount }).map((_, index) => (
												<div
													key={index}
													className={styles.groupStackLayer}
													style={{
														transform: `translate(${index * 4}px, ${index * 4}px)`,
														zIndex: stackCount - index,
													}}
												/>
											))}
										</div>
									)}
									<Box
									key={primaryPr.number}
									className={styles.groupStackContent}
								>
									<Card
										className={`${styles.card} ${
											reviewSession?.prNumber === primaryPr.number
												? styles.reviewCard
												: ""
										} ${
											priorityPrNumbers.has(primaryPr.number)
												? styles.priorityCard
												: ""
										}`}
									>
										{renderCardContent({
											pr: primaryPr,
											hiddenLabelSet,
											styles,
											reviewedByUser:
												reviewedByUserMap[primaryPr.number] === true,
											onSelectUser: (user) =>
												setSelectedUser((prev) =>
													prev === user ? null : user,
												),
											isPriority: priorityPrNumbers.has(primaryPr.number),
											reviewRays,
										})}
									</Card>
								</Box>
									{isGrouped && (
										<Box className={styles.groupBadge}>
											<Text size="1" weight="bold">
											{group.length}
										</Text>
										</Box>
									)}
								</Box>
							)}
						</Box>
					);
				})}
			</Box>
			{mainReviewPageCount > 1 && (
				<Flex align="center" justify="center" gap="2" className={styles.mainPager}>
					<Button
						size="2"
						variant="soft"
						color="gray"
						disabled={currentMainReviewPage <= 1}
						onClick={() => setMainReviewPage((page) => Math.max(1, page - 1))}
					>
						上一页
					</Button>
					{mainPagerNumbers.map((page, index) => (
						<Flex key={page} align="center" gap="2">
							{index > 0 && page - mainPagerNumbers[index - 1] > 1 && (
								<Text size="2" color="gray">
									…
								</Text>
							)}
							<Button
								size="2"
								variant={page === currentMainReviewPage ? "solid" : "soft"}
								color={page === currentMainReviewPage ? undefined : "gray"}
								onClick={() => setMainReviewPage(page)}
							>
								{page}
							</Button>
						</Flex>
					))}
					<Button
						size="2"
						variant="soft"
						color="gray"
						disabled={currentMainReviewPage >= mainReviewPageCount}
						onClick={() =>
							setMainReviewPage((page) =>
								Math.min(mainReviewPageCount, page + 1),
							)
						}
					>
						下一页
					</Button>
					<Flex align="center" gap="2" className={styles.mainPagerJump}>
						<Text size="2" color="gray">
							跳转
						</Text>
						<TextField.Root
							size="2"
							type="number"
							min={1}
							max={mainReviewPageCount}
							placeholder={`${currentMainReviewPage}`}
							value={mainPageInput}
							onChange={(event) => setMainPageInput(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									jumpToMainPage();
								}
							}}
							className={styles.mainPagerInput}
						/>
						<Button size="2" variant="soft" color="gray" onClick={jumpToMainPage}>
							确定
						</Button>
					</Flex>
					<Text size="2" color="gray">
						共 {mainReviewPageCount} 页 / {groupedItems.length} 组
					</Text>
				</Flex>
			)}
			{expandedGroup && (
				<Box
					className={`${styles.overlay} ${
						expandedGroup.phase === "open" ? styles.overlayVisible : ""
					}`}
					style={{
						inset: `${expandedGroup.overlayTopInset}px 0 0 0`,
					}}
					onClick={closeExpandedGroup}
				>
					<Card
						className={`${styles.overlayCard} ${styles.groupPickerCard}`}
						style={{
							left:
								expandedGroup.phase === "open"
									? expandedGroup.to.left
									: expandedGroup.from.left,
							top:
								expandedGroup.phase === "open"
									? expandedGroup.to.top
									: expandedGroup.from.top,
							width:
								expandedGroup.phase === "open"
									? expandedGroup.to.width
									: expandedGroup.from.width,
							height:
								expandedGroup.phase === "open"
									? expandedGroup.to.height
									: expandedGroup.from.height,
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<Flex direction="column" gap="3" className={styles.groupPickerInner}>
							<Flex align="center" justify="between" gap="3">
								<Box>
									<Text size="3" weight="medium">
										相同 ID 的 PR
									</Text>
									<Text size="1" color="gray" asChild>
										<div>{getGroupSharedIds(expandedGroup.group).join(" / ")}</div>
									</Text>
								</Box>
								<Button size="1" variant="ghost" color="gray" onClick={closeExpandedGroup}>
									关闭
								</Button>
							</Flex>
							<Box className={styles.groupPickerList}>
								{groupPickerPageItems.map((pr) => (
									<Card
										key={pr.number}
										className={`${styles.card} ${styles.groupPickerItem} ${
											reviewSession?.prNumber === pr.number ? styles.reviewCard : ""
										} ${
											priorityPrNumbers.has(pr.number)
												? styles.priorityCard
												: ""
										}`}
										onClick={(event) => handleGroupItemClick(pr, event)}
									>
										{renderCardContent({
											pr,
											hiddenLabelSet,
											styles,
											reviewedByUser: reviewedByUserMap[pr.number] === true,
											onSelectUser: (user) =>
												setSelectedUser((prev) => (prev === user ? null : user)),
											isPriority: priorityPrNumbers.has(pr.number),
											reviewRays,
										})}
									</Card>
								))}
							</Box>
							{groupPickerPageCount > 1 && (
								<Flex align="center" justify="between" gap="3" className={styles.groupPickerPager}>
									<Button
										size="1"
										variant="soft"
										color="gray"
										disabled={currentGroupPickerPage <= 1}
										onClick={() => setGroupPickerPage((page) => Math.max(1, page - 1))}
									>
										上一页
									</Button>
									<Text size="2" color="gray">
										{currentGroupPickerPage} / {groupPickerPageCount}
									</Text>
									<Button
										size="1"
										variant="soft"
										color="gray"
										disabled={currentGroupPickerPage >= groupPickerPageCount}
										onClick={() =>
											setGroupPickerPage((page) =>
												Math.min(groupPickerPageCount, page + 1),
											)
										}
									>
										下一页
									</Button>
								</Flex>
							)}
						</Flex>
					</Card>
				</Box>
			)}
			{expandedCard && (
				<Box
					className={`${styles.overlay} ${
						expandedCard.phase === "open" ? styles.overlayVisible : ""
					}`}
					style={{
						inset: `${expandedCard.overlayTopInset}px 0 0 0`,
					}}
					onClick={closeExpanded}
				>
					<Card
						className={`${styles.overlayCard} ${styles.overlayCardExpanded}`}
						style={{
							left:
								expandedCard.phase === "open"
									? expandedCard.to.left
									: expandedCard.from.left,
							top:
								expandedCard.phase === "open"
									? expandedCard.to.top
									: expandedCard.from.top,
							width:
								expandedCard.phase === "open"
									? expandedCard.to.width
									: expandedCard.from.width,
							height:
								expandedCard.phase === "open"
									? expandedCard.to.height
									: expandedCard.from.height,
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<ReviewExpandedContent
							pr={expandedCard.pr}
							hiddenLabelSet={hiddenLabelSet}
							audioLoadPendingId={audioLoadPendingId}
							lastNeteaseIdByPr={lastNeteaseIdByPr}
							onOpenFile={openReviewFile}
							onDownloadFile={downloadReviewFile}
							onDirectReview={handleDirectReview}
							onClose={closeExpanded}
							reviewedByUser={
								reviewedByUserMap[expandedCard.pr.number] === true
							}
							repoOwner="Steve-xmh"
							repoName="amll-ttml-db"
							styles={styles}
						/>
					</Card>
				</Box>
			)}
			<NeteaseIdSelectDialog
				open={neteaseIdDialog.open}
				ids={neteaseIdDialog.ids}
				onSelect={neteaseIdDialog.onSelect}
				onClose={neteaseIdDialog.onClose}
			/>
			{/* 定位 PR 对话框 */}
			{isTargetDialogOpen && (
				<Box
					className={`${styles.overlay} ${styles.overlayVisible}`}
					style={{ inset: 0 }}
					onClick={() => setIsTargetDialogOpen(false)}
				>
					<Card
						className={styles.targetDialog}
						onClick={(event) => event.stopPropagation()}
					>
						<Flex direction="column" gap="3">
							<Text size="3" weight="medium">
								定位到指定 PR
							</Text>
							<TextField.Root
								type="number"
								placeholder="输入 PR 编号..."
								value={targetPrNumber}
								onChange={(e) => setTargetPrNumber(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleTargetPr();
									}
								}}
							>
								<TextField.Slot>#</TextField.Slot>
							</TextField.Root>
							<Flex gap="2" justify="end">
								<Button
									variant="soft"
									color="gray"
									onClick={() => {
										setIsTargetDialogOpen(false);
										setTargetPrNumber("");
									}}
								>
									取消
								</Button>
								<Button onClick={handleTargetPr} disabled={!targetPrNumber}>
								定位
							</Button>
						</Flex>
					</Flex>
				</Card>
			</Box>
		)}
		{/* 标签筛选对话框 */}
		{isLabelFilterDialogOpen && (
			<Box
				className={`${styles.overlay} ${styles.overlayVisible}`}
				style={{ inset: 0 }}
				onClick={() => setIsLabelFilterDialogOpen(false)}
			>
				<Card
					className={styles.labelFilterDialog}
					onClick={(event) => event.stopPropagation()}
				>
					<Flex direction="column" style={{ height: "100%" }}>
						{/* 标题栏 */}
						<Flex
							align="center"
							justify="between"
							className={styles.labelFilterHeader}
						>
							<Text size="3" weight="medium">
								标签筛选
							</Text>
							<Button
								size="1"
								variant="ghost"
								color="gray"
								onClick={() => setIsLabelFilterDialogOpen(false)}
							>
								关闭
							</Button>
						</Flex>
						{/* 主体: 两个 drop zone */}
						<Box className={styles.labelFilterBody}>
							{/* 充分条件 */}
							<Box
								className={`${styles.labelFilterSection} ${styles.labelFilterSectionSufficient} ${
									dragOverZone === "sufficient" ? styles.labelFilterSectionOver : ""
								}`}
								onDragOver={(e) => handleDragOver(e, "sufficient")}
								onDragLeave={(e) => handleDragLeave(e, "sufficient")}
								onDrop={(e) => handleDrop(e, "sufficient")}
							>
								<Flex align="center" gap="2">
									<Box
										className={styles.labelFilterSectionDot}
										style={{ backgroundColor: "var(--blue-9)" }}
									/>
									<Text className={styles.labelFilterSectionTitle}>
										充分条件
									</Text>
									<Text size="1" color="gray">
										({sufficientLabels.length})
									</Text>
								</Flex>
								<Text className={styles.labelFilterSectionDesc}>
									PR 包含至少一个以下标签即通过
								</Text>
								<Box className={styles.labelFilterList}>
									{sufficientLabels.length === 0 ? (
										<Text className={styles.labelEmpty}>
											从工具栏选中标签, 或从右侧拖入
										</Text>
									) : (
										sufficientLabels.map((name) => (
											<Box
												key={name}
												className={`${styles.labelChip} ${
													draggingLabel === name ? styles.labelChipDragging : ""
												}`}
												draggable
												onDragStart={(e) => handleDragStart(e, name)}
												onDragEnd={handleDragEnd}
											>
												<Box
													className={styles.labelChipDot}
													style={{ backgroundColor: `#${getLabelColor(name)}` }}
												/>
												<Text className={styles.labelChipText}>{name}</Text>
												<button
													type="button"
													className={styles.labelChipRemove}
													onClick={() => handleRemoveLabel(name)}
													title="移除"
												>
													×
												</button>
											</Box>
										))
									)}
								</Box>
							</Box>
							{/* 必要条件 */}
							<Box
								className={`${styles.labelFilterSection} ${styles.labelFilterSectionNecessary} ${
									dragOverZone === "necessary" ? styles.labelFilterSectionOver : ""
								}`}
								onDragOver={(e) => handleDragOver(e, "necessary")}
								onDragLeave={(e) => handleDragLeave(e, "necessary")}
								onDrop={(e) => handleDrop(e, "necessary")}
							>
								<Flex align="center" gap="2">
									<Box
										className={styles.labelFilterSectionDot}
										style={{ backgroundColor: "var(--red-9)" }}
									/>
									<Text className={styles.labelFilterSectionTitle}>
										必要条件
									</Text>
									<Text size="1" color="gray">
										({necessaryLabels.length})
									</Text>
								</Flex>
								<Text className={styles.labelFilterSectionDesc}>
									PR 必须包含全部以下标签才通过
								</Text>
								<Box className={styles.labelFilterList}>
									{necessaryLabels.length === 0 ? (
										<Text className={styles.labelEmpty}>
											从左侧拖入标签作为必要条件
										</Text>
									) : (
										necessaryLabels.map((name) => (
											<Box
												key={name}
												className={`${styles.labelChip} ${
													draggingLabel === name ? styles.labelChipDragging : ""
												}`}
												draggable
												onDragStart={(e) => handleDragStart(e, name)}
												onDragEnd={handleDragEnd}
											>
												<Box
													className={styles.labelChipDot}
													style={{ backgroundColor: `#${getLabelColor(name)}` }}
												/>
												<Text className={styles.labelChipText}>{name}</Text>
												<button
													type="button"
													className={styles.labelChipRemove}
													onClick={() => handleRemoveLabel(name)}
													title="移除"
												>
													×
												</button>
											</Box>
										))
									)}
								</Box>
							</Box>
						</Box>
						{/* 底部 */}
						<Flex
							align="center"
							justify="between"
							className={styles.labelFilterFooter}
						>
							<Text className={styles.labelFilterSummary}>
							筛选逻辑: 同时满足必要条件与充分条件
						</Text>
							<Button
								size="1"
								variant="soft"
								color="gray"
								onClick={() => {
									setSufficientLabels([]);
									setNecessaryLabels([]);
								}}
								disabled={labelFilterTotal === 0}
							>
								清空全部
							</Button>
						</Flex>
					</Flex>
				</Card>
			</Box>
		)}
	</Box>
	);
};

export default ReviewPage;
