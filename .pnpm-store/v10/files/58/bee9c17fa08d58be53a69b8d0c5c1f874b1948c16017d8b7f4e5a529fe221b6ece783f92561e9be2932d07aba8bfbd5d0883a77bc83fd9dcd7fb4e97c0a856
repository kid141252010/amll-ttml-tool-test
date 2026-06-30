import { useAtomValue } from 'jotai/react';
import { useSetImmerAtom } from './useSetImmerAtom.js';
export function useImmerAtom(anAtom, options) {
    return [useAtomValue(anAtom, options), useSetImmerAtom(anAtom, options)];
}
