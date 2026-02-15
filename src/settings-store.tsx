import { useContext, useMemo, useRef, useSyncExternalStore, type ReactElement, type ReactNode } from "react";
import { createContext } from "react";

export type SettingsChangeEvent<TState> = {
  path: string;
  value: unknown;
  previousValue: unknown;
  state: TState;
};

export type SettingsStateChangeEvent<TState> = {
  source: "set" | "setState" | "reset" | "hydrate" | "import" | "sync";
  state: TState;
  previousState: TState;
  path?: string;
  value?: unknown;
  previousValue?: unknown;
};

export type SettingsActionContext<TState> = {
  getState: () => TState;
  setState: (updater: TState | ((current: TState) => TState)) => void;
  reset: () => void;
  get: <TValue = unknown>(path: string) => TValue | undefined;
  set: (path: string, value: unknown) => void;
};

export type SettingsActionHandler<TState> = (
  payload: unknown,
  context: SettingsActionContext<TState>
) => void | Promise<void>;

export type SettingsActionEvent<TState> = {
  type: string;
  payload: unknown;
  state: TState;
};

export type SettingsPersistenceAdapter<TState> = {
  load: () => TState | null | Promise<TState | null>;
  loadSync?: () => TState | null;
  save: (state: TState) => void | Promise<void>;
};

export type SettingsImportStrategy = "replace" | "merge" | "skip-conflicts";

export type SettingsImportOptions<TState> = {
  strategy?: SettingsImportStrategy;
  deserialize?: (blob: string) => unknown;
  validate?: (candidate: unknown) => candidate is TState;
};

export type SettingsImportResult = {
  applied: boolean;
  strategy: SettingsImportStrategy;
  conflicts: string[];
};

export type SettingsSyncAdapter<TState> = {
  pull?: () => TState | null | Promise<TState | null>;
  push: (state: TState) => void | Promise<void>;
  subscribe?: (listener: (state: TState) => void) => (() => void) | void;
  merge?: (current: TState, incoming: TState) => TState;
  validate?: (candidate: unknown) => candidate is TState;
  onError?: (error: unknown) => void;
};

export type CreateSettingsStoreOptions<TState> = {
  initialState: TState;
  persistence?: SettingsPersistenceAdapter<TState>;
  onChange?: (event: SettingsChangeEvent<TState>) => void;
  onStateChange?: (event: SettingsStateChangeEvent<TState>) => void;
  actions?: Record<string, SettingsActionHandler<TState>>;
  onAction?: (event: SettingsActionEvent<TState>) => void;
};

export type SettingsStore<TState> = {
  getInitialState: () => TState;
  getState: () => TState;
  setState: (updater: TState | ((current: TState) => TState)) => void;
  reset: () => void;
  subscribe: (listener: () => void) => () => void;
  get: {
    <P extends Path<TState>>(path: P): PathValue<TState, P> | undefined;
    <TValue = unknown>(path: string): TValue | undefined;
  };
  set: {
    <P extends Path<TState>>(path: P, value: PathValue<TState, P>): void;
    (path: string, value: unknown): void;
  };
  hydrate: () => Promise<void>;
  exportSettings: (serialize?: (state: TState) => string) => string;
  importSettings: (
    blob: string | unknown,
    options?: SettingsImportOptions<TState>
  ) => SettingsImportResult;
  syncSettings: (adapter: SettingsSyncAdapter<TState>) => Promise<() => void>;
  dispatch: (type: string, payload?: unknown) => Promise<void>;
};

type UnknownObject = Record<string, unknown>;
type Primitive = string | number | boolean | bigint | symbol | null | undefined | Date;

export type Path<T> = T extends Primitive
  ? never
  : {
      [K in keyof T & string]: T[K] extends Primitive
        ? K
        : K | `${K}.${Path<T[K]>}`;
    }[keyof T & string];

export type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

const isObject = (value: unknown): value is UnknownObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parsePath = (path: string): string[] =>
  path
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

const getByPath = <TValue = unknown,>(input: unknown, path: string): TValue | undefined => {
  const parts = parsePath(path);
  if (parts.length === 0) {
    return input as TValue;
  }

  let current: unknown = input;
  for (const part of parts) {
    if (!isObject(current) || !(part in current)) {
      return undefined;
    }

    current = current[part];
  }

  return current as TValue;
};

const setByPath = <TState extends UnknownObject>(state: TState, path: string, value: unknown): TState => {
  const parts = parsePath(path);
  if (parts.length === 0) {
    return state;
  }

  const cloneRoot: UnknownObject = { ...state };
  let cursor: UnknownObject = cloneRoot;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const next = cursor[key];
    const branch = isObject(next) ? { ...next } : {};
    cursor[key] = branch;
    cursor = branch;
  }

  cursor[parts[parts.length - 1]] = value;
  return cloneRoot as TState;
};

