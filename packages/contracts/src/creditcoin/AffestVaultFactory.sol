// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AffestVault} from "./AffestVault.sol";

contract AffestVaultFactory {
    error VaultAlreadyExists();

    mapping(address owner => address vault) public vaultOf;

    event VaultCreated(address indexed owner, address indexed vault);

    function createVault(
        address stableAsset,
        address riskAsset,
        address swapAdapter
    ) external returns (address vaultAddress) {
        if (vaultOf[msg.sender] != address(0)) revert VaultAlreadyExists();
        AffestVault vault =
            new AffestVault(msg.sender, stableAsset, riskAsset, swapAdapter);
        vaultAddress = address(vault);
        vaultOf[msg.sender] = vaultAddress;
        emit VaultCreated(msg.sender, vaultAddress);
    }
}
