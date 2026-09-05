"use client";

import {useRef} from "react";
import {motion, useInView} from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

const PIECES = [
  {
    n: "01",
    name: "MarketClock",
    line: "Knows when the exchange is actually open",
    body: "A New York calendar on chain, daylight saving and published closures included, checked against the feed's own pulse. Every closed window is bounded by two prints, and both are proved against their neighbouring rounds, so anyone can settle one and nobody can settle a wrong one. No keeper has to be awake at the right second.",
  },
  {
    n: "02",
    name: "GapMarket",
    line: "Prices the reopen while the exchange is shut",
    body: "Twenty one buckets across the next opening print, scored with LMSR. Worst case is bounded at b·ln(n) and posted before the book opens, so it is always quoted, always solvent, and never waiting on a counterparty to take the other side.",
  },
  {
    n: "03",
    name: "ImpliedOpenFeed",
    line: "Hands that price to everything else",
    body: "The book's expected value, served through the same interface as the Chainlink feed it wraps. Anything already reading a Coinbase equity points here and stops going blind at the close. A book too thin or too far from the last print falls back to the underlying, which is no worse than what integrators read today.",
  },
];

export default function Mechanism() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, {once: true, margin: "-100px"});

  return (
    <section ref={ref} className="mx-auto w-full max-w-[1080px] px-6 py-28">
      <motion.div
        initial={{opacity: 0, y: 18}}
        animate={seen ? {opacity: 1, y: 0} : {}}
        transition={{duration: 0.8, ease: EASE}}
        className="max-w-[24ch]"
      >
        <div className="text-[10px] uppercase tracking-[0.26em] text-faint">Three contracts</div>
        <h2 className="display mt-5 text-[30px] leading-[1.1] text-ink sm:text-[42px]">
          A clock, a market, and a price others can read.
        </h2>
      </motion.div>

      <div className="mt-16">
        {PIECES.map((p, i) => (
          <motion.article
            key={p.name}
            initial={{opacity: 0, y: 18}}
            animate={seen ? {opacity: 1, y: 0} : {}}
            transition={{delay: 0.1 + i * 0.12, duration: 0.8, ease: EASE}}
            className="group grid gap-5 border-t border-line py-9 sm:grid-cols-[64px_220px_1fr] sm:gap-8"
          >
            <div className="tnum font-mono text-[11px] text-faint">{p.n}</div>
            <div>
              <h3 className="font-mono text-[14px] text-ink">{p.name}</h3>
              <p className="mt-2 text-[13px] leading-snug text-faint">{p.line}</p>
            </div>
            <p className="max-w-[60ch] text-[15px] leading-relaxed text-dim">{p.body}</p>
          </motion.article>
        ))}
        <div className="border-t border-line" />
      </div>
    </section>
  );
}
