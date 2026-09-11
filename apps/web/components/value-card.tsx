'use client';

import { Sparkline } from '@/components/sparkline';
import { Card, CardContent } from '@/components/ui/card';
import { formatUsd, usdFromAmount, useSpotPrices } from '@/lib/prices';
import { formatAmount, useCc3Holdings } from '@/lib/use-cc3';

export function ValueCard() {
  const holdings = useCc3Holdings();
  const prices = useSpotPrices();
  const totalUsd = (usdFromAmount(holdings.tctc + holdings.wrappedTctc + holdings.vaultTctc, prices.data?.ctcUsd ?? 0) ?? 0)
    + (usdFromAmount(holdings.eth + holdings.weth, prices.data?.ethUsd ?? 0) ?? 0);
  const spark = prices.data?.ethSpark ?? [];
  const dayReturn = spark.length > 24 && spark[spark.length - 25]
    ? spark[spark.length - 1]! / spark[spark.length - 25]! - 1
    : undefined;

  if (!holdings.isConnected) {
    return (
      <Card className="min-h-[194px] p-6">
        <div className="flex min-h-[145px] flex-col justify-center gap-2">
          <b className="text-[13px]">No wallet connected</b>
          <small className="text-[12px] leading-relaxed text-[#788484]">
            Connect a wallet to read TCTC on Creditcoin CC3 and ETH on Ethereum Sepolia.
          </small>
        </div>
      </Card>
    );
  }

  return (
    <Card className="min-h-[194px] p-6">
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] tracking-[0.12em] text-[#879293] uppercase">Total value</div>
            <div className="mt-3 text-[41px] leading-none font-semibold tracking-[-0.07em] tabular">
              {formatUsd(totalUsd)}
            </div>
            <small className={`mt-2 block text-[12px] ${dayReturn && dayReturn >= 0 ? 'text-[#8fef9a]' : 'text-[#f0b3a5]'}`}>
              {dayReturn === undefined ? 'ETH/CTC spot' : `${dayReturn >= 0 ? '+' : ''}${(dayReturn * 100).toFixed(2)}% 24h spot`}
            </small>
            <p className="mt-3 mb-0 text-[12px] text-[#7e8a89]">
              {formatAmount(holdings.tctc)} TCTC · {formatAmount(holdings.eth)} ETH
            </p>
          </div>
          <Sparkline
            values={spark}
            color="#7f92e6"
            fill="rgba(127,146,230,0.18)"
            width={280}
            height={96}
          />
        </div>
      </CardContent>
    </Card>
  );
}
