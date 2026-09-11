// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract PortfolioSignalEmitter {
    error InvalidAsset();
    error InvalidAmount();
    error SignalAlreadyUsed(bytes32 signalId);

    event PortfolioSignal(
        bytes32 indexed signalId,
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint8 signalType
    );

    mapping(bytes32 signalId => bool used) public usedSignalIds;

    function emitSignal(
        bytes32 signalId,
        address asset,
        uint256 amount,
        uint8 signalType
    ) external {
        if (asset == address(0)) revert InvalidAsset();
        if (amount == 0) revert InvalidAmount();
        if (usedSignalIds[signalId]) revert SignalAlreadyUsed(signalId);

        usedSignalIds[signalId] = true;
        emit PortfolioSignal(signalId, msg.sender, asset, amount, signalType);
    }
}
