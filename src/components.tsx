import {
  forwardRef,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactElement,
  type ReactNode
} from "react";
import {
  SettingsProvider,
  useSetting,
  useSettingDirty,
  useVisibleWhen,
  type SettingsStore
} from "./settings-store";
import {
  SettingsRegistryProvider,
  useSettingsRegistryItem,
  type SettingsRegistryItem
} from "./settings-registry";
import { useSettingsField, type UseSettingsFieldResult } from "./use-settings-field";
import { useSettingsSearch, type UseSettingsSearchResult } from "./use-settings-search";
import { useSettingsHistory } from "./use-settings-history";
import { useSettingsKeyboard } from "./use-settings-keyboard";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type UnknownObject = Record<string, unknown>;

type OptionItem = {
  label: string;
  value: string;
};

// ---------------------------------------------------------------------------
// <Settings>
// ---------------------------------------------------------------------------

export type SettingsProps<TState extends UnknownObject = UnknownObject> = Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
> & {
  store?: SettingsStore<TState>;
  initialState?: TState;
  as?: ElementType;
  children?: ReactNode;
};

/**
 * Root wrapper that sets up SettingsProvider, SettingsRegistryProvider, and
 * keyboard navigation.
 */
export const Settings = <TState extends UnknownObject = UnknownObject>({
  store,
  initialState,
  as: Component = "div",
  children,
  ...rest
}: SettingsProps<TState>): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  const inner = (
    <SettingsRegistryProvider>
      <SettingsKeyboardContainer containerRef={containerRef} as={Component} {...rest}>
        {children}
      </SettingsKeyboardContainer>
    </SettingsRegistryProvider>
  );

  if (store) {
    return (
      <SettingsProvider initialState={store.getInitialState() as TState} store={store}>
        {inner}
      </SettingsProvider>
    );
  }

  if (initialState) {
    return (
      <SettingsProvider initialState={initialState}>
        {inner}
      </SettingsProvider>
    );
  }

  throw new Error("<Settings> requires either a `store` or `initialState` prop.");
};

type SettingsKeyboardContainerProps = ComponentPropsWithoutRef<"div"> & {
  containerRef: React.RefObject<HTMLDivElement | null>;
  as?: ElementType;
};

const SettingsKeyboardContainer = ({
  containerRef,
  as: Component = "div",
  children,
  ...rest
}: SettingsKeyboardContainerProps): ReactElement => {
  useSettingsKeyboard({ containerRef });

  return (
    <Component ref={containerRef} data-settings-root {...rest}>
      {children}
    </Component>
  );
};

// ---------------------------------------------------------------------------
// <SettingGroup>
// ---------------------------------------------------------------------------

export type SettingGroupVisibleWhen = {
  path: string;
  value: unknown;
};

export type SettingGroupProps = Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  title: string;
  description?: string;
  visibleWhen?: SettingGroupVisibleWhen;
  as?: ElementType;
};

/**
 * Section grouping for settings with optional conditional visibility.
 */
export const SettingGroup = ({
  title,
  description,
  visibleWhen: condition,
  as: Component = "div",
  children,
  ...rest
}: SettingGroupProps): ReactElement | null => {
  if (condition) {
    return (
      <SettingGroupConditional
        title={title}
        description={description}
        visibleWhen={condition}
        as={Component}
        {...rest}
      >
        {children}
      </SettingGroupConditional>
    );
  }

  return (
    <Component data-settings-group {...rest}>
      <span data-settings-group-title>{title}</span>
      {description && <span data-settings-group-description>{description}</span>}
      <div data-settings-group-content>{children}</div>
    </Component>
  );
};

const SettingGroupConditional = ({
  title,
  description,
  visibleWhen: condition,
  as: Component = "div",
  children,
  ...rest
}: SettingGroupProps & { visibleWhen: SettingGroupVisibleWhen }): ReactElement | null => {
  const visible = useVisibleWhen(condition.path, condition.value);

  if (!visible) {
    return null;
  }

  return (
    <Component data-settings-group {...rest}>
      <span data-settings-group-title>{title}</span>
      {description && <span data-settings-group-description>{description}</span>}
      <div data-settings-group-content>{children}</div>
    </Component>
  );
};

// ---------------------------------------------------------------------------
// <SettingItem>
// ---------------------------------------------------------------------------

type SettingItemType =
  | "select"
  | "toggle"
  | "checkbox"
  | "number"
  | "text"
  | "textarea"
  | "slider"
  | "color"
  | "radio"
  | "segmented"
  | "custom";

export type SettingItemRenderProps = {
  value: unknown;
  setValue: (value: unknown) => void;
  isDirty: boolean;
  field: UseSettingsFieldResult;
};

