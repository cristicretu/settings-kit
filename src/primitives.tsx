import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode
} from "react";
import { useSettingsField, type UseSettingsFieldResult } from "./use-settings-field";

// ---------------------------------------------------------------------------
// Field context — lets child controls auto-wire ARIA labels
// ---------------------------------------------------------------------------

const SettingsFieldContext = createContext<UseSettingsFieldResult | null>(null);

/** Read field ARIA IDs from the nearest SettingsItem container. */
export const useSettingsFieldContext = (): UseSettingsFieldResult | null =>
  useContext(SettingsFieldContext);

// ---------------------------------------------------------------------------
// Ref merging utility
// ---------------------------------------------------------------------------

type RefCallback<T> = (node: T | null) => void;
type RefValue<T> = React.RefObject<T | null> | RefCallback<T> | null | undefined;

function mergeRefs<T>(...refs: RefValue<T>[]): RefCallback<T> {
  return (node: T | null) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref && typeof ref === "object") {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    });
  };
}

// ---------------------------------------------------------------------------
// Layout: SettingsPage
// ---------------------------------------------------------------------------

export const SettingsPage = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
  (props, ref) => <div ref={ref} data-settings-page {...props} />
);
SettingsPage.displayName = "SettingsPage";

// ---------------------------------------------------------------------------
// Layout: SettingsSidebar
// ---------------------------------------------------------------------------

export const SettingsSidebar = forwardRef<HTMLElement, ComponentPropsWithoutRef<"aside">>(
  (props, ref) => <aside ref={ref} data-settings-sidebar {...props} />
);
SettingsSidebar.displayName = "SettingsSidebar";

// ---------------------------------------------------------------------------
// Layout: SettingsSidebarSection
// ---------------------------------------------------------------------------

export type SettingsSidebarSectionProps = ComponentPropsWithoutRef<"div"> & {
  label?: string;
};

export const SettingsSidebarSection = forwardRef<HTMLDivElement, SettingsSidebarSectionProps>(
  ({ label, children, ...rest }, ref) => (
    <div ref={ref} data-settings-sidebar-section {...rest}>
      {label && <h3 data-settings-sidebar-section-label="">{label}</h3>}
      {children}
    </div>
  )
);
SettingsSidebarSection.displayName = "SettingsSidebarSection";

// ---------------------------------------------------------------------------
// Layout: SettingsSidebarItem
// ---------------------------------------------------------------------------

export type SettingsSidebarItemProps = Omit<ComponentPropsWithoutRef<"button">, "children"> & {
  icon?: ReactNode;
  label: string;
  active?: boolean;
  badge?: ReactNode;
  expandable?: boolean;
};

export const SettingsSidebarItem = forwardRef<HTMLButtonElement, SettingsSidebarItemProps>(
  ({ icon, label, active, badge, expandable, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      data-settings-sidebar-item=""
      aria-current={active ? "page" : undefined}
      data-active={active ? "" : undefined}
      {...rest}
    >
      {icon && <span data-settings-sidebar-item-icon="">{icon}</span>}
      <span data-settings-sidebar-item-label="">{label}</span>
      {badge && <span data-settings-sidebar-item-badge="">{badge}</span>}
    </button>
  )
);
SettingsSidebarItem.displayName = "SettingsSidebarItem";

// ---------------------------------------------------------------------------
// Layout: SettingsContent
// ---------------------------------------------------------------------------

export const SettingsContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
  (props, ref) => <div ref={ref} data-settings-content="" role="main" {...props} />
);
SettingsContent.displayName = "SettingsContent";

// ---------------------------------------------------------------------------
// Layout: SettingsHeader
// ---------------------------------------------------------------------------

export type SettingsHeaderProps = Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export const SettingsHeader = forwardRef<HTMLDivElement, SettingsHeaderProps>(
  ({ title, description, actions, children, ...rest }, ref) => (
    <header ref={ref} data-settings-header="" {...rest}>
      <div>
        <h1 data-settings-header-title="">{title}</h1>
        {description && <p data-settings-header-description="">{description}</p>}
        {children}
      </div>
      {actions && <div data-settings-header-actions="">{actions}</div>}
    </header>
  )
);
SettingsHeader.displayName = "SettingsHeader";

// ---------------------------------------------------------------------------
// Layout: SettingsDialog
// ---------------------------------------------------------------------------

