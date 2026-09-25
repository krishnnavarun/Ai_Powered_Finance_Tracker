import { EllipsisVertical, Minus, Pause, Pencil, Play, Plus, Trash2, Trophy } from 'lucide-react';
import { m } from 'motion/react';
import { Money } from '@/components/common/Money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatMonth } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { ProgressRing } from './ProgressRing';

// One plain sentence about where the goal stands.
function goalMessage(goal) {
  const { progress, status, deadline } = goal;
  if (status === 'done') return 'Goal reached — well done!';
  if (status === 'paused') return `Paused · ${formatMoney(progress.remaining)} to go`;
  if (progress.overdue) return `The date has passed · ${formatMoney(progress.remaining)} to go`;
  if (progress.requiredPerMonth) {
    return `Save ${formatMoney(progress.requiredPerMonth)} a month to reach it by ${formatMonth(deadline.slice(0, 7), { long: true })}`;
  }
  return `${formatMoney(progress.remaining)} to go`;
}

export function GoalCard({ goal, index = 0, onAdd, onWithdraw, onEdit, onTogglePause, onDelete }) {
  const done = goal.status === 'done';

  return (
    <m.article
      aria-label={goal.name}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: goal.status === 'paused' ? 0.7 : 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.06, 0.3), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className="surface relative flex flex-col gap-4 overflow-hidden p-5 transition-shadow hover:shadow-lg"
    >
      {/* A thin strip in the goal's colour along the top edge. */}
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: goal.color }}
        aria-hidden="true"
      />

      <div className="flex items-start gap-4">
        <ProgressRing percent={goal.progress.percent} done={done} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold">{goal.name}</h2>
            {done && (
              <Badge className="bg-gold text-gold-foreground">
                <Trophy aria-hidden="true" />
                Done
              </Badge>
            )}
            {goal.status === 'paused' && <Badge variant="secondary">Paused</Badge>}
          </div>
          <p className="mt-1 text-sm">
            <Money paise={goal.savedAmount} className="font-semibold" />
            <span className="text-muted-foreground"> of </span>
            <Money paise={goal.targetAmount} className="text-muted-foreground" />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{goalMessage(goal)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${goal.name}`}>
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onWithdraw(goal)} disabled={goal.savedAmount === 0}>
              <Minus aria-hidden="true" />
              Take money out
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(goal)}>
              <Pencil aria-hidden="true" />
              Edit
            </DropdownMenuItem>
            {!done && (
              <DropdownMenuItem onSelect={() => onTogglePause(goal)}>
                {goal.status === 'paused' ? (
                  <Play aria-hidden="true" />
                ) : (
                  <Pause aria-hidden="true" />
                )}
                {goal.status === 'paused' ? 'Resume' : 'Pause'}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(goal)}>
              <Trash2 aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!done && (
        <Button variant="outline" className="w-full" onClick={() => onAdd(goal)}>
          <Plus aria-hidden="true" />
          Add money
        </Button>
      )}
    </m.article>
  );
}
