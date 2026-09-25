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
        } else {
          const discordId =
            (token.discordId as string | undefined) ?? token.sub ?? undefined;
          session.user.discordId = discordId;
          session.user.isAdmin = Boolean(token.isAdmin);
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
