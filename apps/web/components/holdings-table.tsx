'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatUnits, parseEther } from 'viem';
import { useSwitchChain, useWriteContract } from 'wagmi';
import { toast } from 'sonner';
import { AssetLogo } from '@/components/asset-logo';
import { StrategyReadiness } from '@/components/strategy-readiness';
import { Sparkline } from '@/components/sparkline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { getBalance, waitForTransactionReceipt } from 'wagmi/actions';
import { type AffestAssetId, assetById } from '@/lib/assets';
import { formatUsd, usdFromAmount, useSpotPrices } from '@/lib/prices';
import { cc3AddChainParams, creditcoinCc3, sepolia, sepoliaAddChainParams, wagmiConfig } from '@/lib/chain';
import { sepoliaContracts, vaultAbi, wethAbi, wrappedNativeAbi } from '@/lib/contracts';
import { formatAmount, useCc3Holdings, useOwnedStrategies } from '@/lib/use-cc3';

async function addChain(params: typeof cc3AddChainParams | typeof sepoliaAddChainParams) {
  const provider = window.ethereum;
  if (!provider?.request) throw new Error('No injected wallet found');
  await provider.request({ method: 'wallet_addEthereumChain', params: [params] });
}

export function HoldingsTable() {
  const strategies = useOwnedStrategies();
  const search = useSearchParams();
  const requestedStrategyId = search.get('strategyId') ?? search.get('strategy');
  const selectedStrategy = requestedStrategyId
    ? strategies.items.find((item) => item.id.toString() === requestedStrategyId)
    : undefined;
  // `null` explicitly disables the legacy factory-vault fallback while no
  // strategy is selected or while the requested strategy is resolving.
  const selectedVault = selectedStrategy?.strategy.vault ?? null;
  const holdings = useCc3Holdings(selectedVault);
  const prices = useSpotPrices();
  const { writeContractAsync, isPending } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const [amount, setAmount] = useState('');
  const [assetId, setAssetId] = useState<AffestAssetId>('TCTC');
  const asset = assetById(assetId);

  async function switchTo(chainId: typeof creditcoinCc3.id | typeof sepolia.id) {
    try {
      await switchChainAsync({ chainId });
    } catch {
      await addChain(chainId === sepolia.id ? sepoliaAddChainParams : cc3AddChainParams);
      await switchChainAsync({ chainId });
    }
  }

  async function depositTctc(value: bigint) {
    if (!holdings.address) throw new Error('Connect a wallet first');
    if (!selectedStrategy) throw new Error('Select a strategy before depositing.');
    await switchTo(creditcoinCc3.id);
    const wrapper = holdings.wrapper;
    const vault = selectedStrategy.strategy.vault;
    if (!holdings.vaultAddress || holdings.vaultAddress.toLowerCase() !== vault.toLowerCase()) {
      throw new Error('Selected strategy vault could not be verified. Deposit blocked.');
    }
    if (!wrapper || wrapper.toLowerCase() !== selectedStrategy.strategy.stableAsset.toLowerCase()) {
      throw new Error('Selected strategy WTCTC asset could not be verified on CC3. Deposit blocked.');
    }
    const wrapHash = await writeContractAsync({
      abi: wrappedNativeAbi,
      address: wrapper,
      functionName: 'depositAndApprove',
      args: [vault],
      value,
    });
    await waitForTransactionReceipt(wagmiConfig, { hash: wrapHash });
    toast('TCTC wrapped to WTCTC. Confirm the next signature to move it into the vault.');
    try {
      const depositHash = await writeContractAsync({
        abi: vaultAbi,
        address: vault,
        functionName: 'deposit',
        args: [wrapper, value],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: depositHash });
      toast('TCTC deposited to your CC3 vault');
    } catch {
      toast('TCTC is wrapped as WTCTC in your wallet. Use Move into vault to finish.');
    }
  }

  async function moveWrappedIntoVault() {
    if (!holdings.wrapper || !holdings.vaultAddress || holdings.wrappedTctc === 0n) return;
    if (selectedStrategy && (holdings.vaultAddress.toLowerCase() !== selectedStrategy.strategy.vault.toLowerCase() || holdings.wrapper?.toLowerCase() !== selectedStrategy.strategy.stableAsset.toLowerCase())) {
      toast('Selected strategy vault could not be verified. Deposit blocked.');
      return;
    }
    try {
      await switchTo(creditcoinCc3.id);
      const hash = await writeContractAsync({
        abi: vaultAbi,
        address: holdings.vaultAddress,
        functionName: 'deposit',
        args: [holdings.wrapper, holdings.wrappedTctc],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      holdings.refetch();
      toast('WTCTC moved into your CC3 vault');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Vault deposit failed');
    }
  }

  async function depositSepoliaEth(value: bigint) {
    await switchTo(sepolia.id);
    const hash = await writeContractAsync({
      abi: wethAbi,
      address: sepoliaContracts.weth,
      functionName: 'deposit',
      value,
    });
    await waitForTransactionReceipt(wagmiConfig, { hash });
    toast('ETH deposited on Sepolia as WETH. It stays on Ethereum, not in the CC3 vault.');
  }

  async function sepoliaEthBalance() {
    if (!holdings.address) return 0n;
    if (holdings.eth > 0n && !holdings.ethError) return holdings.eth;
    const live = await getBalance(wagmiConfig, { address: holdings.address, chainId: sepolia.id });
    return live.value;
  }

  async function deposit() {
    try {
      if (!selectedStrategy) {
        toast(strategies.loading ? 'Loading the selected strategy vault…' : requestedStrategyId ? `Strategy #${requestedStrategyId} was not found for this wallet` : 'Select a strategy before depositing.');
        return;
      }
      if (selectedStrategy && (!holdings.vaultAddress || holdings.vaultAddress.toLowerCase() !== selectedStrategy.strategy.vault.toLowerCase())) {
        toast('Selected strategy vault could not be verified. Deposit blocked.');
        return;
      }
      if (selectedStrategy && (!holdings.wrapper || holdings.wrapper.toLowerCase() !== selectedStrategy.strategy.stableAsset.toLowerCase())) {
        toast('Selected strategy WTCTC asset could not be verified. Deposit blocked.');
        return;
      }
      const value = parseEther(amount || '0');
      if (value === 0n) {
        toast('Enter an amount greater than 0');
        return;
      }
      if (asset.kind === 'cc3-native') {
        if (value > holdings.tctc) {
          toast(`Not enough TCTC. Wallet has ${formatAmount(holdings.tctc)} TCTC.`);
          return;
        }
        await depositTctc(value);
      } else {
        const available = await sepoliaEthBalance();
        const gasReserve = parseEther('0.001');
        const spendable = available > gasReserve ? available - gasReserve : 0n;
        if (value > spendable) {
          toast(`Not enough Sepolia ETH. Wallet has ${formatAmount(available)} ETH. Leave a little for gas.`);
          return;
        }
        await depositSepoliaEth(value);
      }
      holdings.refetch();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Deposit failed');
    }
  }

  const connected = holdings.isConnected;
  const selectionRequested = Boolean(requestedStrategyId);
  const selectedVaultMatches = Boolean(selectedStrategy && holdings.vaultAddress && holdings.vaultAddress.toLowerCase() === selectedStrategy.strategy.vault.toLowerCase());
  const selectedStableMatches = Boolean(selectedStrategy && holdings.wrapper && holdings.wrapper.toLowerCase() === selectedStrategy.strategy.stableAsset.toLowerCase());
  const depositTargetVerified = Boolean(selectedStrategy && selectedVaultMatches && selectedStableMatches);
  const ethUsd = prices.data?.ethUsd ?? 0;
  const ctcUsd = prices.data?.ctcUsd ?? 0;
  const available = asset.kind === 'cc3-native' ? holdings.tctc : holdings.eth;
  const maxValue = asset.kind === 'sepolia-native' && available > parseEther('0.001')
    ? available - parseEther('0.001')
    : available;

  function fillMax() {
    if (maxValue === 0n) return;
    setAmount(formatUnits(maxValue, 18));
  }

  return (
    <div className="mt-7 grid gap-3.5 lg:grid-cols-3">
      <Card className="lg:col-span-3 border-line bg-ink-2 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow accent">Strategy vaults</p>
            <CardTitle className="mt-1 text-[17px]">{selectedStrategy ? `Funding Strategy #${selectedStrategy.id.toString()}` : 'Choose a vault to fund'}</CardTitle>
          </div>
          <Badge variant="muted">CC3 · Live</Badge>
        </div>
        {selectedStrategy ? (
          <div className="mt-3 rounded-lg border border-lime/30 bg-preview-bg p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[13px]">Strategy #{selectedStrategy.id.toString()}</b>
                  <small className="text-[11px] text-muted">{selectedStrategy.strategy.stableWeightBps / 100}% WTCTC / {selectedStrategy.strategy.riskWeightBps / 100}% {selectedStrategy.strategy.triggerAsset.toLowerCase() === sepoliaContracts.weth.toLowerCase() ? 'ETH' : 'TCTC'}</small>
                </div>
                <small className="mt-1 block break-all text-[11px] text-muted">Vault: {selectedStrategy.strategy.vault}</small>
              </div>
              <Link href="/portfolio" className="shrink-0 text-[11px] font-semibold text-lime hover:underline">Change strategy</Link>
            </div>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <small className="text-[11px] text-muted">Deposits are locked to this vault. A mismatch keeps Deposit disabled.</small>
              <StrategyReadiness strategy={selectedStrategy.strategy} />
            </div>
          </div>
        ) : selectionRequested ? (
          <b className="mt-3 block text-[13px]">{strategies.loading ? 'Loading selected strategy…' : `Strategy #${requestedStrategyId} was not found for this wallet`}</b>
        ) : strategies.loading ? (
          <p className="mt-3 text-[12px] text-muted">Reading strategies on CC3…</p>
        ) : strategies.error ? (
          <p className="mt-3 text-[12px] text-[#ef9a9a]">Could not read strategies on CC3: {strategies.error.message}</p>
        ) : strategies.items.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted">Create a strategy first to get a strategy-specific vault.</p>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {strategies.items.map((item) => (
              <Link key={item.id.toString()} href={`/portfolio?strategyId=${item.id.toString()}`} className="group flex min-w-0 items-center justify-between gap-3 rounded-lg border border-line bg-ink px-3 py-2.5 transition-colors hover:border-lime/50">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-[12px]">Strategy #{item.id.toString()}</b>
                    <small className="text-[10px] text-muted">{item.strategy.stableWeightBps / 100}% WTCTC / {item.strategy.riskWeightBps / 100}% {item.strategy.triggerAsset.toLowerCase() === sepoliaContracts.weth.toLowerCase() ? 'ETH' : 'TCTC'}</small>
                  </div>
                  <small className="mt-1 block truncate text-[10px] text-muted" title={item.strategy.vault}>Vault: {item.strategy.vault}</small>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-lime transition-transform group-hover:translate-x-0.5">Fund →</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
      {selectionRequested ? (
        <Card className="hidden lg:col-span-3 border-lime/30 bg-preview-bg p-4">
          <p className="eyebrow accent">Strategy-specific funding</p>
          {selectedStrategy ? (
            <>
              <b className="block text-[15px]">Funding Strategy #{selectedStrategy.id.toString()}</b>
              <small className="mt-1 block text-[12px] text-muted">Deposits are locked to this strategy’s vault. If the displayed vault does not match, deposits stay blocked.</small>
            </>
          ) : (
            <b className="block text-[15px]">{strategies.loading ? 'Loading selected strategy…' : `Strategy #${requestedStrategyId} was not found for this wallet`}</b>
          )}
        </Card>
      ) : null}
      {!selectionRequested ? (
        <Card className="hidden lg:col-span-3 border-line bg-ink-2 p-4">
          <p className="eyebrow accent">Choose a strategy vault</p>
          <b className="block text-[15px]">Select which strategy you want to fund</b>
          <small className="mt-1 block text-[12px] text-muted">Affest never deposits into a global or legacy vault. Pick a strategy to load its exact CC3 vault address.</small>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {strategies.loading ? <p className="text-[12px] text-[#788484]">Reading strategies on CC3…</p> : strategies.error ? <p className="text-[12px] text-[#ef9a9a]">Could not read strategies on CC3: {strategies.error.message}</p> : strategies.items.length === 0 ? <p className="text-[12px] text-[#788484]">Create a strategy first to get a strategy-specific vault.</p> : strategies.items.map((item) => (
              <Link key={item.id.toString()} href={`/portfolio?strategyId=${item.id.toString()}`} className="rounded-lg border border-line bg-ink px-3 py-2 transition-colors hover:border-lime/50">
                <b className="block text-[12px]">Strategy #{item.id.toString()}</b>
                <small className="mt-1 block break-all text-[10px] text-[#788484]">Vault: {item.strategy.vault}</small>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
      <Card className="overflow-hidden p-[18px_19px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Vault status</p>
            <b className="block text-[17px]">{selectedStrategy ? `Strategy #${selectedStrategy.id.toString()} vault` : holdings.vaultAddress ? 'Vault on CC3' : connected ? 'No vault yet' : 'Not connected'}</b>
            <small className="mt-1 block break-all text-[12px] text-[#778384]">
              {holdings.vaultAddress ? `Vault: ${holdings.vaultAddress}` : 'Creditcoin CC3 · TCTC custody'}
            </small>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${holdings.vaultAddress ? 'bg-[#1c3a26] text-[#8fef9a]' : 'bg-[#2a3438] text-[#8f9a9b]'}`}>
              {holdings.vaultAddress ? 'Active' : 'Idle'}
            </span>
            <Sparkline
              values={prices.data?.ctcSpark ?? []}
              color="#8fef9a"
              fill="rgba(143,239,154,0.16)"
              width={92}
              height={36}
            />
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden p-[18px_19px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Wallet TCTC</p>
            <b className="block text-[17px] tabular">{connected ? formatAmount(holdings.tctc) : '—'}</b>
            <small className="mt-1 block text-[12px] text-[#778384]">Available to deposit</small>
          </div>
          <Sparkline
            values={prices.data?.ctcSpark ?? []}
            color="#d6f26a"
            fill="rgba(214,242,106,0.14)"
            width={92}
            height={44}
          />
        </div>
      </Card>
      <Card className="overflow-hidden p-[18px_19px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Wallet ETH</p>
            <b className="block text-[17px] tabular">{connected ? formatAmount(holdings.eth) : '—'}</b>
            <small className="mt-1 block text-[12px] text-[#778384]">Ethereum Sepolia</small>
          </div>
          <Sparkline
            values={prices.data?.ethSpark ?? []}
            color="#7f92e6"
            fill="rgba(127,146,230,0.16)"
            width={92}
            height={44}
          />
        </div>
      </Card>
      <Card className="min-h-[260px] p-[22px_23px] lg:col-span-1">
        <CardHeader>
          <div>
            <p className="eyebrow">Holdings</p>
            <CardTitle>Wallet assets</CardTitle>
          </div>
          <Badge>{connected ? 'Live' : 'Empty'}</Badge>
        </CardHeader>
        <CardContent>
          {connected ? (
            <Table>
              <TableBody>
                {([
                  { kind: 'TCTC' as const, name: 'TCTC', detail: 'Creditcoin CC3 · wallet', amount: holdings.tctc, usd: usdFromAmount(holdings.tctc, ctcUsd) },
                  { kind: 'WTCTC' as const, name: 'WTCTC', detail: 'Wrapped TCTC · wallet', amount: holdings.wrappedTctc, usd: usdFromAmount(holdings.wrappedTctc, ctcUsd) },
                  { kind: 'TCTC' as const, name: 'TCTC in vault', detail: 'Vault on CC3', amount: holdings.vaultTctc, usd: usdFromAmount(holdings.vaultTctc, ctcUsd) },
                  { kind: 'ETH' as const, name: 'ETH', detail: 'Ethereum Sepolia · wallet', amount: holdings.eth, usd: usdFromAmount(holdings.eth, ethUsd) },
                  { kind: 'WETH' as const, name: 'ETH deposited', detail: 'WETH on Ethereum Sepolia', amount: holdings.weth, usd: usdFromAmount(holdings.weth, ethUsd) },
                ]).map((row) => (
                  <TableRow key={`${row.name}-${row.detail}`}>
                    <TableCell><AssetLogo kind={row.kind} size={30} /></TableCell>
                    <TableCell>
                      <b className="block text-[12px]">{row.name}</b>
                      <small className="mt-0.5 block text-[11px] text-[#788484]">{row.detail}</small>
                    </TableCell>
                    <TableCell className="text-right">
                      <b className="block text-[12px] tabular">{formatAmount(row.amount)}</b>
                      <small className="mt-0.5 block text-[11px] text-[#9aa7a0] tabular">{formatUsd(row.usd)}</small>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex min-h-[180px] flex-col justify-center gap-2">
              <b className="text-[13px]">Connect a wallet to read TCTC and Sepolia ETH</b>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="min-h-[260px] p-[22px_23px] lg:col-span-2">
        <CardHeader>
          <div>
            <p className="eyebrow">Deposit</p>
            <CardTitle>{selectedStrategy ? `Fund Strategy #${selectedStrategy.id.toString()}` : 'Fund a strategy vault'}</CardTitle>
          </div>
          <Button variant="link" asChild>
            <Link href="/strategies">Create strategy</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {holdings.pendingVaultDeposit ? (
            <div className="mt-4 mb-4 rounded-md border border-[#5a4a22] bg-[#241e12] p-3">
              <b className="block text-[12px] text-[#e6d39a]">{formatAmount(holdings.wrappedTctc)} WTCTC is still in your wallet</b>
              <small className="mt-1 mb-3 block text-[12px] leading-relaxed text-[#b7a882]">
                The wrap succeeded. The vault transfer still needs a signature.
              </small>
              <Button disabled={isPending} onClick={() => void moveWrappedIntoVault()}>
                Move into vault
              </Button>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-[12px] text-[#899596]">
              Asset
              <span className="mt-1 flex h-9 items-center gap-2 rounded-md border border-[#354044] bg-[#101618] px-2">
                <AssetLogo kind={assetId} size={18} />
                <select
                  className="h-full flex-1 bg-transparent text-[12px] outline-none"
                  value={assetId}
                  onChange={(event) => setAssetId(event.target.value === 'ETH' ? 'ETH' : 'TCTC')}
                >
                  <option value="TCTC">TCTC · Creditcoin CC3</option>
                  <option value="ETH">ETH · Ethereum Sepolia</option>
                </select>
              </span>
            </label>
            <label className="text-[12px] text-[#899596]">
              Amount
              <span className="relative mt-1 block w-44">
                <Input
                  className="pr-12"
                  placeholder={asset.kind === 'cc3-native' ? '1000' : '0.01'}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                <button
                  type="button"
                  disabled={!connected || maxValue === 0n}
                  onClick={fillMax}
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded px-1.5 text-[11px] font-semibold text-lime disabled:text-[#5c6869]"
                >
                  Max
                </button>
              </span>
            </label>
            <Button disabled={!connected || isPending || !depositTargetVerified} onClick={() => void deposit()}>
              {asset.kind === 'cc3-native'
                ? selectedStrategy ? 'Deposit TCTC' : 'Select a strategy'
                : 'Deposit ETH'}
            </Button>
          </div>
          <div className="mt-5 rounded-md border border-[#334039] bg-[#17201b] p-3">
            <b className="block text-[12px] text-[#bcd1ad]">
              {asset.kind === 'cc3-native' ? 'TCTC goes into your CC3 vault' : 'ETH deposits on Ethereum Sepolia'}
            </b>
            <small className="mt-1 block text-[12px] leading-relaxed text-[#829088]">
              {asset.kind === 'cc3-native'
                ? selectedStrategy ? `Deposit wraps TCTC to WTCTC, then sends it to Strategy #${selectedStrategy.id.toString()} vault ${selectedStrategy.strategy.vault}.` : 'Select a strategy above to load its exact CC3 vault before depositing.'
                : 'Pick ETH · Ethereum Sepolia and Deposit ETH. Native ETH has no ERC20 address, so Sepolia stores it as WETH. It cannot move into the Creditcoin vault.'}
            </small>
          </div>
        </CardContent>
      </Card>
      <Card className="hidden mt-3.5 p-[22px_23px] lg:col-span-3">
        <CardHeader>
          <div>
            <p className="eyebrow">Strategy vaults</p>
            <CardTitle>Every vault owned by this wallet</CardTitle>
          </div>
          <Badge variant="muted">Live CC3 reads</Badge>
        </CardHeader>
        <CardContent>
          {strategies.loading ? <p className="text-[12px] text-[#788484]">Reading strategy vaults on CC3…</p> : strategies.items.length === 0 ? <p className="text-[12px] text-[#788484]">No strategy vaults found for this wallet.</p> : (
            <div className="grid gap-3 md:grid-cols-2">
              {strategies.items.map((item) => (
                <div key={item.id.toString()} className="rounded-lg border border-line bg-ink-2 p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <b className="block text-[13px]">Strategy #{item.id.toString()}</b>
                      <small className="mt-1 block break-all text-[10px] text-[#657173]">{item.strategy.vault}</small>
                    </div>
                    <small className="shrink-0 text-[11px] text-[#788484]">{item.strategy.stableWeightBps / 100}% WTCTC / {item.strategy.riskWeightBps / 100}% {item.strategy.triggerAsset.toLowerCase() === sepoliaContracts.weth.toLowerCase() ? 'ETH' : 'TCTC'}</small>
                  </div>
                  <StrategyReadiness strategy={item.strategy} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
