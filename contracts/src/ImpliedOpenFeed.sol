// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "solady/auth/Ownable.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {MarketClock} from "./MarketClock.sol";
import {GapMarket} from "./GapMarket.sol";

/// Speaks the Chainlink aggregator interface, so anything already reading a B20
/// equity feed can point here instead and stop going blind at the closing bell.
///
/// While the exchange is open this is a passthrough. While it is shut, the answer
/// comes from the gap market's distribution rather than a price that stopped moving
/// on Friday. That substitution only happens when the book is deep enough to mean
/// something and close enough to the last print to be sane; otherwise it falls back
/// to the stale value, which is no worse than what integrators read today.
contract ImpliedOpenFeed is IAggregatorV3, Ownable {
    IAggregatorV3 public immutable underlying;
    MarketClock public immutable clock;
    GapMarket public immutable market;

    /// How much a book must have taken in before anyone should read its price, and how
    /// far that price may sit from the last real print. Both are set at deploy because
    /// the right numbers depend entirely on how deep the book is funded, and both should
    /// go up a long way before anything meaningful borrows against this.
    uint256 public minDepth;
    uint256 public maxDeviationBps;

    event GuardsSet(uint256 minDepth, uint256 maxDeviationBps);

    constructor(
        address underlying_,
        address clock_,
        address market_,
        address owner_,
        uint256 minDepth_,
        uint256 maxDeviationBps_
    ) {
        underlying = IAggregatorV3(underlying_);
        clock = MarketClock(clock_);
        market = GapMarket(market_);
        minDepth = minDepth_;
        maxDeviationBps = maxDeviationBps_;
        _initializeOwner(owner_);
    }

    function decimals() external view returns (uint8) {
        return underlying.decimals();
    }

    function description() external view returns (string memory) {
        return underlying.description();
    }

    function getRoundData(uint80 roundId) external view returns (uint80, int256, uint256, uint256, uint80) {
        return underlying.getRoundData(roundId);
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        (roundId, answer, startedAt, updatedAt, answeredInRound) = underlying.latestRoundData();
        if (clock.state() == MarketClock.State.Open) return (roundId, answer, startedAt, updatedAt, answeredInRound);

        (int256 implied, bool usable) = impliedNow();
        if (!usable) return (roundId, answer, startedAt, updatedAt, answeredInRound);

        return (roundId, implied, block.timestamp, block.timestamp, answeredInRound);
    }

    /// The live implied open, plus whether it clears the depth and sanity guards.
    function impliedNow() public view returns (int256 implied, bool usable) {
        uint64 closedAt = uint64(clock.lastClose(block.timestamp));
        if (closedAt == 0) return (0, false);

        GapMarket.Session memory s = market.session(closedAt);
        if (s.closedAt == 0 || s.resolved || s.closePrice <= 0) return (0, false);
        if (s.collected < minDepth) return (0, false);

        implied = market.impliedOpen(closedAt);
        if (implied <= 0) return (0, false);

        uint256 drift = _absDiff(implied, s.closePrice) * 10_000 / uint256(s.closePrice);
        usable = drift <= maxDeviationBps;
    }

    function setGuards(uint256 minDepth_, uint256 maxDeviationBps_) external onlyOwner {
        minDepth = minDepth_;
        maxDeviationBps = maxDeviationBps_;
        emit GuardsSet(minDepth_, maxDeviationBps_);
    }

    function _absDiff(int256 a, int256 b) internal pure returns (uint256) {
        return uint256(a > b ? a - b : b - a);
    }
}
