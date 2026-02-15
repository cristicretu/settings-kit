import { useCallback, useEffect, useRef, useState } from "react";

export type UseSettingsDeepLinkOptions = {
  param?: string;
  onNavigate: (path: string) => void;
};

export type UseSettingsDeepLinkResult = {
  currentPath: string | null;
  setPath: (path: string) => void;
  createLink: (path: string) => string;
};

/**
 * Reads/writes a settings route segment from URL query params.
 */
export const useSettingsDeepLink = ({
  param = "settings",
  onNavigate
}: UseSettingsDeepLinkOptions): UseSettingsDeepLinkResult => {
  const hasWindow = typeof window !== "undefined";

  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const getCurrentPath = useCallback(() => {
    if (!hasWindow) {
      return null;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get(param);
  }, [hasWindow, param]);

  const setPath = useCallback(
    (path: string) => {
      if (!hasWindow) {
        onNavigateRef.current(path);
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set(param, path);
      window.history.replaceState(null, "", url.toString());
      onNavigateRef.current(path);
    },
    [hasWindow, param]
  );

  const createLink = useCallback(
    (path: string) => {
      if (!hasWindow) {
        return `?${param}=${encodeURIComponent(path)}`;
      }
      const url = new URL(window.location.href);
      url.searchParams.set(param, path);
      return `${url.pathname}${url.search}`;
    },
    [hasWindow, param]
  );

  const [currentPath, setCurrentPath] = useState<string | null>(() => getCurrentPath());

  useEffect(() => {
    if (!hasWindow) {
      return;
    }

    const sync = (): void => {
      const nextPath = getCurrentPath();
      setCurrentPath(nextPath);
      if (nextPath) {
        onNavigateRef.current(nextPath);
      }
    };

    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [getCurrentPath, hasWindow]);

  const setPathWithState = useCallback(
    (path: string) => {
      setPath(path);
      setCurrentPath(path);
    },
    [setPath]
  );

  return {
    currentPath,
    setPath: setPathWithState,
    createLink
  };
};
