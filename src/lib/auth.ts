import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { getServerSession } from "next-auth";
import {
  adminLoginForHost,
  verifyAdminPassword,
} from "./admin-password";
import { prisma } from "./prisma";
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
      async authorize(credentials, req) {
        const forwarded = req?.headers?.["x-forwarded-host"];
        const hostHeader = Array.isArray(forwarded)
          ? forwarded[0]
          : forwarded || (Array.isArray(req?.headers?.host) ? req.headers.host[0] : req?.headers?.host);
        const account = adminLoginForHost(hostHeader);
        const login = credentials?.email?.trim().toLowerCase() ?? "";
        const password = credentials?.password ?? "";
        if (!account || !login || !password) return null;
        if (login !== account.loginId) return null;
        if (!verifyAdminPassword(password, account.hash)) return null;
        return {
          id: `admin:${account.email}`,
          email: account.email,
          name: account.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "admin-credentials" && user) {
        token.authProvider = "credentials";
        token.isAdmin = true;
        token.discordId = undefined;
      } else if (account?.provider === "discord" && token.sub) {
        token.authProvider = "discord";
        token.discordId = token.sub;
      }

      if (token.authProvider === "credentials") {
        token.isAdmin = true;
      } else if (token.authProvider !== "captain" && (token.discordId || token.sub)) {
        const discordId = (token.discordId as string | undefined) ?? token.sub;
        token.isAdmin = await isSiteAdmin(discordId);
      } else {
        // Tokens from the removed captain passcode login carry no Discord identity.
        token.isAdmin = false;
        token.discordId = undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.authProvider === "credentials") {
          session.user.discordId = undefined;
          session.user.isAdmin = true;
        } else if (token.authProvider !== "captain") {
          session.user.discordId =
            (token.discordId as string | undefined) ?? token.sub ?? undefined;
          session.user.isAdmin = Boolean(token.isAdmin);
        } else {
          session.user.discordId = undefined;
          session.user.isAdmin = false;
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
