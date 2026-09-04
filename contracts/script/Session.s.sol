// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MarketClock} from "../src/MarketClock.sol";
import {GapMarket} from "../src/GapMarket.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// Finds the round that bounds a window without anyone having to read a block explorer.
abstract contract RoundFinder is Script {
    /// Last round published at or before `ts`.
    function closeRoundFor(IAggregatorV3 feed, uint256 ts) internal view returns (uint80) {
        (uint80 latest,,,,) = feed.latestRoundData();
        for (uint80 back; back < 200; ++back) {
            uint80 rid = latest - back;
            (,,, uint256 updatedAt,) = feed.getRoundData(rid);
            if (updatedAt == 0) continue;
            if (updatedAt <= ts) return rid;
        }
        revert("no round before the close");
    }

    /// First round published at or after `ts`.
    function openRoundFor(IAggregatorV3 feed, uint256 ts) internal view returns (uint80) {
        (uint80 latest,,,,) = feed.latestRoundData();
        uint80 best;
        for (uint80 back; back < 200; ++back) {
            uint80 rid = latest - back;
            (,,, uint256 updatedAt,) = feed.getRoundData(rid);
            if (updatedAt == 0) continue;
            if (updatedAt >= ts) best = rid;
            else break;
        }
        require(best != 0, "no round after the bell");
        return best;
    }
}

/// Stand up the market for the blackout in progress.
contract OpenSession is RoundFinder {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        MarketClock clock = MarketClock(vm.envAddress("CLOCK"));
        GapMarket market = GapMarket(vm.envAddress("MARKET"));
        int256 b = int256(vm.envOr("B", uint256(0.2e18)));
        int256 step = int256(vm.envOr("STEP", uint256(0.005e18)));

        (uint64 closedAt, uint64 opensAt) = clock.currentWindow();
        uint80 closeRound = closeRoundFor(clock.feed(), closedAt);
        uint256 subsidy = market.maxLoss(b);

        console.log("window closed at", closedAt);
        console.log("reopens at      ", opensAt);
        console.log("close round     ", closeRound);
        console.log("subsidy (USDC)  ", subsidy);

        require(IERC20(USDC).balanceOf(msg.sender) >= subsidy, "fund the sender with USDC");

        vm.startBroadcast();
        IERC20(USDC).approve(address(market), subsidy);
        market.open(closeRound, b, step, subsidy);
        vm.stopBroadcast();

        console.log("opened. implied  ", uint256(market.impliedOpen(closedAt)));
    }
}

/// Close out a window once the exchange has reopened.
contract ResolveSession is RoundFinder {
    function run() external {
        MarketClock clock = MarketClock(vm.envAddress("CLOCK"));
        GapMarket market = GapMarket(vm.envAddress("MARKET"));
        uint64 closedAt = uint64(vm.envUint("CLOSED_AT"));

        MarketClock.Window memory w = clock.window(closedAt);
        require(w.closedAt != 0, "window was never anchored");
        require(block.timestamp >= w.opensAt, "the bell has not rung");

        uint80 openRound = openRoundFor(clock.feed(), w.opensAt);
        console.log("open round      ", openRound);

        vm.startBroadcast();
        market.resolve(closedAt, openRound);
        vm.stopBroadcast();

        GapMarket.Session memory s = market.session(closedAt);
        console.log("winning bucket  ", s.winner);
        console.log("close price     ", uint256(w.closePrice));
        console.log("open price      ", uint256(clock.window(closedAt).openPrice));
    }
}
