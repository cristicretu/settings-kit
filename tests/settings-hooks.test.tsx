import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createSettingsStore, useSetting, useSettingDirty, visibleWhen } from "../src/settings-store";
import { useSettingsField } from "../src/use-settings-field";

type DemoState = {
  appearance: {
    theme: "light" | "dark";
  };
};

describe("hook integrations", () => {
  it("useSetting returns current value with defaultValue overload", () => {
    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "light" }
      }
    });

    let observed: "light" | "dark" = "dark";

    function Probe() {
      const [theme] = useSetting("appearance.theme", {
        store,
        defaultValue: "dark"
      });
      observed = theme;
      return null;
    }

    renderToString(<Probe />);
    expect(observed).toBe("light");
  });

  it("useSettingDirty compares against initial state", () => {
    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "light" }
      }
    });

    let dirty = true;

    function Probe() {
      dirty = useSettingDirty("appearance.theme", { store });
      return null;
    }

    renderToString(<Probe />);
    expect(dirty).toBe(false);

    store.set("appearance.theme", "dark");
    renderToString(<Probe />);
    expect(dirty).toBe(true);

    store.reset();
    renderToString(<Probe />);
    expect(dirty).toBe(false);
  });

  it("useSettingDirty supports baseline mount mode", () => {
    const store = createSettingsStore<DemoState>({
      initialState: {
        appearance: { theme: "light" }
      }
    });

    store.set("appearance.theme", "dark");

    let dirty = true;

    function Probe() {
      dirty = useSettingDirty("appearance.theme", { store, baseline: "mount" });
      return null;
    }

    renderToString(<Probe />);
    expect(dirty).toBe(false);
  });

  it("useSettingsField omits aria-describedby when hasDescription is false", () => {
    let describedBy: string | undefined = "placeholder";

    function Probe() {
      const field = useSettingsField({ idBase: "field", hasDescription: false });
      describedBy = field.controlProps["aria-describedby"];
      return null;
    }

    renderToString(<Probe />);
    expect(describedBy).toBeUndefined();
  });

  it("visibleWhen evaluates feature flag style conditions", () => {
    const state: DemoState = {
      appearance: { theme: "dark" }
    };

    expect(visibleWhen(state, "appearance.theme", "dark")).toBe(true);
    expect(visibleWhen(state, "appearance.theme", ["light", "dark"])).toBe(true);
    expect(visibleWhen(state, "appearance.theme", (value: unknown) => value === "dark")).toBe(true);
    expect(visibleWhen(state, "appearance.theme", "light")).toBe(false);
  });

  it("visibleWhen predicate receives full state as second argument", () => {
    const state: DemoState = {
      appearance: { theme: "dark" }
    };

    const result = visibleWhen(state, "appearance.theme", (_value: unknown, s: DemoState) => s.appearance.theme === "dark");
    expect(result).toBe(true);

    const negative = visibleWhen(state, "appearance.theme", (_value: unknown, s: DemoState) => s.appearance.theme === "light");
    expect(negative).toBe(false);
  });
});
