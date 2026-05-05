import { Button, TextField } from "@radix-ui/themes";
import classNames from "classnames";
import {
	type Atom,
	useAtom,
	useAtomValue,
	useSetAtom,
	type WritableAtom,
} from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { applyGeneratedRuby } from "$/modules/lyric-editor/utils/ruby-generator";
import {
	createRomanWordEditSession,
	getRomanWordEditState,
	type RomanWordEditSession,
} from "$/modules/lyric-editor/utils/word-romanization";
import {
	getPreferredWordRomanizationLang,
	syncWordRomanizationForWord,
} from "$/modules/lyric-editor/utils/word-romanization-language";
import { amllAutoGenerateRubyFromRomanizationAtom } from "$/modules/settings/states/amll";
import {
	currentWordRomanizationLangAtom,
	isEditingWordRomanizationAtom,
	lyricLinesAtom,
} from "$/states/main";
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
	const lyricLines = useAtomValue(lyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const currentWordRomanizationLang = useAtomValue(
		currentWordRomanizationLangAtom,
	);
	const setCurrentWordRomanizationLang = useSetAtom(
		currentWordRomanizationLangAtom,
	);
	const setIsEditingWordRomanization = useSetAtom(
		isEditingWordRomanizationAtom,
	);
	const autoGenerateRubyFromRomanization = useAtomValue(
		amllAutoGenerateRubyFromRomanizationAtom,
	);
	const [inputValue, setInputValue] = useState(word.romanWord);
	const inputRef = useRef<HTMLInputElement>(null);
	const inputValueRef = useRef(inputValue);
	const lyricLinesRef = useRef(lyricLines);
	const currentWordRomanizationLangRef = useRef(currentWordRomanizationLang);
	const wordRomanWordRef = useRef(word.romanWord);
	const suggestedRomanRef = useRef(suggestedRoman);
	const editSessionRef = useRef<RomanWordEditSession | null>(null);
	const commitRomanWordRef = useRef(
		(_newValue: string, _stopEditing?: boolean) => {},
	);

	const isEditing = editingIndex === wordIndex;

	useEffect(() => {
		inputValueRef.current = inputValue;
	}, [inputValue]);

	useEffect(() => {
		lyricLinesRef.current = lyricLines;
	}, [lyricLines]);

	useEffect(() => {
		currentWordRomanizationLangRef.current = currentWordRomanizationLang;
	}, [currentWordRomanizationLang]);

	useEffect(() => {
		wordRomanWordRef.current = word.romanWord;
	}, [word.romanWord]);

	useEffect(() => {
		suggestedRomanRef.current = suggestedRoman;
	}, [suggestedRoman]);

	const commitRomanWord = useCallback(
		(newValue: string, stopEditing = true) => {
			const session = editSessionRef.current;
			if (!session?.tryCommit()) {
				if (stopEditing) setEditingIndex(null);
				return;
			}

			setIsEditingWordRomanization(false);
			setCurrentWordRomanizationLang(session.lang);
			if (newValue !== word.romanWord) {
				editLyricLines((draft) => {
					for (const line of draft.lyricLines) {
						const wordIndex = line.words.findIndex((w) => w.id === word.id);
						if (wordIndex === -1) continue;
						const targetWord = line.words[wordIndex];
						syncWordRomanizationForWord(
							line,
							targetWord,
							newValue,
							session.lang,
						);
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
			if (stopEditing) setEditingIndex(null);
		},
		[
			word.id,
			word.romanWord,
			editLyricLines,
			setEditingIndex,
			autoGenerateRubyFromRomanization,
			setCurrentWordRomanizationLang,
			setIsEditingWordRomanization,
		],
	);

	useEffect(() => {
		commitRomanWordRef.current = commitRomanWord;
	}, [commitRomanWord]);

	useEffect(() => {
		if (!isEditing) return;

		const targetLang = getPreferredWordRomanizationLang(
			lyricLinesRef.current,
			currentWordRomanizationLangRef.current,
		);
		const session = createRomanWordEditSession(targetLang);
		editSessionRef.current = session;
		setCurrentWordRomanizationLang(targetLang);
		setIsEditingWordRomanization(true);

		const nextInputValue = getRomanWordEditState(
			wordRomanWordRef.current,
			suggestedRomanRef.current,
		).value;
		inputValueRef.current = nextInputValue;
		setInputValue(nextInputValue);
		inputRef.current?.focus();
		inputRef.current?.select();

		return () => {
			if (editSessionRef.current !== session) return;
			if (session.shouldAutoCommit()) {
				commitRomanWordRef.current(inputValueRef.current, false);
			}
			editSessionRef.current = null;
			setIsEditingWordRomanization(false);
		};
	}, [
		isEditing,
		setCurrentWordRomanizationLang,
		setIsEditingWordRomanization,
	]);

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		const value = e.currentTarget.value;
		switch (e.key) {
			case "Enter":
			case "Tab":
				e.preventDefault();
				commitRomanWord(value, false);
				setEditingIndex(wordIndex + 1);
				break;
			case "Escape":
				e.preventDefault();
				editSessionRef.current?.cancel();
				setIsEditingWordRomanization(false);
				setEditingIndex(null);
				break;
			case "Backspace":
				if (value === "") {
					e.preventDefault();
					commitRomanWord("", false);
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
				onChange={(e) => {
					inputValueRef.current = e.currentTarget.value;
					setInputValue(e.currentTarget.value);
				}}
				onBlur={(e) => commitRomanWord(e.currentTarget.value)}
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