export type SettingItemProps = Omit<ComponentPropsWithoutRef<"div">, "title" | "children"> & {
  path: string;
  title: string;
  description?: string;
  type: SettingItemType;
  options?: OptionItem[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  rows?: number;
  dirty?: boolean;
  children?: ReactNode | ((props: SettingItemRenderProps) => ReactNode);
};

/**
 * Individual setting row that auto-wires value, dirty tracking, ARIA, and
 * registry registration.
 */
export const SettingItem = ({
  path,
  title,
  description,
  type,
  options,
  min,
  max,
  step,
  placeholder,
  rows,
  dirty: trackDirty = true,
  children,
  ...rest
}: SettingItemProps): ReactElement => {
  const [value, setValue] = useSetting(path);
  const isDirty = useSettingDirty(path);
  const field = useSettingsField({ hasDescription: !!description });

  useSettingsRegistryItem(
    {
      id: path,
      label: title,
      description,
      options: options?.map((opt) => opt.label)
    },
    { enabled: true }
  );

  const showDirty = trackDirty && isDirty;

  const renderControl = (): ReactNode => {
    if (type === "custom") {
      if (typeof children === "function") {
        return children({ value, setValue, isDirty, field });
      }
      return children as ReactNode;
    }

    switch (type) {
      case "select":
        return (
          <select
            value={(value as string) ?? ""}
            onChange={(e) => setValue(e.target.value)}
            {...field.controlProps}
          >
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "toggle":
        return (
          <button
            role="switch"
            aria-checked={!!value}
            onClick={() => setValue(!value)}
            {...field.controlProps}
          />
        );

      case "checkbox":
        return (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => setValue(e.target.checked)}
            {...field.controlProps}
          />
        );

      case "number":
        return (
          <input
            type="number"
            value={(value as number) ?? ""}
            min={min}
            max={max}
            step={step}
            onChange={(e) => setValue(Number(e.target.value))}
            {...field.controlProps}
          />
        );

      case "text":
        return (
          <input
            type="text"
            value={(value as string) ?? ""}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            {...field.controlProps}
          />
        );

      case "textarea":
        return (
          <textarea
            value={(value as string) ?? ""}
            placeholder={placeholder}
            rows={rows}
            onChange={(e) => setValue(e.target.value)}
            {...field.controlProps}
          />
        );

      case "slider":
        return (
          <input
            type="range"
            value={(value as number) ?? min ?? 0}
            min={min}
            max={max}
            step={step}
            onChange={(e) => setValue(Number(e.target.value))}
            {...field.controlProps}
          />
        );

      case "color":
        return (
          <input
            type="color"
            value={(value as string) ?? "#000000"}
            onChange={(e) => setValue(e.target.value)}
            {...field.controlProps}
          />
        );

      case "radio":
        return (
          <div role="radiogroup" {...field.controlProps}>
            {options?.map((opt) => (
              <label key={opt.value}>
                <input
                  type="radio"
                  name={path}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={() => setValue(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        );

      case "segmented":
        return (
          <div role="radiogroup" data-settings-segmented {...field.controlProps}>
            {options?.map((opt) => (
              <button
                key={opt.value}
                role="radio"
                aria-checked={value === opt.value}
                onClick={() => setValue(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  if (type === "custom" && typeof children === "function") {
    return (
      <div
        data-settings-item
        data-settings-dirty={showDirty ? "true" : "false"}
        {...rest}
      >
        <span id={field.titleId} data-settings-title>
          {title}
        </span>
        {description && (
          <span id={field.descriptionId} data-settings-description>
            {description}
          </span>
        )}
        <div data-settings-control>
          {children({ value, setValue, isDirty, field })}
        </div>
      </div>
    );
  }

  return (
    <div
      data-settings-item
      data-settings-dirty={showDirty ? "true" : "false"}
      {...rest}
    >
      <span id={field.titleId} data-settings-title>
        {title}
      </span>
      {description && (
        <span id={field.descriptionId} data-settings-description>
          {description}
        </span>
      )}
      <div data-settings-control>{renderControl()}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// <SettingSearch>
// ---------------------------------------------------------------------------

export type SettingSearchRenderProps = {
  results: UseSettingsSearchResult["results"];
  query: string;
  isSearching: boolean;
};

export type SettingSearchProps = Omit<ComponentPropsWithoutRef<"input">, "children"> & {
  items?: UseSettingsSearchResult extends { results: (infer R)[] } ? never : never;
  children?: (props: SettingSearchRenderProps) => ReactNode;
};

/**
 * Search input that wraps useSettingsSearch.
 */
export const SettingSearch = ({
  children,
  ...rest
}: Omit<ComponentPropsWithoutRef<"input">, "children"> & {
  items?: Parameters<typeof useSettingsSearch>[0]["items"];
  children?: (props: SettingSearchRenderProps) => ReactNode;
}): ReactElement => {
  const containerRef = useRef<HTMLElement>(null);
  const { items, ...inputProps } = rest as { items?: Parameters<typeof useSettingsSearch>[0]["items"] } & ComponentPropsWithoutRef<"input">;

  const { query, setQuery, results, isSearching } = useSettingsSearch({
    containerRef,
    items
  });

  return (
    <>
      <input
        data-settings-search
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        {...inputProps}
      />
      {children?.({ results, query, isSearching })}
    </>
  );
};

// ---------------------------------------------------------------------------
// <SettingHistory>
// ---------------------------------------------------------------------------

export type SettingHistoryRenderProps = {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export type SettingHistoryProps = {
  path: string;
  children: (props: SettingHistoryRenderProps) => ReactNode;
};

/**
 * Undo/redo wrapper for a specific settings path.
 */
export const SettingHistory = ({ path, children }: SettingHistoryProps): ReactElement => {
  const [value, setValue] = useSetting(path);

  const { undo, redo, canUndo, canRedo } = useSettingsHistory({
    value,
    onChange: setValue
  });

  return <>{children({ undo, redo, canUndo, canRedo })}</>;
};
