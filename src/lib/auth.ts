import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { getServerSession } from "next-auth";
import {
  adminEmailConfigured,
  adminLoginIdMatches,
  adminPasswordHashConfigured,
  adminPasswordPlaintextMisconfigured,
  verifyAdminPassword,
} from "./admin-password";
import { verifyCaptainLogin } from "./captain-accounts";
import { prisma } from "./prisma";
import { AuctionError } from "./auction-lock";
import { isSiteAdmin } from "./site-admin";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
    }),
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin",
      credentials: {
        email: { label: "Username or email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (adminPasswordPlaintextMisconfigured()) return null;
        const login = credentials?.email?.trim() ?? "";
        const password = credentials?.password ?? "";
        const hash = adminPasswordHashConfigured();
        if (!hash || !login || !password) return null;
        if (!adminLoginIdMatches(login)) return null;
        if (!verifyAdminPassword(password, hash)) return null;
        const email = adminEmailConfigured() ?? `${login}@admin.local`;
        return {
          id: `admin:${email}`,
          email,
          name: adminEmailConfigured() ? "Admin" : login,
        };
      },
    }),
    CredentialsProvider({
      id: "captain-credentials",
      name: "Captain",
      credentials: {
        loginName: { label: "Captain login", type: "text" },
        passcode: { label: "Passcode", type: "password" },
      },
      async authorize(credentials) {
        const loginName = credentials?.loginName?.trim() ?? "";
        const passcode = credentials?.passcode ?? "";
        if (!loginName || !passcode) return null;
        const captain = await verifyCaptainLogin({ loginName, passcode });
        if (!captain) return null;
        return {
          id: `captain:${captain.accountId}`,
          name: captain.teamName,
          email: `${captain.loginName}@captain.local`,
          captainTeamId: captain.teamId,
          captainAccountId: captain.accountId,
          captainAccountToken: captain.accountToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "admin-credentials" && user) {
        token.authProvider = "credentials";
        token.isAdmin = true;
        token.isCaptainBidder = false;
        token.discordId = undefined;
        token.captainTeamId = undefined;
        token.captainAccountId = undefined;
        token.captainAccountToken = undefined;
      } else if (account?.provider === "captain-credentials" && user) {
        token.captainAccountToken = (user as { captainAccountToken?: string }).captainAccountToken;
        token.authProvider = "captain";
        token.isAdmin = false;
        token.isCaptainBidder = true;
        token.discordId = undefined;
        token.captainTeamId = (user as { captainTeamId?: string }).captainTeamId;
        token.captainAccountId = (user as { captainAccountId?: string })
          .captainAccountId;
      } else if (account?.provider === "discord" && token.sub) {
        token.authProvider = "discord";
        token.discordId = token.sub;
        token.isCaptainBidder = false;
        token.captainTeamId = undefined;
        token.captainAccountId = undefined;
        token.captainAccountToken = undefined;
      }

      if (token.authProvider === "credentials") {
        token.isAdmin = true;
      } else if (token.authProvider === "captain") {
        token.isAdmin = false;
        token.isCaptainBidder = true;
      } else if (token.discordId || token.sub) {
        const discordId = (token.discordId as string | undefined) ?? token.sub;
        token.isAdmin = await isSiteAdmin(discordId);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.authProvider === "credentials") {
          session.user.discordId = undefined;
          session.user.isAdmin = true;
          session.user.isCaptainBidder = false;
        } else if (token.authProvider === "captain") {
          session.user.discordId = undefined;
          session.user.isAdmin = false;
          session.user.isCaptainBidder = true;
          session.user.captainTeamId = token.captainTeamId;
          session.user.captainAccountId = token.captainAccountId;
          session.user.captainAccountToken = token.captainAccountToken;
        } else {
          const discordId =
            (token.discordId as string | undefined) ?? token.sub ?? undefined;
          session.user.discordId = discordId;
          session.user.isAdmin = Boolean(token.isAdmin);
          session.user.isCaptainBidder = false;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin",
  },
};

export async function authSession() {
  return getServerSession(authOptions);
}

export async function requireCaptainBidder() {
  const session = await authSession();
  if (!session?.user?.isCaptainBidder || !session.user.captainTeamId) {
    throw new AuctionError("Captain auction login required.", 401);
  }
  return {
    session,
    teamId: session.user.captainTeamId,
    accountId: session.user.captainAccountId,
    accountToken: session.user.captainAccountToken,
  };
}

export async function currentPlayer() {
  const session = await authSession();
  const discordId = session?.user?.discordId;
  if (!discordId) return { session, player: null };
  const player = await prisma.player.findFirst({
    where: {
      OR: [
        { discordId },
        { discordId: { startsWith: `${discordId}:` } },
      ],
    },
    include: { team: true },
  });
  return { session, player };
}
