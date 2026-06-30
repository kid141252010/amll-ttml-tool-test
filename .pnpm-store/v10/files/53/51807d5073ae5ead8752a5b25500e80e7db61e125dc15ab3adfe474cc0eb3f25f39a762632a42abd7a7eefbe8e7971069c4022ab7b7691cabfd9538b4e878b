import type { Draft } from 'immer';
import { useAtomValue } from 'jotai/react';
import type { WritableAtom } from 'jotai/vanilla';
type Options = Parameters<typeof useAtomValue>[1];
export declare function useImmerAtom<Value, Result>(anAtom: WritableAtom<Value, [(draft: Draft<Value>) => void], Result>, options?: Options): [Value, (fn: (draft: Draft<Value>) => void) => Result];
export declare function useImmerAtom<Value, Result>(anAtom: WritableAtom<Value, [(value: Value) => Value], Result>, options?: Options): [Value, (fn: (draft: Draft<Value>) => void) => Result];
export {};
