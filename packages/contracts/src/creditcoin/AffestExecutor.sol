// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AffestVault} from "./AffestVault.sol";
import {AffestStrategyManager} from "./AffestStrategyManager.sol";
import {AffestAttestationVerifier} from "./AffestAttestationVerifier.sol";

contract AffestExecutor is ReentrancyGuard {
    error Unauthorized();
    error InvalidAddress();
    error InvalidAction();
    error StrategyVaultMismatch();
    error PendingActionNotFound();
    error PendingActionExpired();

    enum PendingStatus {
        None,
        Pending,
        Executed,
        Rejected
    }

    struct Action {
        address adapter;
        address assetIn;
        address assetOut;
        uint256 amountIn;
        uint256 minimumAmountOut;
        uint16 slippageBps;
    }

    struct PendingAction {
        uint256 strategyId;
        address owner;
        bytes32 actionHash;
        uint64 expiresAt;
        PendingStatus status;
        Action action;
    }

    AffestStrategyManager public immutable strategyManager;
    AffestAttestationVerifier public immutable attestationVerifier;

    mapping(bytes32 eventKey => PendingAction action) private pendingActions;

    event ActionProposed(
        bytes32 indexed eventKey,
        uint256 indexed strategyId,
        address indexed owner,
        bytes32 actionHash,
        uint64 expiresAt
    );
    event ActionExecuted(
        bytes32 indexed eventKey,
        uint256 indexed strategyId,
        bool automatic,
        uint256 amountIn,
        uint256 amountOut
    );
    event ActionRejected(
        bytes32 indexed eventKey,
        uint256 indexed strategyId,
        address indexed owner
    );

    constructor(address strategyManager_, address attestationVerifier_) {
        if (
            strategyManager_ == address(0)
                || attestationVerifier_ == address(0)
        ) revert InvalidAddress();
        strategyManager = AffestStrategyManager(strategyManager_);
        attestationVerifier =
            AffestAttestationVerifier(attestationVerifier_);
    }

    function requestRebalance(
        uint256 strategyId,
        AffestAttestationVerifier.Proof calldata proof,
        uint256 receiptLogIndex,
        Action calldata action
    ) external nonReentrant returns (bytes32 eventKey, bool automatic) {
        AffestStrategyManager.Strategy memory strategy =
            strategyManager.getStrategy(strategyId);
        _validateVaultBinding(strategy, action);
        _validateMinimumOutput(action);
        AffestStrategyManager.Decision decision = strategyManager.checkAction(
            strategyId,
            action.assetIn,
            action.assetOut,
            action.amountIn,
            action.slippageBps
        );

        eventKey = attestationVerifier.verifySignal(
            proof,
            receiptLogIndex,
            AffestAttestationVerifier.ExpectedSignal({
                user: strategy.owner,
                asset: strategy.triggerAsset,
                minimumAmount: strategy.minimumTriggerAmount,
                signalType: strategy.signalType
            })
        );

        if (decision == AffestStrategyManager.Decision.Automatic) {
            automatic = true;
            uint256 amountOut = _execute(strategyId, strategy.vault, action);
            emit ActionExecuted(
                eventKey, strategyId, true, action.amountIn, amountOut
            );
            return (eventKey, true);
        }

        uint64 approvalExpiry = uint64(block.timestamp + 1 days);
        if (strategy.expiresAt < approvalExpiry) {
            approvalExpiry = strategy.expiresAt;
        }
        bytes32 actionHash = keccak256(abi.encode(strategyId, action));
        pendingActions[eventKey] = PendingAction({
            strategyId: strategyId,
            owner: strategy.owner,
            actionHash: actionHash,
            expiresAt: approvalExpiry,
            status: PendingStatus.Pending,
            action: action
        });
        emit ActionProposed(
            eventKey,
            strategyId,
            strategy.owner,
            actionHash,
            approvalExpiry
        );
    }

    function approveRebalance(bytes32 eventKey)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        PendingAction storage pending = pendingActions[eventKey];
        if (pending.status != PendingStatus.Pending) {
            revert PendingActionNotFound();
        }
        if (pending.owner != msg.sender) revert Unauthorized();
        if (block.timestamp > pending.expiresAt) revert PendingActionExpired();

        AffestStrategyManager.Strategy memory strategy =
            strategyManager.getStrategy(pending.strategyId);
        _validateVaultBinding(strategy, pending.action);
        _validateMinimumOutput(pending.action);
        strategyManager.checkAction(
            pending.strategyId,
            pending.action.assetIn,
            pending.action.assetOut,
            pending.action.amountIn,
            pending.action.slippageBps
        );

        pending.status = PendingStatus.Executed;
        amountOut =
            _execute(pending.strategyId, strategy.vault, pending.action);
        emit ActionExecuted(
            eventKey,
            pending.strategyId,
            false,
            pending.action.amountIn,
            amountOut
        );
    }

    function rejectRebalance(bytes32 eventKey) external {
        PendingAction storage pending = pendingActions[eventKey];
        if (pending.status != PendingStatus.Pending) {
            revert PendingActionNotFound();
        }
        if (pending.owner != msg.sender) revert Unauthorized();
        pending.status = PendingStatus.Rejected;
        emit ActionRejected(eventKey, pending.strategyId, msg.sender);
    }

    function getPendingAction(bytes32 eventKey)
        external
        view
        returns (PendingAction memory)
    {
        return pendingActions[eventKey];
    }

    function _execute(
        uint256 strategyId,
        address vaultAddress,
        Action memory action
    ) internal returns (uint256 amountOut) {
        strategyManager.recordExecution(strategyId, action.amountIn);
        amountOut = AffestVault(vaultAddress).executeSwap(
            action.adapter,
            action.assetIn,
            action.assetOut,
            action.amountIn,
            action.minimumAmountOut
        );
    }

    function _validateVaultBinding(
        AffestStrategyManager.Strategy memory strategy,
        Action memory action
    ) internal view {
        AffestVault vault = AffestVault(strategy.vault);
        if (
            vault.owner() != strategy.owner
                || vault.stableAsset() != strategy.stableAsset
                || vault.riskAsset() != strategy.riskAsset
                || vault.swapAdapter() != action.adapter
        ) revert StrategyVaultMismatch();
    }

    function _validateMinimumOutput(Action memory action) internal pure {
        uint256 minimumBySlippage =
            action.amountIn * (10_000 - action.slippageBps) / 10_000;
        if (
            action.amountIn == 0 || action.minimumAmountOut < minimumBySlippage
        ) revert InvalidAction();
    }
}
