// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MarketClock} from "../src/MarketClock.sol";
import {GapMarket} from "../src/GapMarket.sol";
import {ImpliedOpenFeed} from "../src/ImpliedOpenFeed.sol";
import {RehearsalFeed} from "../src/testnet/RehearsalFeed.sol";
import {TestUSDC} from "../src/testnet/TestUSDC.sol";
import {Deploy} from "./Deploy.s.sol";

/// Full staging deploy on a network with no B20 tokens and no equity feeds. Stands up
/// a feed we control, a token we can mint, and opens the book on the blackout that is
/// running right now. Costs nothing but testnet gas.
contract DeployTestnet is Deploy {
    function run() external override {
        address me = msg.sender;
        int256 price = int256(vm.envOr("PRICE", uint256(320e8)));
        int256 b = int256(vm.envOr("B", uint256(0.2e18)));
        int256 step = int256(vm.envOr("STEP", uint256(0.005e18)));

        vm.startBroadcast();

        RehearsalFeed feed = new RehearsalFeed("AAPL / USD (staging)", me);
        TestUSDC usdc = new TestUSDC();

        MarketClock clock = new MarketClock(address(feed), me);
        clock.setHolidays(marketHolidays(), true);

        GapMarket market = new GapMarket(address(usdc), address(clock));
        ImpliedOpenFeed wrapped =
            new ImpliedOpenFeed(address(feed), address(clock), address(market), me, 1e6, 1000);

        // Two prints bracketing the close, so the window can be anchored.
        uint64 closedAt = uint64(clock.lastClose(block.timestamp));
        require(closedAt != 0, "no close behind us yet");
        feed.push(1, price, closedAt - 1 hours);
        feed.push(2, price, closedAt + 30 minutes);

        console.log("feed       ", address(feed));
        console.log("usdc       ", address(usdc));
        console.log("clock      ", address(clock));
        console.log("market     ", address(market));
        console.log("impliedFeed", address(wrapped));
        console.log("closedAt   ", closedAt);

        if (clock.state() == MarketClock.State.Open) {
            console.log("exchange is open, so no book yet. Rerun OpenSession after the bell.");
            vm.stopBroadcast();
            return;
        }

        uint256 subsidy = market.maxLoss(b);
        usdc.mint(me, subsidy + 10_000e6);
        usdc.approve(address(market), type(uint256).max);
        market.open(2, b, step, subsidy);

        vm.stopBroadcast();

        console.log("subsidy    ", subsidy);
        console.log("implied    ", uint256(market.impliedOpen(closedAt)));
        console.log("mint more tUSDC any time by calling mint(address,uint256)");
    }
}

/// Publish the print that closes out a staged window, once the bell has actually rung.
contract SettleTestnet is Script {
    function run() external {
        MarketClock clock = MarketClock(vm.envAddress("CLOCK"));
        GapMarket market = GapMarket(vm.envAddress("MARKET"));
        RehearsalFeed feed = RehearsalFeed(address(clock.feed()));
        uint64 closedAt = uint64(vm.envUint("CLOSED_AT"));
        int256 openPrice = int256(vm.envOr("OPEN_PRICE", uint256(313e8)));

        MarketClock.Window memory w = clock.window(closedAt);
        require(w.closedAt != 0, "window was never anchored");
        require(block.timestamp >= w.opensAt, "the bell has not rung");

        uint80 next = feed.latestRound() + 1;

        vm.startBroadcast();
        feed.push(next, openPrice, w.opensAt + 2 minutes);
        market.resolve(closedAt, next);
        vm.stopBroadcast();

        console.log("open print ", uint256(openPrice));
        console.log("winner     ", market.session(closedAt).winner);
    }
}
