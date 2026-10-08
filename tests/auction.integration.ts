/** Destructive fixtures, ONLY on the named localhost test database. Never loads .env. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/dota_auction_test" || process.env.AUCTION_TEST_ONLY !== "yes") {
  throw new Error("Refusing to run: requires AUCTION_TEST_ONLY=yes and the isolated localhost:55439/dota_auction_test database.");
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const auction = await import("../src/lib/web-auction");
  const { createSeasonTeam } = await import("../src/lib/season-roster");
  const { adminAddCaptain } = await import("../src/lib/captains");
  const { adminSetAuctionSoldPrice } = await import("../src/lib/match-admin");
  const { setActiveSeason } = await import("../src/lib/seasons");
  if (process.argv[2] === "--bid-worker") {
    try {
      const view = await auction.placeWebBid(JSON.parse(process.argv[3]));
      console.log(JSON.stringify({ accepted: true, amount: view.currentBid }));
    } catch (error) {
      console.log(JSON.stringify({ accepted: false, error: error instanceof Error ? error.message : String(error) }));
    } finally { await prisma.$disconnect(); }
    return;
  }
  let passed = 0;
  const check = (name: string) => { passed++; console.log(`PASS ${name}`); };
  const control = (v: Awaited<ReturnType<typeof auction.getWebAuctionView>>) => ({ lotId: v.lotId!, revision: v.revision });
  async function setDeadline(ms: number) {
    const row = await prisma.auctionState.findUniqueOrThrow({ where: { id: "singleton" } });
    const session = JSON.parse(row.sessionJson!);
    session.endsAtMs = Date.now() + ms;
    session.awaitingDecision = false;
    await prisma.auctionState.update({ where: { id: "singleton" }, data: { endsAt: new Date(session.endsAtMs), sessionJson: JSON.stringify(session) } });
  }
  async function fixture(count: number) {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Season", "Player", "AuctionState", "CupSettings" CASCADE');
    const season = await prisma.season.create({ data: { number: 1, name: "Isolated test", isActive: true, status: "live", teamCount: count } });
    await prisma.cupSettings.create({ data: { id: "singleton", currentSeasonId: season.id, auctionEnabled: true } });
    const players = [];
    for (let i = 0; i < count * 5 + 2; i++) {
      const p = await prisma.player.create({ data: { discordId: `fixture-person-${i}`, discordName: `Captain ${i}`, steam32: 500000 + i, steamName: `Player ${String(i).padStart(3, "0")}`, medal: "archon", rolesJson: '["flex"]' } });
      await prisma.seasonPlayer.create({ data: { seasonId: season.id, playerId: p.id, medal: "archon", rolesJson: '["flex"]' } });
      players.push(p);
    }
    const accounts = [];
    for (let i = 0; i < count; i++) {
      const team = i === 0 ? await adminAddCaptain({ discordId: players[i].discordId, teamName: `Team ${i}` }) : await createSeasonTeam({ name: `Team ${i}`, captainPlayerId: players[i].id, purse: 20000 });
      accounts.push({ teamId: team.id, discordId: players[i].discordId });
    }
    await assert.rejects(createSeasonTeam({ name: "Excess", captainPlayerId: players[count].id, purse: 20000 }), new RegExp(`${count} teams`));
    const outsider = await prisma.player.create({ data: { discordId: "fixture-outsider", discordName: "Outsider", steam32: 999999, steamName: "AAA outsider", medal: "archon", rolesJson: "[]" } });
    const view = await auction.startWebAuction("archon");
    assert.notEqual(view.currentPlayer?.id, outsider.id);
    assert.equal(view.teamBalances.length, count);
    assert.ok(view.teamBalances.every(t => t.rosterCount === 1));
    return { accounts: accounts.map(({ discordId }) => ({ discordId })), view, season };
  }
  try {
    for (const count of [8, 10, 12]) {
      const { accounts, view, season } = await fixture(count);
      check(`${count} teams: dynamic cap, captain membership and season-only eligibility`);
      const bids = accounts.map(account => ({ ...account, lotId: view.lotId!, requestId: randomUUID(), amount: view.currentBid }));
      const began = performance.now();
      const outcomes = count === 10
        ? await Promise.all(bids.map(input => new Promise<{ accepted: boolean }>((resolve, reject) => {
            const child = spawn(process.execPath, ["--import", "tsx", "tests/auction.integration.ts", "--bid-worker", JSON.stringify(input)], { env: process.env });
            let out = "", err = "";
            child.stdout.on("data", chunk => out += chunk);
            child.stderr.on("data", chunk => err += chunk);
            child.on("error", reject);
            child.on("exit", code => { if (code) reject(new Error(err)); else { try { resolve(JSON.parse(out.trim())); } catch { reject(new Error(out + err)); } } });
          })))
        : await Promise.all(bids.map(input => auction.placeWebBid(input).then(() => ({ accepted: true }), () => ({ accepted: false }))));
      assert.equal(outcomes.filter(o => o.accepted).length, 1);
      assert.equal(await prisma.bid.count(), 1);
      console.log(`  ${count} competing requests completed in ${Math.round(performance.now() - began)}ms${count === 10 ? " across 10 separate Node processes" : ""}`);
      const winnerIndex = outcomes.findIndex(o => o.accepted);
      await auction.placeWebBid(bids[winnerIndex]);
      assert.equal(await prisma.bid.count(), 1);
      check(`${count} concurrent exact-price bids: one winner, duplicate request is idempotent`);
      const challengers = bids.filter((_, i) => i !== winnerIndex);
      await Promise.allSettled([auction.placeWebBid({ ...challengers[0], requestId: randomUUID(), amount: 2000 }), auction.placeWebBid({ ...challengers[1], requestId: randomUUID(), amount: 1100 })]);
      assert.equal((await auction.getWebAuctionView()).currentBid, 2000);
      check("highest accepted bid cannot be overwritten by a lower bid");
      await assert.rejects(auction.placeWebBid({ ...challengers[2], lotId: "old-lot", requestId: randomUUID(), amount: 2100 }), /no longer/);
      await assert.rejects(auction.placeWebBid({ ...challengers[2], requestId: randomUUID(), amount: 1.5 }), /whole-number/);
      await assert.rejects(auction.placeWebBid({ ...challengers[2], requestId: randomUUID(), amount: 20000 }), /cannot afford/);
      check("stale player, fractional price and over-budget bids rejected");
      const current = await auction.getWebAuctionView();
      const paused = await auction.pauseWebAuction(control(current));
      await assert.rejects(auction.placeWebBid({ ...challengers[2], requestId: randomUUID(), amount: 2100 }), /paused/);
      await auction.resumeWebAuction(control(paused));
      await assert.rejects(auction.pauseWebAuction(control(current)), /changed/);
      await assert.rejects(auction.confirmWebSold(current.lotId), /clock/);
      await assert.rejects(setActiveSeason(season.id), /Finish the auction/);
      check("pause, stale admin controls, early sale and season change protected");
      await assert.rejects(auction.placeWebBid({ discordId: "fixture-person-" + (count * 5 + 1), lotId: current.lotId!, requestId: randomUUID(), amount: 2100 }), /captains/);
      check("a Discord account that is not a captain cannot bid");
      await setDeadline(200);
      assert.equal((await auction.tickWebAuction()).view.awaitingDecision, false);
      await setDeadline(-1);
      await assert.rejects(auction.placeWebBid({ ...challengers[1], requestId: randomUUID(), amount: 2100 }), /closed/);
      check("deadline uses exact expiry and rejects late bids");
      const before = await auction.getWebAuctionView();
      const teamBefore = await prisma.team.findUniqueOrThrow({ where: { id: before.highBidder!.id } });
      // Inject failure after purse, roster and sale writes but before session advancement.
      await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION auction_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated injected failure'; END $$`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER auction_test_failure BEFORE UPDATE ON "AuctionState" FOR EACH ROW EXECUTE FUNCTION auction_test_fail()`);
      try { await assert.rejects(auction.confirmWebSold(before.lotId)); }
      finally { await prisma.$executeRawUnsafe('DROP TRIGGER auction_test_failure ON "AuctionState"'); }
      assert.equal((await prisma.team.findUniqueOrThrow({ where: { id: teamBefore.id } })).purse, teamBefore.purse);
      assert.equal((await prisma.seasonPlayer.findUniqueOrThrow({ where: { seasonId_playerId: { seasonId: season.id, playerId: before.currentPlayer!.id } } })).teamId, null);
      assert.equal((await prisma.auctionLot.findUniqueOrThrow({ where: { id: before.lotId! } })).status, "open");
      check("database failure rolls back purse, player assignment, sale and auction advancement");
      const sales = await Promise.allSettled([auction.confirmWebSold(before.lotId), auction.confirmWebSold(before.lotId)]);
      assert.equal(sales.filter(s => s.status === "fulfilled").length, 1);
      assert.equal(await prisma.auctionLot.count({ where: { playerId: before.currentPlayer!.id, status: "sold" } }), 1);
      assert.equal((await prisma.team.findUniqueOrThrow({ where: { id: teamBefore.id } })).purse, teamBefore.purse - 2000);
      assert.equal((await prisma.seasonPlayer.findUniqueOrThrow({ where: { seasonId_playerId: { seasonId: season.id, playerId: before.currentPlayer!.id } } })).teamId, teamBefore.id);
      assert.equal((await prisma.player.findUniqueOrThrow({ where: { id: before.currentPlayer!.id } })).teamId, teamBefore.id);
      await assert.rejects(auction.passWebUnsold(before.lotId), /no longer/);
      await assert.rejects(adminSetAuctionSoldPrice({ lotId: before.lotId!, soldPrice: 30000 }), /Finish/);
      // A retry for a committed previous-lot bid does not bid on this new player.
      await auction.placeWebBid(bids[winnerIndex]);
      assert.equal((await auction.getWebAuctionView()).highBidder, null);
      check("duplicate sale settles once; season roster matches; old requests cannot touch next player");
    }
    console.log(`\n${passed} integration checks passed. No production database was used.`);
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
