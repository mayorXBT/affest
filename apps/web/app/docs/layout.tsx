'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DocsSidebar } from '@/components/docs/docs-sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { docsPage } from '@/lib/docs';

export default function DocsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const page = docsPage(pathname);

  return (
    <SidebarProvider defaultOpen>
      <DocsSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 md:hidden" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/docs">{page.group}</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{page.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 md:p-10 md:pt-8">
          <article className="mx-auto w-full max-w-3xl">{children}</article>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
