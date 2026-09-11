// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AffestWrappedNative} from "../src/creditcoin/AffestWrappedNative.sol";
import {TestBase} from "./TestBase.sol";

contract AffestWrappedNativeTest is TestBase {
    AffestWrappedNative internal wrapper;

    receive() external payable {}

    function setUp() external {
        wrapper = new AffestWrappedNative();
    }

    function testDepositAndWithdrawRoundTrip() external {
        wrapper.deposit{value: 1 ether}();
        assertEq(wrapper.balanceOf(address(this)), 1 ether);
        assertEq(address(wrapper).balance, 1 ether);

        wrapper.withdraw(0.4 ether);
        assertEq(wrapper.balanceOf(address(this)), 0.6 ether);
    }

    function testDepositAndApproveSetsAllowance() external {
        address spender = address(0xBEEF);
        wrapper.depositAndApprove{value: 2 ether}(spender);
        assertEq(wrapper.balanceOf(address(this)), 2 ether);
        assertEq(wrapper.allowance(address(this), spender), 2 ether);
    }

    function testRejectsZeroDeposit() external {
        vm.expectRevert(AffestWrappedNative.InvalidAmount.selector);
        wrapper.deposit{value: 0}();
    }
}
