// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    INativeQueryVerifier,
    NativeQueryVerifierLib
} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";
import {
    EvmV1Decoder
} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

contract AffestAttestationVerifier {
    error Unauthorized();
    error AuthorizedCallerAlreadySet();
    error InvalidAuthorizedCaller();
    error WrongSourceChain();
    error ProofVerificationFailed();
    error SourceTransactionFailed();
    error InvalidLogIndex();
    error WrongSourceEmitter();
    error MalformedSignalEvent();
    error WrongEventSignature();
    error WrongUser();
    error WrongAsset();
    error InsufficientAmount();
    error WrongSignalType();
    error EventAlreadyProcessed();

    struct Proof {
        uint64 chainKey;
        uint64 blockHeight;
        bytes encodedTransaction;
        bytes32 merkleRoot;
        INativeQueryVerifier.MerkleProofEntry[] siblings;
        bytes32 lowerEndpointDigest;
        bytes32[] continuityRoots;
    }

    struct ExpectedSignal {
        address user;
        address asset;
        uint256 minimumAmount;
        uint8 signalType;
    }

    struct VerifiedSignal {
        bytes32 signalId;
        address user;
        address asset;
        uint256 amount;
        uint8 signalType;
    }

    uint64 public immutable sourceChainKey;
    address public immutable sourceEmitter;
    INativeQueryVerifier public immutable verifier;
    address public immutable administrator;
    address public authorizedCaller;

    bytes32 public constant PORTFOLIO_SIGNAL_EVENT_SIGNATURE =
        keccak256("PortfolioSignal(bytes32,address,address,uint256,uint8)");

    mapping(bytes32 eventKey => bool processed) public processedEvents;

    event TriggerVerified(
        bytes32 indexed eventKey,
        bytes32 indexed queryId,
        bytes32 indexed signalId,
        address user,
        address asset,
        uint256 amount,
        uint8 signalType,
        uint256 receiptLogIndex
    );

    constructor(uint64 sourceChainKey_, address sourceEmitter_) {
        sourceChainKey = sourceChainKey_;
        sourceEmitter = sourceEmitter_;
        verifier = NativeQueryVerifierLib.getVerifier();
        administrator = msg.sender;
    }

    function setAuthorizedCaller(address caller) external {
        if (msg.sender != administrator) revert Unauthorized();
        if (authorizedCaller != address(0)) revert AuthorizedCallerAlreadySet();
        if (caller == address(0)) revert InvalidAuthorizedCaller();
        authorizedCaller = caller;
    }

    function verifySignal(
        Proof calldata proof,
        uint256 receiptLogIndex,
        ExpectedSignal calldata expected
    ) external returns (bytes32 eventKey) {
        if (
            (authorizedCaller == address(0) && msg.sender != administrator)
                || (authorizedCaller != address(0) && msg.sender != authorizedCaller)
        ) revert Unauthorized();
        if (proof.chainKey != sourceChainKey) revert WrongSourceChain();

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
        uint64 transactionIndex = verifier.calculateTxIndex(merkleProof);
        bool verified = verifier.verifyAndEmit(
            proof.chainKey,
            proof.blockHeight,
            proof.encodedTransaction,
            merkleProof,
            continuityProof
        );
        if (!verified) revert ProofVerificationFailed();

        bytes32 queryId = keccak256(
            abi.encodePacked(
                bytes32(uint256(proof.chainKey)),
                bytes8(proof.blockHeight),
                bytes32(uint256(transactionIndex))
            )
        );
        eventKey = keccak256(abi.encode(queryId, receiptLogIndex));
        if (processedEvents[eventKey]) revert EventAlreadyProcessed();

        VerifiedSignal memory signal =
            _decodeAndValidate(proof.encodedTransaction, receiptLogIndex, expected);

        processedEvents[eventKey] = true;
        _emitTriggerVerified(eventKey, queryId, signal, receiptLogIndex);
    }

    function _emitTriggerVerified(
        bytes32 eventKey,
        bytes32 queryId,
        VerifiedSignal memory signal,
        uint256 receiptLogIndex
    ) internal {
        emit TriggerVerified(
            eventKey,
            queryId,
            signal.signalId,
            signal.user,
            signal.asset,
            signal.amount,
            signal.signalType,
            receiptLogIndex
        );
    }

    function _decodeAndValidate(
        bytes calldata encodedTransaction,
        uint256 receiptLogIndex,
        ExpectedSignal calldata expected
    ) internal view returns (VerifiedSignal memory signal) {
        EvmV1Decoder.ReceiptFields memory receipt =
            EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        if (receipt.receiptStatus != 1) revert SourceTransactionFailed();
        if (receiptLogIndex >= receipt.receiptLogs.length) revert InvalidLogIndex();

        EvmV1Decoder.LogEntry memory sourceLog =
            receipt.receiptLogs[receiptLogIndex];
        if (sourceLog.address_ != sourceEmitter) revert WrongSourceEmitter();
        if (sourceLog.topics.length != 4 || sourceLog.data.length != 64) {
            revert MalformedSignalEvent();
        }
        if (sourceLog.topics[0] != PORTFOLIO_SIGNAL_EVENT_SIGNATURE) {
            revert WrongEventSignature();
        }

        signal.signalId = sourceLog.topics[1];
        signal.user = address(uint160(uint256(sourceLog.topics[2])));
        signal.asset = address(uint160(uint256(sourceLog.topics[3])));
        (signal.amount, signal.signalType) =
            abi.decode(sourceLog.data, (uint256, uint8));

        if (signal.user != expected.user) revert WrongUser();
        if (signal.asset != expected.asset) revert WrongAsset();
        if (signal.amount < expected.minimumAmount) revert InsufficientAmount();
        if (signal.signalType != expected.signalType) revert WrongSignalType();
    }
}
