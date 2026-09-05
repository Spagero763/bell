"use client";

import {useEffect, useState} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {formatET, splitDuration} from "@/lib/clock";

export type PulseData = {
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

const usd = (n: number) =>
  n.toLocaleString("en-US", {style: "currency", currency: "USD", minimumFractionDigits: 2});

const EASE = [0.16, 1, 0.3, 1] as const;

/// Seeded with the server's clock so the first client paint matches the markup exactly,
/// then handed over to the browser's own clock a second later.
function useLiveClock(seed?: number) {
  const [now, setNow] = useState(() => seed ?? Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

function Unit({value, label}: {value: number; label: string}) {
  const text = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="tnum font-mono text-[15vw] leading-[0.85] tracking-tight text-ink sm:text-[104px]">
        {text}
      </div>
      <div className="mt-3 text-[9px] uppercase tracking-[0.32em] text-faint">{label}</div>
    </div>
  );
}

function Colon() {
  return (
    <div className="tnum font-mono text-[9vw] leading-[0.85] text-faint sm:text-[64px]" aria-hidden>
      :
    </div>
  );
}

function PriceCard({
  eyebrow,
  price,
  note,
  tone,
  delay,
}: {
  eyebrow: string;
  price: string;
  note: React.ReactNode;
  tone: "frozen" | "live" | "implied";
  delay: number;
}) {
  const dot =
    tone === "live"
      ? "bg-signal live-dot"
      : tone === "implied"
        ? "bg-signal"
        : "bg-amber";
  return (
    <motion.div
      initial={{opacity: 0, y: 18}}
      animate={{opacity: 1, y: 0}}
      transition={{delay, duration: 0.7, ease: EASE}}
      className="relative flex-1 overflow-hidden border-t border-line pt-5"
    >
      <div className="flex items-center gap-2">
        <span className={`inline-block h-[5px] w-[5px] rounded-full ${dot}`} />
        <span className="text-[9px] uppercase tracking-[0.24em] text-muted">{eyebrow}</span>
      </div>
      <div className="tnum mt-4 font-mono text-[30px] leading-none text-ink sm:text-[38px]">
        {price}
      </div>
      <div className="mt-2.5 text-[13px] leading-snug text-muted">{note}</div>
    </motion.div>
  );
}

export default function Hero({initial}: {initial?: PulseData}) {
  const [data, setData] = useState<PulseData | null>(initial ?? null);
  const [failed, setFailed] = useState(false);
  const now = useLiveClock(initial?.now);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/pulse", {cache: "no-store"});
        if (!res.ok) throw new Error();
        const json = (await res.json()) as PulseData;
        if (alive) {
          setData(json);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    };
    load();
    const id = setInterval(load, 12000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const blackout = data?.schedule === "blackout";
  const untilBell = data ? Math.max(0, data.opensAt - now) : 0;
  const {hours, minutes, seconds} = splitDuration(untilBell);
  const frozen = splitDuration(data ? Math.max(0, now - data.feed.updatedAt) : 0);
  const elapsed = data ? Math.min(1, Math.max(0, (now - data.closedAt) / (data.opensAt - data.closedAt))) : 0;

  return (
    <section className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] field" />

      <div className="relative mx-auto w-full max-w-[1080px] px-6 pt-20 sm:pt-28">
        <AnimatePresence mode="wait">
          {!data ? (
            <motion.div
              key="wait"
              exit={{opacity: 0}}
              className="flex h-[520px] items-center justify-center text-[13px] text-faint"
            >
              {failed ? "Base is not answering" : "Reading Base"}
            </motion.div>
          ) : (
            <motion.div key="live" initial={{opacity: 0}} animate={{opacity: 1}}>
              <motion.div
                initial={{opacity: 0, y: 12}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.7, ease: EASE}}
                className="flex items-center justify-center gap-2.5"
              >
                <span
                  className={`inline-block h-[5px] w-[5px] rounded-full ${
                    blackout ? "bg-amber" : "bg-signal live-dot"
                  }`}
                />
                <span className="text-[10px] uppercase tracking-[0.28em] text-muted">
                  {blackout ? "New York is closed" : "Regular session"}
                </span>
              </motion.div>

              <motion.h1
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.08, duration: 0.8, ease: EASE}}
                className="display mx-auto mt-8 max-w-[15ch] text-center text-[40px] leading-[1.04] text-ink sm:text-[64px]"
              >
                {data.name} is still trading.
              </motion.h1>

              <motion.p
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{delay: 0.2, duration: 0.8}}
                className="mx-auto mt-6 max-w-[52ch] text-center text-[15px] leading-relaxed text-dim"
              >
                {blackout ? (
                  <>
                    The exchange shut {formatET(data.closedAt)} and its price feed stopped with it.
                    The token did not. Bell prices the reopen in between.
                  </>
                ) : (
                  <>
                    The feed is live until the bell at {formatET(data.closedAt)}. After that it holds
                    this number until Monday, and Bell takes over.
                  </>
                )}
              </motion.p>

              {blackout && (
                <>
                  <motion.div
                    initial={{opacity: 0, y: 24}}
                    animate={{opacity: 1, y: 0}}
                    transition={{delay: 0.3, duration: 0.9, ease: EASE}}
                    className="mt-16 flex items-start justify-center gap-3 sm:gap-7"
                  >
                    <Unit value={hours} label="hours" />
                    <Colon />
                    <Unit value={minutes} label="minutes" />
                    <Colon />
                    <Unit value={seconds} label="seconds" />
                  </motion.div>

                  <motion.div
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    transition={{delay: 0.5, duration: 0.8}}
                    className="mx-auto mt-14 max-w-[560px]"
                  >
                    <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.2em] text-faint">
                      <span>{formatET(data.closedAt)}</span>
                      <span className="text-muted">
                        {data.blackoutHours.toFixed(1)}h with no reference price
                      </span>
                      <span>{formatET(data.opensAt)}</span>
                    </div>
                    <div className="relative mt-3 h-[3px] w-full overflow-hidden rounded-full bg-line">
                      <motion.div
                        initial={{width: 0}}
                        animate={{width: `${elapsed * 100}%`}}
                        transition={{duration: 1.4, ease: EASE}}
                        className="absolute inset-y-0 left-0 rounded-full bg-amber/70"
                      />
                    </div>
                  </motion.div>
                </>
              )}

              <div className="mt-20 flex flex-col gap-8 sm:flex-row sm:gap-10">
                <PriceCard
                  eyebrow="Chainlink reference"
                  price={usd(data.feed.price)}
                  tone={blackout ? "frozen" : "live"}
                  delay={0.55}
                  note={
                    blackout ? (
                      <>
                        Frozen{" "}
                        <span className="tnum text-amber">
                          {frozen.hours}h {String(frozen.minutes).padStart(2, "0")}m
                        </span>
                        . No heartbeat until the bell.
                      </>
                    ) : (
                      <>Updated {Math.floor(frozen.hours * 60 + frozen.minutes)} minutes ago.</>
                    )
                  }
                />
                <PriceCard
                  eyebrow={`${data.symbol} on Aerodrome`}
                  price={usd(data.pool.price)}
                  tone="live"
                  delay={0.63}
                  note={
                    <>
                      Trading now, {" "}
                      <span className={data.driftBps >= 0 ? "text-signal" : "text-loss"}>
                        {data.driftBps >= 0 ? "+" : ""}
                        {data.driftBps.toFixed(1)} bps
                      </span>{" "}
                      from a price nobody can check.
                    </>
                  }
                />
                <PriceCard
                  eyebrow="Bell implied open"
                  price={data.market ? usd(data.market.impliedOpen) : "—"}
                  tone="implied"
                  delay={0.71}
                  note={
                    data.market ? (
                      <>
                        What the book says it reopens at, from{" "}
                        <span className="tnum text-ink">{usd(data.market.collected)}</span> of flow.
                      </>
                    ) : (
                      <>Opens automatically at the next closing bell.</>
                    )
                  }
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
