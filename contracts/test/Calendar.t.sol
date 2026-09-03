// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {DateTimeLib} from "solady/utils/DateTimeLib.sol";
import {Deploy} from "../script/Deploy.s.sol";

contract CalendarTest is Test, Deploy {
    function test_holidaysAreAllWeekdays() public pure {
        uint256[] memory d = marketHolidays();
        for (uint256 i; i < d.length; ++i) {
            uint256 wd = DateTimeLib.weekday(d[i] * 86400);
            assertLe(wd, 5, "a seeded closure landed on a weekend");
        }
    }

    function test_holidaysAreDistinctAndOrdered() public pure {
        uint256[] memory d = marketHolidays();
        for (uint256 i = 1; i < d.length; ++i) {
            assertGt(d[i], d[i - 1], "closures must be strictly increasing");
        }
    }

    function test_knownClosuresMapToTheRightDates() public pure {
        uint256[] memory d = marketHolidays();
        _assertDate(d[0], 2026, 1, 1);
        _assertDate(d[3], 2026, 4, 3);
        _assertDate(d[6], 2026, 7, 3);
        _assertDate(d[7], 2026, 9, 7);
        _assertDate(d[8], 2026, 11, 26);
        _assertDate(d[9], 2026, 12, 25);
        _assertDate(d[10], 2027, 1, 1);
        _assertDate(d[15], 2027, 6, 18);
        _assertDate(d[16], 2027, 7, 5);
        _assertDate(d[19], 2027, 12, 24);
    }

    function test_observedClosuresSitBesideTheWeekendHoliday() public pure {
        // Independence Day 2026 falls on a Saturday, 2027 on a Sunday
        assertEq(DateTimeLib.weekday(DateTimeLib.dateToEpochDay(2026, 7, 4) * 86400), 6);
        assertEq(DateTimeLib.weekday(DateTimeLib.dateToEpochDay(2027, 7, 4) * 86400), 7);

        uint256[] memory d = marketHolidays();
        assertEq(d[6], DateTimeLib.dateToEpochDay(2026, 7, 4) - 1, "2026 observed on the Friday before");
        assertEq(d[16], DateTimeLib.dateToEpochDay(2027, 7, 4) + 1, "2027 observed on the Monday after");
    }

    function _assertDate(uint256 epochDay, uint256 y, uint256 m, uint256 dd) internal pure {
        assertEq(epochDay, DateTimeLib.dateToEpochDay(y, m, dd));
    }
}
