// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {DateTimeLib} from "solady/utils/DateTimeLib.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// Tracks when the equity behind a B20 token is actually tradable, and pins down
/// the two prints that bound each closed window.
contract MarketClock is Ownable {
    enum State {
        Open,
        Blackout,
        Halted
    }

    struct Window {
        uint64 closedAt;
        uint64 opensAt;
        int256 closePrice;
        int256 openPrice;
        uint80 closeRound;
        uint80 openRound;
        bool settled;
    }

    uint256 internal constant DAY = 86400;
    uint256 internal constant OPEN_OFFSET = 9 hours + 30 minutes;
    uint256 internal constant CLOSE_OFFSET = 16 hours;

    IAggregatorV3 public immutable feed;
    uint8 public immutable feedDecimals;

    /// These feeds publish on deviation, not on a useful heartbeat, so a quiet stretch
    /// inside a live session is normal. Observed silences run to nearly three hours on a
    /// calm day, hence the wide default; tighten it per asset once its cadence is known.
    uint256 public haltTolerance = 4 hours;
    mapping(uint256 => bool) public holiday;
    mapping(uint64 => Window) internal _windows;

    event Anchored(uint64 indexed closedAt, int256 closePrice, uint64 opensAt);
    event Settled(uint64 indexed closedAt, int256 closePrice, int256 openPrice, uint256 openedAt);
    event HolidaySet(uint256 indexed epochDay, bool closed);
    event HaltToleranceSet(uint256 seconds_);

    error MarketOpen();
    error NotYetOpen();
    error NotACloseTime();
    error AlreadyAnchored();
    error AlreadySettled();
    error NotAnchored();
    error BadCloseRound();
    error BadOpenRound();
    error NoWindow();

    constructor(address feed_, address owner_) {
        feed = IAggregatorV3(feed_);
        feedDecimals = IAggregatorV3(feed_).decimals();
        _initializeOwner(owner_);
    }

    function isTradingDay(uint256 epochDay) public view returns (bool) {
        return DateTimeLib.weekday(epochDay * DAY) <= 5 && !holiday[epochDay];
    }

    /// UTC bounds of the regular session on `epochDay`, adjusted for US daylight time.
    function sessionBounds(uint256 epochDay) public pure returns (uint256 openTs, uint256 closeTs) {
        uint256 dayStart = epochDay * DAY;
        uint256 offset = _etOffset(dayStart + 12 hours);
        openTs = dayStart + offset + OPEN_OFFSET;
        closeTs = dayStart + offset + CLOSE_OFFSET;
    }

    function lastClose(uint256 ts) public view returns (uint256) {
        uint256 day = ts / DAY;
        for (uint256 i; i < 10; ++i) {
            uint256 d = day - i;
            if (!isTradingDay(d)) continue;
            (, uint256 closeTs) = sessionBounds(d);
            if (closeTs <= ts) return closeTs;
        }
        return 0;
    }

    function nextOpen(uint256 ts) public view returns (uint256) {
        uint256 day = ts / DAY;
        for (uint256 i; i < 10; ++i) {
            uint256 d = day + i;
            if (!isTradingDay(d)) continue;
            (uint256 openTs,) = sessionBounds(d);
            if (openTs > ts) return openTs;
        }
        return 0;
    }

    function secondsStale() public view returns (uint256) {
        (,,, uint256 updatedAt,) = feed.latestRoundData();
        return block.timestamp > updatedAt ? block.timestamp - updatedAt : 0;
    }

    function state() public view returns (State) {
        uint256 ts = block.timestamp;
        uint256 day = ts / DAY;
        if (isTradingDay(day)) {
            (uint256 openTs, uint256 closeTs) = sessionBounds(day);
            if (ts >= openTs && ts < closeTs) {
                return secondsStale() > haltTolerance ? State.Halted : State.Open;
            }
        }
        return State.Blackout;
    }

    /// Identifier of the blackout currently in progress: the close that started it.
    function currentWindow() public view returns (uint64 closedAt, uint64 opensAt) {
        if (state() == State.Open) revert MarketOpen();
        closedAt = uint64(lastClose(block.timestamp));
        opensAt = uint64(nextOpen(block.timestamp));
    }

    function window(uint64 closedAt) external view returns (Window memory) {
        return _windows[closedAt];
    }

    function isAnchored(uint64 closedAt) external view returns (bool) {
        return _windows[closedAt].closedAt != 0;
    }

    function isSettled(uint64 closedAt) external view returns (bool) {
        return _windows[closedAt].settled;
    }

    /// Pin the last print of the session that just ended. Callable as soon as the bell
    /// rings, because everything downstream needs an anchor before the blackout trades.
    function anchor(uint64 closedAt, uint80 closeRound) public returns (int256 closePrice) {
        Window storage w = _windows[closedAt];
        if (w.closedAt != 0) revert AlreadyAnchored();
        if (closedAt == 0 || lastClose(closedAt) != closedAt) revert NotACloseTime();

        uint256 closeUpdated;
        (, closePrice,, closeUpdated,) = feed.getRoundData(closeRound);
        (,,, uint256 afterClose,) = feed.getRoundData(closeRound + 1);
        if (closeUpdated == 0 || closeUpdated > closedAt || afterClose <= closedAt) revert BadCloseRound();

        w.closedAt = closedAt;
        w.opensAt = uint64(nextOpen(closedAt));
        w.closePrice = closePrice;
        w.closeRound = closeRound;

        emit Anchored(closedAt, closePrice, w.opensAt);
    }

    /// Close the window out with the first print after the bell. The contract checks the
    /// neighbouring rounds itself, so there is nothing to trust and no keeper to run.
    function settle(uint64 closedAt, uint80 openRound) public returns (int256 openPrice) {
        Window storage w = _windows[closedAt];
        if (w.closedAt == 0) revert NotAnchored();
        if (w.settled) revert AlreadySettled();
        if (block.timestamp < w.opensAt) revert NotYetOpen();

        uint256 openUpdated;
        (, openPrice,, openUpdated,) = feed.getRoundData(openRound);
        (,,, uint256 beforeOpen,) = feed.getRoundData(openRound - 1);
        if (openUpdated < w.opensAt || beforeOpen == 0 || beforeOpen >= w.opensAt) revert BadOpenRound();

        w.openPrice = openPrice;
        w.openRound = openRound;
        w.settled = true;

        emit Settled(closedAt, w.closePrice, openPrice, openUpdated);
    }

    function setHolidays(uint256[] calldata epochDays, bool closed) external onlyOwner {
        for (uint256 i; i < epochDays.length; ++i) {
            holiday[epochDays[i]] = closed;
            emit HolidaySet(epochDays[i], closed);
        }
    }

    function setHaltTolerance(uint256 seconds_) external onlyOwner {
        haltTolerance = seconds_;
        emit HaltToleranceSet(seconds_);
    }

    /// Seconds behind UTC that New York is running at `ts`.
    function _etOffset(uint256 ts) internal pure returns (uint256) {
        (uint256 year,,) = DateTimeLib.timestampToDate(ts);
        uint256 dstStart = DateTimeLib.nthWeekdayInMonthOfYearTimestamp(year, 3, 2, DateTimeLib.SUN) + 7 hours;
        uint256 dstEnd = DateTimeLib.nthWeekdayInMonthOfYearTimestamp(year, 11, 1, DateTimeLib.SUN) + 6 hours;
        return (ts >= dstStart && ts < dstEnd) ? 4 hours : 5 hours;
    }
}
