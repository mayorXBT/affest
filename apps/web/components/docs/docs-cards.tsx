import type { ReactNode } from 'react';
import Link from 'next/link';

export function DocsCards({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function DocsCard({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-line bg-ink-2 p-4 no-underline transition-colors hover:border-lime/40 hover:[&_span]:no-underline"
    >
      <span className="block text-[15px] font-semibold text-paper">{title}</span>
      <span className="mt-1 block text-[13px] leading-relaxed text-docs-body">{children}</span>
    </Link>
  );
}