const deepMerge = <TState extends UnknownObject>(base: TState, incoming: TState): TState => {
  const mergeNode = (left: unknown, right: unknown): unknown => {
    if (Array.isArray(right)) {
      return [...right];
    }

    if (!isObject(right)) {
      return right;
    }

    if (!isObject(left)) {
      return { ...right };
    }

    const output: UnknownObject = { ...left };
    for (const [key, value] of Object.entries(right)) {
      output[key] = mergeNode(output[key], value);
    }
    return output;
  };

  return mergeNode(base, incoming) as TState;
};

const mergeSkippingConflicts = <TState extends UnknownObject>(
  current: TState,
  incoming: TState
): { state: TState; conflicts: string[] } => {
  const conflicts: string[] = [];

  const mergeNode = (left: unknown, right: unknown, path: string): unknown => {
    if (Object.is(left, right)) {
      return left;
    }

    if (Array.isArray(right)) {
      if (left === undefined) {
        return [...right];
      }
      conflicts.push(path);
      return left;
    }

    if (!isObject(right)) {
      if (left === undefined) {
        return right;
      }
      conflicts.push(path);
      return left;
    }

    if (!isObject(left)) {
      if (left === undefined) {
        return { ...right };
      }
      conflicts.push(path);
      return left;
    }

    const output: UnknownObject = { ...left };
    for (const [key, value] of Object.entries(right)) {
      const nextPath = path ? `${path}.${key}` : key;
      output[key] = mergeNode(output[key], value, nextPath);
    }
    return output;
  };

  return {
    state: mergeNode(current, incoming, "") as TState,
    conflicts
  };
};

/**
 * Creates a composable settings store with optional persistence.
 */
