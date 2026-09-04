import Pulse from "@/components/Pulse";
import Evidence from "@/components/Evidence";
import Book from "@/components/Book";
import Mechanism from "@/components/Mechanism";
import {DEPLOYMENT, TICKERS} from "@/lib/chain";

export default function Home() {
  const aapl = TICKERS[0];

  return (
    <main className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 h-[720px] grid-field" />

      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-7">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[15px] tracking-tight text-ink">Bell</span>
          <span className="text-[11px] text-faint">Base</span>
        </div>
        <a
          href={`https://basescan.org/address/${aapl.token}`}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-faint transition-colors hover:text-muted"
        >
          {aapl.symbol} contract
        </a>
      </header>

      <section className="relative pt-16 pb-4 sm:pt-24">
        <div className="mx-auto mb-14 max-w-3xl px-6 text-center">
          <h1 className="text-3xl leading-[1.15] tracking-tight text-ink sm:text-5xl">
            Tokenized equities trade around the clock.
            <br />
            <span className="text-muted">Their price feed does not.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-muted">
            Coinbase equities on Base keep moving after New York shuts, but the oracle behind them
            holds Friday&apos;s close and the redemption path closes with the exchange. Bell is a
            venue for those hours, and a live price for everyone else who needs one.
          </p>
        </div>

        <Pulse />
      </section>

      <Book />

      <Evidence />

      <Mechanism />

      <footer className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="border-t border-line pt-8">
          <div className="grid gap-6 text-[13px] sm:grid-cols-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-faint">Reads</div>
              <ul className="mt-3 space-y-1.5 text-muted">
                <li>
                  <a
                    className="transition-colors hover:text-ink"
                    href={`https://basescan.org/address/${aapl.feed}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Chainlink {aapl.name} feed
                  </a>
                </li>
                <li>
                  <a
                    className="transition-colors hover:text-ink"
                    href={`https://basescan.org/address/${aapl.token}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {aapl.symbol} token
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-faint">Contracts</div>
              <ul className="mt-3 space-y-1.5 text-muted">
                {DEPLOYMENT.clock ? (
                  <>
                    <li>
                      <a
                        className="transition-colors hover:text-ink"
                        href={`https://basescan.org/address/${DEPLOYMENT.clock}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        MarketClock
                      </a>
                    </li>
                    <li>
                      <a
                        className="transition-colors hover:text-ink"
                        href={`https://basescan.org/address/${DEPLOYMENT.market}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        GapMarket
                      </a>
                    </li>
                    <li>
                      <a
                        className="transition-colors hover:text-ink"
                        href={`https://basescan.org/address/${DEPLOYMENT.impliedFeed}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ImpliedOpenFeed
                      </a>
                    </li>
                  </>
                ) : (
                  <li className="text-faint">Pending deployment</li>
                )}
              </ul>
            </div>
          </div>
          <p className="mt-10 text-[11px] leading-relaxed text-faint">
            Bell does not issue tokenized stocks and is not affiliated with any issuer or exchange.
            Nothing here is investment advice.
          </p>
        </div>
      </footer>
    </main>
  );
}
