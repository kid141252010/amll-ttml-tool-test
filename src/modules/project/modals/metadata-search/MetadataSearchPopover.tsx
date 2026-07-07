import { GlobeSearch20Regular } from "@fluentui/react-icons";
import {
	Button,
	Checkbox,
	Flex,
	Popover,
	Spinner,
	Text,
} from "@radix-ui/themes";
import {
	candidateKey,
	type MetadataCandidate,
	type MetadataSearchResult,
	type MetadataValueKey,
	type MetadataValues,
} from "$/modules/project/logic/metadata-search";
import {
	buildMetadataCandidateValueItems,
	type MetadataMergePreviewItem,
	type MetadataRegionGroup,
} from "$/modules/project/logic/metadata-search/metadata-search-ui";
import styles from "../MetadataEditor.module.css";

interface MetadataSearchPopoverProps {
	open: boolean;
	setOpen: (open: boolean) => void;
	isSearching: boolean;
	result: MetadataSearchResult | null;
	selectedValueKeys: string[];
	previewOpen: boolean;
	setPreviewOpen: (open: boolean) => void;
	candidates: MetadataCandidate[];
	regionGroups: MetadataRegionGroup[];
	preview: MetadataMergePreviewItem[];
	messages: string[];
	runSearch: () => void;
	applySelection: (keys: string[]) => void;
	toggleValue: (key: string) => void;
	selectRecommended: () => void;
	metadataValueLabels: Record<keyof MetadataValues, string>;
	candidateTitle: (candidate: MetadataCandidate) => string;
	candidateMeta: (candidate: MetadataCandidate) => string;
	t: (
		key: string,
		fallback: string,
		options?: Record<string, unknown>,
	) => string;
}

export const MetadataSearchPopover = ({
	open,
	setOpen,
	isSearching,
	result,
	selectedValueKeys,
	previewOpen,
	setPreviewOpen,
	candidates,
	regionGroups,
	preview,
	messages,
	runSearch,
	applySelection,
	toggleValue,
	selectRecommended,
	metadataValueLabels,
	candidateTitle,
	candidateMeta,
	t,
}: MetadataSearchPopoverProps) => (
	<Popover.Root
		modal={isSearching}
		open={open}
		onOpenChange={(nextOpen) => {
			if (isSearching && !nextOpen) return;
			setOpen(nextOpen);
		}}
	>
		<Popover.Trigger
			style={{
				flex: "1 0 auto",
			}}
		>
			<Button
				variant="soft"
				type="button"
				onClick={(event) => {
					event.preventDefault();
					if (isSearching) return;
					void runSearch();
				}}
			>
				{isSearching ? <Spinner size="1" /> : <GlobeSearch20Regular />}
				{t("metadataDialog.search.action", "自动搜索元数据")}
			</Button>
		</Popover.Trigger>
		<Popover.Content
			className={styles.metadataSearchMenu}
			onInteractOutside={(event) => {
				if (isSearching) event.preventDefault();
			}}
			onPointerDownOutside={(event) => {
				if (isSearching) event.preventDefault();
			}}
		>
			{isSearching && (
				<div className={styles.metadataSearchStatus}>
					<Flex align="center" gap="2" wrap="wrap">
						<Spinner size="1" />
						{t("metadataDialog.search.searching", "正在搜索...")}
					</Flex>
				</div>
			)}
			{result &&
				(previewOpen ? (
					<MetadataMergePreview
						preview={preview}
						selectedValueKeys={selectedValueKeys}
						setPreviewOpen={setPreviewOpen}
						applySelection={applySelection}
						metadataValueLabels={metadataValueLabels}
						t={t}
					/>
				) : (
					<MetadataSearchResults
						result={result}
						selectedValueKeys={selectedValueKeys}
						candidates={candidates}
						regionGroups={regionGroups}
						messages={messages}
						setPreviewOpen={setPreviewOpen}
						toggleValue={toggleValue}
						selectRecommended={selectRecommended}
						metadataValueLabels={metadataValueLabels}
						candidateTitle={candidateTitle}
						candidateMeta={candidateMeta}
						t={t}
					/>
				))}
		</Popover.Content>
	</Popover.Root>
);

