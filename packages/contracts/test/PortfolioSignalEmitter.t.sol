// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PortfolioSignalEmitter} from "../src/source/PortfolioSignalEmitter.sol";
import {TestBase} from "./TestBase.sol";

contract PortfolioSignalEmitterTest is TestBase {
    event PortfolioSignal(
        bytes32 indexed signalId,
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint8 signalType
    );

    function testEmitsSignalBoundToCaller() external {
        PortfolioSignalEmitter emitter = new PortfolioSignalEmitter();
        bytes32 signalId = keccak256("deposit-1");
        address asset = address(0xA11CE);

        vm.expectEmit(true, true, true, true);
        emit PortfolioSignal(signalId, address(this), asset, 1_000_000_000, 1);

        emitter.emitSignal(signalId, asset, 1_000_000_000, 1);

        assertTrue(emitter.usedSignalIds(signalId));
    }

    function testRejectsZeroAsset() external {
        PortfolioSignalEmitter emitter = new PortfolioSignalEmitter();

        vm.expectRevert(PortfolioSignalEmitter.InvalidAsset.selector);
        emitter.emitSignal(keccak256("invalid-asset"), address(0), 1, 1);
    }

    function testRejectsZeroAmount() external {
        PortfolioSignalEmitter emitter = new PortfolioSignalEmitter();

        vm.expectRevert(PortfolioSignalEmitter.InvalidAmount.selector);
        emitter.emitSignal(keccak256("invalid-amount"), address(0xA11CE), 0, 1);
    }

    function testRejectsDuplicateSignalId() external {
        PortfolioSignalEmitter emitter = new PortfolioSignalEmitter();
        bytes32 signalId = keccak256("duplicate");
        emitter.emitSignal(signalId, address(0xA11CE), 1, 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                PortfolioSignalEmitter.SignalAlreadyUsed.selector, signalId
            )
        );
        emitter.emitSignal(signalId, address(0xA11CE), 1, 1);
    }
}
