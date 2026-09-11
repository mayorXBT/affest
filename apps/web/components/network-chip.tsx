export function NetworkChip({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="mb-4 grid place-items-center" title="Creditcoin CC3 Testnet">
        <i className="inline-block size-1.5 rounded-full bg-lime shadow-[0_0_0_3px_#d6f26a18]" />
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#2b3537] px-2.5 py-2 font-mono text-[11px] text-[#c5ccca]">
      <i className="inline-block size-1.5 rounded-full bg-lime shadow-[0_0_0_3px_#d6f26a18]" />
      <span>Creditcoin CC3</span>
      <small className="ml-auto text-[11px] text-[#7c8889]">Testnet</small>
    </div>
  );
}
