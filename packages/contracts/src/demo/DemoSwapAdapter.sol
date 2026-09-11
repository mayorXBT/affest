// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapAdapter} from "../interfaces/ISwapAdapter.sol";

/// @notice Fixed 1:1 hackathon adapter for labelled demo tokens only.
/// @dev This is not a DEX and provides no market price discovery.
contract DemoSwapAdapter is ISwapAdapter {
    using SafeERC20 for IERC20;

    error UnsupportedPair();
    error InvalidRecipient();
    error InsufficientOutput();

    address public immutable stableAsset;
    address public immutable riskAsset;

    constructor(address stableAsset_, address riskAsset_) {
        stableAsset = stableAsset_;
        riskAsset = riskAsset_;
    }

    function swap(
        address assetIn,
        address assetOut,
        uint256 amountIn,
        uint256 minimumAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        bool supported = (
            assetIn == stableAsset && assetOut == riskAsset
        ) || (
            assetIn == riskAsset && assetOut == stableAsset
        );
        if (!supported) revert UnsupportedPair();
        if (recipient == address(0)) revert InvalidRecipient();

        amountOut = amountIn;
        if (amountOut < minimumAmountOut) revert InsufficientOutput();
        IERC20(assetIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(assetOut).safeTransfer(recipient, amountOut);
    }
}
