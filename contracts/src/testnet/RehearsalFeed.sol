// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "solady/auth/Ownable.sol";

/// Stands in for a Chainlink equity feed on networks where none exists. The owner
/// writes rounds directly, including their timestamps, so a whole closed window can
/// be staged and walked through without waiting on New York.
///
/// Staging only. Nothing reads this on a network that has the real feed.
contract RehearsalFeed is Ownable {
    struct Round {
        int256 answer;
        uint256 updatedAt;
    }

    uint8 public constant decimals = 8;
    string public description;
    uint80 public latestRound;

    mapping(uint80 => Round) internal _rounds;

    event RoundPushed(uint80 indexed roundId, int256 answer, uint256 updatedAt);

    error EmptyRound();

    constructor(string memory description_, address owner_) {
        description = description_;
        _initializeOwner(owner_);
    }

    function push(uint80 roundId, int256 answer, uint256 updatedAt) public onlyOwner {
        if (updatedAt == 0) revert EmptyRound();
        _rounds[roundId] = Round(answer, updatedAt);
        if (roundId >= latestRound) latestRound = roundId;
        emit RoundPushed(roundId, answer, updatedAt);
    }

    function pushMany(uint80[] calldata roundIds, int256[] calldata answers, uint256[] calldata times)
        external
    {
        for (uint256 i; i < roundIds.length; ++i) {
            push(roundIds[i], answers[i], times[i]);
        }
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return getRoundData(latestRound);
    }

    function getRoundData(uint80 roundId) public view returns (uint80, int256, uint256, uint256, uint80) {
        Round memory r = _rounds[roundId];
        return (roundId, r.answer, r.updatedAt, r.updatedAt, roundId);
    }
}
