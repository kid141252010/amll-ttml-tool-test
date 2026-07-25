import {
	extractMentions,
	type ReviewLabel,
	type ReviewPullRequest,
} from "./card-service";

export const applyReviewFilters = (options: {
	items: ReviewPullRequest[];
	hiddenLabelSet: Set<string>;
	pendingChecked: boolean;
	updatedChecked: boolean;
	hasPendingLabel: (labels: ReviewLabel[]) => boolean;
	postPendingCommitMap: Record<number, boolean>;
	sufficientLabels: string[];
	necessaryLabels: string[];
	selectedUser: string | null;
}) => {
	const visibleItems = options.items.filter(
		(pr) =>
			!pr.labels.some((label) =>
				options.hiddenLabelSet.has(label.name.toLowerCase()),
			),
	);
	const statusFilteredItems = visibleItems.filter((pr) => {
		if (!options.pendingChecked && !options.updatedChecked) return true;
		const isPending = options.hasPendingLabel(pr.labels);
		const isUpdated =
			isPending && options.postPendingCommitMap[pr.number] === true;
		const pendingMatch = isPending && !isUpdated;
		const updatedMatch = isUpdated;
		if (options.pendingChecked && options.updatedChecked)
			return pendingMatch || updatedMatch;
		if (options.pendingChecked) return pendingMatch;
		if (options.updatedChecked) return updatedMatch;
		return true;
	});
	// 标签筛选逻辑:
	// - 充分条件非空: PR 必须包含至少一个充分标签
	// - 必要条件非空: PR 必须包含全部必要标签
	// - 两者取 AND; 两者都为空则不做标签筛选
	const sufficientSet = new Set(
		options.sufficientLabels.map((label) => label.toLowerCase()),
	);
	const necessarySet = new Set(
		options.necessaryLabels.map((label) => label.toLowerCase()),
	);
	const labelFilteredItems =
		sufficientSet.size === 0 && necessarySet.size === 0
			? statusFilteredItems
			: statusFilteredItems.filter((pr) => {
					const prLabelNames = pr.labels.map((label) =>
						label.name.toLowerCase(),
					);
					const prLabelSet = new Set(prLabelNames);
					const meetsNecessary =
						necessarySet.size === 0 ||
						Array.from(necessarySet).every((label) =>
							prLabelSet.has(label),
						);
					const meetsSufficient =
						sufficientSet.size === 0 ||
						Array.from(sufficientSet).some((label) =>
							prLabelSet.has(label),
						);
					return meetsNecessary && meetsSufficient;
				});
	if (!options.selectedUser) return labelFilteredItems;
	const selectedUserLower = options.selectedUser.toLowerCase();
	return labelFilteredItems.filter((pr) =>
		extractMentions(pr.body).some(
			(name) => name.toLowerCase() === selectedUserLower,
		),
	);
};
