import type { DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      discordId?: string;
      isAdmin?: boolean;
      isCaptainBidder?: boolean;
      captainTeamId?: string;
      captainAccountId?: string;
      captainAccountToken?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    authProvider?: "discord" | "credentials" | "captain";
    discordId?: string;
    isAdmin?: boolean;
    isCaptainBidder?: boolean;
    captainTeamId?: string;
    captainAccountId?: string;
      captainAccountToken?: string;
  }
}
