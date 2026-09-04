// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MarketClock} from "../src/MarketClock.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {OpenSession} from "../script/Session.s.sol";

/// Exercises the round-finding the deploy scripts rely on, against the live feed.
contract SessionScriptTest is Test, OpenSession {
    address constant AAPL_FEED = 0x787f13dEa48Db0897CbCDD985de77809D837F988;
    MarketClock clock;
    IAggregatorV3 feed;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("base"));
        clock = new MarketClock(AAPL_FEED, address(this));
        feed = IAggregatorV3(AAPL_FEED);
    }

    function test_closeRoundIsTheLastPrintBeforeTheClose() public view {
        uint256 closedAt = clock.lastClose(block.timestamp);
        uint80 rid = closeRoundFor(feed, closedAt);

        (,,, uint256 updatedAt,) = feed.getRoundData(rid);
        (,,, uint256 next,) = feed.getRoundData(rid + 1);

        assertLe(updatedAt, closedAt, "the print is at or before the close");
        assertGt(next, closedAt, "and the one after it is not");
    }

    function test_openRoundIsTheFirstPrintAfterABell() public view {
        uint256 lastOpen = _mostRecentOpen();
        uint80 rid = openRoundFor(feed, lastOpen);

        (,,, uint256 updatedAt,) = feed.getRoundData(rid);
        (,,, uint256 prev,) = feed.getRoundData(rid - 1);

        assertGe(updatedAt, lastOpen, "the print is at or after the bell");
        assertLt(prev, lastOpen, "and the one before it is not");
        console.log("bell to first print, seconds", updatedAt - lastOpen);
    }

    /// The rounds the scripts pick are exactly the ones the clock will accept.
    function test_foundRoundsSatisfyAnchorAndSettle() public {
        uint256 lastOpen = _mostRecentOpen();
        uint64 closedAt = uint64(clock.lastClose(lastOpen - 1));
        vm.assume(closedAt != 0);

        uint80 closeRound = closeRoundFor(feed, closedAt);
        uint80 openRound = openRoundFor(feed, clock.nextOpen(closedAt));

        clock.anchor(closedAt, closeRound);
        clock.settle(closedAt, openRound);

        MarketClock.Window memory w = clock.window(closedAt);
        assertTrue(w.settled);
        assertGt(w.closePrice, 0);
        assertGt(w.openPrice, 0);

        int256 gap = ((w.openPrice - w.closePrice) * 10_000) / w.closePrice;
        console.log("blackout hours", (w.opensAt - w.closedAt) / 3600);
        console.log("close", uint256(w.closePrice));
        console.log("open ", uint256(w.openPrice));
        console.log("gap bps");
        console.logInt(gap);
    }

    /// Most recent bell that has already rung.
    function _mostRecentOpen() internal view returns (uint256) {
        uint256 day = block.timestamp / 86400;
        for (uint256 i; i < 10; ++i) {
            uint256 d = day - i;
            if (!clock.isTradingDay(d)) continue;
            (uint256 openTs,) = clock.sessionBounds(d);
            if (openTs <= block.timestamp) return openTs;
        }
        revert("no bell yet");
    }
}