export type SettingsDialogProps = Omit<ComponentPropsWithoutRef<"dialog">, "open"> & {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const SettingsDialog = forwardRef<HTMLDialogElement, SettingsDialogProps>(
  ({ open, onOpenChange, onClick, children, ...rest }, ref) => {
    const innerRef = useRef<HTMLDialogElement>(null);
    const combinedRef = mergeRefs(ref, innerRef);

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      if (open && !el.open) el.showModal();
      else if (!open && el.open) el.close();
    }, [open]);

    const handleClose = useCallback(() => {
      onOpenChange?.(false);
    }, [onOpenChange]);

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.addEventListener("close", handleClose);
      return () => el.removeEventListener("close", handleClose);
    }, [handleClose]);

    const handleBackdropClick = useCallback(
      (e: React.MouseEvent<HTMLDialogElement>) => {
        if (e.target === e.currentTarget) {
          onOpenChange?.(false);
        }
        onClick?.(e);
      },
      [onOpenChange, onClick]
    );

    return (
      <dialog
        ref={combinedRef}
        data-settings-dialog=""
        onClick={handleBackdropClick}
        {...rest}
      >
        {children}
      </dialog>
    );
  }
);
SettingsDialog.displayName = "SettingsDialog";

// ---------------------------------------------------------------------------
// Content: SettingsItem (structural container with field context)
// ---------------------------------------------------------------------------

export type SettingsItemProps = ComponentPropsWithoutRef<"div"> & {
  fieldHasDescription?: boolean;
};

export const SettingsItem = forwardRef<HTMLDivElement, SettingsItemProps>(
  ({ fieldHasDescription = true, children, ...rest }, ref) => {
    const field = useSettingsField({ hasDescription: fieldHasDescription });

    return (
      <SettingsFieldContext.Provider value={field}>
        <div ref={ref} data-settings-item="" {...rest}>
          {children}
        </div>
      </SettingsFieldContext.Provider>
    );
  }
);
SettingsItem.displayName = "SettingsItem";

// ---------------------------------------------------------------------------
// Content: SettingsLabel
// ---------------------------------------------------------------------------

export type SettingsLabelProps = ComponentPropsWithoutRef<"div"> & {
  title: ReactNode;
  description?: ReactNode;
  modified?: boolean;
  ids?: { titleId?: string; descriptionId?: string };
};

