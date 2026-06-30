import type { Draft } from 'immer';
import { useSetAtom } from 'jotai/react';
import type { WritableAtom } from 'jotai/vanilla';
type Options = Parameters<typeof useSetAtom>[1];
export declare function useSetImmerAtom<Value, Result>(anAtom: WritableAtom<Value, [(draft: Draft<Value>) => void], Result>, options?: Options): (fn: (draft: Draft<Value>) => void) => Result;
export declare function useSetImmerAtom<Value, Result>(anAtom: WritableAtom<Value, [(value: Value) => Value], Result>, options?: Options): (fn: (draft: Draft<Value>) => void) => Result;
export {};
