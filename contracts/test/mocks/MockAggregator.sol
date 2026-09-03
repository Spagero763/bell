// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract MockAggregator {
    struct Round {
        int256 answer;
        uint256 updatedAt;
    }

    uint8 public decimals = 8;
    uint80 public latestRound;
    mapping(uint80 => Round) public rounds;

    function push(uint80 roundId, int256 answer, uint256 updatedAt) external {
        rounds[roundId] = Round(answer, updatedAt);
        if (roundId > latestRound) latestRound = roundId;
    }

    function description() external pure returns (string memory) {
        return "MOCK / USD";
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return getRoundData(latestRound);
    }

    function getRoundData(uint80 roundId) public view returns (uint80, int256, uint256, uint256, uint80) {
        Round memory r = rounds[roundId];
        return (roundId, r.answer, r.updatedAt, r.updatedAt, roundId);
    }
}
