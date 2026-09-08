"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PageLoader } from "./page-loader";

const SHOW_DELAY_MS = 120;
const MIN_VISIBLE_MS = 280;
const FAILSAFE_MS = 15000;

let startNavigationHandler: (() => void) | null = null;

export function startNavigation() {
  startNavigationHandler?.();
}

function isInternalNavigation(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(anchor.href);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;
  return (
    url.pathname !== window.location.pathname ||
    url.search !== window.location.search
  );
}

export function NavigationLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const pending = useRef(false);
  const visibleRef = useRef(false);
  const shownAt = useRef(0);
  const pathRef = useRef(pathname);
  const showTimer = useRef(0);
  const hideTimer = useRef(0);
  const failTimer = useRef(0);

  const finish = useCallback(() => {
    pending.current = false;
    window.clearTimeout(showTimer.current);
    window.clearTimeout(failTimer.current);

    if (!visibleRef.current) return;

    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      visibleRef.current = false;
      setVisible(false);
    }, wait);
  }, []);

  const begin = useCallback(() => {
    pending.current = true;
    window.clearTimeout(hideTimer.current);
    window.clearTimeout(failTimer.current);

    failTimer.current = window.setTimeout(() => {
      pending.current = false;
      visibleRef.current = false;
      setVisible(false);
    }, FAILSAFE_MS);

    if (visibleRef.current) return;

    window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => {
      if (!pending.current) return;
      visibleRef.current = true;
      shownAt.current = Date.now();
      setVisible(true);
    }, SHOW_DELAY_MS);
  }, []);

  useEffect(() => {
    startNavigationHandler = begin;
    return () => {
      if (startNavigationHandler === begin) startNavigationHandler = null;
    };
  }, [begin]);

  useEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    finish();
  }, [pathname, finish]);

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isInternalNavigation(anchor)) return;
      begin();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", begin);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", begin);
      window.clearTimeout(showTimer.current);
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(failTimer.current);
    };
  }, [begin]);

  return (
    <>
      <div
        className={visible ? "route-progress is-on" : "route-progress"}
        aria-hidden
      >
        <div className="route-progress-bar" />
      </div>
      {visible ? (
        <div className="route-overlay">
          <PageLoader />
        </div>
      ) : null}
    </>
  );
}
