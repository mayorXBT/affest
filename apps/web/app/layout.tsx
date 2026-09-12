import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WalletProvider } from '@/lib/wallet';
import { appUrl } from '@/lib/public-config';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: 'Affest - verified cross-chain automation',
  description: 'Verified cross-chain automation for self-driving portfolios.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const theme = localStorage.getItem('affest.theme'); if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme; } catch {} })()`,
          }}
        />
      </head>
      <body>
        <WalletProvider>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
            <Toaster />
          </TooltipProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
