# MM Dota Cup

Website + Discord bot for MM Dota Cup: registration, auction, teams, and standings. Both use the same **Postgres** database.

## Local setup

```bash
cp .env.example .env
# Set DATABASE_URL + DIRECT_URL (Neon free tier or local Postgres)
npm install
npm run db:push
npm run dev    # website at http://localhost:3000
npm run bot    # Discord bot (separate terminal)
```

## Production (Vercel + bot)

1. Create Postgres (Neon or Vercel Postgres).
2. Run `npm run db:push` once with production `DIRECT_URL`.
3. Deploy the repo to **Vercel** (website) — see [DEPLOY.md](./DEPLOY.md).
4. Deploy the bot to **Railway** / Render / VPS with the **same** `DATABASE_URL`.

Full step-by-step: **[DEPLOY.md](./DEPLOY.md)**
