# Deploying MM Dota Cup (production)

The **website** (Vercel) and **Discord bot** (Railway, Render, or a VPS) share one **Postgres** database. Discord registrations, auctions, matches, and the public site all read/write the same data.

## Architecture

```
┌─────────────┐     DATABASE_URL      ┌──────────────┐
│   Vercel    │ ────────────────────► │              │
│  (Next.js)  │                       │   Postgres   │
└─────────────┘                       │ (Neon, etc.) │
                                      │              │
┌─────────────┐     DATABASE_URL      │              │
│ Discord bot │ ────────────────────► │              │
│  (Railway)  │                       └──────────────┘
└─────────────┘
```

## 1. Create Postgres (one database for both)

Recommended: [Neon](https://neon.tech) or **Vercel Postgres** (Storage tab in your Vercel project).

From the provider you get two URLs:

| Variable | Use |
|----------|-----|
| `DATABASE_URL` | **Pooled** connection (Neon `*-pooler` host). Website + bot runtime. |
| `DIRECT_URL` | **Direct** connection. `npm run db:push` only. |

If your host has no pooler, set `DIRECT_URL` to the same value as `DATABASE_URL`.

### Apply schema (once)

On your machine (or CI), with production URLs in `.env`:

```bash
npm install
npm run db:push
```

This creates all tables in the shared database. Re-run after schema changes.

> **Note:** Old SQLite data in `prisma/dev.db` is not migrated automatically. Re-register players in Discord or run `npm run seed` if you use the seed script.

---

## 2. Deploy website on Vercel

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com).
2. Vercel detects Next.js; `vercel.json` runs `prisma generate && next build`.
3. Add **Environment variables** (Production + Preview as needed):

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Pooled Postgres URL |
| `DIRECT_URL` | Yes | Direct URL (Vercel may only need this for builds if you add a build-time push; runtime uses `DATABASE_URL`) |
| `NEXTAUTH_URL` | Yes | `https://your-app.vercel.app` or custom domain |
| `NEXTAUTH_SECRET` | Yes | Long random string |
| `DISCORD_CLIENT_ID` | For login | Same Discord application as the bot |
| `DISCORD_CLIENT_SECRET` | For login | OAuth secret |
| `ADMIN_DISCORD_IDS` | Optional | Comma-separated admin user IDs |
| `ADMIN_ROLE_NAME` | Optional | Default `Admin` |

Do **not** put `DISCORD_TOKEN` on Vercel — that stays on the bot host only.

4. Deploy. Open the site URL and check `/`, `/teams`, `/table`.

### Custom domain

Add the domain in Vercel → Settings → Domains, then set `NEXTAUTH_URL` to `https://your-domain.com`.

---

## 3. Deploy Discord bot (24/7)

The bot cannot run on Vercel. Use **Railway**, **Render**, **Fly.io**, or a VPS.

### Railway / Render example

1. New service from the same GitHub repo.
2. **Start command:** `npm run bot`
3. **Build command:** `npm install` (or `npm ci`)
4. Set the **same** env vars as local `.env`, including:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Same pooled Postgres URL as Vercel |
| `DISCORD_TOKEN` | Bot token |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_GUILD_ID` | Your server ID |
| `SCHEDULE_UTC_OFFSET_HOURS` | `5` for Pakistan |
| `SCHEDULE_MATCH_HOUR_LOCAL` | `23` |
| `SCHEDULE_MATCH_MINUTE_LOCAL` | `30` |
| `REMINDER_MINUTES_BEFORE` | `60` |
| `REMINDER_CHANNEL_NAME` | `general` |
| `RULES_CHANNEL_NAME` | `general` |
| `AUTO_POST_CHANNEL_RULES` | `false` |

`DIRECT_URL` is optional on the bot host unless you run `db:push` from there.

### pm2 on a VPS

```bash
npm ci
npm run build          # only if you also host the site on the same machine
pm2 start npm --name dota-cup-bot -- run bot
pm2 save && pm2 startup
```

---

## 4. Discord application setup

1. [Discord Developer Portal](https://discord.com/developers/applications) → your app.
2. **OAuth2 → Redirects:** add `https://your-site-url/api/auth/callback/discord`
3. Bot → enable **Message Content** intent (for `!result`).
4. Invite bot with `applications.commands` + `bot` scopes; grant **Manage Messages** for pinned rules.
5. In Discord as admin:
   - `/rules post` — pins rules in `#general`
   - `/schedule generate` — after rosters are full (regular season is best of 1)
   - `/schedule final` — top 2 play a best-of-3 grand final

Restart the bot after env or slash-command changes.

---

## 5. Local development

```bash
cp .env.example .env
# Fill DATABASE_URL + DIRECT_URL (Neon free tier works for dev)
npm install
npm run db:push
npm run dev      # website
npm run bot      # bot (second terminal)
```

---

## 6. Match screenshots

`!result` saves images to `public/uploads/matches/` on the **bot** machine. Vercel does not see that disk. Screenshots on the website only work if:

- You host the site on the same server as the bot and sync uploads, or
- You add object storage (S3, Vercel Blob) later.

Stats and standings still sync via Postgres.

---

## 7. Health checks

| Check | Expected |
|-------|----------|
| Website `/` | Loads standings / matches |
| Website `/table` | Standings board |
| Discord `/help` | Bot replies |
| Discord `/schedule list` | Fixtures from DB |
| Register on Discord → refresh site | Player appears on `/players` |
