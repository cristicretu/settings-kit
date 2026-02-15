import { useMemo } from "react";
import type { SettingsStore } from "./settings-store";
import { useSetting, useSettingDirty, type UseSettingDirtyOptions } from "./settings-store";
import { useSettingsRegistryItem } from "./settings-registry";
import { useSettingsField, type UseSettingsFieldResult } from "./use-settings-field";

type UnknownObject = Record<string, unknown>;

export type UseSettingFieldOptions<TValue, TState extends UnknownObject = UnknownObject> = {
  defaultValue: TValue;
  store?: SettingsStore<TState>;
  label?: string;
  description?: string;
  keywords?: string[];
  options?: string[];
  group?: string;
  dirty?: boolean;
  dirtyBaseline?: "initial" | "mount";
};

export type UseSettingFieldResult<TValue> = {
  value: TValue;
  setValue: (value: TValue) => void;
  isDirty: boolean;
  field: UseSettingsFieldResult;
};

/**
 * Bundles useSetting + useSettingDirty + useSettingsRegistryItem + useSettingsField into one call.
 */
export function useSettingField<TValue, TState extends UnknownObject = UnknownObject>(
  path: string,
  options: UseSettingFieldOptions<TValue, TState>
): UseSettingFieldResult<TValue> {
  const { defaultValue, store, label, description, keywords, options: searchOptions, group, dirty = true, dirtyBaseline = "initial" } = options;

  const [value, setValue] = useSetting<TValue, TState>(path, { store, defaultValue });

  const dirtyOptions = useMemo<UseSettingDirtyOptions<TValue, TState>>(
    () => ({ store, baseline: dirtyBaseline }),
    [store, dirtyBaseline]
  );
  const neverDirtyOptions = useMemo<UseSettingDirtyOptions<TValue, TState>>(
    () => ({ store, initialValue: value }),
    [store, value]
  );
  const isDirty = useSettingDirty<TValue, TState>(path, dirty ? dirtyOptions : neverDirtyOptions);

  const registryItem = useMemo(
    () =>
      label
        ? { id: path, label, description, keywords, options: searchOptions, group }
        : null,
    [path, label, description, keywords, searchOptions, group]
  );
  useSettingsRegistryItem(registryItem);

  const field = useSettingsField({ idBase: path, hasDescription: Boolean(description) });

  return { value, setValue, isDirty: dirty ? isDirty : false, field };
}
