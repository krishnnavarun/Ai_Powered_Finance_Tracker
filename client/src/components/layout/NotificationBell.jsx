import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import * as notificationsApi from '@/api/notifications';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, useTimeZone } from '@/lib/dates';
import { cn } from '@/lib/utils';

const KEY = ['notifications'];

// The bell in the top bar: budget alerts, warnings and the weekly digest.
// Checks for new ones every minute while the app is open.
export function NotificationBell() {
  const timeZone = useTimeZone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: notificationsApi.listNotifications,
    refetchInterval: 60_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const markRead = useMutation({
    mutationFn: notificationsApi.markNotificationRead,
    onSuccess: refresh,
  });
  const markAll = useMutation({
    mutationFn: notificationsApi.markAllNotificationsRead,
    onSuccess: refresh,
  });

  const unread = data?.unread ?? 0;
  const list = data?.notifications ?? [];

  const open = (notification) => {
    if (!notification.read) markRead.mutate(notification.id);
    if (notification.link) navigate(notification.link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell aria-hidden="true" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] leading-4 font-semibold text-gold-foreground"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unread > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                markAll.mutate();
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {list.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nothing yet. Budget alerts and your weekly summary show up here.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {list.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onSelect={() => open(notification)}
                className="flex items-start gap-2 py-2"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    notification.read ? 'bg-transparent' : 'bg-primary',
                  )}
                />
                <span className="min-w-0">
                  <span className={cn('block text-sm', !notification.read && 'font-medium')}>
                    {notification.title}
                    {!notification.read && <span className="sr-only"> (unread)</span>}
                  </span>
                  {notification.body && (
                    <span className="line-clamp-2 block text-xs text-muted-foreground">
                      {notification.body}
                    </span>
                  )}
                  <span className="block text-[11px] text-muted-foreground">
                    {formatDate(notification.createdAt, timeZone)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
