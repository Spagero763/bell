// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MarketClock} from "../src/MarketClock.sol";
import {GapMarket} from "../src/GapMarket.sol";
import {ImpliedOpenFeed} from "../src/ImpliedOpenFeed.sol";

contract Deploy is Script {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant AAPL_FEED = 0x787f13dEa48Db0897CbCDD985de77809D837F988;

    function run() external virtual {
        address feed = vm.envOr("FEED", AAPL_FEED);
        address owner = msg.sender;

        vm.startBroadcast();

        MarketClock clock = new MarketClock(feed, owner);
        clock.setHolidays(marketHolidays(), true);

        GapMarket market = new GapMarket(USDC, address(clock));
        ImpliedOpenFeed wrapped = new ImpliedOpenFeed(
            feed,
            address(clock),
            address(market),
            owner,
            vm.envOr("MIN_DEPTH", uint256(1e6)),
            vm.envOr("MAX_DEVIATION_BPS", uint256(1000))
        );

        vm.stopBroadcast();

        console.log("feed      ", feed);
        console.log("clock     ", address(clock));
        console.log("market    ", address(market));
        console.log("impliedFeed", address(wrapped));
    }

    /// NYSE closures for 2026 and 2027 as days since the unix epoch.
    function marketHolidays() internal pure returns (uint256[] memory d) {
        d = new uint256[](20);
        // 2026: Jan 1, MLK, Presidents, Good Friday, Memorial, Juneteenth,
        // Jul 3 observed, Labor, Thanksgiving, Christmas
        d[0] = 20454;
        d[1] = 20472;
        d[2] = 20500;
        d[3] = 20546;
        d[4] = 20598;
        d[5] = 20623;
        d[6] = 20637;
        d[7] = 20703;
        d[8] = 20783;
        d[9] = 20812;
        // 2027: Jan 1, MLK, Presidents, Good Friday, Memorial, Jun 18 observed,
        // Jul 5 observed, Labor, Thanksgiving, Dec 24 observed
        d[10] = 20819;
        d[11] = 20836;
        d[12] = 20864;
        d[13] = 20903;
        d[14] = 20969;
        d[15] = 20987;
        d[16] = 21004;
        d[17] = 21067;
        d[18] = 21147;
        d[19] = 21176;
    }
}

/// Finishes a deploy whose clock is already on chain. Reads the feed off the clock so
/// the two cannot drift apart.
contract DeployRest is Script {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        MarketClock clock = MarketClock(vm.envAddress("CLOCK"));
        address feed = address(clock.feed());
        address owner = msg.sender;

        vm.startBroadcast();

        GapMarket market = new GapMarket(USDC, address(clock));
        ImpliedOpenFeed wrapped = new ImpliedOpenFeed(
            feed,
            address(clock),
            address(market),
            owner,
            vm.envOr("MIN_DEPTH", uint256(1e6)),
            vm.envOr("MAX_DEVIATION_BPS", uint256(1000))
        );

        vm.stopBroadcast();

        console.log("clock      ", address(clock));
        console.log("market     ", address(market));
        console.log("impliedFeed", address(wrapped));
    }
}
