// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISwapAdapter} from "../interfaces/ISwapAdapter.sol";

contract AffestVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error Unauthorized();
    error InvalidAddress();
    error ExecutorAlreadySet();
    error AssetNotAllowed();
    error AdapterNotAllowed();
    error InvalidAmount();
    error AutomationPaused();
    error InsufficientOutput();

    address public immutable owner;
    address public immutable stableAsset;
    address public immutable riskAsset;
    address public immutable swapAdapter;

    address public executor;
    bool public automationPaused;

    event Deposit(address indexed sender, address indexed asset, uint256 amount);
    event Withdrawal(address indexed asset, uint256 amount);
    event ExecutorSet(address indexed executor);
    event AutomationPauseChanged(bool paused);
    event PortfolioSwap(
        address indexed adapter,
        address indexed assetIn,
        address indexed assetOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(
        address owner_,
        address stableAsset_,
        address riskAsset_,
        address swapAdapter_
    ) {
        if (
            owner_ == address(0) || stableAsset_ == address(0)
                || riskAsset_ == address(0) || swapAdapter_ == address(0)
                || stableAsset_ == riskAsset_
        ) revert InvalidAddress();
        owner = owner_;
        stableAsset = stableAsset_;
        riskAsset = riskAsset_;
        swapAdapter = swapAdapter_;
    }

    function setExecutor(address executor_) external {
        if (msg.sender != owner) revert Unauthorized();
        if (executor != address(0)) revert ExecutorAlreadySet();
        if (executor_ == address(0)) revert InvalidAddress();
        executor = executor_;
        emit ExecutorSet(executor_);
    }

    function deposit(address asset, uint256 amount) external nonReentrant {
        if (!_isAllowedAsset(asset)) revert AssetNotAllowed();
        if (amount == 0) revert InvalidAmount();
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, asset, amount);
    }

    function withdraw(address asset, uint256 amount) external nonReentrant {
        if (msg.sender != owner) revert Unauthorized();
        if (!_isAllowedAsset(asset)) revert AssetNotAllowed();
        if (amount == 0) revert InvalidAmount();
        IERC20(asset).safeTransfer(owner, amount);
        emit Withdrawal(asset, amount);
    }

    function executeSwap(
        address adapter,
        address assetIn,
        address assetOut,
        uint256 amountIn,
        uint256 minimumAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        if (msg.sender != executor) revert Unauthorized();
        if (automationPaused) revert AutomationPaused();
        if (adapter != swapAdapter) revert AdapterNotAllowed();
        if (!_isAllowedAsset(assetIn) || !_isAllowedAsset(assetOut)) {
            revert AssetNotAllowed();
        }
        if (assetIn == assetOut) revert AssetNotAllowed();
        if (amountIn == 0) revert InvalidAmount();

        IERC20 input = IERC20(assetIn);
        IERC20 output = IERC20(assetOut);
        uint256 balanceBefore = output.balanceOf(address(this));
        input.forceApprove(adapter, amountIn);
        ISwapAdapter(adapter).swap(
            assetIn, assetOut, amountIn, minimumAmountOut, address(this)
        );
        input.forceApprove(adapter, 0);
        amountOut = output.balanceOf(address(this)) - balanceBefore;
        if (amountOut < minimumAmountOut) revert InsufficientOutput();

        emit PortfolioSwap(adapter, assetIn, assetOut, amountIn, amountOut);
    }

    function pause() external {
        if (msg.sender != owner) revert Unauthorized();
        automationPaused = true;
        emit AutomationPauseChanged(true);
    }

    function unpause() external {
        if (msg.sender != owner) revert Unauthorized();
        automationPaused = false;
        emit AutomationPauseChanged(false);
    }

    function _isAllowedAsset(address asset) internal view returns (bool) {
        return asset == stableAsset || asset == riskAsset;
    }
}
