import { randomBytes } from "node:crypto";
import { BID_CLOCK_SECONDS, BID_INCREMENT, MAX_ROSTER, MIN_ROSTER,
  MEDAL_LABELS, basePriceFor, parseMedal, type Medal } from "./constants";
import { prisma } from "./prisma";
import { isDummyDiscordId } from "./dummy";
import { AuctionError, withAuctionLock, requireAuctionSeason, type AuctionDb } from "./auction-lock";

export const AUCTION_PLAYER_STATUS = {
  UNSOLD: "UNSOLD",
  ON_AUCTION: "ON_AUCTION",
  SOLD: "SOLD",
} as const;

type WebPlayer = {
  id: string;
  steamName: string;
  medal: string;
  rolesJson: string;
  basePrice: number;
};

type WebTeam = {
  id: string;
  name: string;
  purse: number;
  rosterCount: number;
};

export type WebSale = {
  playerName: string;
  teamName: string | null;
  price: number | null;
  medal: string;
  rolesJson: string;
  balances: { name: string; purse: number; rosterCount: number }[];
};

export type WebAuctionSession = {
  version: 2;
  revision: number;
  lotId: string | null;
  pausedRemainingMs: number | null;
  seasonId: string;
  status: "idle" | "running" | "paused";
  medal: Medal | null;
  queue: string[];
  currentPlayerId: string | null;
  currentBid: number;
  currentBidderTeamId: string | null;
  endsAtMs: number | null;
  awaitingDecision: boolean;
  event: "idle" | "lot" | "bid" | "sold" | "unsold" | "done";
  players: Record<string, WebPlayer>;
  teams: Record<string, WebTeam>;
  lastSale: WebSale | null;
  channelId: string | null;
  messageId: string | null;
};

export type WebAuctionView = {
  revision: number;
  serverTime: number;
  status: WebAuctionSession["status"];
  medal: string | null;
  medalLabel: string | null;
  secondsLeft: number;
  endsAt: Date | null;
  currentBid: number;
  currentPlayer: WebPlayer | null;
  lotId: string | null;
  highBidder: { id: string; name: string } | null;
  remainingInPool: number;
  awaitingDecision: boolean;
  event: WebAuctionSession["event"];
  lastSale: WebSale | null;
  teamBalances: { id: string; name: string; purse: number; rosterCount: number }[];
  seasonId: string | null;
  channelId: string | null;
  messageId: string | null;
  sandbox: false;
};

export type AuctionControl = { lotId: string; revision: number };
export type BidInput = {
  teamId?: string;
  accountId?: string;
  accountToken?: string;
  discordId?: string;
  amount?: number;
  bump?: number;
  lotId: string;
  requestId: string;
};

function parseSession(row: { sessionJson: string | null } | null): WebAuctionSession | null {
  if (!row?.sessionJson) return null;
  let session: WebAuctionSession;
  try { session = JSON.parse(row.sessionJson); }
  catch { throw new AuctionError("Auction state could not be read. Contact the organizer.", 503); }
  if (session.version !== 2) {
    // Never reinterpret an old player ID as a new lot or silently continue an old auction.
    if (session.status !== "idle") throw new AuctionError("An older auction is still open. Finish it using the previous release before upgrading.", 503);
    return null;
  }
  return session;
}

async function readSession(db: AuctionDb = prisma) {
  return parseSession(await db.auctionState.findUnique({ where: { id: "singleton" } }));
}

function expired(session: WebAuctionSession, now = Date.now()) {
  return session.status === "running" && session.endsAtMs !== null && session.endsAtMs <= now;
}

function balances(session: WebAuctionSession) {
  return Object.values(session.teams).sort((a,b) => a.name.localeCompare(b.name));
}

function viewFrom(session: WebAuctionSession | null): WebAuctionView {
  const now = Date.now();
  const bidder = session?.currentBidderTeamId ? session.teams[session.currentBidderTeamId] : null;
  return {
    revision: session?.revision ?? 0,
    serverTime: now,
    status: session?.status ?? "idle",
    medal: session?.medal ?? null,
    medalLabel: session?.medal ? MEDAL_LABELS[session.medal] : null,
    secondsLeft: session?.status === "paused"
      ? Math.ceil((session.pausedRemainingMs ?? 0) / 1000)
      : Math.max(0, Math.ceil(((session?.endsAtMs ?? now) - now) / 1000)),
    endsAt: session?.endsAtMs ? new Date(session.endsAtMs) : null,
    currentBid: session?.currentBid ?? 0,
    currentPlayer: session?.currentPlayerId ? session.players[session.currentPlayerId] ?? null : null,
    lotId: session?.lotId ?? null,
    highBidder: bidder ? { id: bidder.id, name: bidder.name } : null,
    remainingInPool: session?.queue.length ?? 0,
    awaitingDecision: session ? session.awaitingDecision || expired(session, now) : false,
    event: session?.event ?? "idle",
    lastSale: session?.lastSale ?? null,
    teamBalances: session ? balances(session) : [],
    seasonId: session?.seasonId ?? null,
    channelId: session?.channelId ?? null,
    messageId: session?.messageId ?? null,
    sandbox: false,
  };
}