export const createSettingsStore = <TState extends UnknownObject>({
  initialState,
  persistence,
  onChange,
  onStateChange,
  actions,
  onAction
}: CreateSettingsStoreOptions<TState>): SettingsStore<TState> => {
  let state = initialState;
  if (persistence?.loadSync) {
    const persisted = persistence.loadSync();
    if (persisted) {
      state = persisted;
    }
  }
  const listeners = new Set<() => void>();
  const syncAdapters = new Set<SettingsSyncAdapter<TState>>();

  const notify = (): void => {
    listeners.forEach((listener) => listener());
  };

  const persist = (nextState: TState): void => {
    if (!persistence) {
      return;
    }

    void persistence.save(nextState);
  };

  const syncPush = (nextState: TState): void => {
    syncAdapters.forEach((adapter) => {
      Promise.resolve(adapter.push(nextState)).catch((error) => {
        adapter.onError?.(error);
      });
    });
  };

  const commitState = (
    nextState: TState,
    event: Omit<SettingsStateChangeEvent<TState>, "state" | "previousState">,
    options?: { persist?: boolean; sync?: boolean }
  ): void => {
    if (Object.is(nextState, state)) {
      return;
    }

    const previousState = state;
    state = nextState;
    if (options?.persist ?? true) {
      persist(nextState);
    }
    if (options?.sync ?? true) {
      syncPush(nextState);
    }
    onStateChange?.({
      ...event,
      state: nextState,
      previousState
    });
    notify();
  };

  const setState: SettingsStore<TState>["setState"] = (updater) => {
    const nextState = typeof updater === "function" ? updater(state) : updater;
    commitState(nextState, { source: "setState" });
  };

  const store: SettingsStore<TState> = {
    getInitialState: () => initialState,
    getState: () => state,
    setState,
    reset: () => {
      commitState(initialState, { source: "reset" });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: ((path: string) => getByPath(state, path)) as SettingsStore<TState>["get"],
    set: ((path: string, value: unknown) => {
      const previousValue = getByPath(state, path);
      const nextState = setByPath(state, path, value);
      if (Object.is(previousValue, value)) {
        return;
      }

      commitState(nextState, {
        source: "set",
        path,
        value,
        previousValue
      });
      onChange?.({
        path,
        value,
        previousValue,
        state: nextState
      });
    }) as SettingsStore<TState>["set"],
    hydrate: async () => {
      if (!persistence) {
        return;
      }

      const persisted = await persistence.load();
      if (!persisted) {
        return;
      }

      commitState(persisted, { source: "hydrate" }, { persist: false, sync: false });
    },
    exportSettings: (serialize = JSON.stringify) => serialize(state),
    importSettings: (blob, options) => {
      const strategy = options?.strategy ?? "replace";
      const deserialize = options?.deserialize ?? ((raw: string) => JSON.parse(raw) as unknown);
      const candidate = typeof blob === "string" ? deserialize(blob) : blob;

      if (!isObject(candidate)) {
        throw new Error("Imported settings must be an object.");
      }

      if (options?.validate && !options.validate(candidate)) {
        throw new Error("Imported settings failed validation.");
      }

      const incoming = candidate as TState;
      let nextState = state;
      let conflicts: string[] = [];

      if (strategy === "replace") {
        nextState = incoming;
      } else if (strategy === "merge") {
        nextState = deepMerge(state, incoming);
      } else {
        const result = mergeSkippingConflicts(state, incoming);
        nextState = result.state;
        conflicts = result.conflicts;
      }

      const applied = !Object.is(nextState, state);
      if (applied) {
        commitState(nextState, { source: "import" });
      }

      return {
        applied,
        strategy,
        conflicts
      };
    },
    syncSettings: async (adapter) => {
      syncAdapters.add(adapter);
      let stopped = false;

      if (adapter.pull) {
        const incoming = await adapter.pull();
        if (incoming) {
          if (adapter.validate && !adapter.validate(incoming)) {
            throw new Error("Pulled settings failed sync adapter validation.");
          }

          const merged = adapter.merge ? adapter.merge(store.getState(), incoming) : incoming;
          commitState(merged, { source: "sync" }, { sync: false });
        }
      }

      const unsubscribe = adapter.subscribe?.((incoming) => {
        if (stopped) {
          return;
        }

        if (adapter.validate && !adapter.validate(incoming)) {
          return;
        }

        const merged = adapter.merge ? adapter.merge(store.getState(), incoming) : incoming;
        commitState(merged, { source: "sync" }, { sync: false });
      });

      return () => {
        stopped = true;
        syncAdapters.delete(adapter);
        unsubscribe?.();
      };
    },
    dispatch: async (type, payload) => {
      const action = actions?.[type];
      if (!action) {
        throw new Error(`No action registered for "${type}".`);
      }

      const context: SettingsActionContext<TState> = {
        getState: () => state,
        setState,
        reset: () => store.reset(),
        get: (path) => store.get(path),
        set: (path, value) => store.set(path, value)
      };

      await action(payload, context);
      onAction?.({
        type,
        payload,
        state
      });
    }
  };

  return store;
};

/**
 * Memory adapter useful for tests and demos.
 */
export const createMemorySettingsPersistence = <TState,>(
  seed: TState | null = null
): SettingsPersistenceAdapter<TState> => {
  let memory = seed;

  return {
    load: () => memory,
    loadSync: () => memory,
    save: (state) => {
      memory = state;
    }
  };
};

/**
 * localStorage adapter for persisted settings.
 */
export const createLocalStorageSettingsPersistence = <TState,>(
  key = "settings-kit",
  options?: {
    serialize?: (state: TState) => string;
    deserialize?: (raw: string) => TState;
  }
): SettingsPersistenceAdapter<TState> => {
  const serialize = options?.serialize ?? JSON.stringify;
  const deserialize = options?.deserialize ?? ((raw: string) => JSON.parse(raw) as TState);
  const readFromStorage = (): TState | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    try {
      return deserialize(raw);
    } catch {
      return null;
    }
  };

  return {
    load: readFromStorage,
    loadSync: readFromStorage,
    save: (state) => {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(key, serialize(state));
    }
  };
};

const SettingsStoreContext = createContext<SettingsStore<UnknownObject> | null>(null);

export type SettingsProviderProps<TState extends UnknownObject> = {
  children: ReactNode;
  initialState: TState;
  store?: SettingsStore<TState>;
  persistence?: SettingsPersistenceAdapter<TState>;
  onChange?: (event: SettingsChangeEvent<TState>) => void;
  onStateChange?: (event: SettingsStateChangeEvent<TState>) => void;
  actions?: Record<string, SettingsActionHandler<TState>>;
  onAction?: (event: SettingsActionEvent<TState>) => void;
};

/**
 * Optional provider for global settings state.
 */
export const SettingsProvider = <TState extends UnknownObject>({
  children,
  initialState,
  store,
  persistence,
  onChange,
  onStateChange,
  actions,
  onAction
}: SettingsProviderProps<TState>): ReactElement => {
  const fallbackStoreRef = useRef<SettingsStore<TState> | null>(null);

  if (!fallbackStoreRef.current) {
    fallbackStoreRef.current = createSettingsStore({
      initialState,
      persistence,
      onChange,
      onStateChange,
      actions,
      onAction
    });
    void fallbackStoreRef.current.hydrate();
  }

  return (
    <SettingsStoreContext.Provider value={(store ?? fallbackStoreRef.current) as SettingsStore<UnknownObject>}>
      {children}
    </SettingsStoreContext.Provider>
  );
};

