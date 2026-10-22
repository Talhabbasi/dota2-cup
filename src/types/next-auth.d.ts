import type { DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      discordId?: string;
      isAdmin?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    authProvider?: "discord" | "credentials" | "captain";
    discordId?: string;
    isAdmin?: boolean;
    /** Set on sign-in. Missing or stale values mean the login is cleared. */
    sessionEpoch?: number;
    /** Unix seconds when this login started. Does not slide on each visit. */
    loggedInAt?: number;
    expired?: boolean;
  }
}
