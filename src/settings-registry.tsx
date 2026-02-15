import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode
} from "react";

type RegistryListener = () => void;

export type SettingsRegistryItem = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  group?: string;
  options?: string[];
};

export type SettingsRegistryStore = {
  upsert: (item: SettingsRegistryItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  getItems: () => SettingsRegistryItem[];
  subscribe: (listener: RegistryListener) => () => void;
};

const sortById = (left: SettingsRegistryItem, right: SettingsRegistryItem): number =>
  left.id.localeCompare(right.id);
const EMPTY_REGISTRY_ITEMS: SettingsRegistryItem[] = [];

/** Creates a lightweight settings registry store for inferred search indexing. */
export const createSettingsRegistryStore = (): SettingsRegistryStore => {
  const items = new Map<string, SettingsRegistryItem>();
  const listeners = new Set<RegistryListener>();
  let snapshot: SettingsRegistryItem[] = [];

  const rebuildSnapshot = () => {
    snapshot = Array.from(items.values()).sort(sortById);
  };

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    upsert(item) {
      const previous = items.get(item.id);
      if (
        previous &&
        previous.label === item.label &&
        previous.description === item.description &&
        previous.group === item.group &&
        (previous.keywords ?? []).join("|") === (item.keywords ?? []).join("|") &&
        (previous.options ?? []).join("|") === (item.options ?? []).join("|")
      ) {
        return;
      }
      items.set(item.id, item);
      rebuildSnapshot();
      emit();
    },
    remove(id) {
      if (!items.delete(id)) {
        return;
      }
      rebuildSnapshot();
      emit();
    },
    clear() {
      if (items.size === 0) {
        return;
      }
      items.clear();
      rebuildSnapshot();
      emit();
    },
    getItems() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
};

const SettingsRegistryContext = createContext<SettingsRegistryStore | null>(null);

export type SettingsRegistryProviderProps = {
  children: ReactNode;
  store?: SettingsRegistryStore;
};

/** Optional provider that lets settings primitives auto-register searchable metadata. */
export const SettingsRegistryProvider = ({
  children,
  store
}: SettingsRegistryProviderProps) => {
  const fallbackStoreRef = useRef<SettingsRegistryStore | null>(null);

  if (!fallbackStoreRef.current) {
    fallbackStoreRef.current = createSettingsRegistryStore();
  }

  return (
    <SettingsRegistryContext.Provider value={store ?? fallbackStoreRef.current}>
      {children}
    </SettingsRegistryContext.Provider>
  );
};

/** Reads settings registry store from context. */
export const useSettingsRegistryStore = (
  options: { optional?: boolean } = {}
): SettingsRegistryStore | null => {
  const context = useContext(SettingsRegistryContext);

  if (!context && !options.optional) {
    throw new Error(
      "useSettingsRegistryStore must be used within <SettingsRegistryProvider> when optional=false."
    );
  }

  return context;
};

/** Subscribes to current registry item snapshot. */
export const useSettingsRegistryItems = (
  options: { optional?: boolean } = {}
): SettingsRegistryItem[] => {
  const store = useSettingsRegistryStore(options);

  const subscribe = useMemo(
    () => (store ? store.subscribe : (_listener: RegistryListener) => () => {}),
    [store]
  );
  const getSnapshot = useMemo(
    () => (store ? store.getItems : () => EMPTY_REGISTRY_ITEMS),
    [store]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export type UseSettingsRegistryItemOptions = {
  enabled?: boolean;
};

/** Registers a single inferred settings item for global search/indexing. */
export const useSettingsRegistryItem = (
  item: SettingsRegistryItem | null,
  options: UseSettingsRegistryItemOptions = {}
): void => {
  const store = useSettingsRegistryStore({ optional: true });
  const enabled = options.enabled ?? true;

  const keywordsSignature = (item?.keywords ?? []).join("|");
  const optionsSignature = (item?.options ?? []).join("|");

  useEffect(() => {
    if (!enabled || !store || !item) {
      return;
    }

    store.upsert(item);
  }, [
    enabled,
    item?.description,
    item?.group,
    item?.id,
    item?.label,
    keywordsSignature,
    optionsSignature,
    store
  ]);

  useEffect(() => {
    if (!enabled || !store || !item) {
      return;
    }

    const id = item.id;
    return () => {
      store.remove(id);
    };
  }, [enabled, item?.id, store]);
};
