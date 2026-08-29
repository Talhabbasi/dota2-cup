import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { getServerSession } from "next-auth";
import { isAdminDiscordId } from "./constants";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.discordId = token.sub;
        session.user.isAdmin = isAdminDiscordId(token.sub);
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};

export async function authSession() {
  return getServerSession(authOptions);
}

export async function currentPlayer() {
  const session = await authSession();
  const discordId = session?.user?.discordId;
  if (!discordId) return { session, player: null };
  const player = await prisma.player.findUnique({
    where: { discordId },
    include: { team: true },
  });
  return { session, player };
}
