// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {MarketClock} from "./MarketClock.sol";

/// A market on where a tokenized equity reopens, running only while the underlying
/// exchange is shut. Shares are scored with LMSR, so the book is always priced,
/// always solvent, and never needs a counterparty on the other side.
contract GapMarket {
    uint256 public constant BUCKETS = 21;
    uint256 public constant CENTER = 10;
    int256 internal constant WAD = 1e18;
    uint256 internal constant USDC_SCALE = 1e12;

    struct Session {
        uint64 closedAt;
        uint64 opensAt;
        int256 closePrice;
        int256 b;
        int256 step;
        uint256 subsidy;
        uint256 collected;
        uint256 winner;
        bool resolved;
    }

    address public immutable usdc;
    MarketClock public immutable clock;

    mapping(uint64 => Session) internal _sessions;
    mapping(uint64 => mapping(uint256 => int256)) public outstanding;
    mapping(uint64 => mapping(uint256 => mapping(address => uint256))) public shares;

    event Opened(uint64 indexed closedAt, int256 closePrice, int256 b, int256 step, uint256 subsidy);
    event Bought(uint64 indexed closedAt, address indexed trader, uint256 bucket, uint256 size, uint256 cost);
    event Resolved(uint64 indexed closedAt, int256 openPrice, uint256 winner);
    event Redeemed(uint64 indexed closedAt, address indexed trader, uint256 payout);

    error SessionExists();
    error NoSession();
    error BellHasRung();
    error StillClosed();
    error AlreadyResolved();
    error NotResolved();
    error BadBucket();
    error BadParams();
    error CostExceeded(uint256 cost);
    error SubsidyTooSmall(uint256 required);
    error NothingToRedeem();

    constructor(address usdc_, address clock_) {
        usdc = usdc_;
        clock = MarketClock(clock_);
    }

    function session(uint64 closedAt) external view returns (Session memory) {
        return _sessions[closedAt];
    }

    /// Stand up the market for the blackout currently in progress. Anyone can do this,
    /// and whoever does puts up the LMSR subsidy that bounds the book's worst case.
    function open(uint80 closeRound, int256 b, int256 step, uint256 subsidy)
        external
        returns (uint64 closedAt)
    {
        uint64 opensAt;
        (closedAt, opensAt) = clock.currentWindow();
        if (_sessions[closedAt].closedAt != 0) revert SessionExists();
        if (b <= 0 || step <= 0) revert BadParams();

        uint256 required = maxLoss(b);
        if (subsidy < required) revert SubsidyTooSmall(required);

        if (!clock.isAnchored(closedAt)) clock.anchor(closedAt, closeRound);
        int256 closePrice = clock.window(closedAt).closePrice;
        if (closePrice <= 0) revert BadParams();

        _sessions[closedAt] = Session({
            closedAt: closedAt,
            opensAt: opensAt,
            closePrice: closePrice,
            b: b,
            step: step,
            subsidy: subsidy,
            collected: 0,
            winner: 0,
            resolved: false
        });

        SafeTransferLib.safeTransferFrom(usdc, msg.sender, address(this), subsidy);
        emit Opened(closedAt, closePrice, b, step, subsidy);
    }

    function buy(uint64 closedAt, uint256 bucket, uint256 size, uint256 maxCost)
        external
        returns (uint256 cost)
    {
        Session storage s = _sessions[closedAt];
        if (s.closedAt == 0) revert NoSession();
        if (block.timestamp >= s.opensAt) revert BellHasRung();
        if (bucket >= BUCKETS) revert BadBucket();

        int256[BUCKETS] memory q = _book(closedAt);
        int256 before = _score(q, s.b);
        q[bucket] += int256(size);
        int256 next = _score(q, s.b);

        cost = _toUsdcUp(uint256(next - before));
        if (cost > maxCost) revert CostExceeded(cost);

        outstanding[closedAt][bucket] += int256(size);
        shares[closedAt][bucket][msg.sender] += size;
        s.collected += cost;

        SafeTransferLib.safeTransferFrom(usdc, msg.sender, address(this), cost);
        emit Bought(closedAt, msg.sender, bucket, size, cost);
    }

    /// Lock the result to the first print after the bell.
    function resolve(uint64 closedAt, uint80 openRound) external {
        Session storage s = _sessions[closedAt];
        if (s.closedAt == 0) revert NoSession();
        if (s.resolved) revert AlreadyResolved();
        if (block.timestamp < s.opensAt) revert StillClosed();

        if (!clock.isSettled(closedAt)) clock.settle(closedAt, openRound);
        int256 openPrice = clock.window(closedAt).openPrice;

        uint256 winner = bucketOf(closedAt, openPrice);
        s.winner = winner;
        s.resolved = true;

        emit Resolved(closedAt, openPrice, winner);
    }

    function redeem(uint64 closedAt) external returns (uint256 payout) {
        Session storage s = _sessions[closedAt];
        if (!s.resolved) revert NotResolved();

        uint256 held = shares[closedAt][s.winner][msg.sender];
        if (held == 0) revert NothingToRedeem();
        shares[closedAt][s.winner][msg.sender] = 0;

        payout = held / USDC_SCALE;
        SafeTransferLib.safeTransfer(usdc, msg.sender, payout);
        emit Redeemed(closedAt, msg.sender, payout);
    }

    /// Worst case the subsidy has to cover, b * ln(n).
    function maxLoss(int256 b) public pure returns (uint256) {
        return _toUsdcUp(uint256(b * FixedPointMathLib.lnWad(int256(BUCKETS) * WAD) / WAD));
    }

    function bucketMid(uint64 closedAt, uint256 i) public view returns (int256) {
        Session memory s = _sessions[closedAt];
        return s.closePrice * (WAD + (int256(i) - int256(CENTER)) * s.step) / WAD;
    }

    function bucketOf(uint64 closedAt, int256 price) public view returns (uint256) {
        Session memory s = _sessions[closedAt];
        int256 rel = (price - s.closePrice) * WAD / s.closePrice;
        int256 k = rel >= 0 ? (rel + s.step / 2) / s.step : -((-rel + s.step / 2) / s.step);
        int256 idx = int256(CENTER) + k;
        if (idx < 0) return 0;
        if (idx > int256(BUCKETS - 1)) return BUCKETS - 1;
        return uint256(idx);
    }

    /// Marginal price of each bucket, in WAD. These sum to one and are the market's
    /// live distribution over the opening print.
    function prices(uint64 closedAt) public view returns (uint256[BUCKETS] memory p) {
        Session memory s = _sessions[closedAt];
        if (s.closedAt == 0) revert NoSession();

        int256[BUCKETS] memory q = _book(closedAt);
        int256 peak = q[0];
        for (uint256 i = 1; i < BUCKETS; ++i) {
            if (q[i] > peak) peak = q[i];
        }

        int256[BUCKETS] memory e;
        int256 sum;
        for (uint256 i; i < BUCKETS; ++i) {
            e[i] = FixedPointMathLib.expWad((q[i] - peak) * WAD / s.b);
            sum += e[i];
        }
        for (uint256 i; i < BUCKETS; ++i) {
            p[i] = uint256(e[i] * WAD / sum);
        }
    }

    /// The number that does not otherwise exist on chain while the exchange is shut:
    /// a live, market-derived estimate of the next opening print.
    function impliedOpen(uint64 closedAt) public view returns (int256 px) {
        uint256[BUCKETS] memory p = prices(closedAt);
        for (uint256 i; i < BUCKETS; ++i) {
            px += int256(p[i]) * bucketMid(closedAt, i) / WAD;
        }
    }

    function quote(uint64 closedAt, uint256 bucket, uint256 size) external view returns (uint256) {
        Session memory s = _sessions[closedAt];
        if (s.closedAt == 0) revert NoSession();
        if (bucket >= BUCKETS) revert BadBucket();

        int256[BUCKETS] memory q = _book(closedAt);
        int256 before = _score(q, s.b);
        q[bucket] += int256(size);
        return _toUsdcUp(uint256(_score(q, s.b) - before));
    }

    function _book(uint64 closedAt) internal view returns (int256[BUCKETS] memory q) {
        for (uint256 i; i < BUCKETS; ++i) {
            q[i] = outstanding[closedAt][i];
        }
    }

    /// LMSR cost function, shifted by the running max so the exponentials stay in range.
    function _score(int256[BUCKETS] memory q, int256 b) internal pure returns (int256) {
        int256 peak = q[0];
        for (uint256 i = 1; i < BUCKETS; ++i) {
            if (q[i] > peak) peak = q[i];
        }
        int256 sum;
        for (uint256 i; i < BUCKETS; ++i) {
            sum += FixedPointMathLib.expWad((q[i] - peak) * WAD / b);
        }
        return peak + b * FixedPointMathLib.lnWad(sum) / WAD;
    }

    function _toUsdcUp(uint256 wad) internal pure returns (uint256) {
        return (wad + USDC_SCALE - 1) / USDC_SCALE;
    }
}
