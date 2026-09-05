import {parseAbi} from "viem";
import {client, TICKERS, FEED_ABI, MARKET_ABI, DEPLOYMENT} from "@/lib/chain";
import {lastClose, nextOpen, scheduleState} from "@/lib/clock";

const POOL = "0xa3b1e3f9747065e2073722ff4c9027d3ea4994f0" as const;
const POOL_ABI = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)",
]);

const Q96 = 2 ** 96;

export type Pulse = {
  now: number;
  symbol: string;
  name: string;
  schedule: "open" | "blackout";
  closedAt: number;
  opensAt: number;
  blackoutHours: number;
  progress: number;
  feed: {price: number; updatedAt: number; staleSeconds: number};
  pool: {price: number};
  driftBps: number;
  market: {
    open: boolean;
    closePrice: number;
    impliedOpen: number;
    collected: number;
    subsidy: number;
  } | null;
};

export async function getPulse(): Promise<Pulse> {
  const ticker = TICKERS[0];
  const now = Math.floor(Date.now() / 1000);
  const schedule = scheduleState(now);
  const closedAt = lastClose(now);
  const opensAt = nextOpen(now);

  const [round, slot0] = await Promise.all([
    client.readContract({address: ticker.feed, abi: FEED_ABI, functionName: "latestRoundData"}),
    client.readContract({address: POOL, abi: POOL_ABI, functionName: "slot0"}),
  ]);

  const updatedAt = Number(round[3]);
  const feedPrice = Number(round[1]) / 1e8;
  const ratio = Number(slot0[0]) / Q96;
  const poolPrice = 100 / (ratio * ratio);

  let market: Pulse["market"] = null;
  if (DEPLOYMENT.market && schedule === "blackout") {
    try {
      const session = await client.readContract({
        address: DEPLOYMENT.market,
        abi: MARKET_ABI,
        functionName: "session",
        args: [BigInt(closedAt)],
      });
      if (session.closedAt !== 0n && !session.resolved) {
        const implied = await client.readContract({
          address: DEPLOYMENT.market,
          abi: MARKET_ABI,
          functionName: "impliedOpen",
          args: [BigInt(closedAt)],
        });
        market = {
          open: true,
          closePrice: Number(session.closePrice) / 1e8,
          impliedOpen: Number(implied) / 1e8,
          collected: Number(session.collected) / 1e6,
          subsidy: Number(session.subsidy) / 1e6,
        };
      }
    } catch {
      market = null;
    }
  }

  const total = opensAt - closedAt;
  const elapsed = schedule === "blackout" ? now - closedAt : 0;

  return {
    now,
    symbol: ticker.symbol,
    name: ticker.name,
    schedule,
    closedAt,
    opensAt,
    blackoutHours: schedule === "blackout" ? total / 3600 : 0,
    progress: total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0,
    feed: {price: feedPrice, updatedAt, staleSeconds: Math.max(0, now - updatedAt)},
    pool: {price: poolPrice},
    driftBps: ((poolPrice - feedPrice) / feedPrice) * 10_000,
    market,
  };
}
