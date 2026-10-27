const LEAKS_INTERNALS =
  /prisma\.|Invalid `|schema\.prisma|Unique constraint|Validation Error|\/Users\/|\/home\/|\\\\Users\\\\|node_modules|invocation in/i;

const PRISMA_REASON: Record<string, string> = {
  P1000: "The database rejected the login. Check DATABASE_URL.",
  P1001: "Cannot reach the database. It may be down, or this machine cannot open the connection.",
  P1002: "The database timed out before it answered.",
  P1008: "The database operation timed out.",
  P1017: "The database closed the connection.",
  P2021: "A required database table is missing. The schema may not be applied.",
  P2022: "A required database column is missing. The schema may not be applied.",
  P2024: "The database connection pool timed out. Too many requests were waiting.",
  P2025: "That record was not found.",
  P2003: "That change points at a record that does not exist.",
  P2034: "The database changed at the same time. Try again.",
};

const NETWORK_REASON: Record<string, string> = {
  ENOTFOUND: "The server hostname could not be resolved.",
  ECONNREFUSED: "The server refused the connection.",
  ECONNRESET: "The connection was reset before a response arrived.",
  ETIMEDOUT: "The request timed out.",
  UND_ERR_CONNECT_TIMEOUT: "The request timed out while connecting.",
  UND_ERR_HEADERS_TIMEOUT: "The server did not send a response in time.",
  UND_ERR_SOCKET: "The network connection dropped.",
};

/** Next.js uses these digests for redirect() and notFound(). They must keep throwing. */
export function rethrowFrameworkError(error: unknown): void {
  if (!error || typeof error !== "object" || !("digest" in error)) return;
  const digest = String((error as { digest?: unknown }).digest ?? "");
  if (
    digest.startsWith("NEXT_REDIRECT") ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") ||
    digest.startsWith("NEXT_NOT_FOUND")
  ) {
    throw error;
  }
}

function prismaCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && /^P\d+/.test(code)) return code;
  }
  return undefined;
}

function uniqueFields(error: unknown): string[] {
  if (error && typeof error === "object" && "meta" in error) {
    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    if (Array.isArray(target)) {
      return target.filter((field): field is string => typeof field === "string");
    }
    if (typeof target === "string" && target.trim()) return [target];
  }
  return [];
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

function causeCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("cause" in error)) return undefined;
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return undefined;
  if ("code" in cause && typeof (cause as { code?: unknown }).code === "string") {
    return (cause as { code: string }).code;
  }
  return undefined;
}

/** Strip secrets, query text, and local paths from a message shown to people. */
export function redactFailureText(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[database]")
    .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[database]")
    .replace(/Bot\s+[A-Za-z0-9._-]{10,}/g, "Bot [redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(
      /(api[_-]?key|token|secret|password|authorization)=([^&\s]+)/gi,
      "$1=[redacted]",
    )
    .replace(/\/Users\/\S+/g, "[path]")
    .replace(/\/home\/\S+/g, "[path]")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueConstraintMessage(fields: string[]): string {
  if (fields.includes("steam32")) return "That Steam account is already registered.";
  if (fields.includes("discordId")) return "This Discord account is already registered.";
  if (fields.includes("number")) return "That season number already exists.";
  if (fields.includes("alias")) return "That alias is already used.";
  if (fields.length > 0) {
    return `That value is already taken (${fields.join(", ")}).`;
  }
  return "That record already exists.";
}

function networkReason(error: unknown): string | null {
  const code = causeCode(error);
  if (code && NETWORK_REASON[code]) return NETWORK_REASON[code];
  const message = errorMessage(error);
  if (/fetch failed/i.test(message) && code && NETWORK_REASON[code]) {
    return NETWORK_REASON[code];
  }
  if (/fetch failed/i.test(message)) {
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : "";
    const safe = cause ? redactFailureText(cause) : "";
    return safe && !LEAKS_INTERNALS.test(safe)
      ? `The request failed before a response arrived. ${safe}`
      : "The request failed before a response arrived.";
  }
  if (code === "ABORT_ERR" || /aborted/i.test(message)) {
    return "The request timed out.";
  }
  return null;
}

/**
 * A short reason safe to show in the UI or an API response.
 * Prisma query text, tokens, and filesystem paths stay on the server log.
 */
export function publicErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Try again.",
): string {
  const code = prismaCode(error);
  if (code === "P2002") return uniqueConstraintMessage(uniqueFields(error));
  if (code && PRISMA_REASON[code]) return PRISMA_REASON[code];

  const network = networkReason(error);
  if (network) return network;

  const raw = errorMessage(error);
  if (/unique constraint/i.test(raw)) {
    return uniqueConstraintMessage(
      [...raw.matchAll(/\(([^)]+)\)/g)].flatMap((match) =>
        match[1]
          .split(",")
          .map((field) => field.replace(/[`"\s]/g, ""))
          .filter(Boolean),
      ),
    );
  }
  if (/can't reach database server/i.test(raw)) {
    const host = raw.match(/at `([^`]+)`/i)?.[1];
    return host
      ? `Cannot reach the database at ${host}.`
      : "Cannot reach the database.";
  }
  if (/timed out fetching a new connection/i.test(raw)) {
    return PRISMA_REASON.P2024;
  }

  const message = redactFailureText(raw).replace(/\*\*/g, "");
  if (!message) return code ? `${fallback} (${code})` : fallback;
  if (error instanceof Error && error.name.startsWith("Prisma")) {
    return code ? `${fallback} (${code})` : fallback;
  }
  if (LEAKS_INTERNALS.test(message)) {
    return code ? `${fallback} (${code})` : fallback;
  }
  return message.slice(0, 280);
}

/**
 * Log an upstream HTTP failure and return a one-line reason.
 * Does not read the original body, so the caller can still parse it.
 */
export async function noteFailedResponse(
  label: string,
  res: Response,
): Promise<string> {
  let detail = "";
  try {
    const raw = (await res.clone().text()).replace(/\s+/g, " ").trim();
    if (raw && !raw.startsWith("<")) {
      try {
        const parsed = JSON.parse(raw) as {
          message?: unknown;
          error?: unknown;
          error_description?: unknown;
        };
        const fromMessage =
          typeof parsed.message === "string" ? parsed.message : "";
        const fromError =
          typeof parsed.error === "string"
            ? parsed.error
            : parsed.error &&
                typeof parsed.error === "object" &&
                "message" in parsed.error &&
                typeof (parsed.error as { message?: unknown }).message === "string"
              ? (parsed.error as { message: string }).message
              : "";
        const fromDescription =
          typeof parsed.error_description === "string"
            ? parsed.error_description
            : "";
        detail = redactFailureText(fromMessage || fromError || fromDescription || raw);
      } catch {
        detail = redactFailureText(raw);
      }
    }
  } catch {
    detail = "";
  }
  const status = `${res.status}${res.statusText ? ` ${res.statusText}` : ""}`;
  const reason = detail
    ? `${label} failed (${status}): ${detail.slice(0, 180)}`
    : `${label} failed (${status}).`;
  console.error(reason);
  return reason;
}