async function writeSession(db: AuctionDb, session: WebAuctionSession) {
  session.revision++;
  const data = {
    status: session.status, role: session.medal, currentPlayerId: session.currentPlayerId,
    currentLotId: session.lotId, currentBid: session.currentBid,
    currentBidderTeamId: session.currentBidderTeamId,
    endsAt: session.endsAtMs === null ? null : new Date(session.endsAtMs),
    queueJson: JSON.stringify(session.queue), seasonId: session.seasonId,
    awaitingDecision: session.awaitingDecision, event: session.event,
    sessionJson: JSON.stringify(session), lastSaleJson: session.lastSale ? JSON.stringify(session.lastSale) : null,
  };
  await db.auctionState.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
}

async function activeSession(db: AuctionDb) {
  const session = await readSession(db);
  if (!session || session.status === "idle") throw new AuctionError("No auction running.");
  const season = await requireAuctionSeason(db);
  const settings = await db.cupSettings.findUnique({ where: { id: "singleton" } });
  if (season.id !== session.seasonId || season.tournamentFormat !== "AUCTION_BASED" || settings?.auctionEnabled === false) {
    throw new AuctionError("This auction is no longer active. Contact the organizer.");
  }
  return session;
}

function requireLot(session: WebAuctionSession, lotId?: string | null) {
  if (!lotId || lotId !== session.lotId || !session.currentPlayerId) {
    throw new AuctionError("This player is no longer on the block. Refresh the auction.");
  }
}

function requireControl(session: WebAuctionSession, control?: AuctionControl) {
  requireLot(session, control?.lotId);
  if (!control || control.revision !== session.revision) {
    throw new AuctionError("The auction changed. Review the latest bid and try again.");
  }
}

async function refreshTeams(db: AuctionDb, session: WebAuctionSession) {
  const teams = await db.team.findMany({ where: { seasonId: session.seasonId }, include: { _count: { select: { seasonPlayers: true } } } });
  session.teams = Object.fromEntries(teams.map(t => [t.id, { id:t.id, name:t.name, purse:t.purse, rosterCount:t._count.seasonPlayers }]));
}

async function openLot(db: AuctionDb, session: WebAuctionSession, playerId: string) {
  const membership = await db.seasonPlayer.findUnique({ where: { seasonId_playerId: { seasonId:session.seasonId, playerId } } });
  if (!membership || membership.teamId) throw new AuctionError("The next player is no longer eligible. Contact the organizer.");
  const player = session.players[playerId];
  const lot = await db.auctionLot.create({ data: { seasonId:session.seasonId, playerId, role:player.medal, status:"open" } });
  session.lotId = lot.id;
  session.currentPlayerId = playerId;
  session.currentBid = player.basePrice;
  session.currentBidderTeamId = null;
  session.endsAtMs = null;
  session.pausedRemainingMs = null;
  session.awaitingDecision = false;
  session.event = "lot";
  await db.player.update({ where:{id:playerId}, data:{auctionStatus:AUCTION_PLAYER_STATUS.ON_AUCTION} });
}

export async function getWebAuctionView() {
  return viewFrom(await readSession());
}

/** Let live pages render their reconnecting state while Neon is waking up. */
export async function getWebAuctionViewOrEmpty() {
  try {
    return await getWebAuctionView();
  } catch (error) {
    console.error("Initial auction view unavailable", error);
    return viewFrom(null);
  }
}

