"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useAdminToast } from "@/components/admin/admin-toast";
import {
  adminBtnClass,
  adminBtnDangerClass,
  adminBtnGhostClass,
  adminBtnPrimaryClass,
  adminBtnSecondaryClass,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";

const AdminFormPendingContext = createContext(false);

export function AdminSubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const pending = useContext(AdminFormPendingContext);
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={cn(
        adminBtnClass,
        variant === "primary" && adminBtnPrimaryClass,
        variant === "secondary" && adminBtnSecondaryClass,
        variant === "danger" && adminBtnDangerClass,
        variant === "ghost" && adminBtnGhostClass,
        className,
        pending && "opacity-70",
      )}
      {...props}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span
            className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
            aria-hidden
          />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

type AdminActionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
  successMessage?: string;
  /** When set, show themed confirm modal before running the action. */
  confirmMessage?: string;
  confirmTitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

/**
 * Admin form wrapper: runs the server action, refreshes RSC tree, shows toast.
 * Use `confirmMessage` for sensitive saves (replaces window.confirm).
 */
export function AdminActionForm({
  action,
  children,
  className,
  successMessage = "Saved",
  confirmMessage,
  confirmTitle = "Confirm action",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: AdminActionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useAdminToast();
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, pending]);

  function runSave(formData: FormData) {
    setOpen(false);
    startTransition(async () => {
      try {
        await action(formData);
        router.refresh();
        toast.success(successMessage);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not save. Try again.",
        );
      }
    });
  }

  const modal =
    open && mounted && confirmMessage
      ? createPortal(
          <div className="admin-confirm-root" role="presentation">
            <button
              type="button"
              className="admin-confirm-backdrop"
              aria-label="Dismiss"
              disabled={pending}
              onClick={() => setOpen(false)}
            />
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descId}
              className="admin-confirm-dialog"
            >
              <p
                id={titleId}
                className="m-0 text-[0.65rem] font-semibold tracking-[0.16em] text-[#8eb4ff] uppercase"
              >
                {confirmTitle}
              </p>
              <p
                id={descId}
                className="mt-3 mb-0 text-base leading-relaxed text-foreground"
              >
                {confirmMessage}
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  ref={cancelRef}
                  type="button"
                  className={cn(adminBtnClass, adminBtnGhostClass)}
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  className={cn(adminBtnClass, adminBtnPrimaryClass)}
                  disabled={pending}
                  onClick={() => {
                    const form = formRef.current;
                    if (form) runSave(new FormData(form));
                  }}
                >
                  {pending ? "Saving…" : confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <AdminFormPendingContext.Provider value={pending}>
      <form
        ref={formRef}
        className={cn(className, pending && "pointer-events-none opacity-70")}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (pending) return;
          const formData = new FormData(event.currentTarget);
          if (confirmMessage) {
            setOpen(true);
            return;
          }
          runSave(formData);
        }}
      >
        {children}
      </form>
      {modal}
    </AdminFormPendingContext.Provider>
  );
}

/** @deprecated Prefer AdminActionForm with confirmMessage. */
export function AdminConfirmForm({
  action,
  message,
  title = "Confirm action",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  successMessage = "Saved",
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  successMessage?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AdminActionForm
      action={action}
      className={className}
      successMessage={successMessage}
      confirmMessage={message}
      confirmTitle={title}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
    >
      {children}
    </AdminActionForm>
  );
}
