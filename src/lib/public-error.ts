const LEAKS_INTERNALS =
  /prisma\.|Invalid `|schema\.prisma|Unique constraint|Validation Error|\/Users\/|\/home\/|\\\\Users\\\\|node_modules|invocation in/i;

function prismaCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

function uniqueFields(error: unknown): string[] {
  if (error && typeof error === "object" && "meta" in error) {
    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    if (Array.isArray(target)) {
      return target.filter((field): field is string => typeof field === "string");
    }
  }
  return [];
}

export function publicErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Try again.",
): string {
  const code = prismaCode(error);
  if (code === "P2002") {
    const fields = uniqueFields(error);
    if (fields.includes("steam32")) {
      return "That Steam account is already registered.";
    }
    if (fields.includes("discordId")) {
      return "This Discord account is already registered.";
    }
    return "That account is already registered.";
  }
  if (code?.startsWith("P")) {
    return fallback;
  }

  if (error instanceof Error) {
    if (error.name.startsWith("Prisma") || LEAKS_INTERNALS.test(error.message)) {
      return fallback;
    }
    return error.message.replace(/\*\*/g, "");
  }

  return fallback;
}
