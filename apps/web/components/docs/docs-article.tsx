import type { ReactNode } from 'react';

export function DocsArticle({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <div className="docs-prose">
      <h1 className="mt-2 mb-3 text-[32px] font-semibold tracking-[-0.05em]">{title}</h1>
      {lede ? <p className="mb-6 text-[16px] leading-relaxed text-muted">{lede}</p> : null}
      <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-docs-body [&_a]:text-lime [&_a]:underline-offset-2 hover:[&_a]:underline [&_code]:rounded [&_code]:bg-ink-3 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:text-paper [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-paper [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[14px] [&_th]:border-b [&_th]:border-line [&_th]:pb-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold [&_th]:text-paper [&_td]:border-b [&_td]:border-line [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-line [&_pre]:bg-ink-3 [&_pre]:p-4 [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_dt]:mt-3 [&_dt]:font-semibold [&_dt]:text-paper [&_dd]:mt-1">
        {children}
      </div>
    </div>
  );
}
