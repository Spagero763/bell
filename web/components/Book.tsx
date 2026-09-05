"use client";

import {useEffect, useMemo, useState} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {formatUnits, parseUnits} from "viem";
import {DEPLOYMENT, MARKET_ABI, ERC20_ABI, USDC, isLive} from "@/lib/chain";
import {DATA_SUFFIX} from "@/lib/builderCode";
import {lastClose, scheduleState} from "@/lib/clock";

const BUCKETS = 21;
const CENTER = 10;
const EASE = [0.16, 1, 0.3, 1] as const;

const usd = (n: number, dp = 2) =>
  n.toLocaleString("en-US", {style: "currency", currency: "USD", minimumFractionDigits: dp});

function Frame({restricted, children}: {restricted?: boolean; children: React.ReactNode}) {
  return (
    <section id="book" className="mx-auto w-full max-w-[1080px] px-6 pb-28">
      <div className="text-[10px] uppercase tracking-[0.26em] text-faint">The book</div>
      <div className="mt-6 rounded-lg border border-line bg-panel">
        {restricted && (
          <div className="border-b border-line bg-raised px-8 py-4">
            <p className="max-w-[70ch] text-[13px] leading-relaxed text-muted">
              <span className="text-amber">Viewing only.</span> The equities behind this book are
              issued to eligible users outside the United States, so Bell does not transact for US
              visitors. Everything on this page stays readable.
            </p>
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/** Parses user input to 18dp, tolerating half typed numbers like "0." */
function toWad(v: string): bigint {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  try {
    return parseUnits(v, 18);
  } catch {
    return 0n;
  }
}

function sizeHint(b: bigint): string {
  const half = Number(formatUnits(b / 2n, 18));
  return half > 0 ? String(Number(half.toPrecision(2))) : "";
}

function Quiet({restricted, children}: {restricted?: boolean; children: React.ReactNode}) {
  return (
    <Frame restricted={restricted}>
      <p className="max-w-[60ch] p-10 text-[15px] leading-relaxed text-dim">{children}</p>
    </Frame>
  );
}

export default function Book({restricted = false}: {restricted?: boolean}) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [bucket, setBucket] = useState(CENTER);
  const [typed, setTyped] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);

  const {address, isConnected} = useAccount();
  const {connect, connectors, error: connectError, isPending: connecting} = useConnect();
  const {disconnect} = useDisconnect();
  const {writeContract, data: hash, isPending, reset} = useWriteContract();
  const {isLoading: confirming, isSuccess} = useWaitForTransactionReceipt({hash});

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(id);
  }, []);

  const closedAt = useMemo(() => BigInt(lastClose(now)), [now]);
  const blackout = scheduleState(now) === "blackout";
  const market = DEPLOYMENT.market;
  const on = {enabled: Boolean(market), refetchInterval: 12000};

  const {data: session, refetch: refetchSession} = useReadContract({
    address: market, abi: MARKET_ABI, functionName: "session", args: [closedAt], query: on,
  });
  const hasSession = Boolean(session?.closedAt) && !session?.resolved;

  const {data: prices, refetch: refetchPrices} = useReadContract({
    address: market, abi: MARKET_ABI, functionName: "prices", args: [closedAt],
    query: {...on, enabled: Boolean(market) && hasSession},
  });
  const {data: implied} = useReadContract({
    address: market, abi: MARKET_ABI, functionName: "impliedOpen", args: [closedAt],
    query: {...on, enabled: Boolean(market) && hasSession},
  });

  // In LMSR the meaningful trade size scales with b: around b/2 shifts a bucket by a few
  // points, while many multiples of b pin it at one and cost far more than the subsidy.
  const suggested = session?.b ? sizeHint(session.b) : "";
  const shares = typed ?? suggested;
  const size = toWad(shares);

  const {data: cost} = useReadContract({
    address: market, abi: MARKET_ABI, functionName: "quote", args: [closedAt, BigInt(bucket), size],
    query: {enabled: Boolean(market) && hasSession && size > 0n},
  });
  const {data: allowance, refetch: refetchAllowance} = useReadContract({
    address: USDC, abi: ERC20_ABI, functionName: "allowance",
    args: address && market ? [address, market] : undefined,
    query: {enabled: Boolean(address && market)},
  });

  useEffect(() => {
    if (!isSuccess) return;
    refetchSession();
    refetchPrices();
    refetchAllowance();
    reset();
  }, [isSuccess, refetchSession, refetchPrices, refetchAllowance, reset]);

  if (!isLive) return <Quiet restricted={restricted}>The contracts are not deployed yet.</Quiet>;
  if (!blackout)
    return (
      <Quiet restricted={restricted}>
        New York is open, so there is nothing to price. The book opens by itself at the closing bell
        and locks at the next one.
      </Quiet>
    );
  if (!hasSession)
    return (
      <Quiet restricted={restricted}>
        No session has been opened for this blackout yet. Anyone can start one by posting the LMSR
        subsidy, which is what bounds the book&apos;s worst case.
      </Quiet>
    );

  const closePrice = Number(session!.closePrice) / 1e8;
  const step = Number(session!.step) / 1e18;
  const midFor = (i: number) => closePrice * (1 + (i - CENTER) * step);
  const p = (prices as readonly bigint[] | undefined) ?? [];
  const peak = p.length ? Number(p.reduce((a, b) => (b > a ? b : a), 0n)) / 1e18 : 1;
  const impliedPx = implied ? Number(implied) / 1e8 : 0;
  const costUsd = cost ? Number(formatUnits(cost, 6)) : 0;
  const needsApproval = allowance !== undefined && cost !== undefined && allowance < cost;
  const depthRatio = session?.b && size > 0n ? Number(size) / Number(session.b) : 0;
  const shown = hover ?? bucket;
  const drift = impliedPx > 0 ? ((impliedPx - closePrice) / closePrice) * 100 : 0;

  return (
    <Frame restricted={restricted}>
      <div className="flex flex-wrap items-end justify-between gap-8 border-b border-line p-8">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-faint">Implied open</div>
          <div className="tnum mt-3 font-mono text-[42px] leading-none text-ink">
            {usd(impliedPx)}
          </div>
          <div className="mt-3 text-[13px] text-muted">
            against a reference frozen at <span className="text-amber">{usd(closePrice)}</span>
            {impliedPx > 0 && (
              <>
                {" · "}
                <span className={drift >= 0 ? "text-signal" : "text-loss"}>
                  {drift >= 0 ? "+" : ""}
                  {drift.toFixed(2)}%
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-8 text-right">
          <div>
            <div className="tnum font-mono text-[17px] text-ink">
              {usd(Number(formatUnits(session!.collected, 6)), 4)}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-faint">flow</div>
          </div>
          <div>
            <div className="tnum font-mono text-[17px] text-ink">
              {usd(Number(formatUnits(session!.subsidy, 6)), 4)}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-faint">max loss</div>
          </div>
        </div>
      </div>

      <div className="px-8 pt-9">
        <div className="flex h-56 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
          {Array.from({length: BUCKETS}, (_, i) => {
            const prob = p[i] !== undefined ? Number(p[i]) / 1e18 : 0;
            const active = i === bucket;
            return (
              <button
                key={i}
                onClick={() => setBucket(i)}
                onMouseEnter={() => setHover(i)}
                aria-label={`Opens near ${usd(midFor(i))}, ${(prob * 100).toFixed(1)} percent`}
                className="flex h-full flex-1 cursor-pointer flex-col justify-end"
              >
                <motion.span
                  animate={{height: `${Math.max(1.5, (prob / peak) * 100)}%`}}
                  transition={{type: "spring", stiffness: 170, damping: 24}}
                  className={`w-full rounded-[2px] transition-colors duration-150 ${
                    active
                      ? "bg-signal"
                      : i === hover
                        ? "bg-[#3a434f]"
                        : i === CENTER
                          ? "bg-[#2b3138]"
                          : "bg-[#20252c]"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-hair pt-3 text-[10px] text-faint">
          <span className="tnum">{usd(midFor(0))} or lower</span>
          <span className="tnum text-amber">{usd(closePrice)} unchanged</span>
          <span className="tnum">{usd(midFor(BUCKETS - 1))} or higher</span>
        </div>

        <div className="mt-4 h-5 text-[12px] text-muted">
          {p[shown] !== undefined && (
            <span className="tnum">
              {usd(midFor(shown))} · {((Number(p[shown]) / 1e18) * 100).toFixed(1)}% implied
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-7 border-t border-line p-8 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-faint">Your call</div>
          <div className="tnum mt-3 font-mono text-[22px] text-ink">{usd(midFor(bucket))}</div>
          <div className="mt-1.5 text-[12px] text-faint">
            {bucket === 0
              ? "or lower"
              : bucket === BUCKETS - 1
                ? "or higher"
                : `${((bucket - CENTER) * step * 100).toFixed(1)}% from the close`}
          </div>
        </div>

        <div>
          <label htmlFor="shares" className="text-[10px] uppercase tracking-[0.2em] text-faint">
            Shares
          </label>
          <input
            id="shares"
            value={shares}
            disabled={restricted}
            onChange={(e) => setTyped(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))}
            inputMode="decimal"
            autoComplete="off"
            className="tnum mt-3 w-full rounded-md border border-line bg-raised px-3.5 py-2.5 font-mono text-[17px] text-ink outline-none transition-colors focus:border-[#2b333d] disabled:opacity-40"
          />
          <div className="mt-1.5 text-[12px] text-faint">
            {costUsd > 0 ? (
              <>
                costs <span className="text-ink">{usd(costUsd, 4)}</span>, pays{" "}
                {usd(Number(shares) || 0)} if right
              </>
            ) : (
              "each share pays one dollar if the open lands here"
            )}
          </div>
          {depthRatio > 4 && (
            <div className="mt-2 text-[12px] leading-snug text-amber">
              {depthRatio.toFixed(0)}× the book&apos;s depth. It will pin this bucket at once and
              cost far more than a smaller trade.
            </div>
          )}
        </div>

        <div className="flex flex-col items-stretch gap-2">
          {restricted ? (
            <div className="rounded-md border border-line bg-raised px-4 py-2.5 text-[12px] leading-snug text-muted">
              Not available in your region.
            </div>
          ) : !isConnected ? (
            picking ? (
              <div className="flex flex-col gap-1.5">
                {connectors.map((c) => (
                  <button
                    key={c.uid}
                    onClick={() => {
                      connect({connector: c});
                      setPicking(false);
                    }}
                    className="flex items-center gap-2.5 rounded-md border border-line bg-raised px-4 py-2.5 text-left text-[13px] text-dim transition-colors hover:border-[#2b333d] hover:text-ink"
                  >
                    <span
                      className={`inline-block h-[6px] w-[6px] rounded-full ${
                        c.id === "coinbaseWalletSDK" ? "bg-[#0052ff]" : "bg-faint"
                      }`}
                    />
                    {c.id === "coinbaseWalletSDK" ? "Coinbase Wallet" : c.name}
                  </button>
                ))}
                <button
                  onClick={() => setPicking(false)}
                  className="text-[11px] text-faint transition-colors hover:text-muted"
                >
                  cancel
                </button>
                {connectError && (
                  <p className="max-w-[220px] text-[11px] leading-snug text-loss">
                    {connectError.message.slice(0, 160)}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setPicking(true)}
                  className="rounded-md bg-ink px-6 py-2.5 text-[14px] text-void transition-opacity hover:opacity-90"
                >
                  {connecting ? "Opening wallet…" : "Connect wallet"}
                </button>
                {connectError && (
                  <p className="max-w-[220px] text-[11px] leading-snug text-loss">
                    {connectError.message.slice(0, 160)}
                  </p>
                )}
              </div>
            )
          ) : needsApproval ? (
            <button
              disabled={isPending || confirming}
              onClick={() =>
                writeContract({
                  address: USDC, abi: ERC20_ABI, functionName: "approve",
                  args: [market!, 2n ** 255n],
                  dataSuffix: DATA_SUFFIX,
                })
              }
              className="rounded-md bg-ink px-6 py-2.5 text-[14px] text-void transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending || confirming ? "Approving…" : "Approve USDC"}
            </button>
          ) : (
            <button
              disabled={isPending || confirming || size === 0n || !cost}
              onClick={() =>
                writeContract({
                  address: market!, abi: MARKET_ABI, functionName: "buy",
                  args: [closedAt, BigInt(bucket), size, ((cost ?? 0n) * 102n) / 100n],
                  dataSuffix: DATA_SUFFIX,
                })
              }
              className="rounded-md bg-signal px-6 py-2.5 text-[14px] font-medium text-void transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {isPending ? "Confirm in wallet" : confirming ? "Settling…" : "Take this side"}
            </button>
          )}
          {isConnected && (
            <button
              onClick={() => disconnect()}
              className="text-[11px] text-faint transition-colors hover:text-muted"
            >
              {address?.slice(0, 6)}…{address?.slice(-4)} · disconnect
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {hash && (
          <motion.div
            initial={{opacity: 0, height: 0}}
            animate={{opacity: 1, height: "auto"}}
            exit={{opacity: 0, height: 0}}
            transition={{duration: 0.4, ease: EASE}}
            className="border-t border-line px-8 py-4"
          >
            <a
              href={`https://basescan.org/tx/${hash}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[12px] text-muted transition-colors hover:text-ink"
            >
              {confirming ? "Waiting on Base" : "Confirmed"} · {hash.slice(0, 14)}… ↗
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </Frame>
  );
}
