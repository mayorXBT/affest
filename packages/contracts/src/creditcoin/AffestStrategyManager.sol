// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AffestStrategyManager {
    error Unauthorized();
    error ExecutorAlreadySet();
    error InvalidAddress();
    error InvalidAllocation();
    error InvalidLimits();
    error InvalidExpiry();
    error StrategyNotFound();
    error StrategyNotActive();
    error StrategyExpired();
    error AssetNotAllowed();
    error InvalidAmount();
    error ActionLimitExceeded();
    error WeeklyLimitExceeded();
    error SlippageExceeded();
    error CooldownActive();
    error AutomaticLimitExceeded();

    enum ExecutionMode {
        Approval,
        Automatic,
        Hybrid
    }

    enum Status {
        Active,
        Paused,
        Revoked
    }

    enum Decision {
        Automatic,
        Approval
    }

    struct Policy {
        address vault;
        address stableAsset;
        address riskAsset;
        address triggerAsset;
        uint256 minimumTriggerAmount;
        uint8 signalType;
        uint16 stableWeightBps;
        uint16 riskWeightBps;
        ExecutionMode mode;
        uint256 automaticExecutionLimit;
        uint256 maximumActionAmount;
        uint256 maximumWeeklyAmount;
        uint16 maximumSlippageBps;
        uint64 expiresAt;
        uint64 cooldownSeconds;
    }

    struct Strategy {
        address owner;
        address vault;
        address stableAsset;
        address riskAsset;
        address triggerAsset;
        uint256 minimumTriggerAmount;
        uint8 signalType;
        uint16 stableWeightBps;
        uint16 riskWeightBps;
        ExecutionMode mode;
        uint256 automaticExecutionLimit;
        uint256 maximumActionAmount;
        uint256 maximumWeeklyAmount;
        uint16 maximumSlippageBps;
        uint64 expiresAt;
        uint64 cooldownSeconds;
        uint64 lastExecutionAt;
        uint64 weeklyWindowStartedAt;
        uint256 weeklySpent;
        Status status;
    }

    address public immutable administrator;
    address public executor;
    uint256 public strategyCount;

    mapping(uint256 strategyId => Strategy strategy) private strategies;

    event StrategyCreated(
        uint256 indexed strategyId,
        address indexed owner,
        address indexed vault,
        ExecutionMode mode
    );
    event StrategyPaused(uint256 indexed strategyId);
    event StrategyResumed(uint256 indexed strategyId);
    event StrategyRevoked(uint256 indexed strategyId);
    event ExecutionRecorded(
        uint256 indexed strategyId,
        uint256 amount,
        uint256 weeklySpent
    );

    constructor() {
        administrator = msg.sender;
    }

    function setExecutor(address executor_) external {
        if (msg.sender != administrator) revert Unauthorized();
        if (executor != address(0)) revert ExecutorAlreadySet();
        if (executor_ == address(0)) revert InvalidAddress();
        executor = executor_;
    }

    function createStrategy(Policy calldata policy)
        external
        returns (uint256 strategyId)
    {
        _validatePolicy(policy);
        strategyId = ++strategyCount;
        strategies[strategyId] = Strategy({
            owner: msg.sender,
            vault: policy.vault,
            stableAsset: policy.stableAsset,
            riskAsset: policy.riskAsset,
            triggerAsset: policy.triggerAsset,
            minimumTriggerAmount: policy.minimumTriggerAmount,
            signalType: policy.signalType,
            stableWeightBps: policy.stableWeightBps,
            riskWeightBps: policy.riskWeightBps,
            mode: policy.mode,
            automaticExecutionLimit: policy.automaticExecutionLimit,
            maximumActionAmount: policy.maximumActionAmount,
            maximumWeeklyAmount: policy.maximumWeeklyAmount,
            maximumSlippageBps: policy.maximumSlippageBps,
            expiresAt: policy.expiresAt,
            cooldownSeconds: policy.cooldownSeconds,
            lastExecutionAt: 0,
            weeklyWindowStartedAt: uint64(block.timestamp),
            weeklySpent: 0,
            status: Status.Active
        });
        emit StrategyCreated(strategyId, msg.sender, policy.vault, policy.mode);
    }

    function getStrategy(uint256 strategyId)
        external
        view
        returns (Strategy memory strategy)
    {
        strategy = _strategy(strategyId);
    }

    function checkAction(
        uint256 strategyId,
        address assetIn,
        address assetOut,
        uint256 amount,
        uint16 slippageBps
    ) external view returns (Decision) {
        Strategy storage strategy = _strategyStorage(strategyId);
        _validateAction(strategy, assetIn, assetOut, amount, slippageBps);

        if (strategy.mode == ExecutionMode.Approval) return Decision.Approval;
        if (amount <= strategy.automaticExecutionLimit) {
            return Decision.Automatic;
        }
        if (strategy.mode == ExecutionMode.Hybrid) return Decision.Approval;
        revert AutomaticLimitExceeded();
    }

    function recordExecution(uint256 strategyId, uint256 amount) external {
        if (msg.sender != executor) revert Unauthorized();
        Strategy storage strategy = _strategyStorage(strategyId);
        if (strategy.status != Status.Active) revert StrategyNotActive();
        if (amount == 0) revert InvalidAmount();
        if (amount > strategy.maximumActionAmount) revert ActionLimitExceeded();
        if (block.timestamp > strategy.expiresAt) revert StrategyExpired();

        _resetWeeklyWindowIfNeeded(strategy);
        if (strategy.weeklySpent + amount > strategy.maximumWeeklyAmount) {
            revert WeeklyLimitExceeded();
        }
        strategy.weeklySpent += amount;
        strategy.lastExecutionAt = uint64(block.timestamp);
        emit ExecutionRecorded(strategyId, amount, strategy.weeklySpent);
    }

    function pauseStrategy(uint256 strategyId) external {
        Strategy storage strategy = _ownedStrategy(strategyId);
        if (strategy.status != Status.Active) revert StrategyNotActive();
        strategy.status = Status.Paused;
        emit StrategyPaused(strategyId);
    }

    function resumeStrategy(uint256 strategyId) external {
        Strategy storage strategy = _ownedStrategy(strategyId);
        if (strategy.status != Status.Paused) revert StrategyNotActive();
        if (block.timestamp > strategy.expiresAt) revert StrategyExpired();
        strategy.status = Status.Active;
        emit StrategyResumed(strategyId);
    }

    function revokeStrategy(uint256 strategyId) external {
        Strategy storage strategy = _ownedStrategy(strategyId);
        strategy.status = Status.Revoked;
        emit StrategyRevoked(strategyId);
    }

    function _validatePolicy(Policy calldata policy) internal view {
        if (
            policy.vault == address(0) || policy.stableAsset == address(0)
                || policy.riskAsset == address(0)
                || policy.triggerAsset == address(0)
                || policy.stableAsset == policy.riskAsset
        ) revert InvalidAddress();
        if (
            uint256(policy.stableWeightBps) + uint256(policy.riskWeightBps)
                != 10_000
        ) revert InvalidAllocation();
        if (
            policy.minimumTriggerAmount == 0 || policy.maximumActionAmount == 0
                || policy.maximumWeeklyAmount == 0
                || policy.maximumActionAmount > policy.maximumWeeklyAmount
                || policy.automaticExecutionLimit > policy.maximumActionAmount
                || policy.maximumSlippageBps > 1_000
        ) revert InvalidLimits();
        if (policy.expiresAt <= block.timestamp) revert InvalidExpiry();
    }

    function _validateAction(
        Strategy storage strategy,
        address assetIn,
        address assetOut,
        uint256 amount,
        uint16 slippageBps
    ) internal view {
        if (strategy.status != Status.Active) revert StrategyNotActive();
        if (block.timestamp > strategy.expiresAt) revert StrategyExpired();
        bool supportedPair = (
            assetIn == strategy.stableAsset && assetOut == strategy.riskAsset
        ) || (
            assetIn == strategy.riskAsset && assetOut == strategy.stableAsset
        );
        if (!supportedPair) revert AssetNotAllowed();
        if (amount == 0) revert InvalidAmount();
        if (amount > strategy.maximumActionAmount) revert ActionLimitExceeded();
        if (slippageBps > strategy.maximumSlippageBps) {
            revert SlippageExceeded();
        }
        if (
            strategy.lastExecutionAt != 0 && strategy.cooldownSeconds != 0
                && block.timestamp
                    < uint256(strategy.lastExecutionAt) + strategy.cooldownSeconds
        ) revert CooldownActive();
        uint256 spent = strategy.weeklySpent;
        if (
            block.timestamp
                >= uint256(strategy.weeklyWindowStartedAt) + 7 days
        ) spent = 0;
        if (spent + amount > strategy.maximumWeeklyAmount) {
            revert WeeklyLimitExceeded();
        }
    }

    function _resetWeeklyWindowIfNeeded(Strategy storage strategy) internal {
        if (
            block.timestamp
                >= uint256(strategy.weeklyWindowStartedAt) + 7 days
        ) {
            strategy.weeklyWindowStartedAt = uint64(block.timestamp);
            strategy.weeklySpent = 0;
        }
    }

    function _ownedStrategy(uint256 strategyId)
        internal
        view
        returns (Strategy storage strategy)
    {
        strategy = _strategyStorage(strategyId);
        if (strategy.owner != msg.sender) revert Unauthorized();
    }

    function _strategy(uint256 strategyId)
        internal
        view
        returns (Strategy memory strategy)
    {
        strategy = strategies[strategyId];
        if (strategy.owner == address(0)) revert StrategyNotFound();
    }

    function _strategyStorage(uint256 strategyId)
        internal
        view
        returns (Strategy storage strategy)
    {
        strategy = strategies[strategyId];
        if (strategy.owner == address(0)) revert StrategyNotFound();
    }
}
