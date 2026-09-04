# Deploying

## Which network

**Base Sepolia costs nothing, but there is nothing real to read.** Coinbase tokenized
equities and the Chainlink feeds behind them exist on Base mainnet only. Testnet has no
AAPLc and no equity feed, so a staging deploy has to stand up a feed we write ourselves.
Fine for rehearsing the commands. Not a demo, because the whole point is that it reads the
real frozen Coinbase feed.

**Base mainnet is where this ends up**, and it is small money. Two different tokens are
involved and it is worth being clear about which is which:

| | Token | Amount |
|---|---|---|
| Gas | ETH on Base | ~0.000063 ETH for the full deploy |
| Subsidy | USDC on Base (`0x8335…2913`) | 0.61 USDC at the default depth |

Everything else scales off one number, `B`, the LMSR depth:

| `B` | Subsidy you post | A sensible trade | costs about |
|---|---|---|---|
| `0.05e18` | $0.15 | 0.025 shares | under a cent |
| `0.2e18` (default) | **$0.61** | 0.1 shares | ~$0.006 |
| `1e18` | $3.04 | 0.5 shares | ~$0.03 |
| `20e18` | $60.89 | 10 shares | ~$0.90 |

The subsidy is not a fee. It is the most the book can lose, posted up front, which is what
lets LMSR quote both sides with nobody on the other end. On a balanced book most of it comes
back.

Trade size scales off `B` too, and that matters more than the subsidy. Buying many multiples
of `B` pins a bucket at 100% in one go and costs far more than the subsidy: 25 shares against
`b=1e18` costs $22. The interface sizes trades at about `b/2` and warns past four times
depth, so this is handled, but watch it if you type a number in by hand.

Budget **0.0002 ETH and 1 USDC on Base** and you have room for the whole flow.

---

## Set up a keystore

Foundry encrypts the key on disk and asks for a password when it needs it. No private key in
a file, in your shell history, or in an environment variable.

**If you already have a key you want to use:**

```bash
cast wallet import bell --interactive
```

It prompts for the private key, then a password, and encrypts it into
`~/.foundry/keystores/bell`.

**If you want a fresh one:**

```bash
cast wallet new
```

That prints an address and a private key but stores nothing. Copy the private key, run the
`cast wallet import bell --interactive` above and paste it, then clear your scrollback so the
plaintext key is not left sitting in it.

**Check it:**

```bash
cast wallet list
cast wallet address --account bell
```

Fund that address on Base with a little ETH and a dollar of USDC, then confirm it arrived:

```bash
export ADDR=$(cast wallet address --account bell)

cast balance $ADDR --rpc-url base --ether
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" $ADDR --rpc-url base
```

USDC has six decimals, so `1000000` is one dollar.

### Two flags do the work

`--account bell` picks the keystore and prompts for the password.
`--sender $ADDR` tells the simulation who is signing, and the scripts read it as the owner.

---

## Dry run first

Every script runs read-only without `--broadcast`. Nothing is sent, nothing is spent, and it
does not even ask for your password. Do this before each real step.

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy --rpc-url base --sender $ADDR
```

It prints the estimated gas and what it would deploy. If that looks right, add the flags.

---

## Base mainnet

### 1. Deploy

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base --account bell --sender $ADDR \
  --broadcast --verify -vvv
```

Prints four addresses. Put three into `web/.env.local`:

```
NEXT_PUBLIC_CLOCK=0x...
NEXT_PUBLIC_MARKET=0x...
NEXT_PUBLIC_IMPLIED_FEED=0x...
```

and export two for the next steps:

```bash
export CLOCK=0x...
export MARKET=0x...
```

The deploy seeds the 2026 and 2027 NYSE closures, so the calendar is right from the first
block.

### 2. Open a session

Run while the exchange is shut, which is any weeknight after 16:00 ET or any time at the
weekend. During a regular session it reverts with `MarketOpen`, which is intended.

```bash
forge script script/Session.s.sol:OpenSession \
  --rpc-url base --account bell --sender $ADDR \
  --broadcast -vvv
```

It reads the window off the clock, walks the feed for the last print before the close,
anchors it and posts the subsidy. **Note the `window closed at` number**, which is the
session id.

### 3. Resolve after the bell

```bash
CLOSED_AT=<the number from step 2> \
forge script script/Session.s.sol:ResolveSession \
  --rpc-url base --account bell --sender $ADDR \
  --broadcast -vvv
```

It finds the first print after the open, proves it against the round before it, and settles.
Winners call `redeem(closedAt)`.

---

## Base Sepolia, if you want to rehearse first

Same flags, one command, free. Fund the address from a Base Sepolia faucet.

```bash
forge script script/Testnet.s.sol:DeployTestnet \
  --rpc-url base_sepolia --account bell --sender $ADDR \
  --broadcast -vvv
```

Deploys a feed you own, a freely mintable tUSDC, the three real contracts, the prints that
bracket the current close, and opens the book if the exchange is shut.

To close a staged window once the bell has rung:

```bash
CLOSED_AT=<from the deploy output> OPEN_PRICE=31300000000 \
forge script script/Testnet.s.sol:SettleTestnet \
  --rpc-url base_sepolia --account bell --sender $ADDR \
  --broadcast -vvv
```

---

## Settings

Only `FEED`, `B`, `STEP`, `MIN_DEPTH` and `MAX_DEVIATION_BPS` are read from the environment,
and all have defaults. See `contracts/.env.example`. There is no `PRIVATE_KEY` field; the
keystore replaced it.

To run a different equity, set `FEED` before deploying:

```bash
FEED=0x04689a41629776563E6822F76f2e57D148d28513 \
forge script script/Deploy.s.sol:Deploy --rpc-url base --sender $ADDR
```

| | |
|---|---|
| AAPL | `0x787f13dEa48Db0897CbCDD985de77809D837F988` |
| NVDA | `0x04689a41629776563E6822F76f2e57D148d28513` |
| TSLA | `0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4` |
| MSFT | `0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c` |
| COIN | `0x408e44f504A7371a345F03a73dDC96A4b48e8aa7` |
