import { useCallback, useEffect, useRef, useState } from "react";

export type UseSettingsHistoryOptions<T> = {
  value: T;
  onChange: (value: T) => void;
  maxHistory?: number;
  isEqual?: (a: T, b: T) => boolean;
};

export type UseSettingsHistoryResult = {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
};

/**
 * Manages undo/redo state for setting values.
 */
export const useSettingsHistory = <T,>({
  value,
  onChange,
  maxHistory = 50,
  isEqual = Object.is
}: UseSettingsHistoryOptions<T>): UseSettingsHistoryResult => {
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);
  const lastValueRef = useRef<T>(value);

  useEffect(() => {
    if (isEqual(lastValueRef.current, value)) {
      return;
    }

    setPast((entries) => {
      const next = [...entries, lastValueRef.current];
      return next.slice(Math.max(0, next.length - maxHistory));
    });
    setFuture([]);
    lastValueRef.current = value;
  }, [value, maxHistory, isEqual]);

  const undo = useCallback(() => {
    setPast((entries) => {
      if (entries.length === 0) {
        return entries;
      }

      const previous = entries[entries.length - 1];
      setFuture((current) => [lastValueRef.current, ...current]);
      onChange(previous);
      lastValueRef.current = previous;
      return entries.slice(0, -1);
    });
  }, [onChange]);

  const redo = useCallback(() => {
    setFuture((entries) => {
      if (entries.length === 0) {
        return entries;
      }

      const [next, ...rest] = entries;
      setPast((current) => [...current, lastValueRef.current]);
      onChange(next);
      lastValueRef.current = next;
      return rest;
    });
  }, [onChange]);

  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return {
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    clear
  };
};
