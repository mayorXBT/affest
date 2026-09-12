import { AttestationWorker } from './index.js';
import { SdkAttestationPort, ViemSepoliaSourcePort } from './adapters.js';
import { ViemCreditcoinPort, parseAddress, parsePrivateKey } from './creditcoin.js';
import { PostgresWorkerStore } from './postgres-store.js';
import { runWorkerForever, createWorkerLogger } from './main.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const store = new PostgresWorkerStore(required('DATABASE_URL'));
  const creditcoin = new ViemCreditcoinPort({
    rpcUrl: required('CREDITCOIN_RPC_URL'),
    privateKey: parsePrivateKey(required('RELAYER_PRIVATE_KEY')),
    strategyManager: parseAddress(required('AFFEST_STRATEGY_MANAGER_ADDRESS'), 'AFFEST_STRATEGY_MANAGER_ADDRESS'),
    executor: parseAddress(required('AFFEST_EXECUTOR_ADDRESS'), 'AFFEST_EXECUTOR_ADDRESS'),
    attestationVerifier: parseAddress(required('AFFEST_ATTESTATION_VERIFIER_ADDRESS'), 'AFFEST_ATTESTATION_VERIFIER_ADDRESS'),
  });
  await creditcoin.assertRoleWiring();
  const worker = new AttestationWorker(
    store,
    {
      source: new ViemSepoliaSourcePort(
        required('SEPOLIA_RPC_URL'),
        parseAddress(required('SOURCE_SIGNAL_CONTRACT_ADDRESS'), 'SOURCE_SIGNAL_CONTRACT_ADDRESS'),
      ),
      attestation: new SdkAttestationPort(
        Number(process.env.ATTESTCOIN_SOURCE_CHAIN_KEY ?? 1),
        required('ATTESTCOIN_PROOF_API_URL'),
      ),
      creditcoin,
    },
    Number(process.env.ATTESTCOIN_SOURCE_CHAIN_KEY ?? 1),
    'ethereum-sepolia-signals',
    BigInt(required('WORKER_START_BLOCK')),
    createWorkerLogger(),
  );
  const stop = async () => {
    await store.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => { void stop(); });
  process.once('SIGINT', () => { void stop(); });
  await runWorkerForever(worker, Number(process.env.WORKER_INTERVAL_MS ?? 15_000));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'worker failed';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
