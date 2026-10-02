import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

// eslint-disable-next-line react-refresh/only-export-components
export function scrollToPageTop() {
  if (typeof window === "undefined") return;

  const html = document.documentElement;
  const body = document.body;

  const prevHtmlBehavior = html ? html.style.scrollBehavior : "";
  const prevBodyBehavior = body ? body.style.scrollBehavior : "";

  if (html) html.style.scrollBehavior = "auto";
  if (body) body.style.scrollBehavior = "auto";

  try {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  } catch {
    window.scrollTo(0, 0);
  }

  if (html) html.scrollTop = 0;
  if (body) body.scrollTop = 0;

  const scrollableSelectors = [
    "#root",
    ".admin-main",
    ".admin-page",
    ".delivery-shell",
    ".checkout-page-wrapper",
    ".cart-page-wrapper",
  ];

  for (const selector of scrollableSelectors) {
    const el = document.querySelector(selector);
    if (el && el.scrollTop > 0) {
      el.scrollTop = 0;
    }
  }

  requestAnimationFrame(() => {
    if (html) html.style.scrollBehavior = prevHtmlBehavior;
    if (body) body.style.scrollBehavior = prevBodyBehavior;
  });
}

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useLayoutEffect(() => {
    scrollToPageTop();

    const rafId = requestAnimationFrame(() => {
      scrollToPageTop();
    });

    const t1 = setTimeout(() => {
      scrollToPageTop();
    }, 50);

    const t2 = setTimeout(() => {
      scrollToPageTop();
    }, 150);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname, search]);

  return null;
}

export default ScrollToTop;
