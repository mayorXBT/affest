// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    AffestStrategyManager
} from "../src/creditcoin/AffestStrategyManager.sol";
import {TestBase} from "./TestBase.sol";

contract AffestStrategyManagerTest is TestBase {
    address internal constant VAULT = address(0xA11CE);
    address internal constant STABLE = address(0x57AB1E);
    address internal constant RISK = address(0xB15C);
    address internal constant EXECUTOR = address(0xE0);

    function testCreatesDeterministicHybridStrategy() external {
        AffestStrategyManager manager = new AffestStrategyManager();
        manager.setExecutor(EXECUTOR);

        uint256 strategyId = manager.createStrategy(_hybridPolicy());
        AffestStrategyManager.Strategy memory strategy =
            manager.getStrategy(strategyId);

        assertEq(strategy.owner, address(this));
        assertEq(strategy.vault, VAULT);
        assertEq(strategy.stableWeightBps, 7_000);
        assertEq(strategy.riskWeightBps, 3_000);
        assertTrue(strategy.status == AffestStrategyManager.Status.Active);
    }

    function testRejectsWeightsThatDoNotTotalTenThousand() external {
        AffestStrategyManager manager = new AffestStrategyManager();
        AffestStrategyManager.Policy memory policy = _hybridPolicy();
        policy.riskWeightBps = 2_999;

        vm.expectRevert(AffestStrategyManager.InvalidAllocation.selector);
        manager.createStrategy(policy);
    }

    function testHybridAutomaticallyExecutesAtOrBelowLimit() external {
        AffestStrategyManager manager = _managerWithExecutor();
        uint256 strategyId = manager.createStrategy(_hybridPolicy());

        AffestStrategyManager.Decision decision =
            manager.checkAction(strategyId, STABLE, RISK, 500, 50);

        assertTrue(decision == AffestStrategyManager.Decision.Automatic);
    }

    function testHybridRequiresApprovalAboveAutomaticLimit() external {
        AffestStrategyManager manager = _managerWithExecutor();
        uint256 strategyId = manager.createStrategy(_hybridPolicy());

        AffestStrategyManager.Decision decision =
            manager.checkAction(strategyId, STABLE, RISK, 501, 50);

        assertTrue(decision == AffestStrategyManager.Decision.Approval);
    }

    function testRejectsActionAbovePerActionLimit() external {
        AffestStrategyManager manager = _managerWithExecutor();
        uint256 strategyId = manager.createStrategy(_hybridPolicy());

        vm.expectRevert(AffestStrategyManager.ActionLimitExceeded.selector);
        manager.checkAction(strategyId, STABLE, RISK, 1_001, 50);
    }

    function testRejectsUnsupportedAssetPair() external {
        AffestStrategyManager manager = _managerWithExecutor();
        uint256 strategyId = manager.createStrategy(_hybridPolicy());

        vm.expectRevert(AffestStrategyManager.AssetNotAllowed.selector);
        manager.checkAction(strategyId, address(0xBAD), RISK, 100, 50);
    }

    function testRejectsUnsafeSlippage() external {
        AffestStrategyManager manager = _managerWithExecutor();
        uint256 strategyId = manager.createStrategy(_hybridPolicy());

        vm.expectRevert(AffestStrategyManager.SlippageExceeded.selector);
        manager.checkAction(strategyId, STABLE, RISK, 100, 51);
    }

    function testRejectsExpiredStrategy() external {
        AffestStrategyManager manager = _managerWithExecutor();
        AffestStrategyManager.Policy memory policy = _hybridPolicy();
        policy.expiresAt = uint64(block.timestamp + 1);
        uint256 strategyId = manager.createStrategy(policy);
        vm.warp(block.timestamp + 2);

        vm.expectRevert(AffestStrategyManager.StrategyExpired.selector);
        manager.checkAction(strategyId, STABLE, RISK, 100, 50);
    }

    function testOnlyOwnerCanPauseAndResume() external {
        AffestStrategyManager manager = _managerWithExecutor();
        uint256 strategyId = manager.createStrategy(_hybridPolicy());

        vm.prank(address(0xBAD));
        vm.expectRevert(AffestStrategyManager.Unauthorized.selector);
        manager.pauseStrategy(strategyId);

        manager.pauseStrategy(strategyId);
        vm.expectRevert(AffestStrategyManager.StrategyNotActive.selector);
        manager.checkAction(strategyId, STABLE, RISK, 100, 50);

        manager.resumeStrategy(strategyId);
        AffestStrategyManager.Decision decision =
            manager.checkAction(strategyId, STABLE, RISK, 100, 50);
        assertTrue(decision == AffestStrategyManager.Decision.Automatic);
    }

    function testExecutorRecordsAndEnforcesWeeklyLimitAndCooldown() external {
        AffestStrategyManager manager = _managerWithExecutor();
        AffestStrategyManager.Policy memory policy = _hybridPolicy();
        policy.maximumActionAmount = 600;
        policy.maximumWeeklyAmount = 600;
        policy.cooldownSeconds = 60;
        uint256 strategyId = manager.createStrategy(policy);

        vm.prank(EXECUTOR);
        manager.recordExecution(strategyId, 500);

        vm.expectRevert(AffestStrategyManager.CooldownActive.selector);
        manager.checkAction(strategyId, STABLE, RISK, 100, 50);

        vm.warp(block.timestamp + 61);
        vm.expectRevert(AffestStrategyManager.WeeklyLimitExceeded.selector);
        manager.checkAction(strategyId, STABLE, RISK, 101, 50);
    }

    function _managerWithExecutor()
        internal
        returns (AffestStrategyManager manager)
    {
        manager = new AffestStrategyManager();
        manager.setExecutor(EXECUTOR);
    }

    function _hybridPolicy()
        internal
        view
        returns (AffestStrategyManager.Policy memory)
    {
        return AffestStrategyManager.Policy({
            vault: VAULT,
            stableAsset: STABLE,
            riskAsset: RISK,
            triggerAsset: STABLE,
            minimumTriggerAmount: 1_000,
            signalType: 1,
            stableWeightBps: 7_000,
            riskWeightBps: 3_000,
            mode: AffestStrategyManager.ExecutionMode.Hybrid,
            automaticExecutionLimit: 500,
            maximumActionAmount: 1_000,
            maximumWeeklyAmount: 1_500,
            maximumSlippageBps: 50,
            expiresAt: uint64(block.timestamp + 30 days),
            cooldownSeconds: 0
        });
    }
}