export const SettingsLabel = forwardRef<HTMLDivElement, SettingsLabelProps>(
  ({ title, description, modified, ids, children, ...rest }, ref) => {
    const fieldContext = useSettingsFieldContext();
    const titleId = ids?.titleId ?? fieldContext?.titleId;
    const descriptionId = ids?.descriptionId ?? fieldContext?.descriptionId;

    return (
      <div ref={ref} data-settings-label="" {...rest}>
        <div>
          <p id={titleId} data-settings-label-title="">
            {title}
            {modified && <span data-settings-label-modified="">Modified</span>}
          </p>
          {description && (
            <p id={descriptionId} data-settings-label-description="">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    );
  }
);
SettingsLabel.displayName = "SettingsLabel";

// ---------------------------------------------------------------------------
// Content: SettingsSeparator
// ---------------------------------------------------------------------------

export const SettingsSeparator = forwardRef<HTMLHRElement, ComponentPropsWithoutRef<"hr">>(
  (props, ref) => <hr ref={ref} data-settings-separator="" {...props} />
);
SettingsSeparator.displayName = "SettingsSeparator";

// ---------------------------------------------------------------------------
// Content: SettingsGroup
// ---------------------------------------------------------------------------

export type SettingsGroupProps = ComponentPropsWithoutRef<"div"> & {
  variant?: "default" | "danger";
};

export const SettingsGroup = forwardRef<HTMLDivElement, SettingsGroupProps>(
  ({ variant = "default", ...rest }, ref) => (
    <div ref={ref} data-settings-group="" data-variant={variant} {...rest} />
  )
);
SettingsGroup.displayName = "SettingsGroup";

// ---------------------------------------------------------------------------
// Content: SettingsSearchInput
// ---------------------------------------------------------------------------

export const SettingsSearchInput = forwardRef<
  HTMLInputElement,
  ComponentPropsWithoutRef<"input">
>((props, ref) => (
  <input ref={ref} type="search" data-settings-search-input="" {...props} />
));
SettingsSearchInput.displayName = "SettingsSearchInput";

// ---------------------------------------------------------------------------
// Control: SettingsSelect
// ---------------------------------------------------------------------------

export type SettingsSelectOption = {
  label: string;
  value: string;
  description?: string;
  icon?: ReactNode;
};

export type SettingsSelectProps = Omit<ComponentPropsWithoutRef<"select">, "onChange" | "children"> & {
  value: string;
  onChange: (value: string) => void;
  options: SettingsSelectOption[];
};

export const SettingsSelect = forwardRef<HTMLSelectElement, SettingsSelectProps>(
  ({ value, onChange, options, ...rest }, ref) => {
    const fieldContext = useSettingsFieldContext();

    return (
      <select
        ref={ref}
        data-settings-select=""
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-labelledby={fieldContext?.controlProps["aria-labelledby"]}
        aria-describedby={fieldContext?.controlProps["aria-describedby"]}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);
SettingsSelect.displayName = "SettingsSelect";

// ---------------------------------------------------------------------------
// Control: SettingsToggle
// ---------------------------------------------------------------------------

export type SettingsToggleProps = Omit<ComponentPropsWithoutRef<"button">, "onChange"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: "xs" | "sm" | "md";
};

export const SettingsToggle = forwardRef<HTMLButtonElement, SettingsToggleProps>(
  ({ checked, onChange, size = "md", ...rest }, ref) => {
    const fieldContext = useSettingsFieldContext();

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        data-settings-toggle=""
        data-size={size}
        data-state={checked ? "checked" : "unchecked"}
        onClick={() => onChange(!checked)}
        aria-labelledby={fieldContext?.controlProps["aria-labelledby"]}
        aria-describedby={fieldContext?.controlProps["aria-describedby"]}
        {...rest}
      >
        <span data-settings-toggle-thumb="" />
      </button>
    );
  }
);
SettingsToggle.displayName = "SettingsToggle";

// ---------------------------------------------------------------------------
// Control: SettingsSegmented
// ---------------------------------------------------------------------------

export type SettingsSegmentedOption = {
  label: string;
  value: string;
  icon?: ReactNode;
};

export type SettingsSegmentedProps = Omit<ComponentPropsWithoutRef<"div">, "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  options: SettingsSegmentedOption[];
};

export const SettingsSegmented = forwardRef<HTMLDivElement, SettingsSegmentedProps>(
  ({ value, onChange, options, ...rest }, ref) => {
    const fieldContext = useSettingsFieldContext();

    return (
      <div
        ref={ref}
        role="radiogroup"
        data-settings-segmented=""
        aria-labelledby={fieldContext?.controlProps["aria-labelledby"]}
        {...rest}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            data-state={value === opt.value ? "checked" : "unchecked"}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
    );
  }
);
SettingsSegmented.displayName = "SettingsSegmented";

// ---------------------------------------------------------------------------
// Control: SettingsInput
// ---------------------------------------------------------------------------

export type SettingsInputProps = Omit<ComponentPropsWithoutRef<"input">, "size"> & {
  bare?: boolean;
  wrapperClassName?: string;
  error?: string;
};

export const SettingsInput = forwardRef<HTMLInputElement, SettingsInputProps>(
  ({ bare, wrapperClassName, error, className, ...rest }, ref) => {
    const fieldContext = useSettingsFieldContext();
    const ariaProps = {
      "aria-labelledby": fieldContext?.controlProps["aria-labelledby"],
      "aria-describedby": fieldContext?.controlProps["aria-describedby"],
      "aria-invalid": error ? ("true" as const) : undefined
    };

    if (bare) {
      return (
        <input
          ref={ref}
          data-settings-input=""
          className={className}
          {...ariaProps}
          {...rest}
        />
      );
    }

    return (
      <div data-settings-input-wrapper="" className={wrapperClassName}>
        <input
          ref={ref}
          data-settings-input=""
          className={className}
          {...ariaProps}
          {...rest}
        />
        {error && <p data-settings-input-error="">{error}</p>}
      </div>
    );
  }
);
SettingsInput.displayName = "SettingsInput";

// ---------------------------------------------------------------------------
// Control: SettingsTextarea
// ---------------------------------------------------------------------------

export type SettingsTextareaProps = ComponentPropsWithoutRef<"textarea"> & {
  error?: string;
};

export const SettingsTextarea = forwardRef<HTMLTextAreaElement, SettingsTextareaProps>(
  ({ error, ...rest }, ref) => {
    const fieldContext = useSettingsFieldContext();

    return (
      <div data-settings-textarea-wrapper="">
        <textarea
          ref={ref}
          data-settings-textarea=""
          aria-labelledby={fieldContext?.controlProps["aria-labelledby"]}
          aria-describedby={fieldContext?.controlProps["aria-describedby"]}
          aria-invalid={error ? "true" : undefined}
          {...rest}
        />
        {error && <p data-settings-textarea-error="">{error}</p>}
      </div>
    );
  }
);
SettingsTextarea.displayName = "SettingsTextarea";
