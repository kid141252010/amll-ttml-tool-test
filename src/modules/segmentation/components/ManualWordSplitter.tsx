/**
 * @description 手动分词组件
 */

import { Dismiss16Regular } from "@fluentui/react-icons";
import { Flex, IconButton } from "@radix-ui/themes";
import { Fragment, memo, useMemo } from "react";
import styles from "./ManualWordSplitter.module.css";

interface ManualWordSplitterProps {
	word: string;
	splitIndices: Set<number>;
	onSplitIndexToggle: (index: number) => void;
	onClearAllSplits?: () => void;
}

export const ManualWordSplitter = memo(
	({
		word,
		splitIndices,
		onSplitIndexToggle,
		onClearAllSplits,
	}: ManualWordSplitterProps) => {
		const manualGraphemes = useMemo(() => Array.from(word), [word]);
		const hasSplits = splitIndices.size > 0;

		return (
			<Flex
				align="center"
				justify="center"
				style={{
					backgroundColor: "var(--gray-4)",
					borderRadius: "var(--radius-2)",
					padding: "var(--space-4)",
					minHeight: "4em",
					userSelect: "none",
					overflowX: "auto",
					whiteSpace: "nowrap",
					position: "relative",
				}}
			>
				{hasSplits && onClearAllSplits && (
					<button
						type="button"
						style={{
							position: "absolute",
							top: "2px",
							right: "2px",
							width: "16px",
							height: "16px",
							padding: "0",
							border: "none",
							background: "transparent",
							cursor: "pointer",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "var(--red-9)",
						}}
						onClick={onClearAllSplits}
						title="清空所有分词"
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 12 12"
							fill="none"
							stroke="currentColor"
							strokeWidth="1"
							strokeLinecap="round"
						>
							<path d="M3 3L9 9M9 3L3 9" />
						</svg>
					</button>
				)}
				{manualGraphemes.map((grapheme, index) => (
					<Fragment
						key={`${grapheme}-${
							// biome-ignore lint/suspicious/noArrayIndexKey: 这个列表顺序不会在交互时发生变化
							index
						}`}
					>
						{index > 0 && (
							<button
								type="button"
								className={styles.manualSplitter}
								data-split={splitIndices.has(index)}
								onClick={() => onSplitIndexToggle(index)}
							/>
						)}
						<span className={styles.grapheme}>{grapheme}</span>
					</Fragment>
				))}
			</Flex>
		);
	},
);
