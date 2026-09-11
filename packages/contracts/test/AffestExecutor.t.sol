// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    INativeQueryVerifier
} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";
import {
    EvmV1Decoder
} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {AffestVault} from "../src/creditcoin/AffestVault.sol";
import {
    AffestStrategyManager
} from "../src/creditcoin/AffestStrategyManager.sol";
import {
    AffestAttestationVerifier
} from "../src/creditcoin/AffestAttestationVerifier.sol";
import {AffestExecutor} from "../src/creditcoin/AffestExecutor.sol";
import {AffestDemoToken} from "../src/demo/AffestDemoToken.sol";
import {DemoSwapAdapter} from "../src/demo/DemoSwapAdapter.sol";
import {TestBase} from "./TestBase.sol";

interface IExecutorSingleNativeVerifier {
    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        INativeQueryVerifier.MerkleProof calldata merkleProof,
        INativeQueryVerifier.ContinuityProof calldata continuityProof
    ) external returns (bool);
}

contract AffestExecutorTest is TestBase {
    address internal constant PRECOMPILE =
        0x0000000000000000000000000000000000000FD2;
    address internal constant SOURCE_EMITTER = address(0x5151);
    bytes32 internal constant SIGNAL_EVENT_SIGNATURE =
        keccak256("PortfolioSignal(bytes32,address,address,uint256,uint8)");

    AffestDemoToken internal stable;
    AffestDemoToken internal risk;
    DemoSwapAdapter internal adapter;
    AffestVault internal vault;
    AffestStrategyManager internal manager;
    AffestAttestationVerifier internal verifier;
    AffestExecutor internal executor;
    uint256 internal strategyId;

    function setUp() external {
        stable = new AffestDemoToken("Affest Demo USD", "adUSD");
        risk = new AffestDemoToken("Affest Demo Risk", "adRISK");
        adapter = new DemoSwapAdapter(address(stable), address(risk));
        vault =
            new AffestVault(address(this), address(stable), address(risk), address(adapter));
        manager = new AffestStrategyManager();
        verifier = new AffestAttestationVerifier(1, SOURCE_EMITTER);
        executor = new AffestExecutor(address(manager), address(verifier));

        vault.setExecutor(address(executor));
        manager.setExecutor(address(executor));
        verifier.setAuthorizedCaller(address(executor));
        stable.mint(address(vault), 2_000);
        risk.mint(address(adapter), 2_000);
        strategyId = manager.createStrategy(_policy());
    }

    function testAutomaticallyExecutesProofBackedActionAtLimit() external {
        AffestAttestationVerifier.Proof memory proof = _validProof("auto");
        _mockProofVerification(proof, 1);
        AffestExecutor.Action memory action = _action(500);

        (bytes32 eventKey, bool executedAutomatically) =
            executor.requestRebalance(strategyId, proof, 0, action);

        assertTrue(executedAutomatically);
        assertTrue(verifier.processedEvents(eventKey));
        assertEq(stable.balanceOf(address(vault)), 1_500);
        assertEq(risk.balanceOf(address(vault)), 500);
    }

    function testCreatesBoundApprovalAboveHybridLimitThenOwnerExecutes() external {
        AffestAttestationVerifier.Proof memory proof = _validProof("approval");
        _mockProofVerification(proof, 2);
        AffestExecutor.Action memory action = _action(600);

        (bytes32 eventKey, bool executedAutomatically) =
            executor.requestRebalance(strategyId, proof, 0, action);

        assertTrue(!executedAutomatically);
        assertEq(stable.balanceOf(address(vault)), 2_000);
        AffestExecutor.PendingAction memory pending =
            executor.getPendingAction(eventKey);
        assertTrue(pending.status == AffestExecutor.PendingStatus.Pending);
        assertEq(pending.owner, address(this));

        executor.approveRebalance(eventKey);

        pending = executor.getPendingAction(eventKey);
        assertTrue(pending.status == AffestExecutor.PendingStatus.Executed);
        assertEq(stable.balanceOf(address(vault)), 1_400);
        assertEq(risk.balanceOf(address(vault)), 600);
    }

    function testRejectsUnauthorizedPendingApproval() external {
        AffestAttestationVerifier.Proof memory proof = _validProof("unauthorized");
        _mockProofVerification(proof, 3);
        (bytes32 eventKey,) =
            executor.requestRebalance(strategyId, proof, 0, _action(600));

        vm.prank(address(0xBAD));
        vm.expectRevert(AffestExecutor.Unauthorized.selector);
        executor.approveRebalance(eventKey);
    }

    function _policy()
        internal
        view
        returns (AffestStrategyManager.Policy memory)
    {
        return AffestStrategyManager.Policy({
            vault: address(vault),
            stableAsset: address(stable),
            riskAsset: address(risk),
            triggerAsset: address(stable),
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

    function _action(uint256 amount)
        internal
        view
        returns (AffestExecutor.Action memory)
    {
        return AffestExecutor.Action({
            adapter: address(adapter),
            assetIn: address(stable),
            assetOut: address(risk),
            amountIn: amount,
            minimumAmountOut: amount,
            slippageBps: 50
        });
    }

    function _validProof(string memory salt)
        internal
        view
        returns (AffestAttestationVerifier.Proof memory)
    {
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = SIGNAL_EVENT_SIGNATURE;
        topics[1] = keccak256(bytes(salt));
        topics[2] = bytes32(uint256(uint160(address(this))));
        topics[3] = bytes32(uint256(uint160(address(stable))));
        EvmV1Decoder.LogEntryTuple[] memory logs =
            new EvmV1Decoder.LogEntryTuple[](1);
        logs[0] = EvmV1Decoder.LogEntryTuple({
            address_: SOURCE_EMITTER,
            topics: topics,
            data: abi.encode(uint256(1_000), uint8(1))
        });

        bytes[] memory chunks = new bytes[](3);
        chunks[0] = abi.encode(
            uint64(1),
            uint64(100_000),
            address(this),
            false,
            SOURCE_EMITTER,
            uint256(0),
            bytes("")
        );
        EvmV1Decoder.AccessListEntryBytes32[] memory accessList =
            new EvmV1Decoder.AccessListEntryBytes32[](0);
        chunks[1] = abi.encode(
            uint64(11155111),
            uint128(1),
            uint128(2),
            accessList,
            uint8(0),
            bytes32(0),
            bytes32(0)
        );
        chunks[2] = abi.encode(uint8(1), uint64(80_000), logs, bytes(""));

        INativeQueryVerifier.MerkleProofEntry[] memory siblings =
            new INativeQueryVerifier.MerkleProofEntry[](0);
        bytes32[] memory continuityRoots = new bytes32[](1);
        continuityRoots[0] = keccak256("continuity");
        return AffestAttestationVerifier.Proof({
            chainKey: 1,
            blockHeight: 9_000_000,
            encodedTransaction: abi.encode(uint8(2), chunks),
            merkleRoot: keccak256(bytes(salt)),
            siblings: siblings,
            lowerEndpointDigest: keccak256("lower"),
            continuityRoots: continuityRoots
        });
    }

    function _mockProofVerification(
        AffestAttestationVerifier.Proof memory proof,
        uint64 transactionIndex
    ) internal {
        INativeQueryVerifier.MerkleProof memory merkleProof =
            INativeQueryVerifier.MerkleProof({
                root: proof.merkleRoot,
                siblings: proof.siblings
            });
        INativeQueryVerifier.ContinuityProof memory continuityProof =
            INativeQueryVerifier.ContinuityProof({
                lowerEndpointDigest: proof.lowerEndpointDigest,
                roots: proof.continuityRoots
            });
        vm.mockCall(
            PRECOMPILE,
            abi.encodeCall(INativeQueryVerifier.calculateTxIndex, (merkleProof)),
            abi.encode(transactionIndex)
        );
        vm.mockCall(
            PRECOMPILE,
            abi.encodeCall(
                IExecutorSingleNativeVerifier.verifyAndEmit,
                (
                    proof.chainKey,
                    proof.blockHeight,
                    proof.encodedTransaction,
                    merkleProof,
                    continuityProof
                )
            ),
            abi.encode(true)
        );
    }
}
