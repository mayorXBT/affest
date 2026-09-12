# Affest testnet deployments

These addresses were returned by Foundry deployments from the configured
deployer account on 2026-09-08. The administrator subsequently completed the
one-time role wiring on CC3; the confirmed transactions are recorded below.
Keep the deployer key out of hosted services. The worker uses a separate
relayer key for proof submission.

## Hosted dashboard

The dashboard deployment is [https://affest.cefo.dev](https://affest.cefo.dev).
Its Vercel project must set the `NEXT_PUBLIC_*` values from `.env.example`.
Set `NEXT_PUBLIC_MCP_BASE_URL` to the hosted MCP origin, or leave it empty when
the dashboard origin reverse-proxies MCP requests.

## Ethereum Sepolia

| Contract | Address | Deployment transaction |
|---|---|---|
| `PortfolioSignalEmitter` | `0x5b185DC5443dca8bda7C4ca7De1a6BcA8d73C2b6` | [`0x0f52…3783`](https://sepolia.etherscan.io/tx/0x0f52ebee082242ab19b06ec342d4dd766d4c1b6298d235e8b345508a4e3a3783) |

## Creditcoin CC3 Testnet

| Contract | Address | Deployment transaction |
|---|---|---|
| Demo stable token | `0x5b185DC5443dca8bda7C4ca7De1a6BcA8d73C2b6` | [`0xb54a…60e7`](https://creditcoin-testnet.blockscout.com/tx/0xb54a7ebdeeef27019cbf892738dd83d6e5fb487abbd02181b793b2fb883a60e7) |
| Demo risk token | `0x3cC438F47c330AB747cf5404c573156221beD2fD` | [`0x597b…097d`](https://creditcoin-testnet.blockscout.com/tx/0x597b6e93b6e99af1099ee7b4f90b621919f1c46bca6da9b15f144b8f9415097d) |
| `DemoSwapAdapter` | `0xd010E8bdbd492124aF10D2ac3f025beaC2E9D44C` | [`0xe8b3…7f9e`](https://creditcoin-testnet.blockscout.com/tx/0xe8b3aca8a16bc04f617f4faacb9d5c429aa77c79f021f221c33174d92b457f9e) |
| `AffestAttestationVerifier` | `0xD5ed47C1b75D41DFE2de73620C1f496d89861D1D` | [`0xf28c…d021`](https://creditcoin-testnet.blockscout.com/tx/0xf28c51e77feca71b633671d3dfbc775c6c7dac0504d2f0405f965e513887d021) |
| `AffestStrategyManager` | `0xf016A45345857aeE7e93C987B4429840B779020B` | [`0x8dce…2395`](https://creditcoin-testnet.blockscout.com/tx/0x8dce634719fa81842acecf856af86e56689776ff2f996639d0dcf20744962395) |
| `AffestExecutor` | `0x2544619c10F049DEE88b121B7A0c6f6d144cA883` | [`0x0a48…bf00`](https://creditcoin-testnet.blockscout.com/tx/0x0a48e97987edba56c96d4b051fa5605287694f2dce773b64487e0327adc0bf00) |
| `AffestVaultFactory` | `0x6A83bC86a1cF17b7F5a22d96e6aF376402491749` | [`0xd393…3ca1`](https://creditcoin-testnet.blockscout.com/tx/0xd3930be3acc0bc474b03a2281017a7dcf1d8bd40910d393618464df7a5eb3ca1) |

The role-wiring transactions were submitted by the administrator after the
worker integration was added:

| Call | Transaction | Status |
|---|---|---|
| `AffestStrategyManager.setExecutor(AffestExecutor)` | [`0x45c6…689f`](https://creditcoin-testnet.blockscout.com/tx/0x45c6f470fea9278bbea5ebc8ad4e1810cf1a12e5c951f343157c8d1b6bb6689f) | confirmed |
| `AffestAttestationVerifier.setAuthorizedCaller(AffestExecutor)` | [`0xc2f2…fc35`](https://creditcoin-testnet.blockscout.com/tx/0xc2f288cf432d828f297637c7b1aa9f47f6a97ebdd22bc524ef0ea4061e75fc35) | confirmed |

The worker's relayer can now call `AffestExecutor.requestRebalance`, while
the verifier accepts only calls forwarded by that executor.

Read-only verification completed after deployment:

- Sepolia source receipt status: `0x1`.
- All seven CC3 deployment receipt statuses: `0x1`.
- RPC bytecode is non-empty at every listed address.
- `AffestStrategyManager.executor()` equals `AffestExecutor`.
- `AffestAttestationVerifier.authorizedCaller()` equals `AffestExecutor`.
