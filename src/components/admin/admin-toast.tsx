"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type AdminToastTone = "ok" | "error";

type AdminToastItem = {
  id: number;
  tone: AdminToastTone;
  message: string;
};

type AdminToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const AdminToastContext = createContext<AdminToastApi | null>(null);

export function useAdminToast(): AdminToastApi {
  const ctx = useContext(AdminToastContext);
  if (!ctx) {
    return {
      success: () => {},
      error: () => {},
    };
  }
  return ctx;
}

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AdminToastItem[]>([]);
  const timersRef = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const push = useCallback(
    (tone: AdminToastTone, message: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setItems((prev) => [...prev.slice(-3), { id, tone, message }]);
      const timer = window.setTimeout(() => dismiss(id), 3400);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  const api = useMemo<AdminToastApi>(
    () => ({
      success: (message) => push("ok", message),
      error: (message) => push("error", message),
    }),
    [push],
  );

  return (
    <AdminToastContext.Provider value={api}>
      {children}
      <div
        className="admin-toast-stack"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "admin-toast",
              item.tone === "ok" ? "admin-toast-ok" : "admin-toast-error",
            )}
          >
            <span className="admin-toast-dot" aria-hidden />
            <span className="min-w-0 flex-1">{item.message}</span>
            <button
              type="button"
              className="admin-toast-dismiss"
              aria-label="Dismiss"
              onClick={() => dismiss(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </AdminToastContext.Provider>
  );
}
