import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WalletProvider } from '@/lib/wallet';

export const metadata: Metadata = {
  title: 'Affest - verified cross-chain automation',
  description: 'Verified cross-chain automation for self-driving portfolios.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
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
