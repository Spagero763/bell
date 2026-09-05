import {createPublicClient, http, parseAbi} from "viem";
import {base} from "viem/chains";

export const client = createPublicClient({
  chain: base,
  // The public endpoint drops requests under load, so retry rather than render an
  // empty page. Point NEXT_PUBLIC_RPC at a dedicated node to stop paying for this.
  transport: http(process.env.NEXT_PUBLIC_RPC ?? "https://mainnet.base.org", {
    retryCount: 3,
    retryDelay: 250,
    timeout: 8000,
  }),
  batch: {multicall: true},
});

export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export type Ticker = {
  symbol: string;
  name: string;
  token: `0x${string}`;
  feed: `0x${string}`;
};

export const TICKERS: Ticker[] = [
  {
    symbol: "AAPLc",
    name: "Apple",
    token: "0xb200000000000000000000C2e324d24d7eEcd1fb",
    feed: "0x787f13dEa48Db0897CbCDD985de77809D837F988",
  },
];

export const FEED_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function getRoundData(uint80 roundId) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

export const CLOCK_ABI = parseAbi([
  "function state() view returns (uint8)",
  "function secondsStale() view returns (uint256)",
  "function lastClose(uint256 ts) view returns (uint256)",
  "function nextOpen(uint256 ts) view returns (uint256)",
  "function isAnchored(uint64 closedAt) view returns (bool)",
  "function isSettled(uint64 closedAt) view returns (bool)",
  "function anchor(uint64 closedAt, uint80 closeRound) returns (int256)",
  "function settle(uint64 closedAt, uint80 openRound) returns (int256)",
]);

export const MARKET_ABI = parseAbi([
  "function session(uint64 closedAt) view returns ((uint64 closedAt,uint64 opensAt,int256 closePrice,int256 b,int256 step,uint256 subsidy,uint256 collected,uint256 winner,bool resolved))",
  "function prices(uint64 closedAt) view returns (uint256[21])",
  "function impliedOpen(uint64 closedAt) view returns (int256)",
  "function bucketMid(uint64 closedAt, uint256 i) view returns (int256)",
  "function quote(uint64 closedAt, uint256 bucket, uint256 size) view returns (uint256)",
  "function shares(uint64 closedAt, uint256 bucket, address who) view returns (uint256)",
  "function maxLoss(int256 b) pure returns (uint256)",
  "function open(uint80 closeRound, int256 b, int256 step, uint256 subsidy) returns (uint64)",
  "function buy(uint64 closedAt, uint256 bucket, uint256 size, uint256 maxCost) returns (uint256)",
  "function resolve(uint64 closedAt, uint80 openRound)",
  "function redeem(uint64 closedAt) returns (uint256)",
]);

export const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const addr = (v: string | undefined) =>
  v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : undefined;

export const DEPLOYMENT = {
  clock: addr(process.env.NEXT_PUBLIC_CLOCK),
  market: addr(process.env.NEXT_PUBLIC_MARKET),
  impliedFeed: addr(process.env.NEXT_PUBLIC_IMPLIED_FEED),
};

export const isLive = Boolean(DEPLOYMENT.clock && DEPLOYMENT.market);