export async function startWebAuction(rankInput: string) {
  const medal = parseMedal(rankInput);
  return withAuctionLock(async db => {
    const season = await requireAuctionSeason(db);
    const settings = await db.cupSettings.findUnique({ where:{id:"singleton"} });
    if (settings?.auctionEnabled === false || season.tournamentFormat !== "AUCTION_BASED") throw new AuctionError("Auction is turned off for this season.");
    const existing = await readSession(db);
    if (existing && existing.status !== "idle") throw new AuctionError("Finish the current pool first.");
    const members = await db.seasonPlayer.findMany({ where:{seasonId:season.id, teamId:null, isCaptain:false}, include:{player:true}, orderBy:{player:{steamName:"asc"}} });
    const eligible = members.filter(m => !isDummyDiscordId(m.player.discordId) && (m.medal ?? m.player.medal).toLowerCase() === medal);
    if (!eligible.length) throw new AuctionError(`No unsigned ${MEDAL_LABELS[medal]} players registered in this season.`);
    const session: WebAuctionSession = {
      version:2, revision:existing?.revision ?? 0, lotId:null, pausedRemainingMs:null,
      seasonId:season.id, status:"running", medal, queue:eligible.map(m=>m.playerId), currentPlayerId:null,
      currentBid:0, currentBidderTeamId:null, endsAtMs:null, awaitingDecision:false, event:"lot",
      players:Object.fromEntries(eligible.map(m=>[m.playerId,{id:m.playerId, steamName:m.player.steamName, medal:m.medal ?? m.player.medal, rolesJson:m.rolesJson ?? m.player.rolesJson, basePrice:m.player.basePrice ?? basePriceFor(m.medal ?? m.player.medal)}])),
      teams:{}, lastSale:null, channelId:null, messageId:null,
    };
    if (Object.values(session.players).some(p=>!Number.isSafeInteger(p.basePrice) || p.basePrice < 1)) throw new AuctionError("All player base prices must be positive whole numbers.");
    await refreshTeams(db,session);
    if (Object.keys(session.teams).length !== season.teamCount) throw new AuctionError(`Create all ${season.teamCount} teams before starting.`);
    const teamCaptains = await db.team.findMany({
      where: { seasonId: season.id },
      select: {
        captainId: true,
        seasonPlayers: { where: { isCaptain: true }, select: { playerId: true } },
      },
    });
    const captainsAreAssigned = teamCaptains.length === season.teamCount && teamCaptains.every(
      team => team.seasonPlayers.length === 1 && team.seasonPlayers[0].playerId === team.captainId,
    );
    if (!captainsAreAssigned || Object.values(session.teams).some(t=>t.rosterCount<1 || t.rosterCount>MAX_ROSTER || t.purse<0)) throw new AuctionError("Check each team's captain, roster, and purse before starting.");
    await openLot(db,session,session.queue.shift()!);
    await db.season.update({where:{id:season.id},data:{phase:"AUCTION_ACTIVE"}});
    await writeSession(db,session);
    return viewFrom(session);
  });
}

export function startWebTimer(control?: AuctionControl) { return controlAuction("timer",control); }
export function resetWebTimer(control?: AuctionControl) { return controlAuction("timer",control); }
export function pauseWebAuction(control?: AuctionControl) { return controlAuction("pause",control); }
export function resumeWebAuction(control?: AuctionControl) { return controlAuction("resume",control); }

async function controlAuction(action:"timer"|"pause"|"resume",control?:AuctionControl) {
  return withAuctionLock(async db=>{
    const session=await activeSession(db);
    requireControl(session,control);
    const now=Date.now();
    if(action === "resume") {
      if(session.status !== "paused") throw new AuctionError("Auction is not paused.");
      session.status="running";
      if(session.pausedRemainingMs !== null) session.endsAtMs=now+session.pausedRemainingMs;
      session.pausedRemainingMs=null;
    } else {
      if(session.status !== "running") throw new AuctionError("Auction is not running.");
      if(action === "pause") {
        session.awaitingDecision=expired(session,now);
        session.pausedRemainingMs=session.endsAtMs === null ? null : Math.max(0,session.endsAtMs-now);
        session.endsAtMs=null;
        session.status="paused";
      } else {
        session.endsAtMs=now+BID_CLOCK_SECONDS*1000;
        session.awaitingDecision=false;
      }
    }
    session.event="bid";
    await writeSession(db,session);
    return viewFrom(session);
  });
}

function validInteger(value:unknown) { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647; }

