// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ISwapAdapter {
    function swap(
        address assetIn,
        address assetOut,
        uint256 amountIn,
        uint256 minimumAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}
