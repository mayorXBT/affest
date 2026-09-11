import { readFileSync, writeFileSync } from 'node:fs';

const wrap = JSON.parse(
  readFileSync(new URL('../../../packages/contracts/out/AffestWrappedNative.sol/AffestWrappedNative.json', import.meta.url), 'utf8'),
);
const vault = JSON.parse(
  readFileSync(new URL('../../../packages/contracts/out/AffestVault.sol/AffestVault.json', import.meta.url), 'utf8'),
);

writeFileSync(
  new URL('../lib/bytecode.ts', import.meta.url),
  [
    "export const wrappedNativeBytecode = '" + wrap.bytecode.object + "' as const;",
    "export const vaultBytecode = '" + vault.bytecode.object + "' as const;",
    '',
  ].join('\n'),
);
