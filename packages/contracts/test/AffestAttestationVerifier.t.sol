// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    INativeQueryVerifier
} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";
import {
    EvmV1Decoder
} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {
    AffestAttestationVerifier
} from "../src/creditcoin/AffestAttestationVerifier.sol";
import {TestBase} from "./TestBase.sol";

interface ISingleNativeQueryVerifier {
    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        INativeQueryVerifier.MerkleProof calldata merkleProof,
        INativeQueryVerifier.ContinuityProof calldata continuityProof
    ) external returns (bool);
}

contract AffestAttestationVerifierTest is TestBase {
    address internal constant PRECOMPILE =
        0x0000000000000000000000000000000000000FD2;
    uint64 internal constant SEPOLIA_CHAIN_KEY = 1;
    address internal constant SOURCE_EMITTER = address(0x5151);
    address internal constant USER = address(0xB0B);
    address internal constant ASSET = address(0xA11CE);
    bytes32 internal constant SIGNAL_ID = keccak256("signal-1");
    bytes32 internal constant SIGNAL_EVENT_SIGNATURE =
        keccak256("PortfolioSignal(bytes32,address,address,uint256,uint8)");

    function testVerifiesSuccessfulBoundPortfolioSignal() external {
        AffestAttestationVerifier verifier =
            new AffestAttestationVerifier(SEPOLIA_CHAIN_KEY, SOURCE_EMITTER);
        AffestAttestationVerifier.Proof memory proof =
            _proof(
                _encodedTransaction(
                    1,
                    SOURCE_EMITTER,
                    SIGNAL_EVENT_SIGNATURE,
                    USER,
                    ASSET,
                    1_000,
                    1
                )
            );
        AffestAttestationVerifier.ExpectedSignal memory expected =
            AffestAttestationVerifier.ExpectedSignal({
                user: USER,
                asset: ASSET,
                minimumAmount: 1_000,
                signalType: 1
            });
        _mockProofVerification(proof, 7);

        bytes32 eventKey = verifier.verifySignal(proof, 0, expected);

        bytes32 queryId = keccak256(
            abi.encodePacked(
                bytes32(uint256(SEPOLIA_CHAIN_KEY)),
                bytes8(proof.blockHeight),
                bytes32(uint256(7))
            )
        );
        bytes32 expectedEventKey = keccak256(abi.encode(queryId, uint256(0)));
        assertEq(eventKey, expectedEventKey);
        assertTrue(verifier.processedEvents(expectedEventKey));
    }

    function testRejectsWrongSourceChain() external {
        AffestAttestationVerifier verifier =
            new AffestAttestationVerifier(SEPOLIA_CHAIN_KEY, SOURCE_EMITTER);
        AffestAttestationVerifier.Proof memory proof = _validProof();
        proof.chainKey = 3;

        vm.expectRevert(AffestAttestationVerifier.WrongSourceChain.selector);
        verifier.verifySignal(proof, 0, _expectedSignal());
    }

    function testRejectsFailedSourceReceipt() external {
        AffestAttestationVerifier verifier =
            new AffestAttestationVerifier(SEPOLIA_CHAIN_KEY, SOURCE_EMITTER);
        AffestAttestationVerifier.Proof memory proof = _proof(
            _encodedTransaction(
                0,
                SOURCE_EMITTER,
                SIGNAL_EVENT_SIGNATURE,
                USER,
                ASSET,
                1_000,
                1
            )
        );
        _mockProofVerification(proof, 7);

        vm.expectRevert(AffestAttestationVerifier.SourceTransactionFailed.selector);
        verifier.verifySignal(proof, 0, _expectedSignal());
    }

    function testRejectsWrongEmitter() external {
        AffestAttestationVerifier verifier =
            new AffestAttestationVerifier(SEPOLIA_CHAIN_KEY, SOURCE_EMITTER);
        AffestAttestationVerifier.Proof memory proof = _proof(
            _encodedTransaction(
                1,
                address(0xBAD),
                SIGNAL_EVENT_SIGNATURE,
                USER,
                ASSET,
                1_000,
                1
            )
        );
        _mockProofVerification(proof, 7);

        vm.expectRevert(AffestAttestationVerifier.WrongSourceEmitter.selector);
        verifier.verifySignal(proof, 0, _expectedSignal());
    }

    function testRejectsWrongEventSignature() external {
        AffestAttestationVerifier verifier =
            new AffestAttestationVerifier(SEPOLIA_CHAIN_KEY, SOURCE_EMITTER);
        AffestAttestationVerifier.Proof memory proof = _proof(
            _encodedTransaction(
                1,
                SOURCE_EMITTER,
                keccak256("OtherEvent()"),
                USER,
                ASSET,
                1_000,
                1
            )
        );
        _mockProofVerification(proof, 7);

        vm.expectRevert(AffestAttestationVerifier.WrongEventSignature.selector);
        verifier.verifySignal(proof, 0, _expectedSignal());
    }

    function testRejectsWrongUser() external {
        AffestAttestationVerifier verifier =
            new AffestAttestationVerifier(SEPOLIA_CHAIN_KEY, SOURCE_EMITTER);
        AffestAttestationVerifier.Proof memory proof = _proof(
            _encodedTransaction(
                1,
                SOURCE_EMITTER,
                SIGNAL_EVENT_SIGNATURE,
                address(0xBAD),
                ASSET,
                1_000,
                1
            )
        );
        _mockProofVerification(proof, 7);

        vm.expectRevert(AffestAttestationVerifier.WrongUser.selector);
        verifier.verifySignal(proof, 0, _expectedSignal());
    }

    function testRejectsWrongAsset() external {
        AffestAttestationVerifier verifier =
            new AffestAttestationVerifier(SEPOLIA_CHAIN_KEY, SOURCE_EMITTER);
        AffestAttestationVerifier.Proof memory proof = _proof(
            _encodedTransaction(
                1,
                SOURCE_EMITTER,
                SIGNAL_EVENT_SIGNATURE,
                USER,
                address(0xBAD),
                1_000,
                1
            )
        );
        _mockProofVerification(proof, 7);

        vm.expectRevert(AffestAttestationVerifier.WrongAsset.selector);
        verifier.verifySignal(proof, 0, _expectedSignal());
    }

    function testRejectsAmountBelowMinimum() external {
        AffestAttestationVerifier verifier =
            new AffestAttestationVerifier(SEPOLIA_CHAIN_KEY, SOURCE_EMITTER);
        AffestAttestationVerifier.Proof memory proof = _proof(
            _encodedTransaction(
                1,
                SOURCE_EMITTER,
                SIGNAL_EVENT_SIGNATURE,
                USER,
                ASSET,
                999,
                1
            )
        );
        _mockProofVerification(proof, 7);

        vm.expectRevert(AffestAttestationVerifier.InsufficientAmount.selector);
        verifier.verifySignal(proof, 0, _expectedSignal());
    }

    function testRejectsWrongSignalType() external {
        AffestAttestationVerifier verifier =
            new AffestAttestationVerifier(SEPOLIA_CHAIN_KEY, SOURCE_EMITTER);
        AffestAttestationVerifier.Proof memory proof = _proof(
            _encodedTransaction(
                1,
                SOURCE_EMITTER,
                SIGNAL_EVENT_SIGNATURE,
                USER,
                ASSET,
                1_000,
                2
            )
        );
        _mockProofVerification(proof, 7);

        vm.expectRevert(AffestAttestationVerifier.WrongSignalType.selector);
        verifier.verifySignal(proof, 0, _expectedSignal());
    }

    function testRejectsMissingLogIndex() external {
        AffestAttestationVerifier verifier =
            new AffestAttestationVerifier(SEPOLIA_CHAIN_KEY, SOURCE_EMITTER);
        AffestAttestationVerifier.Proof memory proof = _validProof();
        _mockProofVerification(proof, 7);

        vm.expectRevert(AffestAttestationVerifier.InvalidLogIndex.selector);
        verifier.verifySignal(proof, 1, _expectedSignal());
    }

    function testRejectsReplayOfSameReceiptLog() external {
        AffestAttestationVerifier verifier =
            new AffestAttestationVerifier(SEPOLIA_CHAIN_KEY, SOURCE_EMITTER);
        AffestAttestationVerifier.Proof memory proof = _validProof();
        _mockProofVerification(proof, 7);
        verifier.verifySignal(proof, 0, _expectedSignal());

        vm.expectRevert(AffestAttestationVerifier.EventAlreadyProcessed.selector);
        verifier.verifySignal(proof, 0, _expectedSignal());
    }

    function testOnlyConfiguredExecutorCanVerifyAfterAuthorization() external {
        AffestAttestationVerifier verifier =
            new AffestAttestationVerifier(SEPOLIA_CHAIN_KEY, SOURCE_EMITTER);
        AffestAttestationVerifier.Proof memory proof = _validProof();
        _mockProofVerification(proof, 7);
        verifier.setAuthorizedCaller(address(0xE0));

        vm.expectRevert(AffestAttestationVerifier.Unauthorized.selector);
        verifier.verifySignal(proof, 0, _expectedSignal());

        vm.prank(address(0xE0));
        bytes32 eventKey = verifier.verifySignal(proof, 0, _expectedSignal());
        assertTrue(verifier.processedEvents(eventKey));
    }

    function _validProof()
        internal
        pure
        returns (AffestAttestationVerifier.Proof memory)
    {
        return _proof(
            _encodedTransaction(
                1,
                SOURCE_EMITTER,
                SIGNAL_EVENT_SIGNATURE,
                USER,
                ASSET,
                1_000,
                1
            )
        );
    }

    function _expectedSignal()
        internal
        pure
        returns (AffestAttestationVerifier.ExpectedSignal memory)
    {
        return AffestAttestationVerifier.ExpectedSignal({
            user: USER,
            asset: ASSET,
            minimumAmount: 1_000,
            signalType: 1
        });
    }

    function _proof(bytes memory encodedTransaction)
        internal
        pure
        returns (AffestAttestationVerifier.Proof memory)
    {
        INativeQueryVerifier.MerkleProofEntry[] memory siblings =
            new INativeQueryVerifier.MerkleProofEntry[](1);
        siblings[0] = INativeQueryVerifier.MerkleProofEntry({
            hash: keccak256("sibling"),
            isLeft: false
        });
        bytes32[] memory continuityRoots = new bytes32[](1);
        continuityRoots[0] = keccak256("continuity");
        return AffestAttestationVerifier.Proof({
            chainKey: SEPOLIA_CHAIN_KEY,
            blockHeight: 9_000_000,
            encodedTransaction: encodedTransaction,
            merkleRoot: keccak256("root"),
            siblings: siblings,
            lowerEndpointDigest: keccak256("lower"),
            continuityRoots: continuityRoots
        });
    }

    function _encodedTransaction(
        uint8 receiptStatus,
        address emitter,
        bytes32 eventSignature,
        address user,
        address asset,
        uint256 amount,
        uint8 signalType
    ) internal pure returns (bytes memory) {
        bytes[] memory chunks = new bytes[](3);
        chunks[0] = abi.encode(
            uint64(1),
            uint64(100_000),
            user,
            false,
            emitter,
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
        EvmV1Decoder.LogEntryTuple[] memory logs =
            new EvmV1Decoder.LogEntryTuple[](1);
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = eventSignature;
        topics[1] = SIGNAL_ID;
        topics[2] = bytes32(uint256(uint160(user)));
        topics[3] = bytes32(uint256(uint160(asset)));
        logs[0] = EvmV1Decoder.LogEntryTuple({
            address_: emitter,
            topics: topics,
            data: abi.encode(amount, signalType)
        });
        chunks[2] = abi.encode(receiptStatus, uint64(80_000), logs, bytes(""));
        return abi.encode(uint8(2), chunks);
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
                ISingleNativeQueryVerifier.verifyAndEmit,
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
