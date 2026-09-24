import { Archive, ArchiveRestore, EllipsisVertical, Pencil, Trash2 } from 'lucide-react';
import { m } from 'motion/react';
import { AnimatedMoney } from '@/components/common/AnimatedMoney';
import { Money } from '@/components/common/Money';
import { NamedIcon } from '@/components/common/NamedIcon';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { walletTypeLabel } from './walletTypes';

// A wallet drawn as a bank card: gradient in the wallet's colour, gold chip, balance.
export function WalletCard({ wallet, index = 0, onEdit, onToggleArchive, onDelete }) {
  const isCard = wallet.type === 'card';
  const available =
    isCard && wallet.creditLimit !== null ? wallet.creditLimit + wallet.balance : null;
  const owes = wallet.balance < 0;

  return (
    <m.article
      aria-label={wallet.name}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: wallet.isArchived ? 0.55 : 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.06, 0.4), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, rotateX: 4 }}
      style={{
        background: `linear-gradient(135deg, ${wallet.color}, color-mix(in oklab, ${wallet.color} 55%, black))`,
        transformPerspective: 800,
      }}
      className="relative flex min-h-44 flex-col justify-between gap-5 overflow-hidden rounded-2xl p-5 text-white shadow-lg ring-1 ring-white/10 transition-shadow hover:shadow-2xl"
    >
      {/* Light shapes for a printed-card look */}
      <div
        className="absolute -top-12 -right-12 size-40 rounded-full bg-white/12 blur-xl"
        aria-hidden="true"
      />
      <div
        className="absolute right-6 -bottom-16 size-40 rounded-full border-[18px] border-white/6"
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
          <NamedIcon name={wallet.icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{wallet.name}</h2>
          <p className="text-xs text-white/75">
            {walletTypeLabel(wallet.type)}
            {wallet.isArchived && ' · Archived'}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/15 hover:text-white"
              aria-label={`Actions for ${wallet.name}`}
            >
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(wallet)}>
              <Pencil aria-hidden="true" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onToggleArchive(wallet)}>
              {wallet.isArchived ? (
                <ArchiveRestore aria-hidden="true" />
              ) : (
                <Archive aria-hidden="true" />
              )}
              {wallet.isArchived ? 'Restore' : 'Archive'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(wallet)}>
              <Trash2 aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-white/75">{isCard && owes ? 'You owe' : 'Balance'}</p>
          <p className={cn('text-2xl font-semibold', owes && !isCard && 'text-red-100')}>
            <AnimatedMoney paise={wallet.balance} />
          </p>
          {available !== null && (
            <p className="mt-1 text-xs text-white/75">
              <Money paise={available} /> available of <Money paise={wallet.creditLimit} />
            </p>
          )}
        </div>
        {/* Gold chip */}
        <span
          className="h-7 w-10 shrink-0 rounded-md bg-linear-to-br from-[oklch(0.9_0.1_90)] to-[oklch(0.7_0.14_70)] shadow-inner ring-1 ring-black/10"
          aria-hidden="true"
        />
      </div>
    </m.article>
  );
}