export async function placeWebBid(input:BidInput) {
  if (!input.lotId || typeof input.requestId !== "string" || !/^[\w-]{8,100}$/.test(input.requestId)) throw new AuctionError("A lot and request identifier are required.",400);
  if ((input.amount !== undefined && !validInteger(input.amount)) || (input.bump !== undefined && (!validInteger(input.bump) || input.bump < BID_INCREMENT)) || (input.amount === undefined && input.bump === undefined) || (input.amount !== undefined && input.bump !== undefined)) throw new AuctionError("Provide one positive whole-number bid or increment.",400);
  return withAuctionLock(async db=>{
    const season=await requireAuctionSeason(db);
    let teamId=input.teamId;
    if(input.discordId) {
      const captain=await db.seasonPlayer.findFirst({where:{seasonId:season.id,isCaptain:true,player:{OR:[{discordId:input.discordId},{discordId:{startsWith:`${input.discordId}:`}}]}}});
      teamId=captain?.teamId ?? undefined;
    } else {
      const account=input.accountId ? await db.captainAccount.findUnique({where:{id:input.accountId}}) : null;
      if(!account || account.revokedAt || account.seasonId !== season.id || account.teamId !== teamId || !input.accountToken || account.token !== input.accountToken) throw new AuctionError("Captain access expired or was revoked. Sign in again.",403);
    }
    if(!teamId) throw new AuctionError("Only this season's captains can bid.",403);
    const bidId=`bid:${input.requestId}`;
    const previous=await db.bid.findUnique({where:{id:bidId}});
    if(previous) {
      if(previous.teamId !== teamId || previous.lotId !== input.lotId || (input.amount !== undefined && previous.amount !== input.amount)) throw new AuctionError("This request identifier has already been used.");
      return viewFrom(await readSession(db));
    }
    const session=await activeSession(db);
    requireLot(session,input.lotId);
    if(session.status !== "running") throw new AuctionError("Auction is paused.");
    if(session.awaitingDecision || expired(session)) throw new AuctionError("Bidding closed. Waiting for Sold or Pass.");
    await refreshTeams(db,session);
    const team=session.teams[teamId];
    if(!team) throw new AuctionError("Team not found in this auction.",403);
    const member=await db.seasonPlayer.findUnique({where:{seasonId_playerId:{seasonId:session.seasonId,playerId:session.currentPlayerId!}}});
    if(!member || member.teamId) throw new AuctionError("This player is no longer available.");
    const amount=input.amount ?? (session.currentBidderTeamId ? session.currentBid+input.bump! : session.currentBid);
    const minimum=session.currentBidderTeamId ? session.currentBid+BID_INCREMENT : session.currentBid;
    if(!validInteger(amount) || amount<minimum) throw new AuctionError(`Bid changed. Minimum bid is ${minimum}.`);
    if(session.currentBidderTeamId===teamId) throw new AuctionError("You are already the high bidder.");
    await checkBudget(db,session,team,amount);
    // Recheck after database work, while still holding the lock. A queued request gets no extra time.
    if(expired(session)) throw new AuctionError("Bidding closed before your bid could be accepted.");
    await db.bid.create({data:{id:bidId,lotId:session.lotId!,playerId:session.currentPlayerId!,teamId,amount}});
    session.currentBid=amount;
    session.currentBidderTeamId=teamId;
    session.endsAtMs=Date.now()+BID_CLOCK_SECONDS*1000;
    session.event="bid";
    await writeSession(db,session);
    return viewFrom(session);
  });
}

async function checkBudget(db:AuctionDb,session:WebAuctionSession,team:WebTeam,amount:number) {
  if(team.rosterCount>=MAX_ROSTER) throw new AuctionError(`${team.name} already has ${MAX_ROSTER} players.`);
  const needed=Math.max(0,MIN_ROSTER-team.rosterCount-1);
  // Reserve the cheapest remaining eligible players, across all medal pools.
  const available=await db.seasonPlayer.findMany({where:{seasonId:session.seasonId,teamId:null,isCaptain:false,playerId:{not:session.currentPlayerId!}},include:{player:true}});
  const floors=available.filter(m=>!isDummyDiscordId(m.player.discordId)).map(m=>m.player.basePrice ?? basePriceFor(m.medal ?? m.player.medal));
  if(floors.some(price=>!Number.isSafeInteger(price) || price<1)) throw new AuctionError("A remaining player's base price is invalid. Contact the organizer.");
  floors.sort((a,b)=>a-b);
  const reserve=floors.slice(0,needed).reduce((sum,n)=>sum+n,0);
  if(floors.length<needed || team.purse<amount+reserve) throw new AuctionError(`${team.name} cannot afford ${amount} while keeping enough to fill ${MIN_ROSTER} starters.`);
}

export function placeWebBidByDiscord(input:{discordId:string;amount?:number;bump?:number;lotId?:string|null;requestId?:string}) {
  return placeWebBid({...input,lotId:input.lotId ?? "",requestId:input.requestId ?? ""});
}

