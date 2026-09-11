'use client';

import { ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCc3Account } from '@/lib/use-cc3';

const steps = [
  { title: 'Source signal', detail: 'No source transaction detected' },
  { title: 'Attestation', detail: 'Waiting for Attestcoin', waiting: true },
  { title: 'Proof', detail: 'Generated after attested height' },
  { title: 'Creditcoin', detail: 'Verification gates execution' },
];

export function ProofRail() {
  const { isConnected, onCc3 } = useCc3Account();

  return (
    <Card className="p-[22px_23px]">
      <CardHeader>
        <div>
          <p className="eyebrow">Cross-chain proof rail</p>
          <CardTitle>Next trigger</CardTitle>
        </div>
        <Badge variant="waiting">{isConnected && onCc3 ? 'Idle' : 'Disconnected'}</Badge>
      </CardHeader>
      <CardContent>
        <div className="my-[18px] flex items-center gap-2.5 rounded-[7px] border border-[#2b3537] bg-[#1a2123] p-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-[#8b9bff18] text-blue">
            <Sparkles size={16} />
          </span>
          <div>
            <b className="block text-[12px]">PortfolioSignal</b>
            <small className="mt-0.5 block text-[11px] text-[#7e8989]">Ethereum Sepolia · source contract</small>
          </div>
        </div>
        <ol className="relative m-0 list-none p-0">
          {steps.map((step, index) => (
            <li key={step.title} className="relative mb-3 flex min-h-[42px] items-start gap-2.5">
              <div className={`z-[1] grid size-5 place-items-center rounded-full border bg-ink-2 text-[11px] ${step.waiting ? 'border-amber text-amber' : 'border-[#4c595c] text-[#798788]'}`}>
                {index + 1}
              </div>
              <div>
                <b className="block text-[12px]">{step.title}</b>
                <small className="mt-0.5 block text-[11px] text-[#778383]">{step.detail}</small>
              </div>
              {index < steps.length - 1 ? <div className="absolute top-5 left-[9px] h-[23px] w-px bg-[#344044]" /> : null}
            </li>
          ))}
        </ol>
        <div className="mt-1 flex items-start gap-2 border-t border-[#2b3436] pt-3 text-[12px] leading-relaxed text-[#798586]">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-lime-2" />
          <span>Nothing executes from a database claim. The Creditcoin contract must verify the Attestcoin proof first.</span>
        </div>
      </CardContent>
    </Card>
  );
}
