import { IndianRupee, Wifi } from 'lucide-react';
import { AnimatedMoney } from '@/components/common/AnimatedMoney';

// The big "bank card" on the dashboard: emerald gradient, gold chip, total balance.
export function BalanceCard({ balance, walletCount }) {
  return (
    <div className="relative h-full min-h-48 overflow-hidden rounded-2xl bg-linear-to-br from-[oklch(0.42_0.1_164)] via-[oklch(0.33_0.08_168)] to-[oklch(0.22_0.05_172)] p-6 text-white shadow-xl shadow-primary/25 ring-1 ring-white/10">
      {/* Soft light shapes, like the pattern on a premium card. */}
      <div
        className="absolute -top-16 -right-10 size-56 rounded-full bg-white/10 blur-2xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-20 -left-10 size-56 rounded-full bg-[oklch(0.8_0.14_82/30%)] blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex h-full flex-col justify-between gap-8">
        <div className="flex items-center justify-between">
          {/* Gold chip */}
          <div
            className="h-8 w-11 rounded-md bg-linear-to-br from-[oklch(0.9_0.1_90)] to-[oklch(0.7_0.14_70)] shadow-inner ring-1 ring-black/10"
            aria-hidden="true"
          />
          <Wifi className="size-5 rotate-90 text-white/70" aria-hidden="true" />
        </div>

        <div>
          <p className="text-sm text-white/70">Total balance</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">
            <AnimatedMoney paise={balance} />
          </p>
          <p className="mt-1 text-sm text-white/70">
            Across {walletCount} {walletCount === 1 ? 'wallet' : 'wallets'}
          </p>
        </div>

        <div className="flex items-center justify-between text-sm text-white/80">
          <span className="tracking-[0.3em]">•••• PAISA PAL</span>
          <IndianRupee className="size-5 text-[oklch(0.86_0.13_85)]" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
