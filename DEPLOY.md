# Deploying

There are two paths. Read this bit first, because it decides which one you want.

## Which network

**Base Sepolia costs nothing, but there is nothing real to read.** Coinbase tokenized
equities and the Chainlink feeds behind them exist on Base mainnet only. Testnet has no
AAPLc and no equity feed, so a staging deploy has to stand up a feed we write ourselves.
That is fine for rehearsing the commands and clicking through the interface. It is not a
demo, because the whole point is that it reads the real frozen Coinbase feed.

**Base mainnet is where this has to end up**, and it is cheap. Gas for the three contracts
is cents. The only real cost is the LMSR subsidy, and you choose it:

| `B` | Subsidy you post |
|---|---|
| `0.25e18` | $0.76 |
| `0.5e18` | $1.52 |
| `1e18` (default) | **$3.04** |
| `2e18` | $6.09 |
| `20e18` | $60.89 |

The subsidy is not a fee. It is the most the book can lose, posted up front, which is what
lets LMSR quote both sides without a counterparty. On a balanced book you get most of it
back. Three dollars is plenty for a demo; a deeper book just means each trade moves the
distribution less.

Rehearse on Sepolia, then do the real one on mainnet for a few dollars.

---

## Staging on Base Sepolia

```bash
cd contracts
cp .env.example .env          # put a key in it, fund from a Base Sepolia faucet
source .env

forge script script/Testnet.s.sol:DeployTestnet \
  --rpc-url base_sepolia --broadcast -vvv
```

One command does everything: deploys a feed you own, a freely mintable tUSDC, the three
real contracts, writes the two prints that bracket the current close, and opens the book if
the exchange is shut. It prints every address plus the `closedAt` session id.

Run it during a blackout, which is any weeknight after 16:00 ET or any time at the weekend.
During a regular session it deploys and tells you to come back after the bell.

To close a staged window once the bell has actually rung:

```bash
CLOSED_AT=<from the deploy output> OPEN_PRICE=31300000000 \
forge script script/Testnet.s.sol:SettleTestnet \
  --rpc-url base_sepolia --broadcast -vvv
```

---

## The real one, on Base mainnet

Your key needs a little ETH for gas and about **3 USDC** at the default depth.

### 1. Deploy

```bash
source .env
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base --broadcast --verify -vvv
```

Copy `clock` and `market` back into `.env`, and put all three addresses into
`web/.env.local`:

```
NEXT_PUBLIC_CLOCK=0x...
NEXT_PUBLIC_MARKET=0x...
NEXT_PUBLIC_IMPLIED_FEED=0x...
```

The deploy seeds the 2026 and 2027 NYSE closures, so the calendar is right from the first
block.

### 2. Open a session

Run while the exchange is shut. It reverts with `MarketOpen` during a regular session, which
is intended.

```bash
source .env
forge script script/Session.s.sol:OpenSession \
  --rpc-url base --broadcast -vvv
```

It reads the window off the clock, walks the feed for the last print before the close,
anchors it and posts the subsidy. Note the `window closed at` value, which is the session id.

### 3. Resolve after the bell

```bash
CLOSED_AT=<the value from step 2> \
forge script script/Session.s.sol:ResolveSession \
  --rpc-url base --broadcast -vvv
```

It finds the first print after the open, proves it against the round before it, and settles.
Winners call `redeem(closedAt)`.

---

## Dry running

Drop `--broadcast` and any script runs read-only against the real chain. Nothing is sent and
nothing is spent, but you see the window, the rounds it picked and the exact subsidy.

```bash
forge script script/Session.s.sol:OpenSession --rpc-url base -vvv
```

Do this first. It is the cheapest way to confirm the round walking picked what you expect.
