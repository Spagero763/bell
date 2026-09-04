import {NextResponse} from "next/server";
import {parseAbi} from "viem";
import {client, TICKERS, FEED_ABI} from "@/lib/chain";
import {lastClose, nextOpen, scheduleState} from "@/lib/clock";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const POOL = "0xa3b1e3f9747065e2073722ff4c9027d3ea4994f0" as const;
const POOL_ABI = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)",
  "function liquidity() view returns (uint128)",
]);

const Q96 = 2 ** 96;

export async function GET() {
  const ticker = TICKERS[0];

  const [round, slot0, liquidity] = await Promise.all([
    client.readContract({address: ticker.feed, abi: FEED_ABI, functionName: "latestRoundData"}),
    client.readContract({address: POOL, abi: POOL_ABI, functionName: "slot0"}),
    client.readContract({address: POOL, abi: POOL_ABI, functionName: "liquidity"}),
  ]);

  const now = Math.floor(Date.now() / 1000);
  const updatedAt = Number(round[3]);
  const feedPrice = Number(round[1]) / 1e8;

  // token0 is USDC at 6dp, token1 the equity at 8dp
  const ratio = Number(slot0[0]) / Q96;
  const poolPrice = 100 / (ratio * ratio);

  const schedule = scheduleState(now);
  const closedAt = lastClose(now);
  const opensAt = nextOpen(now);

  return NextResponse.json(
    {
      now,
      symbol: ticker.symbol,
      name: ticker.name,
      schedule,
      closedAt,
      opensAt,
      blackoutHours: schedule === "blackout" ? (opensAt - closedAt) / 3600 : 0,
      feed: {
        price: feedPrice,
        updatedAt,
        staleSeconds: Math.max(0, now - updatedAt),
        roundId: round[0].toString(),
      },
      pool: {
        price: poolPrice,
        liquidity: liquidity.toString(),
      },
      driftBps: ((poolPrice - feedPrice) / feedPrice) * 10_000,
    },
    {headers: {"cache-control": "no-store"}},
  );
}
