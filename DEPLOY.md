# Deploying

There are two paths. Read this bit first, because it decides which one you want.

## Which network

**Base Sepolia costs nothing, but there is nothing real to read.** Coinbase tokenized
equities and the Chainlink feeds behind them exist on Base mainnet only. Testnet has no
AAPLc and no equity feed, so a staging deploy has to stand up a feed we write ourselves.
That is fine for rehearsing the commands and clicking through the interface. It is not a
demo, because the whole point is that it reads the real frozen Coinbase feed.

**Base mainnet is where this has to end up**, and it is small money. Gas for the three
contracts is cents. Everything else scales off one number, `B`, the LMSR depth:

| `B` | Subsidy you post | A sensible trade | costs about |
|---|---|---|---|
| `0.05e18` | **$0.15** | 0.025 shares | under a cent |
| `0.1e18` | $0.30 | 0.05 shares | under a cent |
| `0.2e18` (default) | **$0.61** | 0.1 shares | ~$0.006 |
| `1e18` | $3.04 | 0.5 shares | ~$0.03 |
| `20e18` | $60.89 | 10 shares | ~$0.90 |

The subsidy is not a fee. It is the most the book can lose, posted up front, which is what
lets LMSR quote both sides with nobody on the other end. On a balanced book most of it comes
back.

Trade size scales off `B` too, and that matters more than the subsidy does. Buying many
multiples of `B` pins a bucket at 100% in one go and costs far more than the subsidy: 25
shares against `b=1e18` costs **$22**. The interface now sizes trades at about `b/2` by
default and warns you past four times depth, so this is handled, but it is the thing to
watch if you type a number in by hand.

At the default you can deploy, open a session and trade for **well under a dollar**.

Rehearse on Sepolia, then do the real one on mainnet for pocket change.

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

Your key needs a little ETH for gas and about **1 USDC** at the default depth.

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