/**
 * Accesses current settings store from provider context.
 */
export const useSettingsStore = <TState extends UnknownObject>(): SettingsStore<TState> => {
  const context = useContext(SettingsStoreContext);
  if (!context) {
    throw new Error("useSettingsStore must be used within <SettingsProvider> or with useSetting(path, { store }).");
  }

  return context as SettingsStore<TState>;
};

/**
 * Reads and updates a single setting path from the store.
 */
export function useSetting<TValue, TState extends UnknownObject = UnknownObject>(
  path: string,
  options: { store?: SettingsStore<TState>; defaultValue: TValue }
): [TValue, (value: TValue) => void];
export function useSetting<TValue = unknown, TState extends UnknownObject = UnknownObject>(
  path: string
): [TValue | undefined, (value: TValue) => void];
export function useSetting<TValue = unknown, TState extends UnknownObject = UnknownObject>(
  path: string,
  options?: { store?: SettingsStore<TState>; defaultValue?: TValue }
): [TValue | undefined, (value: TValue) => void] {
  const contextStore = useContext(SettingsStoreContext) as SettingsStore<TState> | null;
  const store = options?.store ?? contextStore;

  if (!store) {
    throw new Error("useSetting requires either a provider or an explicit store option.");
  }

  const value = useSyncExternalStore(
    store.subscribe,
    () => store.get<TValue>(path),
    () => store.get<TValue>(path)
  );

  const setValue = useMemo(() => (next: TValue) => store.set(path, next), [store, path]);

  if (options && "defaultValue" in options) {
    return [(value ?? options.defaultValue) as TValue, setValue];
  }

  return [value, setValue];
}

export type UseSettingDirtyOptions<TValue = unknown, TState extends UnknownObject = UnknownObject> = {
  store?: SettingsStore<TState>;
  initialValue?: TValue;
  isEqual?: (a: TValue | undefined, b: TValue | undefined) => boolean;
  baseline?: "initial" | "mount";
};

/**
 * Returns whether a setting value differs from its initial value.
 */
export const useSettingDirty = <TValue = unknown, TState extends UnknownObject = UnknownObject>(
  path: string,
  options?: UseSettingDirtyOptions<TValue, TState>
): boolean => {
  const contextStore = useContext(SettingsStoreContext) as SettingsStore<TState> | null;
  const store = options?.store ?? contextStore;
  if (!store) {
    throw new Error("useSettingDirty requires either a provider or an explicit store option.");
  }

  const currentValue = useSyncExternalStore(
    store.subscribe,
    () => store.get<TValue>(path),
    () => store.get<TValue>(path)
  );
  const baselineValue =
    options && "initialValue" in options
      ? options.initialValue
      : getByPath<TValue>(store.getInitialState(), path);
  const mountBaselineRef = useRef<TValue | undefined>(currentValue);
  const baseline = options?.baseline ?? "initial";
  const comparisonBaseline = baseline === "mount" ? mountBaselineRef.current : baselineValue;
  const isEqual = options?.isEqual ?? Object.is;

  return !isEqual(currentValue, comparisonBaseline);
};

/**
 * Evaluates conditional visibility against current settings state.
 */
export const visibleWhen = <TState extends UnknownObject>(
  state: TState,
  path: string,
  expected: unknown | unknown[] | ((value: unknown, state: TState) => boolean)
): boolean => {
  const value = getByPath(state, path);
  if (typeof expected === "function") {
    return expected(value, state);
  }

  if (Array.isArray(expected)) {
    return expected.some((candidate) => Object.is(candidate, value));
  }

  return Object.is(value, expected);
};

/**
 * React hook for conditional setting visibility (feature-flag style).
 */
export const useVisibleWhen = <TState extends UnknownObject = UnknownObject>(
  path: string,
  expected: unknown | unknown[] | ((value: unknown, state: TState) => boolean),
  options?: { store?: SettingsStore<TState> }
): boolean => {
  const contextStore = useContext(SettingsStoreContext) as SettingsStore<TState> | null;
  const store = options?.store ?? contextStore;
  if (!store) {
    throw new Error("useVisibleWhen requires either a provider or an explicit store option.");
  }

  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return visibleWhen(snapshot, path, expected);
};
