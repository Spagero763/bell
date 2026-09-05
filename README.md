# Bell

Tokenized equities trade around the clock. Their price feed does not.

Coinbase equities on Base are ERC-20s that move whenever someone wants to move them. The
Chainlink feed behind them is not. From the closing bell in New York until the next one,
the oracle holds the last print and the mint and redeem path is shut, because Authorized
Participants cannot touch real shares while the exchange is closed. For sixty five hours
every weekend and seventeen and a half every weeknight, the asset trades with no reference
price and no arbitrage path to the thing it represents.

Chainlink documents this plainly:

> When underlying equity markets are closed (weekends, holidays, thin overnight windows),
> the feed holds the last close even though the contract remains callable via
> `latestRoundData()`. These feeds do not have heartbeats during off-hours.

Bell is a venue for those hours, and a live price for everyone who needs one.

## What actually happens in the dark

AAPLc on Base, Friday 28 August to Monday 31 August 2026, reconstructed from swap events on
the 0.05% USDC pool at `0xa3b1e3f9747065e2073722ff4c9027d3ea4994f0`:

| | |
|---|---|
| Friday 16:00 ET close | $319.98 |
| Trades during the blackout | 16,909 |
| USDC volume during the blackout | $5,629,032 |
| Weekend range | $318.73 to $321.99, a 1.0% band |
| Last price before the Monday bell | $319.88, 3 basis points from Friday |
| Monday midday low | $313.43, down 2.0% |

Five and a half million dollars changed hands at a price nobody could check. With nothing to
price against, the weekend market did the only thing available to it and pinned itself to
Friday's close. Then the bell rang and Apple was worth two percent less.

The heaviest hour of the whole weekend was the last one before trading resumed: 1,218 swaps
and $1,032,821 in the thirty minutes ahead of the open, as arbitrage repriced a gap that had
been knowable to nobody and was about to be knowable to everyone. That is the leak, and it
reopens every weekend.

## Design

**`MarketClock`** decides when the exchange is actually open. It carries a New York calendar
on chain, daylight saving and published closures included, and checks it against the feed's
own pulse. Schedule says trading and the feed says nothing means the feed is paused, which is
what a corporate action looks like from here.

Each closed window is bounded by two prints. `anchor` pins the last print at or before the
close, `settle` pins the first at or after the bell, and both are proved on chain by checking
the neighbouring round: the round after the close print must fall after the close, the round
before the open print must fall before the bell. Anyone can submit them, nobody can submit a
wrong one, and no keeper has to be running at the right second.

**`GapMarket`** runs only while the exchange is shut. Twenty one buckets spanning the next
opening print, scored with LMSR. Worst case loss is bounded at `b·ln(n)` and posted as subsidy
before the book opens, so it is always quoted, always solvent, and never waiting for someone
to take the other side. It opens at the bell and locks at the next one.

**`ImpliedOpenFeed`** serves the market's expected value through the same interface as the
Chainlink feed it wraps. Anything already reading a Coinbase equity can point at it instead
and stop going blind at the close. A book thinner than `minDepth` or drifting further than
`maxDeviationBps` from the last print falls back to the underlying, which is no worse than
what integrators read today.

## A note on halt detection

These feeds publish on deviation, not on a meaningful heartbeat, so silence inside a live
session is normal rather than exceptional. The AAPL feed was observed quiet for two hours
fifty minutes during an ordinary session. `haltTolerance` therefore defaults to four hours
and is owner tunable per asset. The schedule, not the silence, is the source of truth for
whether a window is closed; silence is only ever a soft signal layered on top.

## Layout

```
contracts/   Foundry. MarketClock, GapMarket, ImpliedOpenFeed, deploy script.
web/         Next.js front end, reads Base mainnet directly.
```

## Running it

```bash
cd contracts
forge test                       # unit tests plus a fork test against the live feed
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```

```bash
cd web
npm install
npm run dev
```

The front end reads Base with no configuration. Point it at deployed contracts by setting
`NEXT_PUBLIC_CLOCK`, `NEXT_PUBLIC_MARKET` and `NEXT_PUBLIC_IMPLIED_FEED`.

## Addresses

Live on Base mainnet, running Apple.

| | |
|---|---|
| MarketClock | `0x326babf614281B8630fd887377A3f3151f2Cb840` |
| GapMarket | `0xE639e143344DaA3Bf116b3a527362032f737Bd8E` |
| ImpliedOpenFeed | `0x3900bBdDbEc4ecc6CdB8505721e74d6f4ebd7A59` |

What they read.

| | |
|---|---|
| AAPLc | `0xb200000000000000000000C2e324d24d7eEcd1fb` |
| Chainlink AAPL feed | `0x787f13dEa48Db0897CbCDD985de77809D837F988` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Disclaimer

Bell does not issue tokenized stocks and is not affiliated with any issuer or exchange. The
contracts are unaudited. Nothing here is investment advice.
