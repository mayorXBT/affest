// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface Vm {
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData)
        external;

    function expectRevert(bytes4 selector) external;

    function expectRevert(bytes calldata revertData) external;

    function mockCall(address callee, bytes calldata data, bytes calldata returnData)
        external;

    function prank(address caller) external;

    function warp(uint256 timestamp) external;

    function etch(address target, bytes calldata code) external;
}

abstract contract TestBase {
    Vm internal constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(bytes32 actual, bytes32 expected) internal pure {
        require(actual == expected, "bytes32 values differ");
    }

    function assertEq(address actual, address expected) internal pure {
        require(actual == expected, "address values differ");
    }

    function assertEq(uint256 actual, uint256 expected) internal pure {
        require(actual == expected, "uint256 values differ");
    }

    function assertTrue(bool value) internal pure {
        require(value, "expected true");
    }
}
