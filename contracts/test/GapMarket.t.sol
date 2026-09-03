// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MarketClock} from "../src/MarketClock.sol";
import {GapMarket} from "../src/GapMarket.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract GapMarketTest is Test {
    uint256 constant FRI = 20693;
    uint256 constant MON = 20696;

    int256 constant CLOSE_PX = 319_98000000;
    int256 constant OPEN_PX = 313_43000000;
    int256 constant B = 2000e18;
    int256 constant STEP = 0.005e18;

    address constant OWNER = address(0xB0B);
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B0);

    MockAggregator feed;
    MockUSDC usdc;
    MarketClock clock;
    GapMarket market;

    uint64 closedAt;
    uint64 opensAt;

    function setUp() public {
        feed = new MockAggregator();
        usdc = new MockUSDC();
        clock = new MarketClock(address(feed), OWNER);
        market = new GapMarket(address(usdc), address(clock));

        (, uint256 fridayClose) = clock.sessionBounds(FRI);
        (uint256 mondayOpen,) = clock.sessionBounds(MON);
        closedAt = uint64(fridayClose);
        opensAt = uint64(mondayOpen);

        feed.push(1, CLOSE_PX, fridayClose - 1 hours);
        feed.push(2, CLOSE_PX, fridayClose + 90 minutes);

        vm.warp(fridayClose + 6 hours);

        usdc.mint(address(this), 1_000_000e6);
        usdc.approve(address(market), type(uint256).max);
        for (uint256 i; i < 2; ++i) {
            address who = i == 0 ? ALICE : BOB;
            usdc.mint(who, 1_000_000e6);
            vm.prank(who);
            usdc.approve(address(market), type(uint256).max);
        }
    }

    function _open() internal returns (uint64) {
        return market.open(1, B, STEP, market.maxLoss(B));
    }

    function test_windowMatchesTheWeekend() public view {
        assertEq(opensAt - closedAt, 65 hours + 30 minutes);
    }

    function test_opensWithAFlatBook() public {
        _open();
        uint256[21] memory p = market.prices(closedAt);
        uint256 flat = uint256(1e18) / 21;
        uint256 total;
        for (uint256 i; i < 21; ++i) {
            assertApproxEqAbs(p[i], flat, 1e6, "uniform at open");
            total += p[i];
        }
        assertApproxEqAbs(total, 1e18, 1e6, "prices sum to one");
        assertApproxEqAbs(uint256(market.impliedOpen(closedAt)), uint256(CLOSE_PX), 1e6, "anchored at close");
    }

    function test_buyingMovesTheDistribution() public {
        _open();
        uint256 before = market.prices(closedAt)[6];
        int256 impliedBefore = market.impliedOpen(closedAt);

        vm.prank(ALICE);
        market.buy(closedAt, 6, 4000e18, type(uint256).max);

        assertGt(market.prices(closedAt)[6], before, "bought bucket richens");
        assertLt(market.impliedOpen(closedAt), impliedBefore, "implied open drops toward it");

        uint256 total;
        uint256[21] memory p = market.prices(closedAt);
        for (uint256 i; i < 21; ++i) {
            total += p[i];
        }
        assertApproxEqAbs(total, 1e18, 1e8, "still a distribution");
    }

    function test_shareNeverCostsMoreThanItPays() public {
        _open();
        uint256 size = 500e18;
        for (uint256 i; i < 12; ++i) {
            vm.prank(ALICE);
            uint256 cost = market.buy(closedAt, 6, size, type(uint256).max);
            assertLe(cost, size / 1e12, "cost per share capped at one dollar");
        }
    }

    function test_bucketOfMapsThePrint() public {
        _open();
        assertEq(market.bucketOf(closedAt, CLOSE_PX), 10, "flat open is the centre");
        assertEq(market.bucketOf(closedAt, CLOSE_PX * 1005 / 1000), 11, "+0.5% is one up");
        assertEq(market.bucketOf(closedAt, CLOSE_PX * 995 / 1000), 9, "-0.5% is one down");
        assertEq(market.bucketOf(closedAt, CLOSE_PX / 2), 0, "far below pins to the low tail");
        assertEq(market.bucketOf(closedAt, CLOSE_PX * 2), 20, "far above pins to the high tail");
    }

    function test_fullWeekendLifecycle() public {
        _open();

        // Alice reads the gap correctly, Bob does not.
        uint256 down = market.bucketOf(closedAt, OPEN_PX);
        vm.prank(ALICE);
        market.buy(closedAt, down, 3000e18, type(uint256).max);
        vm.prank(BOB);
        market.buy(closedAt, 14, 3000e18, type(uint256).max);

        vm.warp(opensAt + 5 minutes);
        feed.push(3, OPEN_PX, opensAt + 2 minutes);

        vm.expectRevert(GapMarket.BellHasRung.selector);
        vm.prank(ALICE);
        market.buy(closedAt, down, 1e18, type(uint256).max);

        market.resolve(closedAt, 3);
        assertEq(market.session(closedAt).winner, down);

        uint256 aliceBefore = usdc.balanceOf(ALICE);
        vm.prank(ALICE);
        uint256 payout = market.redeem(closedAt);
        assertEq(payout, 3000e6, "one dollar a share");
        assertEq(usdc.balanceOf(ALICE) - aliceBefore, payout);

        vm.expectRevert(GapMarket.NothingToRedeem.selector);
        vm.prank(BOB);
        market.redeem(closedAt);
    }

    function test_cannotOpenTwice() public {
        _open();
        uint256 subsidy = market.maxLoss(B);
        vm.expectRevert(GapMarket.SessionExists.selector);
        market.open(1, B, STEP, subsidy);
    }

    function test_subsidyMustCoverTheWorstCase() public {
        uint256 required = market.maxLoss(B);
        vm.expectRevert(abi.encodeWithSelector(GapMarket.SubsidyTooSmall.selector, required));
        market.open(1, B, STEP, required - 1);
    }

    /// However the book gets pushed around, the contract can always pay the winners.
    function testFuzz_staysSolvent(uint256[8] memory buckets, uint256[8] memory sizes) public {
        _open();
        for (uint256 i; i < 8; ++i) {
            uint256 bucket = buckets[i] % 21;
            uint256 size = bound(sizes[i], 1e18, 20_000e18);
            vm.prank(ALICE);
            market.buy(closedAt, bucket, size, type(uint256).max);
        }

        uint256 worst;
        for (uint256 i; i < 21; ++i) {
            uint256 owed = uint256(market.outstanding(closedAt, i)) / 1e12;
            if (owed > worst) worst = owed;
        }
        assertGe(usdc.balanceOf(address(market)), worst, "reserves cover the biggest bucket");
    }
}
