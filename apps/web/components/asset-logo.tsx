'use client';

type LogoKind = 'TCTC' | 'ETH' | 'WTCTC' | 'WETH';

export function AssetLogo({ kind, size = 28 }: { kind: LogoKind; size?: number }) {
  if (kind === 'ETH' || kind === 'WETH') {
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-[#627eea]" style={{ width: size, height: size }} aria-hidden="true">
        <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 32 32" fill="none">
          <path d="M16 3.2 15.6 4.5v16.4L16 21.3l7.4-4.4L16 3.2Z" fill="#fff" fillOpacity="0.85" />
          <path d="M16 3.2 8.6 16.9 16 21.3V3.2Z" fill="#fff" />
          <path d="M16 23.1 15.8 23.4v5.1L16 29.2l7.4-10.4L16 23.1Z" fill="#fff" fillOpacity="0.85" />
          <path d="M16 29.2v-6.1l-7.4-4.3L16 29.2Z" fill="#fff" />
          <path d="M16 21.3 23.4 16.9 16 13.7v7.6Z" fill="#fff" fillOpacity="0.6" />
          <path d="M8.6 16.9 16 21.3V13.7L8.6 16.9Z" fill="#fff" fillOpacity="0.8" />
        </svg>
      </span>
    );
  }

  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-[#d6f26a]" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" fill="none">
        <path d="M16 4 6 10v12l10 6 10-6V10L16 4Z" stroke="#101410" strokeWidth="2.2" />
        <path d="M16 10v12M10.5 13.2 16 16.4l5.5-3.2" stroke="#101410" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
