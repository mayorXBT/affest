// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AffestVault} from "../src/creditcoin/AffestVault.sol";
import {
    AffestVaultFactory
} from "../src/creditcoin/AffestVaultFactory.sol";
import {TestBase} from "./TestBase.sol";

contract AffestVaultFactoryTest is TestBase {
    function testCreatesOnlyOneVaultPerOwner() external {
        AffestVaultFactory factory = new AffestVaultFactory();

        address vaultAddress = factory.createVault(
            address(0x57AB1E), address(0xB15C), address(0xAD)
        );

        assertEq(factory.vaultOf(address(this)), vaultAddress);
        assertEq(AffestVault(vaultAddress).owner(), address(this));

        vm.expectRevert(AffestVaultFactory.VaultAlreadyExists.selector);
        factory.createVault(address(0x57AB1E), address(0xB15C), address(0xAD));
    }
}