const MetadataMergePreview = ({
	preview,
	selectedValueKeys,
	setPreviewOpen,
	applySelection,
	metadataValueLabels,
	t,
}: {
	preview: MetadataMergePreviewItem[];
	selectedValueKeys: string[];
	setPreviewOpen: (open: boolean) => void;
	applySelection: (keys: string[]) => void;
	metadataValueLabels: Record<keyof MetadataValues, string>;
	t: MetadataSearchPopoverProps["t"];
}) => (
	<>
		<div className={styles.metadataSearchToolbar}>
			<Flex justify="between" align="center" gap="2" wrap="wrap">
				<Text size="2" weight="bold">
					{t("metadataDialog.search.previewTitle", "合并预览")}
				</Text>
				<Flex gap="2" wrap="wrap">
					<Button
						size="1"
						variant="soft"
						color="gray"
						onClick={() => setPreviewOpen(false)}
					>
						{t("metadataDialog.search.backToSelection", "返回选择")}
					</Button>
					<Button
						size="1"
						disabled={selectedValueKeys.length === 0}
						onClick={() => applySelection(selectedValueKeys)}
					>
						{t("metadataDialog.search.confirmApply", "确认应用")}
					</Button>
				</Flex>
			</Flex>
		</div>
		{preview.length > 0 ? (
			<div className={styles.metadataPreviewList}>
				{preview.map((item) => (
					<div className={styles.metadataPreviewItem} key={item.key}>
						<Text size="1" weight="bold">
							{metadataValueLabels[item.key]}
						</Text>
						{item.added.length > 0 && (
							<Text size="1" color="green" wrap="wrap">
								{t("metadataDialog.search.previewAdded", "新增")}:{" "}
								{item.added.join(" / ")}
							</Text>
						)}
						{item.skipped.length > 0 && (
							<Text size="1" color="gray" wrap="wrap">
								{t("metadataDialog.search.previewSkipped", "已存在，跳过")}:{" "}
								{item.skipped.join(" / ")}
							</Text>
						)}
					</div>
				))}
			</div>
		) : (
			<div className={styles.metadataSearchStatus}>
				<Text size="1" color="gray" wrap="wrap">
					{t(
						"metadataDialog.search.previewEmpty",
						"所选候选没有可新增的元数据",
					)}
				</Text>
			</div>
		)}
	</>
);

