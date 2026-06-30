import { useCallback } from 'react';
import { produce } from 'immer';
import { useSetAtom } from 'jotai/react';
export function useSetImmerAtom(anAtom, options) {
    const setState = useSetAtom(anAtom, options);
    return useCallback((fn) => setState(produce(fn)), [setState]);
}
