import type { ReactNode } from 'react';

export function DocsCallout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="docs-callout rounded-lg border px-4 py-3 text-[14px] leading-relaxed">
      <p className="mb-1 font-semibold">{title}</p>
      <div className="[&_a]:text-lime [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5">{children}</div>
    </aside>
  );
}
