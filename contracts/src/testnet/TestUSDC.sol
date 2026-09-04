// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "solady/tokens/ERC20.sol";

/// Freely mintable six decimal token so a staging deploy costs nothing.
contract TestUSDC is ERC20 {
    function name() public pure override returns (string memory) {
        return "Test USD Coin";
    }

    function symbol() public pure override returns (string memory) {
        return "tUSDC";
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