const MetadataSearchResults = ({
	result,
	selectedValueKeys,
	candidates,
	regionGroups,
	messages,
	setPreviewOpen,
	toggleValue,
	selectRecommended,
	metadataValueLabels,
	candidateTitle,
	candidateMeta,
	t,
}: {
	result: MetadataSearchResult;
	selectedValueKeys: string[];
	candidates: MetadataCandidate[];
	regionGroups: MetadataRegionGroup[];
	messages: string[];
	setPreviewOpen: (open: boolean) => void;
	toggleValue: (key: string) => void;
	selectRecommended: () => void;
	metadataValueLabels: Record<keyof MetadataValues, string>;
	candidateTitle: (candidate: MetadataCandidate) => string;
	candidateMeta: (candidate: MetadataCandidate) => string;
	t: MetadataSearchPopoverProps["t"];
}) => (
	<>
		<div className={styles.metadataSearchToolbar}>
			<Flex justify="between" align="center" gap="2" wrap="wrap">
				<Text size="1" color="gray">
					{t("metadataDialog.search.selectedCount", "已选 {count} 项", {
						count: selectedValueKeys.length,
					})}
				</Text>
				<Flex gap="2" wrap="wrap">
					{result.recommendedCandidateIds.length > 0 && (
						<Button size="1" variant="soft" onClick={selectRecommended}>
							{t("metadataDialog.search.selectRecommended", "选择推荐")}
						</Button>
					)}
					<Button
						size="1"
						variant="soft"
						disabled={selectedValueKeys.length === 0}
						onClick={() => setPreviewOpen(true)}
					>
						{t("metadataDialog.search.previewSelected", "预览已选")}
					</Button>
				</Flex>
			</Flex>
		</div>
		{messages.map((error) => (
			<div
				className={styles.metadataSearchMessage}
				key={`metadata-search-error-${error}`}
			>
				<Text color="orange" size="1" wrap="wrap">
					{error}
				</Text>
			</div>
		))}
		{messages.length > 0 && candidates.length > 0 && (
			<div className={styles.metadataSearchSeparator} />
		)}
		{regionGroups.map((group) => (
			<div
				className={styles.metadataSourceGroup}
				key={`metadata-search-region-${group.region}`}
			>
				<div className={styles.metadataSourceHeader}>
					<Text size="1" weight="bold">
						{group.region}
					</Text>
				</div>
				{group.candidates.slice(0, 12).map((candidate) => (
					<MetadataCandidateCard
						key={candidateKey(candidate)}
						candidate={candidate}
						selectedValueKeys={selectedValueKeys}
						toggleValue={toggleValue}
						metadataValueLabels={metadataValueLabels}
						candidateTitle={candidateTitle}
						candidateMeta={candidateMeta}
					/>
				))}
			</div>
		))}
		{candidates.length === 0 && messages.length === 0 && (
			<div className={styles.metadataSearchStatus}>
				{t("metadataDialog.search.noCandidates", "未找到可用候选")}
			</div>
		)}
	</>
);

const MetadataCandidateCard = ({
	candidate,
	selectedValueKeys,
	toggleValue,
	metadataValueLabels,
	candidateTitle,
	candidateMeta,
}: {
	candidate: MetadataCandidate;
	selectedValueKeys: string[];
	toggleValue: (key: string) => void;
	metadataValueLabels: Record<MetadataValueKey, string>;
	candidateTitle: (candidate: MetadataCandidate) => string;
	candidateMeta: (candidate: MetadataCandidate) => string;
}) => {
	const valueItems = buildMetadataCandidateValueItems([candidate]);
	const selected = valueItems.some((item) =>
		selectedValueKeys.includes(item.id),
	);
	return (
		<div
			className={styles.metadataCandidateItem}
			data-selected={selected ? "true" : undefined}
		>
			<Flex direction="column" gap="2" style={{ minWidth: 0 }}>
				<Flex direction="column" gap="1" style={{ minWidth: 0 }}>
					<Text size="2" weight="medium" wrap="wrap">
						{candidateTitle(candidate)}
					</Text>
					<Text size="1" color="gray" wrap="wrap">
						{candidateMeta(candidate)}
					</Text>
				</Flex>
				<div className={styles.metadataCandidateValueList}>
					{valueItems.map((item) => {
						const valueSelected = selectedValueKeys.includes(item.id);
						return (
							<label
								key={item.id}
								className={styles.metadataCandidateValueItem}
								data-selected={valueSelected ? "true" : undefined}
							>
								<div className={styles.metadataCandidateValueText}>
									<Text
										className={styles.metadataCandidateValueKey}
										size="1"
										weight="bold"
										wrap="wrap"
									>
										{metadataValueLabels[item.key]}
									</Text>
									<Text
										className={styles.metadataCandidateValueValue}
										size="1"
										color="gray"
										wrap="wrap"
									>
										{item.value}
									</Text>
								</div>
								<Checkbox
									checked={valueSelected}
									onCheckedChange={() => toggleValue(item.id)}
								/>
							</label>
						);
					})}
				</div>
			</Flex>
		</div>
	);
};
