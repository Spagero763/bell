"use client";

import {useRef} from "react";
import {motion, useInView} from "framer-motion";

const PIECES = [
  {
    name: "MarketClock",
    line: "Knows when the exchange is actually open",
    body: "A New York calendar on chain, daylight time and closures included, checked against the feed's own pulse. When the schedule says trading and the feed says nothing, that is a halt, which is how a corporate action shows up. Every closed window is pinned by two prints, and both are proved against their neighbouring rounds, so settlement needs no keeper and nothing to trust.",
  },
  {
    name: "GapMarket",
    line: "Prices the reopen while the exchange is shut",
    body: "Twenty one buckets across the next opening print, scored with LMSR. Worst case is bounded at b·ln(n) and posted up front, so the book is always quoted, always solvent, and never waiting on a counterparty. It opens at the bell and locks at the next one.",
  },
  {
    name: "ImpliedOpenFeed",
    line: "Hands that price to everyone else",
    body: "The market's expected value, served through the same interface as the Chainlink feed it wraps. Anything already reading a Coinbase equity can point here and stop going blind at the close. A book too thin or too far from the last print falls back to the stale value, which is no worse than what integrators read today.",
  },
];

export default function Mechanism() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, {once: true, margin: "-80px"});

  return (
    <section ref={ref} className="mx-auto w-full max-w-5xl px-6 pb-24">
      <motion.div
        initial={{opacity: 0, y: 16}}
        animate={seen ? {opacity: 1, y: 0} : {}}
        transition={{duration: 0.6, ease: [0.16, 1, 0.3, 1]}}
      >
        <div className="text-[10px] uppercase tracking-[0.24em] text-faint">Three contracts</div>
        <h2 className="mt-4 max-w-2xl text-2xl leading-snug text-ink sm:text-3xl">
          A clock, a market, and a price other protocols can read.
        </h2>
      </motion.div>

      <div className="mt-10 divide-y divide-line border-y border-line">
        {PIECES.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{opacity: 0, y: 12}}
            animate={seen ? {opacity: 1, y: 0} : {}}
            transition={{duration: 0.5, delay: 0.12 + i * 0.1, ease: [0.16, 1, 0.3, 1]}}
            className="grid gap-4 py-7 sm:grid-cols-[200px_1fr] sm:gap-10"
          >
            <div>
              <div className="font-mono text-[13px] text-ink">{p.name}</div>
              <div className="mt-1.5 text-[13px] leading-snug text-faint">{p.line}</div>
            </div>
            <p className="text-[15px] leading-relaxed text-muted">{p.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
