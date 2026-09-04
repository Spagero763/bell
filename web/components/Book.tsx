"use client";

import {useEffect, useMemo, useState} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {formatUnits, parseUnits} from "viem";
import {DEPLOYMENT, MARKET_ABI, ERC20_ABI, USDC, isLive} from "@/lib/chain";
import {lastClose, scheduleState} from "@/lib/clock";

const BUCKETS = 21;
const CENTER = 10;
const WAD = 10n ** 18n;

const usd = (n: number) =>
  n.toLocaleString("en-US", {style: "currency", currency: "USD", minimumFractionDigits: 2});

function Shell({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-24">
      <div className="text-[10px] uppercase tracking-[0.24em] text-faint">{title}</div>
      <div className="mt-6 rounded-xl border border-line bg-panel p-8">{children}</div>
    </section>
  );
}

export default function Book() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [bucket, setBucket] = useState(CENTER);
  const [shares, setShares] = useState("25");
  const {address, isConnected} = useAccount();
  const {connect, connectors} = useConnect();
  const {writeContract, data: hash, isPending, reset} = useWriteContract();
  const {isLoading: confirming, isSuccess} = useWaitForTransactionReceipt({hash});

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(id);
  }, []);

  const closedAt = useMemo(() => BigInt(lastClose(now)), [now]);
  const blackout = scheduleState(now) === "blackout";
  const market = DEPLOYMENT.market;

  const {data: session, refetch: refetchSession} = useReadContract({
    address: market,
    abi: MARKET_ABI,
    functionName: "session",
    args: [closedAt],
    query: {enabled: Boolean(market), refetchInterval: 12000},
  });

  const {data: prices, refetch: refetchPrices} = useReadContract({
    address: market,
    abi: MARKET_ABI,
    functionName: "prices",
    args: [closedAt],
    query: {enabled: Boolean(market) && Boolean(session?.closedAt), refetchInterval: 12000},
  });

  const {data: implied} = useReadContract({
    address: market,
    abi: MARKET_ABI,
    functionName: "impliedOpen",
    args: [closedAt],
    query: {enabled: Boolean(market) && Boolean(session?.closedAt), refetchInterval: 12000},
  });

  const size = useMemo(() => {
    const n = Number(shares);
    return Number.isFinite(n) && n > 0 ? parseUnits(shares, 18) : 0n;
  }, [shares]);

  const {data: cost} = useReadContract({
    address: market,
    abi: MARKET_ABI,
    functionName: "quote",
    args: [closedAt, BigInt(bucket), size],
    query: {enabled: Boolean(market) && Boolean(session?.closedAt) && size > 0n},
  });

  const {data: allowance, refetch: refetchAllowance} = useReadContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && market ? [address, market] : undefined,
    query: {enabled: Boolean(address && market)},
  });

  useEffect(() => {
    if (isSuccess) {
      refetchSession();
      refetchPrices();
      refetchAllowance();
      reset();
    }
  }, [isSuccess, refetchSession, refetchPrices, refetchAllowance, reset]);

  if (!isLive) {
    return (
      <Shell title="The book">
        <p className="max-w-xl text-[15px] leading-relaxed text-muted">
          The contracts are not deployed yet. Once they are, this is where the market&apos;s
          distribution over the next opening print lives, and where you take a side.
        </p>
      </Shell>
    );
  }

  const live = Boolean(session?.closedAt) && !session?.resolved;
  const closePrice = session ? Number(session.closePrice) / 1e8 : 0;
  const step = session ? session.step : 0n;

  const midFor = (i: number) =>
    session ? (Number(session.closePrice) * (1 + ((i - CENTER) * Number(step)) / 1e18)) / 1e8 : 0;

  const p = prices ? (prices as readonly bigint[]) : [];
  const peak = p.length ? Number(p.reduce((a, b) => (b > a ? b : a), 0n)) / 1e18 : 1;
  const impliedPx = implied ? Number(implied) / 1e8 : 0;
  const costUsd = cost ? Number(formatUnits(cost, 6)) : 0;
  const needsApproval = allowance !== undefined && cost !== undefined && allowance < cost;

  if (!blackout) {
    return (
      <Shell title="The book">
        <p className="max-w-xl text-[15px] leading-relaxed text-muted">
          New York is open, so there is nothing to price. The book opens automatically at the
          closing bell and locks at the next one.
        </p>
      </Shell>
    );
  }

  if (!live) {
    return (
      <Shell title="The book">
        <p className="max-w-xl text-[15px] leading-relaxed text-muted">
          No session has been opened for this blackout yet. Anyone can start one by posting the
          LMSR subsidy, which is what bounds the book&apos;s worst case.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title="The book">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-faint">
            Market&apos;s implied open
          </div>
          <div className="tnum mt-2 font-mono text-4xl text-ink">{usd(impliedPx)}</div>
          <div className="mt-2 text-sm text-muted">
            against a frozen reference of <span className="text-amber">{usd(closePrice)}</span>
            {impliedPx > 0 && (
              <>
                {" · "}
                <span className={impliedPx >= closePrice ? "text-signal" : "text-loss"}>
                  {impliedPx >= closePrice ? "+" : ""}
                  {(((impliedPx - closePrice) / closePrice) * 100).toFixed(2)}%
                </span>
              </>
            )}
          </div>
        </div>
        <div className="text-right text-sm text-muted">
          <div className="tnum font-mono text-ink">
            {session ? usd(Number(formatUnits(session.collected, 6))) : "-"}
          </div>
          <div className="text-[11px] text-faint">taken in so far</div>
        </div>
      </div>

      <div className="mt-10 flex h-52 items-end gap-1">
        {Array.from({length: BUCKETS}, (_, i) => {
          const prob = p[i] !== undefined ? Number(p[i]) / 1e18 : 0;
          const selected = i === bucket;
          return (
            <button
              key={i}
              onClick={() => setBucket(i)}
              className="group relative flex h-full flex-1 cursor-pointer flex-col justify-end"
              title={`${usd(midFor(i))} · ${(prob * 100).toFixed(1)}%`}
            >
              <motion.div
                animate={{height: `${Math.max(2, (prob / peak) * 100)}%`}}
                transition={{type: "spring", stiffness: 160, damping: 22}}
                className={`w-full rounded-sm transition-colors ${
                  selected
                    ? "bg-signal"
                    : "bg-[#2a3038] group-hover:bg-[#39414c]"
                }`}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-faint">
        <span className="tnum">{usd(midFor(0))}</span>
        <span className="tnum text-amber">{usd(closePrice)}</span>
        <span className="tnum">{usd(midFor(BUCKETS - 1))}</span>
      </div>

      <div className="mt-10 grid gap-6 border-t border-line pt-8 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-faint">Opens at</div>
          <div className="tnum mt-2 font-mono text-xl text-ink">{usd(midFor(bucket))}</div>
          <div className="mt-1 text-[12px] text-faint">
            {bucket === 0
              ? "or lower"
              : bucket === BUCKETS - 1
                ? "or higher"
                : `${(((bucket - CENTER) * Number(step)) / 1e18 * 100).toFixed(1)}% from the close`}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-faint">Shares</label>
          <input
            value={shares}
            onChange={(e) => setShares(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="tnum mt-2 w-full rounded-md border border-line bg-raised px-3 py-2 font-mono text-lg text-ink outline-none focus:border-[#2b333d]"
          />
          <div className="mt-1 text-[12px] text-faint">
            {costUsd > 0 ? (
              <>
                costs <span className="text-ink">{usd(costUsd)}</span>, pays{" "}
                {usd(Number(shares) || 0)} if right
              </>
            ) : (
              "each share pays one dollar if the open lands here"
            )}
          </div>
        </div>

        <div>
          {!isConnected ? (
            <button
              onClick={() => connect({connector: connectors[0]})}
              className="w-full rounded-md bg-ink px-5 py-2.5 text-sm text-void transition-opacity hover:opacity-90 sm:w-auto"
            >
              Connect
            </button>
          ) : needsApproval ? (
            <button
              disabled={isPending || confirming}
              onClick={() =>
                writeContract({
                  address: USDC,
                  abi: ERC20_ABI,
                  functionName: "approve",
                  args: [market!, 2n ** 255n],
                })
              }
              className="w-full rounded-md bg-ink px-5 py-2.5 text-sm text-void transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              {isPending || confirming ? "Approving" : "Approve USDC"}
            </button>
          ) : (
            <button
              disabled={isPending || confirming || size === 0n || !cost}
              onClick={() =>
                writeContract({
                  address: market!,
                  abi: MARKET_ABI,
                  functionName: "buy",
                  args: [closedAt, BigInt(bucket), size, ((cost ?? 0n) * 102n) / 100n],
                })
              }
              className="w-full rounded-md bg-signal px-5 py-2.5 text-sm text-void transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto"
            >
              {isPending ? "Confirm" : confirming ? "Settling" : "Take this side"}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {hash && (
          <motion.div
            initial={{opacity: 0, y: 6}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0}}
            className="mt-5 text-[12px] text-faint"
          >
            <a
              href={`https://basescan.org/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-muted"
            >
              {confirming ? "Waiting on Base" : "Done"} · {hash.slice(0, 10)}…
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}