async function settle(kind:"sold"|"unsold",lotId?:string|null,revision?:number) {
  return withAuctionLock(async db=>{
    const session=await activeSession(db);
    requireLot(session,lotId);
    if(revision !== undefined && revision !== session.revision) throw new AuctionError("The auction changed. Review the latest bid before confirming.");
    const lot=await db.auctionLot.findUnique({where:{id:session.lotId!}});
    if(!lot || lot.status !== "open") throw new AuctionError("This lot has already been settled.");
    if(kind === "sold" && !session.awaitingDecision && !expired(session)) throw new AuctionError("Wait for the bidding clock to close before confirming Sold.");
    if(kind === "unsold" && session.currentBidderTeamId && !session.awaitingDecision && !expired(session)) throw new AuctionError("Wait for the bidding clock to close before passing a bid player.");
    await refreshTeams(db,session);
    const playerId=session.currentPlayerId!;
    const player=session.players[playerId];
    const member=await db.seasonPlayer.findUnique({where:{seasonId_playerId:{seasonId:session.seasonId,playerId}}});
    if(!member || member.teamId) throw new AuctionError("This player has already been assigned or is no longer registered.");
    const team=session.currentBidderTeamId ? session.teams[session.currentBidderTeamId] : null;
    if(kind === "sold") {
      if(!team) throw new AuctionError("No high bidder. Use Pass.");
      await checkBudget(db,session,team,session.currentBid);
      const deducted=await db.team.updateMany({where:{id:team.id,purse:{gte:session.currentBid}},data:{purse:{decrement:session.currentBid}}});
      if(deducted.count !== 1) throw new AuctionError("Team budget changed. Review before selling.");
      const assignment={teamId:team.id,teamJoinedAt:new Date(),rosterRole:team.rosterCount>=MIN_ROSTER ? "sub" : null,isCaptain:false};
      await db.seasonPlayer.update({where:{id:member.id},data:assignment});
      await db.player.update({where:{id:playerId},data:{...assignment,auctionStatus:AUCTION_PLAYER_STATUS.SOLD}});
      team.purse-=session.currentBid;
      team.rosterCount++;
    } else {
      await db.player.update({where:{id:playerId},data:{auctionStatus:AUCTION_PLAYER_STATUS.UNSOLD}});
    }
    await db.auctionLot.update({where:{id:lot.id},data:{status:kind,teamId:kind === "sold" ? team!.id : null,soldPrice:kind === "sold" ? session.currentBid : null}});
    session.lastSale={playerName:player.steamName,teamName:kind === "sold" ? team!.name : null,price:kind === "sold" ? session.currentBid : null,medal:player.medal,rolesJson:player.rolesJson,balances:balances(session)};
    const next=session.queue.shift();
    if(next) await openLot(db,session,next);
    else {
      session.status="idle";session.lotId=null;session.currentPlayerId=null;
      session.currentBid=0;session.currentBidderTeamId=null;session.endsAtMs=null;
      session.pausedRemainingMs=null;session.awaitingDecision=false;session.event="done";
      // A medal pool ending does not mean the entire auction has finished.
      const short=Object.values(session.teams).some(t=>t.rosterCount<MIN_ROSTER);
      await db.season.update({where:{id:session.seasonId},data:{phase:short ? "AUCTION_ACTIVE" : "IN_PROGRESS"}});
    }
    await writeSession(db,session);
    return viewFrom(session);
  });
}

export function confirmWebSold(lotId?:string|null,revision?:number) { return settle("sold",lotId,revision); }
export function passWebUnsold(lotId?:string|null,revision?:number) { return settle("unsold",lotId,revision); }
export function introduceNextWebPlayer(control?:AuctionControl) { return passWebUnsold(control?.lotId,control?.revision); }

/** Reads derive deadline state; spectators never mutate the auction. */
export async function tickWebAuction() {
  const view=await getWebAuctionView();
  return {changed:view.awaitingDecision,view};
}

export async function saveWebAuctionMessage(channelId:string,messageId:string) {
  await withAuctionLock(async db=>{
    const session=await readSession(db);
    if(!session) return;
    session.channelId=channelId;session.messageId=messageId;
    // Delivery metadata does not change the bid/control revision.
    session.revision--;
    await writeSession(db,session);
  });
}
export async function clearWebAuctionMessage() {
  await withAuctionLock(async db=>{
    const session=await readSession(db);
    if(!session) return;
    session.messageId=null;session.revision--;
    await writeSession(db,session);
  });
}
export function generateCaptainPasscode() { return randomBytes(8).toString("hex"); }
export function generateCaptainToken() { return randomBytes(24).toString("hex"); }
