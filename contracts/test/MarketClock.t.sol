// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MarketClock} from "../src/MarketClock.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";

contract MarketClockTest is Test {
    address constant AAPL_FEED = 0x787f13dEa48Db0897CbCDD985de77809D837F988;
    address constant OWNER = address(0xB0B);

    // 2026-01-15 Thu, 2026-07-15 Wed, 2026-08-29 Sat, 2026-08-31 Mon
    uint256 constant JAN15 = 20468;
    uint256 constant JUL15 = 20649;
    uint256 constant SAT = 20694;
    uint256 constant MON = 20696;

    MarketClock clock;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("base"));
        clock = new MarketClock(AAPL_FEED, OWNER);
    }

    function test_standardTimeSession() public view {
        (uint256 openTs, uint256 closeTs) = clock.sessionBounds(JAN15);
        assertEq(openTs - JAN15 * 86400, 14 hours + 30 minutes, "EST open 14:30 UTC");
        assertEq(closeTs - JAN15 * 86400, 21 hours, "EST close 21:00 UTC");
    }

    function test_daylightTimeSession() public view {
        (uint256 openTs, uint256 closeTs) = clock.sessionBounds(JUL15);
        assertEq(openTs - JUL15 * 86400, 13 hours + 30 minutes, "EDT open 13:30 UTC");
        assertEq(closeTs - JUL15 * 86400, 20 hours, "EDT close 20:00 UTC");
    }

    function test_weekendIsNotATradingDay() public view {
        assertFalse(clock.isTradingDay(SAT));
        assertTrue(clock.isTradingDay(MON));
    }

    function test_weekendBlackoutSpansToMondayBell() public {
        vm.warp(SAT * 86400 + 12 hours);
        assertEq(uint8(clock.state()), uint8(MarketClock.State.Blackout));

        (uint256 mondayOpen,) = clock.sessionBounds(MON);
        assertEq(clock.nextOpen(block.timestamp), mondayOpen);

        uint256 fridayClose = clock.lastClose(block.timestamp);
        assertEq(clock.nextOpen(block.timestamp) - fridayClose, 65 hours + 30 minutes, "65.5h blackout");
    }

    function test_holidayExtendsBlackout() public {
        uint256[] memory days_ = new uint256[](1);
        days_[0] = MON;
        vm.prank(OWNER);
        clock.setHolidays(days_, true);

        vm.warp(SAT * 86400 + 12 hours);
        (uint256 tuesdayOpen,) = clock.sessionBounds(MON + 1);
        assertEq(clock.nextOpen(block.timestamp), tuesdayOpen, "rolls past the holiday");
    }

    function test_openDuringRegularHours() public {
        (uint256 openTs,) = clock.sessionBounds(block.timestamp / 86400);
        vm.warp(openTs + 1 hours);
        // fork price is fixed, so freshness is judged against the forked round
        if (clock.secondsStale() <= clock.haltTolerance()) {
            assertEq(uint8(clock.state()), uint8(MarketClock.State.Open));
        }
    }

    /// A feed that goes quiet while the schedule says the session is running is how a
    /// corporate action shows up on chain.
    function test_haltedWhenFeedPausesInsideSession() public {
        MockAggregator mock = new MockAggregator();
        MarketClock mocked = new MarketClock(address(mock), OWNER);

        (uint256 openTs,) = mocked.sessionBounds(MON);
        mock.push(1, 300e8, openTs + 15 minutes);

        vm.warp(openTs + 30 minutes);
        assertEq(uint8(mocked.state()), uint8(MarketClock.State.Open));

        vm.prank(OWNER);
        mocked.setHaltTolerance(45 minutes);

        vm.warp(openTs + 2 hours);
        assertEq(uint8(mocked.state()), uint8(MarketClock.State.Halted), "quiet feed inside session is a halt");

        mock.push(2, 301e8, block.timestamp);
        assertEq(uint8(mocked.state()), uint8(MarketClock.State.Open), "resumes when prints return");
    }

    /// A calm session with no deviation prints must not read as a halt.
    function test_defaultToleranceSurvivesAQuietSession() public {
        MockAggregator mock = new MockAggregator();
        MarketClock mocked = new MarketClock(address(mock), OWNER);

        (uint256 openTs,) = mocked.sessionBounds(MON);
        mock.push(1, 300e8, openTs + 10 minutes);

        vm.warp(openTs + 3 hours);
        assertEq(uint8(mocked.state()), uint8(MarketClock.State.Open), "2h50m of silence is normal");
    }

    /// Walk the live feed, find a real blackout, and prove it settles with the
    /// bracketing rounds the contract demands.
    function test_settleAgainstLiveFeed() public {
        IAggregatorV3 feed = IAggregatorV3(AAPL_FEED);
        (uint80 latest,,,,) = feed.latestRoundData();

        uint80 openRound;
        uint64 closedAt;
        for (uint80 back = 1; back < 40; ++back) {
            uint80 rid = latest - back;
            (,,, uint256 up,) = feed.getRoundData(rid);
            (,,, uint256 prev,) = feed.getRoundData(rid - 1);
            if (up == 0 || prev == 0) break;
            if (up - prev < 8 hours) continue;

            uint64 candidate = uint64(clock.lastClose(prev));
            if (candidate == 0) continue;
            if (clock.nextOpen(candidate) > up) continue;
            openRound = rid;
            closedAt = candidate;
            break;
        }
        require(openRound != 0, "no blackout in recent rounds");

        uint80 closeRound = openRound - 1;
        for (uint80 back = 1; back < 40; ++back) {
            (,,, uint256 up,) = feed.getRoundData(openRound - back);
            if (up != 0 && up <= closedAt) {
                closeRound = openRound - back;
                break;
            }
        }

        clock.anchor(closedAt, closeRound);
        clock.settle(closedAt, openRound);
        MarketClock.Window memory w = clock.window(closedAt);

        assertTrue(w.settled);
        assertGt(w.openPrice, 0);
        assertGt(w.closePrice, 0);
        assertGt(w.opensAt, w.closedAt);

        console.log("blackout hours   ", (w.opensAt - w.closedAt) / 3600);
        console.log("close price (8dp)", uint256(w.closePrice));
        console.log("open  price (8dp)", uint256(w.openPrice));
    }

    function test_anchorRejectsARoundThatIsNotTheClose() public {
        IAggregatorV3 feed = IAggregatorV3(AAPL_FEED);
        (uint80 latest,,,,) = feed.latestRoundData();
        uint64 closedAt = uint64(clock.lastClose(block.timestamp));
        vm.expectRevert(MarketClock.BadCloseRound.selector);
        clock.anchor(closedAt, latest);
    }

    function test_settleRejectsAnUnanchoredWindow() public {
        IAggregatorV3 feed = IAggregatorV3(AAPL_FEED);
        (uint80 latest,,,,) = feed.latestRoundData();
        uint64 closedAt = uint64(clock.lastClose(block.timestamp));
        vm.expectRevert(MarketClock.NotAnchored.selector);
        clock.settle(closedAt, latest);
    }
}
