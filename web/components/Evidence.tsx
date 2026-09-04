"use client";

import {useRef} from "react";
import {motion, useInView} from "framer-motion";
import {PRICES, VOLUMES, CLOSE_INDEX, BELL_INDEX, CLOSE_PRICE, FACTS, labelFor} from "@/lib/weekend";

const W = 1000;
const H = 320;
const PAD = {top: 24, right: 16, bottom: 40, left: 52};

const lo = Math.min(...PRICES) - 0.6;
const hi = Math.max(...PRICES) + 0.6;

const x = (i: number) => PAD.left + (i / (PRICES.length - 1)) * (W - PAD.left - PAD.right);
const y = (p: number) => PAD.top + (1 - (p - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

const path = PRICES.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(
  " ",
);

const maxVol = Math.max(...VOLUMES);

function Stat({label, value, tone}: {label: string; value: string; tone?: "loss" | "amber"}) {
  return (
    <div className="border-l border-line pl-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-faint">{label}</div>
      <div
        className={`tnum mt-1.5 font-mono text-xl ${
          tone === "loss" ? "text-loss" : tone === "amber" ? "text-amber" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export default function Evidence() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, {once: true, margin: "-80px"});

  return (
    <section ref={ref} className="mx-auto w-full max-w-5xl px-6 py-24">
      <motion.div
        initial={{opacity: 0, y: 16}}
        animate={seen ? {opacity: 1, y: 0} : {}}
        transition={{duration: 0.6, ease: [0.16, 1, 0.3, 1]}}
      >
        <div className="text-[10px] uppercase tracking-[0.24em] text-faint">
          Apple on Base · 28 to 31 August 2026
        </div>
        <h2 className="mt-4 max-w-2xl text-2xl leading-snug text-ink sm:text-3xl">
          Five and a half million dollars changed hands at a price nobody could check.
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          With the feed frozen on Friday&apos;s close and no way to redeem against real shares, the
          weekend market had nothing to price against. It held a one percent band for sixty five
          hours. Then the bell rang and Apple was worth two percent less.
        </p>
      </motion.div>

      <motion.div
        initial={{opacity: 0}}
        animate={seen ? {opacity: 1} : {}}
        transition={{duration: 0.5, delay: 0.15}}
        className="mt-10 overflow-hidden rounded-xl border border-line bg-panel"
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
          <rect
            x={x(CLOSE_INDEX)}
            y={PAD.top}
            width={x(BELL_INDEX) - x(CLOSE_INDEX)}
            height={H - PAD.top - PAD.bottom}
            fill="rgba(242,169,59,0.05)"
          />
          <line
            x1={x(CLOSE_INDEX)}
            x2={x(CLOSE_INDEX)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="rgba(242,169,59,0.35)"
            strokeWidth="1"
          />
          <line
            x1={x(BELL_INDEX)}
            x2={x(BELL_INDEX)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="rgba(242,104,95,0.5)"
            strokeWidth="1"
          />

          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(CLOSE_PRICE)}
            y2={y(CLOSE_PRICE)}
            stroke="rgba(242,169,59,0.45)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <text x={PAD.left + 6} y={y(CLOSE_PRICE) - 7} className="fill-amber" fontSize="11">
            what the feed still said: ${CLOSE_PRICE.toFixed(2)}
          </text>

          {VOLUMES.map((v, i) => (
            <rect
              key={i}
              x={x(i) - 3}
              y={H - PAD.bottom - (v / maxVol) * 26}
              width="6"
              height={(v / maxVol) * 26}
              fill={i === BELL_INDEX ? "rgba(242,104,95,0.75)" : "rgba(255,255,255,0.09)"}
            />
          ))}

          <motion.path
            d={path}
            fill="none"
            stroke="#e9ebee"
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{pathLength: 0}}
            animate={seen ? {pathLength: 1} : {}}
            transition={{duration: 2.4, ease: "easeInOut", delay: 0.3}}
          />

          <motion.g
            initial={{opacity: 0}}
            animate={seen ? {opacity: 1} : {}}
            transition={{delay: 2.4, duration: 0.5}}
          >
            <circle cx={x(BELL_INDEX)} cy={y(PRICES[BELL_INDEX])} r="3.5" fill="#f2685f" />
            <text
              x={x(BELL_INDEX) - 8}
              y={y(PRICES[BELL_INDEX]) - 14}
              textAnchor="end"
              className="fill-loss"
              fontSize="11"
            >
              the bell
            </text>
          </motion.g>

          {[0, 12, 36, 60, 76].map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 14}
              textAnchor={i === 0 ? "start" : i === 76 ? "end" : "middle"}
              className="fill-[#5a616b]"
              fontSize="10"
            >
              {labelFor(i).slice(0, 3)}
            </text>
          ))}
          {[lo + 1, (lo + hi) / 2, hi - 1].map((p) => (
            <text key={p} x={PAD.left - 10} y={y(p) + 3} textAnchor="end" className="fill-[#5a616b]" fontSize="10">
              {p.toFixed(0)}
            </text>
          ))}
        </svg>
      </motion.div>

      <motion.div
        initial={{opacity: 0, y: 12}}
        animate={seen ? {opacity: 1, y: 0} : {}}
        transition={{duration: 0.5, delay: 0.35}}
        className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4"
      >
        <Stat label="Trades in the dark" value={FACTS.swaps.toLocaleString()} />
        <Stat label="Volume" value={`$${(FACTS.volume / 1e6).toFixed(2)}M`} />
        <Stat label="Weekend range" value="1.0%" tone="amber" />
        <Stat label="Gap at the open" value="-2.0%" tone="loss" />
      </motion.div>

      <motion.p
        initial={{opacity: 0}}
        animate={seen ? {opacity: 1} : {}}
        transition={{duration: 0.5, delay: 0.5}}
        className="mt-8 max-w-2xl text-[15px] leading-relaxed text-muted"
      >
        The heaviest hour of the entire weekend was the last one before trading resumed:{" "}
        <span className="text-ink">{FACTS.rushSwaps.toLocaleString()} swaps</span> and{" "}
        <span className="text-ink">${(FACTS.rushVolume / 1e6).toFixed(2)}M</span> in the thirty
        minutes ahead of the bell, as arbitrage repriced a gap that had been knowable to nobody and
        was about to be knowable to everyone. That is the leak. It happens every weekend.
      </motion.p>
    </section>
  );
}
