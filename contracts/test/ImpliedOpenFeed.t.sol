// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MarketClock} from "../src/MarketClock.sol";
import {GapMarket} from "../src/GapMarket.sol";
import {ImpliedOpenFeed} from "../src/ImpliedOpenFeed.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract ImpliedOpenFeedTest is Test {
    uint256 constant FRI = 20693;
    uint256 constant MON = 20696;

    int256 constant CLOSE_PX = 319_98000000;
    int256 constant B = 2000e18;
    int256 constant STEP = 0.005e18;

    address constant OWNER = address(0xB0B);
    address constant ALICE = address(0xA11CE);

    MockAggregator feed;
    MockUSDC usdc;
    MarketClock clock;
    GapMarket market;
    ImpliedOpenFeed wrapped;

    uint64 closedAt;
    uint64 opensAt;

    function setUp() public {
        feed = new MockAggregator();
        usdc = new MockUSDC();
        clock = new MarketClock(address(feed), OWNER);
        market = new GapMarket(address(usdc), address(clock));
        wrapped = new ImpliedOpenFeed(address(feed), address(clock), address(market), OWNER, 250e6, 1000);

        (, uint256 fridayClose) = clock.sessionBounds(FRI);
        (uint256 mondayOpen,) = clock.sessionBounds(MON);
        closedAt = uint64(fridayClose);
        opensAt = uint64(mondayOpen);

        feed.push(1, CLOSE_PX, fridayClose - 1 hours);
        feed.push(2, CLOSE_PX, fridayClose + 90 minutes);
        vm.warp(fridayClose + 6 hours);

        usdc.mint(address(this), 1_000_000e6);
        usdc.approve(address(market), type(uint256).max);
        usdc.mint(ALICE, 1_000_000e6);
        vm.prank(ALICE);
        usdc.approve(address(market), type(uint256).max);

        market.open(1, B, STEP, market.maxLoss(B));
    }

    function test_passesThroughWhileTheExchangeIsOpen() public {
        vm.warp(opensAt + 1 hours);
        feed.push(3, 313_00000000, opensAt + 2 minutes);

        (, int256 answer,, uint256 updatedAt,) = wrapped.latestRoundData();
        assertEq(answer, 313_00000000, "underlying answer");
        assertEq(updatedAt, opensAt + 2 minutes, "underlying timestamp");
    }

    function test_thinBookFallsBackToTheStalePrint() public {
        (, bool usable) = wrapped.impliedNow();
        assertFalse(usable, "empty book is not a price");

        (, int256 answer,, uint256 updatedAt,) = wrapped.latestRoundData();
        assertEq(answer, CLOSE_PX);
        assertEq(updatedAt, closedAt + 90 minutes, "still the stale print");
    }

    function test_deepBookReplacesTheStalePrint() public {
        vm.prank(ALICE);
        market.buy(closedAt, 6, 5000e18, type(uint256).max);

        (int256 implied, bool usable) = wrapped.impliedNow();
        assertTrue(usable, "book is deep enough to speak");
        assertLt(implied, CLOSE_PX, "market says it reopens lower");

        (, int256 answer,, uint256 updatedAt,) = wrapped.latestRoundData();
        assertEq(answer, implied);
        assertEq(updatedAt, block.timestamp, "never stale during the blackout");
    }

    function test_absurdDriftIsRejected() public {
        vm.prank(OWNER);
        wrapped.setGuards(1, 10);

        vm.prank(ALICE);
        market.buy(closedAt, 0, 20_000e18, type(uint256).max);

        (, bool usable) = wrapped.impliedNow();
        assertFalse(usable, "drift past the guard falls back");

        (, int256 answer,,,) = wrapped.latestRoundData();
        assertEq(answer, CLOSE_PX);
    }

    function test_stopsSpeakingOnceResolved() public {
        vm.prank(ALICE);
        market.buy(closedAt, 6, 5000e18, type(uint256).max);

        vm.warp(opensAt + 5 minutes);
        feed.push(3, 313_43000000, opensAt + 2 minutes);
        market.resolve(closedAt, 3);

        (, bool usable) = wrapped.impliedNow();
        assertFalse(usable, "resolved session no longer quotes");
    }
}
