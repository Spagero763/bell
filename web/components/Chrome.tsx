"use client";

import {useEffect, useState} from "react";
import {DEPLOYMENT, TICKERS} from "@/lib/chain";
import {scheduleState} from "@/lib/clock";

const scan = (a: string) => `https://basescan.org/address/${a}`;

export function Nav() {
  const [closed, setClosed] = useState<boolean | null>(null);
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const tick = () => setClosed(scheduleState(Math.floor(Date.now() / 1000)) === "blackout");
    tick();
    const id = setInterval(tick, 30000);
    const onScroll = () => setLifted(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, {passive: true});
    return () => {
      clearInterval(id);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        lifted ? "border-b border-line bg-void/85 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex w-full max-w-[1080px] items-center justify-between px-6 py-4">
        <a href="#main" className="flex items-baseline gap-2.5">
          <span className="text-[15px] tracking-tight text-ink">Bell</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-faint">Base</span>
        </a>

        <div className="flex items-center gap-5">
          {closed !== null && (
            <span className="hidden items-center gap-2 text-[11px] text-muted sm:flex">
              <span
                className={`inline-block h-[5px] w-[5px] rounded-full ${
                  closed ? "bg-amber" : "bg-signal live-dot"
                }`}
              />
              {closed ? "Exchange closed" : "Exchange open"}
            </span>
          )}
          <a
            href="#book"
            className="rounded-md border border-line px-3.5 py-1.5 text-[12px] text-dim transition-colors hover:border-[#2b333d] hover:text-ink"
          >
            Open the book
          </a>
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  const t = TICKERS[0];
  const contracts: [string, string | undefined][] = [
    ["MarketClock", DEPLOYMENT.clock],
    ["GapMarket", DEPLOYMENT.market],
    ["ImpliedOpenFeed", DEPLOYMENT.impliedFeed],
  ];

  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-[1080px] px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <div className="text-[15px] tracking-tight text-ink">Bell</div>
            <p className="mt-3 max-w-[30ch] text-[13px] leading-relaxed text-faint">
              The price of a stock market that is closed.
            </p>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-faint">Contracts</div>
            <ul className="mt-4 space-y-2 text-[13px]">
              {contracts.map(([name, addr]) => (
                <li key={name}>
                  {addr ? (
                    <a
                      href={scan(addr)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-muted transition-colors hover:text-ink"
                    >
                      {name} <span className="tnum text-faint">{addr.slice(0, 6)}…{addr.slice(-4)}</span>
                    </a>
                  ) : (
                    <span className="text-faint">{name}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-faint">Reads</div>
            <ul className="mt-4 space-y-2 text-[13px]">
              <li>
                <a
                  href={scan(t.feed)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted transition-colors hover:text-ink"
                >
                  Chainlink {t.name} feed
                </a>
              </li>
              <li>
                <a
                  href={scan(t.token)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted transition-colors hover:text-ink"
                >
                  {t.symbol} token
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 space-y-3 text-[11px] leading-relaxed text-faint">
          <p className="max-w-[80ch]">
            <span className="text-muted">Availability.</span> The tokenized equities referenced here
            are issued by Coinbase to eligible users outside the United States. Bell does not offer
            or enable trading to US persons, and the book will not transact for visitors in the
            United States. Nothing on this site is an offer or solicitation anywhere it would be
            unlawful.
          </p>
          <p className="max-w-[80ch]">
            Bell does not issue tokenized stocks and is not affiliated with any issuer or exchange.
            The contracts are unaudited and carry total loss risk. Nothing here is investment,
            legal or tax advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
