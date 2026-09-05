"use client";

import {useEffect, useRef} from "react";
import gsap from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import {PRICES, VOLUMES, CLOSE_INDEX, BELL_INDEX, CLOSE_PRICE, FACTS} from "@/lib/weekend";

const W = 1100;
const H = 380;
const PAD = {top: 40, right: 28, bottom: 54, left: 62};

const lo = Math.min(...PRICES) - 0.9;
const hi = Math.max(...PRICES) + 0.9;
const x = (i: number) => PAD.left + (i / (PRICES.length - 1)) * (W - PAD.left - PAD.right);
const y = (p: number) => PAD.top + (1 - (p - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

const linePath = PRICES.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
const maxVol = Math.max(...VOLUMES);

export default function Evidence() {
  const root = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(".ev-anno", {opacity: 1});
      gsap.set(path.current, {strokeDashoffset: 0});
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const len = path.current?.getTotalLength() ?? 0;
      gsap.set(path.current, {strokeDasharray: len, strokeDashoffset: len});
      gsap.set(".ev-anno", {opacity: 0, y: 8});

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".ev-stage",
          start: "top top",
          end: "+=2200",
          pin: true,
          scrub: 0.7,
          anticipatePin: 1,
        },
      });

      tl.to(path.current, {strokeDashoffset: 0, ease: "none", duration: 10}, 0)
        .to(".ev-anno-close", {opacity: 1, y: 0, duration: 0.7}, 1.4)
        .to(".ev-shade", {opacity: 1, duration: 1}, 1.6)
        .to(".ev-anno-band", {opacity: 1, y: 0, duration: 0.7}, 4)
        .to(".ev-anno-bell", {opacity: 1, y: 0, duration: 0.7}, 7.6)
        .to(".ev-rush", {opacity: 1, duration: 0.5}, 7.8)
        .to(".ev-anno-gap", {opacity: 1, y: 0, duration: 0.7}, 8.9)
        .to(".ev-stat", {opacity: 1, y: 0, stagger: 0.25, duration: 0.7}, 9.2);
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative" aria-label="What happened during the last blackout">
      <div className="ev-stage flex min-h-screen flex-col justify-center py-20">
        <div className="mx-auto w-full max-w-[1080px] px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="display text-[28px] leading-tight text-ink sm:text-[38px]">
              Five and a half million dollars,
              <br />
              at a price nobody could check.
            </h2>
            <div className="text-[10px] uppercase tracking-[0.22em] text-faint">
              AAPLc · 28–31 Aug 2026
            </div>
          </div>

          <div className="mt-10 overflow-hidden rounded-lg border border-line bg-panel">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Price path">
              <rect
                className="ev-shade"
                style={{opacity: 0}}
                x={x(CLOSE_INDEX)}
                y={PAD.top}
                width={x(BELL_INDEX) - x(CLOSE_INDEX)}
                height={H - PAD.top - PAD.bottom}
                fill="rgba(232,163,61,0.055)"
              />

              {[lo + 1.2, (lo + hi) / 2, hi - 1.2].map((p) => (
                <g key={p}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={y(p)}
                    y2={y(p)}
                    stroke="#12151b"
                    strokeWidth="1"
                  />
                  <text x={PAD.left - 12} y={y(p) + 3.5} textAnchor="end" fill="#4e555f" fontSize="10">
                    {p.toFixed(0)}
                  </text>
                </g>
              ))}

              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(CLOSE_PRICE)}
                y2={y(CLOSE_PRICE)}
                stroke="rgba(232,163,61,0.5)"
                strokeWidth="1"
                strokeDasharray="2 5"
              />

              {VOLUMES.map((v, i) => (
                <rect
                  key={i}
                  className={i === BELL_INDEX ? "ev-rush" : undefined}
                  style={i === BELL_INDEX ? {opacity: 0} : undefined}
                  x={x(i) - 2.6}
                  y={H - PAD.bottom - (v / maxVol) * 30}
                  width="5.2"
                  height={(v / maxVol) * 30}
                  fill={i === BELL_INDEX ? "rgba(229,72,77,0.85)" : "rgba(255,255,255,0.07)"}
                />
              ))}

              <line
                x1={x(BELL_INDEX)}
                x2={x(BELL_INDEX)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="rgba(229,72,77,0.4)"
                strokeWidth="1"
              />

              <path
                ref={path}
                d={linePath}
                fill="none"
                stroke="#f2f4f7"
                strokeWidth="1.9"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              <g className="ev-anno ev-anno-close" style={{opacity: 0}}>
                <text x={PAD.left + 8} y={y(CLOSE_PRICE) - 11} fill="#e8a33d" fontSize="11.5">
                  the feed stops here, and holds ${CLOSE_PRICE.toFixed(2)} for 65 hours
                </text>
              </g>

              <g className="ev-anno ev-anno-band" style={{opacity: 0}}>
                <text x={x(34)} y={PAD.top + 26} textAnchor="middle" fill="#a2a9b4" fontSize="11.5">
                  $5.6M changes hands inside a 1% band
                </text>
              </g>

              <g className="ev-anno ev-anno-bell" style={{opacity: 0}}>
                <text x={x(BELL_INDEX) - 10} y={PAD.top + 18} textAnchor="end" fill="#e5484d" fontSize="11.5">
                  the bell
                </text>
              </g>

              <g className="ev-anno ev-anno-gap" style={{opacity: 0}}>
                <circle cx={x(72)} cy={y(PRICES[72])} r="3.4" fill="#e5484d" />
                <text x={x(72) - 12} y={y(PRICES[72]) + 22} textAnchor="end" fill="#e5484d" fontSize="11.5">
                  −2.0%
                </text>
              </g>

              {[
                [0, "Fri"],
                [12, "Sat"],
                [36, "Sun"],
                [60, "Mon"],
              ].map(([i, l]) => (
                <text
                  key={l as string}
                  x={x(i as number)}
                  y={H - 18}
                  textAnchor="middle"
                  fill="#4e555f"
                  fontSize="10"
                >
                  {l as string}
                </text>
              ))}
            </svg>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
            {[
              [FACTS.swaps.toLocaleString(), "trades in the dark", ""],
              [`$${(FACTS.volume / 1e6).toFixed(2)}M`, "volume", ""],
              ["1.0%", "weekend range", "text-amber"],
              ["−2.0%", "gap at the open", "text-loss"],
            ].map(([v, l, tone]) => (
              <div key={l} className="ev-stat bg-panel px-5 py-5" style={{opacity: 0}}>
                <div className={`tnum font-mono text-[22px] ${tone || "text-ink"}`}>{v}</div>
                <div className="mt-1.5 text-[11px] text-faint">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1080px] px-6 pb-28">
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-dim">
          The busiest half hour of the entire weekend was the one immediately before trading
          resumed: <span className="text-ink">{FACTS.rushSwaps.toLocaleString()} swaps</span> and{" "}
          <span className="text-ink">${(FACTS.rushVolume / 1e6).toFixed(2)}M</span> in the thirty
          minutes ahead of the bell, as arbitrage repriced a gap that had been knowable to nobody and
          was about to be knowable to everyone. That is the leak. It reopens every Friday at four.
        </p>
      </div>
    </section>
  );
}
