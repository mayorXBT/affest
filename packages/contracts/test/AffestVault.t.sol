// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AffestVault} from "../src/creditcoin/AffestVault.sol";
import {AffestDemoToken} from "../src/demo/AffestDemoToken.sol";
import {DemoSwapAdapter} from "../src/demo/DemoSwapAdapter.sol";
import {TestBase} from "./TestBase.sol";

contract AffestVaultTest is TestBase {
    AffestDemoToken internal stable;
    AffestDemoToken internal risk;
    DemoSwapAdapter internal adapter;
    AffestVault internal vault;

    function setUp() external {
        stable = new AffestDemoToken("Affest Demo USD", "adUSD");
        risk = new AffestDemoToken("Affest Demo Risk", "adRISK");
        adapter = new DemoSwapAdapter(address(stable), address(risk));
        vault =
            new AffestVault(address(this), address(stable), address(risk), address(adapter));
        vault.setExecutor(address(this));

        stable.mint(address(this), 10_000);
        risk.mint(address(adapter), 10_000);
        stable.approve(address(vault), type(uint256).max);
    }

    function testDepositsAndOwnerWithdrawsAllowedAsset() external {
        vault.deposit(address(stable), 1_000);
        assertEq(stable.balanceOf(address(vault)), 1_000);

        vault.withdraw(address(stable), 250);

        assertEq(stable.balanceOf(address(vault)), 750);
        assertEq(stable.balanceOf(address(this)), 9_250);
    }

    function testRejectsUnauthorizedWithdrawal() external {
        vault.deposit(address(stable), 1_000);

        vm.prank(address(0xBAD));
        vm.expectRevert(AffestVault.Unauthorized.selector);
        vault.withdraw(address(stable), 1);
    }

    function testExecutorSwapsOnlyIntoVault() external {
        vault.deposit(address(stable), 1_000);

        uint256 amountOut = vault.executeSwap(
            address(adapter), address(stable), address(risk), 100, 100
        );

        assertEq(amountOut, 100);
        assertEq(stable.balanceOf(address(vault)), 900);
        assertEq(risk.balanceOf(address(vault)), 100);
    }

    function testEmergencyPauseBlocksAutomationButNotOwnerWithdrawal() external {
        vault.deposit(address(stable), 1_000);
        vault.pause();

        vm.expectRevert(AffestVault.AutomationPaused.selector);
        vault.executeSwap(
            address(adapter), address(stable), address(risk), 100, 100
        );

        vault.withdraw(address(stable), 100);
        assertEq(stable.balanceOf(address(vault)), 900);
    }

    function testRejectsUnknownAdapterAndAsset() external {
        vault.deposit(address(stable), 1_000);

        vm.expectRevert(AffestVault.AdapterNotAllowed.selector);
        vault.executeSwap(
            address(0xBAD), address(stable), address(risk), 100, 100
        );

        vm.expectRevert(AffestVault.AssetNotAllowed.selector);
        vault.deposit(address(0xBAD), 1);
    }
}
