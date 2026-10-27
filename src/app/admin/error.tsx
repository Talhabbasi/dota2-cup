"use client";

const GENERIC =
  /an error occurred in the server components render|digest|unexpected response/i;

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error.message?.trim() ?? "";
  const showMessage = message.length > 0 && !GENERIC.test(message);

  return (
    <div className="page mx-auto flex max-w-lg flex-col gap-4 px-4 py-16">
      <p className="m-0 text-xs font-semibold tracking-[0.16em] text-amber-200/80 uppercase">
        Admin
      </p>
      <h1 className="m-0 font-display text-3xl tracking-wide uppercase">
        This admin page failed
      </h1>
      <p className="m-0 text-sm text-muted-foreground">
        {showMessage
          ? message
          : "The action or page query failed. The reference below matches the error in the server log."}
      </p>
      {error.digest ? (
        <p className="m-0 font-mono text-xs text-muted-foreground">
          Reference {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}
