import type { Draft } from 'immer';
import type { PrimitiveAtom, WritableAtom } from 'jotai/vanilla';
export declare function withImmer<Value, Args extends unknown[], Result>(anAtom: WritableAtom<Value, Args, Result>): WritableAtom<Value, Args extends [Value | infer OtherValue] ? [
    Value | ((draft: Draft<Value>) => void) | Exclude<OtherValue, (...args: never[]) => unknown>
] : unknown[], Result>;
export declare function withImmer<Value>(anAtom: PrimitiveAtom<Value>): WritableAtom<Value, [Value | ((draft: Draft<Value>) => void)], void>;
