"use client";

import {useEffect, useRef, useState} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {formatET, splitDuration} from "@/lib/clock";

type PulseData = {
  now: number;
  symbol: string;
  name: string;
  schedule: "open" | "blackout";
  closedAt: number;
  opensAt: number;
  blackoutHours: number;
  feed: {price: number; updatedAt: number; staleSeconds: number; roundId: string};
  pool: {price: number; liquidity: string};
  driftBps: number;
};

const usd = (n: number) =>
  n.toLocaleString("en-US", {style: "currency", currency: "USD", minimumFractionDigits: 2});

function useServerClock(data: PulseData | null) {
  const [now, setNow] = useState(0);
  const offset = useRef(0);

  useEffect(() => {
    if (!data) return;
    offset.current = data.now - Math.floor(Date.now() / 1000);
    setNow(data.now);
  }, [data]);

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000) + offset.current), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

function Digits({value, label}: {value: number; label: string}) {
  return (
    <div className="flex flex-col items-center">
      <div className="tnum font-mono text-4xl leading-none text-ink sm:text-6xl">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-faint">{label}</div>
    </div>
  );
}

function Panel({
  label,
  value,
  sub,
  tone,
  delay,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  tone: "frozen" | "live";
  delay: number;
}) {
  return (
    <motion.div
      initial={{opacity: 0, y: 14}}
      animate={{opacity: 1, y: 0}}
      transition={{delay, duration: 0.5, ease: [0.16, 1, 0.3, 1]}}
      className="relative overflow-hidden rounded-xl border border-line bg-panel p-5 sm:p-6"
    >
      <div className="flex items-center gap-2">
        <span
          className={`relative inline-block h-1.5 w-1.5 rounded-full ${
            tone === "live" ? "beacon bg-signal text-signal" : "bg-faint"
          }`}
        />
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted">{label}</span>
      </div>
      <div className="tnum mt-4 font-mono text-3xl text-ink sm:text-4xl">{value}</div>
      <div className="mt-2 text-sm text-muted">{sub}</div>
    </motion.div>
  );
}

export default function Pulse() {
  const [data, setData] = useState<PulseData | null>(null);
  const [error, setError] = useState(false);
  const now = useServerClock(data);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/pulse", {cache: "no-store"});
        if (!res.ok) throw new Error();
        const json = (await res.json()) as PulseData;
        if (alive) {
          setData(json);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const blackout = data?.schedule === "blackout";
  const untilBell = data ? Math.max(0, data.opensAt - now) : 0;
  const frozenFor = data ? Math.max(0, now - data.feed.updatedAt) : 0;
  const {hours, minutes, seconds} = splitDuration(untilBell);
  const frozen = splitDuration(frozenFor);

  return (
    <div className="mx-auto w-full max-w-5xl px-6">
      <AnimatePresence mode="wait">
        {!data ? (
          <motion.div
            key="loading"
            exit={{opacity: 0}}
            className="flex h-64 items-center justify-center text-sm text-faint"
          >
            {error ? "Base is not answering right now" : "Reading Base"}
          </motion.div>
        ) : (
          <motion.div key="live" initial={{opacity: 0}} animate={{opacity: 1}}>
            <motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.5, ease: [0.16, 1, 0.3, 1]}}
              className="flex flex-wrap items-center justify-center gap-3"
            >
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] ${
                  blackout
                    ? "border-amber/30 bg-amber/10 text-amber"
                    : "border-signal/30 bg-signal/10 text-signal"
                }`}
              >
                <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-current beacon" />
                {blackout ? "Exchange closed" : "Exchange open"}
              </span>
              <span className="text-sm text-muted">
                {data.name} · {data.symbol}
              </span>
            </motion.div>

            <div className="mt-10 text-center">
              {blackout ? (
                <>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-faint">
                    Reopens in
                  </div>
                  <div className="mt-5 flex items-start justify-center gap-6 sm:gap-10">
                    <Digits value={hours} label="hours" />
                    <Digits value={minutes} label="minutes" />
                    <Digits value={seconds} label="seconds" />
                  </div>
                  <div className="mt-6 text-sm text-muted">
                    {formatET(data.closedAt)} to {formatET(data.opensAt)} ·{" "}
                    <span className="text-ink">{data.blackoutHours.toFixed(1)} hours</span> with no
                    reference price
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-faint">
                    Regular session
                  </div>
                  <div className="tnum mt-5 font-mono text-5xl text-ink sm:text-7xl">
                    {usd(data.feed.price)}
                  </div>
                  <div className="mt-5 text-sm text-muted">
                    The bell rings at {formatET(data.closedAt)}. After that the feed stops and this
                    page starts counting.
                  </div>
                </>
              )}
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              <Panel
                label="Chainlink reference"
                value={usd(data.feed.price)}
                tone={blackout ? "frozen" : "live"}
                delay={0.08}
                sub={
                  blackout ? (
                    <>
                      Frozen for{" "}
                      <span className="tnum text-amber">
                        {frozen.hours}h {String(frozen.minutes).padStart(2, "0")}m
                      </span>
                    </>
                  ) : (
                    <>Updated {Math.floor(frozenFor / 60)} min ago</>
                  )
                }
              />
              <Panel
                label="On-chain market"
                value={usd(data.pool.price)}
                tone="live"
                delay={0.16}
                sub={
                  <>
                    Trading now ·{" "}
                    <span className={data.driftBps >= 0 ? "text-signal" : "text-loss"}>
                      {data.driftBps >= 0 ? "+" : ""}
                      {data.driftBps.toFixed(1)} bps
                    </span>{" "}
                    from the reference
                  </>
                }
              />
            </div>

            <motion.p
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{delay: 0.3}}
              className="mt-6 text-center text-sm text-faint"
            >
              Both numbers are read from Base mainnet on every refresh.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
