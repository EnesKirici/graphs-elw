"use client";

import { createContext, useContext, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { postAnalytics, sendAnalyticsBeacon } from "@/lib/api";

const AnalyticsContext = createContext(null);

const FLUSH_INTERVAL = 10_000; // 10 saniye
const MAX_QUEUE_SIZE = 10;

let memorySessionId = null; // sessionStorage engelliyse (gizlilik eklentisi vb.) bellek-içi yedek

// Admin (site sahibi) hiç izlenmez — istatistikleri kendi gezintimizle kirletmeyelim.
// localStorage'tan her seferinde okunur: context zamanlamasından bağımsız, cihaz başına
// admin girişi yapıldığı andan itibaren geçerli.
function isAdminBrowser() {
  try {
    return !!localStorage.getItem("admin_token");
  } catch {
    return false;
  }
}

function getSessionId() {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem("analytics_sid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("analytics_sid", id);
    }
    return id;
  } catch {
    // sessionStorage erişilemez → boş session_id backend validasyonundan döner;
    // bellek-içi id ile event'ler yine geçerli kalır (sekme ömrü boyunca sabit).
    if (!memorySessionId) memorySessionId = crypto.randomUUID();
    return memorySessionId;
  }
}

export function AnalyticsProvider({ children }) {
  const queue = useRef([]);
  const sessionId = useRef("");
  const sessionStart = useRef(Date.now());
  const pagesVisited = useRef(0);
  const flushTimer = useRef(null);

  useEffect(() => {
    sessionId.current = getSessionId();
    sessionStart.current = Date.now();

    // Periyodik flush
    flushTimer.current = setInterval(() => flush(), FLUSH_INTERVAL);

    // Sayfa kapanırken session_end + kalan event'leri gönder
    const handleUnload = () => {
      if (isAdminBrowser()) return; // site sahibi izlenmez
      const duration = Math.round((Date.now() - sessionStart.current) / 1000);

      queue.current.push({
        type: "session_end",
        page: window.location.pathname,
        data: { duration_seconds: duration, pages_visited: pagesVisited.current },
        session_id: sessionId.current,
      });

      sendAnalyticsBeacon({ events: queue.current });
      queue.current = [];
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      if (flushTimer.current) clearInterval(flushTimer.current);
    };
  }, []);

  const flush = useCallback(() => {
    if (queue.current.length === 0) return;

    const events = [...queue.current];
    queue.current = [];
    postAnalytics("/analytics/batch", { events });
  }, []);

  const enqueue = useCallback((type, page, data) => {
    if (isAdminBrowser()) return; // site sahibi izlenmez
    queue.current.push({
      type,
      page: page || (typeof window !== "undefined" ? window.location.pathname : ""),
      data: data || null,
      session_id: sessionId.current,
    });

    if (queue.current.length >= MAX_QUEUE_SIZE) {
      flush();
    }
  }, [flush]);

  const trackPageView = useCallback((page) => {
    pagesVisited.current++;
    enqueue("page_view", page, null);
  }, [enqueue]);

  const trackSearch = useCallback((query) => {
    enqueue("search", null, { query });
  }, [enqueue]);

  const trackClick = useCallback((element, extra) => {
    enqueue("click", null, { element, ...extra });
  }, [enqueue]);

  return (
    <AnalyticsContext.Provider value={{ trackPageView, trackSearch, trackClick }}>
      <PageTracker trackPageView={trackPageView} />
      {children}
    </AnalyticsContext.Provider>
  );
}

/**
 * Sayfa değişimlerini otomatik izle.
 */
function PageTracker({ trackPageView }) {
  const pathname = usePathname();
  const prevPath = useRef(null);

  useEffect(() => {
    // Admin sayfalarini track etme
    if (pathname && pathname !== prevPath.current && !pathname.startsWith("/admin")) {
      prevPath.current = pathname;
      trackPageView(pathname);
    }
  }, [pathname, trackPageView]);

  return null;
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}
