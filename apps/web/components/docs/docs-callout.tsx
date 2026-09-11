import type { ReactNode } from 'react';

export function DocsCallout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="rounded-lg border border-[#5c4a2e] bg-[#2b2418] px-4 py-3 text-[14px] leading-relaxed text-[#e6d39a]">
      <p className="mb-1 font-semibold text-[#f5b96a]">{title}</p>
      <div className="[&_a]:text-lime [&_code]:rounded [&_code]:bg-[#1c1810] [&_code]:px-1.5 [&_code]:py-0.5">{children}</div>
    </aside>
  );
}
