# Deploying

Three commands. Everything that can be derived on chain is derived on chain, so there are no
round IDs or timestamps to look up by hand.

## Once

```bash
cd contracts
cp .env.example .env
```

Put a deployer key in `.env`. It needs a small amount of ETH on Base for gas, and about
**61 USDC** if you want to open the first session in the same sitting. Add a Basescan API key
if you want the contracts verified.

## 1. Deploy

```bash
source .env
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base --broadcast --verify -vvv
```

Prints four addresses. Copy `clock` and `market` back into `.env` as `CLOCK` and `MARKET`,
and put all three into `web/.env.local`:

```
NEXT_PUBLIC_CLOCK=0x...
NEXT_PUBLIC_MARKET=0x...
NEXT_PUBLIC_IMPLIED_FEED=0x...
```

The deploy also seeds the 2026 and 2027 NYSE closures, so the calendar is correct from the
first block.

## 2. Open a session

Run this **while the exchange is shut**, which is any weeknight after 16:00 ET or any time
over a weekend. It reverts with `MarketOpen` during a regular session, which is intended.

```bash
source .env
forge script script/Session.s.sol:OpenSession \
  --rpc-url base --broadcast -vvv
```

It reads the window from the clock, walks the feed to find the last print before the close,
anchors it, and puts up the LMSR subsidy. Note the `window closed at` value it prints, which
is the session id.

## 3. Resolve after the bell

```bash
CLOSED_AT=<the value printed above> \
forge script script/Session.s.sol:ResolveSession \
  --rpc-url base --broadcast -vvv
```

It finds the first print after the open, proves it against the round before it, and settles.
Winners redeem with `redeem(closedAt)`.

## Checking without spending anything

Every script runs read-only if you drop `--broadcast`, so you can confirm the window, the
rounds and the subsidy before committing to anything.

```bash
forge script script/Session.s.sol:OpenSession --rpc-url base -vvv
```
