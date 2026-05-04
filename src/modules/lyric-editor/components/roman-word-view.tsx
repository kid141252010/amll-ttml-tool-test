import { Button, TextField } from "@radix-ui/themes";
import classNames from "classnames";
import { type Atom, useAtom, useAtomValue, type WritableAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { applyGeneratedRuby } from "$/modules/lyric-editor/utils/ruby-generator";
import { getRomanWordEditState } from "$/modules/lyric-editor/utils/word-romanization";
import { amllAutoGenerateRubyFromRomanizationAtom } from "$/modules/settings/states/amll";
import { lyricLinesAtom } from "$/states/main";
import type { LyricWord } from "$/types/ttml";
import styles from "./roman-word-view.module.css";

interface RomanWordViewProps {
	wordAtom: Atom<LyricWord>;
	wordIndex: number;
	editingIndexAtom: WritableAtom<number | null, [number | null], void>;
	suggestedRoman?: string;
}

export const RomanWordView = ({
	wordAtom,
	wordIndex,
	editingIndexAtom,
	suggestedRoman,
}: RomanWordViewProps) => {
	const word = useAtomValue(wordAtom);
	const [editingIndex, setEditingIndex] = useAtom(editingIndexAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const autoGenerateRubyFromRomanization = useAtomValue(
		amllAutoGenerateRubyFromRomanizationAtom,
	);
	const [inputValue, setInputValue] = useState(word.romanWord);
	const inputRef = useRef<HTMLInputElement>(null);

	const isEditing = editingIndex === wordIndex;

	const saveAndStopEditing = useCallback(
		(newValue: string) => {
			if (newValue !== word.romanWord) {
				editLyricLines((draft) => {
					for (const line of draft.lyricLines) {
						const wordIndex = line.words.findIndex((w) => w.id === word.id);
						if (wordIndex === -1) continue;
						const targetWord = line.words[wordIndex];
						targetWord.romanWord = newValue;
						if (autoGenerateRubyFromRomanization) {
							applyGeneratedRuby(targetWord, {
								lineWords: line.words,
								wordIndex,
							});
						}
						break;
					}
				});
			}
			setEditingIndex(null);
		},
		[
			word.id,
			word.romanWord,
			editLyricLines,
			setEditingIndex,
			autoGenerateRubyFromRomanization,
		],
	);

	useEffect(() => {
		if (isEditing) {
			setInputValue(
				getRomanWordEditState(word.romanWord, suggestedRoman).value,
			);
		}
	}, [isEditing, word.romanWord, suggestedRoman]);

	useEffect(() => {
		if (isEditing) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isEditing]);

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		const value = e.currentTarget.value;
		switch (e.key) {
			case "Enter":
			case "Tab":
				e.preventDefault();
				saveAndStopEditing(value);
				setEditingIndex(wordIndex + 1);
				break;
			case "Escape":
				e.preventDefault();
				setEditingIndex(null);
				break;
			case "Backspace":
				if (value === "") {
					e.preventDefault();
					saveAndStopEditing("");
					setEditingIndex(wordIndex - 1);
				}
				break;
			default:
				break;
		}
	};

	if (isEditing) {
		return (
			<TextField.Root
				ref={inputRef}
				size="1"
				className={classNames(
					styles.romanWordView,
					word.romanWarning && styles.warning,
				)}
				value={inputValue}
				placeholder={
					getRomanWordEditState(word.romanWord, suggestedRoman).placeholder
				}
				onChange={(e) => setInputValue(e.currentTarget.value)}
				onBlur={(e) => saveAndStopEditing(e.currentTarget.value)}
				onKeyDown={handleKeyDown}
			/>
		);
	}

	return (
		<Button
			size="1"
			variant="soft"
			color="gray"
			className={classNames(
				styles.romanWordView,
				!word.romanWord && styles.placeholder,
				word.romanWarning && styles.warning,
			)}
			onClick={(e) => {
				e.stopPropagation();
				setEditingIndex(wordIndex);
			}}
		>
			{word.romanWord || ""}
		</Button>
	);
};
