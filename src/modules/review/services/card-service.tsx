import {
	Checkmark20Regular,
	Clock20Regular,
	Copy20Regular,
	Person20Regular,
} from "@fluentui/react-icons";
import { Box, Button, Flex, IconButton, Text } from "@radix-ui/themes";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { pushNotificationAtom } from "$/states/notifications";

export type ReviewLabel = {
	name: string;
	color: string;
};

export type ReviewPullRequest = {
	number: number;
	title: string;
	body: string;
	createdAt: string;
	labels: ReviewLabel[];
};

export type ReviewMetadata = {
	musicName: string[];
	artists: string[];
	album: string[];
	ncmId: string[];
	qqMusicId: string[];
	spotifyId: string[];
	appleMusicId: string[];
	remark: string[];
};

export const extractMentions = (body: string) => {
	const matches = [...body.matchAll(/@([a-zA-Z0-9-]+)/g)];
	const names = matches.map((match) => match[1]).filter(Boolean);
	return Array.from(new Set(names));
};

export function parseReviewMetadata(body: string): ReviewMetadata {
	const result: ReviewMetadata = {
		musicName: [],
		artists: [],
		album: [],
		ncmId: [],
		qqMusicId: [],
		spotifyId: [],
		appleMusicId: [],
		remark: [],
	};
	type MetadataKey = Exclude<keyof ReviewMetadata, "remark">;
	const pushValues = (key: MetadataKey, value: string) => {
		const cleaned = value
			.replace(/^[-*]\s+/, "")
			.replace(/^\[[ xX]\]\s*/, "")
			.replace(/^>\s*/, "")
			.replace(/`/g, "")
			.trim();
		if (!cleaned) return;
		const values = cleaned
			.split(/[，,]/)
			.map((item) => item.trim())
			.filter(Boolean);
		result[key].push(...values);
	};
	const pushRemarkLines = (value: string) => {
		const lines = value.split(/\r?\n/).map((line) => line.trimEnd());
		while (lines.length > 0 && !lines[0]?.trim()) lines.shift();
		while (lines.length > 0 && !lines[lines.length - 1]?.trim()) lines.pop();
		result.remark.push(...lines);
	};
	const getKeyFromText = (text: string) => {
		const normalized = text.replace(/\s/g, "").toLowerCase();
		if (normalized.includes("音乐名称") || normalized.includes("歌名")) {
			return "musicName" as const;
		}
		if (
			normalized.includes("音乐作者") ||
			normalized.includes("歌手") ||
			normalized.includes("艺术家")
		) {
			return "artists" as const;
		}
		if (normalized.includes("音乐专辑") || normalized.includes("专辑")) {
			return "album" as const;
		}
		if (
			normalized.includes("网易云音乐id") ||
			(normalized.includes("网易云音乐") && normalized.includes("id"))
		) {
			return "ncmId" as const;
		}
		if (
			normalized.includes("qq音乐id") ||
			(normalized.includes("qq音乐") && normalized.includes("id"))
		) {
			return "qqMusicId" as const;
		}
		if (normalized.includes("spotifyid")) {
			return "spotifyId" as const;
		}
		if (normalized.includes("applemusicid")) {
			return "appleMusicId" as const;
		}
		if (normalized.includes("备注")) {
			return "remark" as const;
		}
		return null;
	};
	const headingPattern = /^###\s+(.+?)\s*$/gm;
	const headings = [...body.matchAll(headingPattern)];
	const remarkHeading = headings.find(
		(match) => getKeyFromText(match[1] ?? "") === "remark",
	);
	const remarkIndex = remarkHeading?.index ?? -1;
	const metadataBody = remarkIndex >= 0 ? body.slice(0, remarkIndex) : body;
	if (remarkHeading && remarkIndex >= 0) {
		pushRemarkLines(body.slice(remarkIndex + remarkHeading[0].length));
	}
	const sections = [...metadataBody.matchAll(headingPattern)];
	for (let index = 0; index < sections.length; index += 1) {
		const section = sections[index];
		const sectionIndex = section.index ?? 0;
		const key = getKeyFromText(section[1] ?? "");
		if (!key || key === "remark") continue;
		const contentStart = sectionIndex + section[0].length;
		const contentEnd = sections[index + 1]?.index ?? metadataBody.length;
		const content = metadataBody.slice(contentStart, contentEnd);
		for (const line of content.split(/\r?\n/)) {
			pushValues(key, line);
		}
	}
	return result;
}

export const formatTimeAgo = (iso: string) => {
	const target = new Date(iso).getTime();
	const now = Date.now();
	const diff = Math.max(0, now - target);
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return "刚刚";
	if (minutes < 60) return `${minutes}分钟前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}小时前`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}天前`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months}个月前`;
	const years = Math.floor(months / 12);
	return `${years}年前`;
};

export const getLabelTextColor = (hex: string) => {
	const cleaned = hex.replace("#", "");
	const r = Number.parseInt(cleaned.slice(0, 2), 16) || 0;
	const g = Number.parseInt(cleaned.slice(2, 4), 16) || 0;
	const b = Number.parseInt(cleaned.slice(4, 6), 16) || 0;
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.6 ? "#1f1f1f" : "#ffffff";
};

const MetaValueChip = ({
	value,
	styles,
}: {
	value: string;
	styles: Record<string, string>;
}) => {
	const [copied, setCopied] = useState(false);
	const pushNotification = useSetAtom(pushNotificationAtom);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			pushNotification({
				title: "已复制到剪贴板",
				description: value,
				level: "success",
				source: "审阅",
			});
			setTimeout(() => setCopied(false), 2000);
		} catch (e) {
			console.error("Failed to copy:", e);
			pushNotification({
				title: "复制失败",
				description: String(e),
				level: "error",
				source: "审阅",
			});
		}
	};

	return (
		<Flex
			align="center"
			gap="1"
			className={styles.metaChip}
			style={{ display: "inline-flex" }}
		>
			<Text size="2">{value}</Text>
			<IconButton
				size="1"
				variant="ghost"
				color={copied ? "green" : "gray"}
				onClick={handleCopy}
				title={copied ? "已复制" : "复制"}
			>
				<Copy20Regular className={styles.icon} />
			</IconButton>
		</Flex>
	);
};

export const renderMetaValues = (
	values: string[],
	styles: Record<string, string>,
) => {
	if (values.length === 0) {
		return (
			<Text size="2" color="gray">
				（这里什么都没有……）
			</Text>
		);
	}
	return values.map((value) => (
		<MetaValueChip key={value} value={value} styles={styles} />
	));
};

export const renderCardContent = (options: {
	pr: ReviewPullRequest;
	hiddenLabelSet: Set<string>;
	styles: Record<string, string>;
	reviewedByUser?: boolean;
	onSelectUser?: (user: string) => void;
}) => {
	const mentions = extractMentions(options.pr.body);
	const visibleLabels = options.pr.labels.filter(
		(label) => !options.hiddenLabelSet.has(label.name.toLowerCase()),
	);
	return (
		<Flex direction="column" gap="2">
			<Flex align="center" justify="between">
				<Flex align="center" gap="1">
					<Text size="2" weight="medium">
						#{options.pr.number}
					</Text>
					{options.reviewedByUser && (
						<Checkmark20Regular className={options.styles.icon} />
					)}
				</Flex>
				<Flex align="center" gap="1" className={options.styles.meta}>
					<Clock20Regular className={options.styles.icon} />
					<Text size="1" color="gray" className={options.styles.timeText}>
						{formatTimeAgo(options.pr.createdAt)}
					</Text>
				</Flex>
			</Flex>
			<Text size="3" className={options.styles.title} title={options.pr.title}>
				{options.pr.title}
			</Text>
			<Flex align="center" gap="2" className={options.styles.mentions}>
				<Person20Regular className={options.styles.icon} />
				{mentions.length > 0 ? (
					<Flex align="center" gap="1" wrap="wrap">
						{mentions.map((name) =>
							options.onSelectUser ? (
								<Button
									key={name}
									size="1"
									variant="soft"
									color="gray"
									onClick={(event) => {
										event.stopPropagation();
										options.onSelectUser?.(name);
									}}
									asChild
								>
									<span>@{name}</span>
								</Button>
							) : (
								<Text key={name} size="2" color="gray" asChild>
									<span>@{name}</span>
								</Text>
							),
						)}
					</Flex>
				) : (
					<Text size="2" color="gray">
						未提到用户
					</Text>
				)}
			</Flex>
			<Flex wrap="wrap" gap="2">
				{visibleLabels.length > 0 ? (
					visibleLabels.map((label) => (
						<Box
							key={label.name}
							className={options.styles.label}
							style={{
								backgroundColor: `#${label.color}`,
								color: getLabelTextColor(label.color),
							}}
						>
							<Text size="1">{label.name}</Text>
						</Box>
					))
				) : (
					<Text size="1" color="gray">
						无标签
					</Text>
				)}
			</Flex>
		</Flex>
	);
};
