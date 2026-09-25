import {
  ArrowUp,
  LoaderCircle,
  MessageSquarePlus,
  MessagesSquare,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { createSession } from '@/api/chat';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { FormAlert } from '@/components/common/FormAlert';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChatChart } from '@/features/assistant/ChatChart';
import { MessageText } from '@/features/assistant/MessageText';
import {
  toolLabel,
  useAskAssistant,
  useChatSession,
  useChatSessions,
  useDeleteChat,
} from '@/features/assistant/useChat';
import { useAiStatus } from '@/features/capture/useCapture';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Where did most of my money go this month?',
  'Compare food spending with last month',
  'Can I afford a ₹15,000 phone this month?',
  'How can I save ₹3,000 more?',
];

function Bubble({ role, children }) {
  const mine = role === 'user';
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex', mine ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[min(42rem,90%)] rounded-2xl px-4 py-3',
          mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'surface rounded-bl-md',
        )}
      >
        {children}
      </div>
    </m.div>
  );
}

function Steps({ steps, done }) {
  if (!steps.length) return null;
  return (
    <ul
      className="mb-2 grid gap-1 text-xs text-muted-foreground"
      aria-label="What the assistant looked at"
    >
      {steps.map((name, i) => (
        <li key={`${name}-${i}`} className="flex items-center gap-1.5">
          {done || i < steps.length - 1 ? (
            <Sparkles className="size-3 text-gold" aria-hidden="true" />
          ) : (
            <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
          )}
          {toolLabel(name)}
        </li>
      ))}
    </ul>
  );
}

function Composer({ onSend, busy, onStop, disabled }) {
  const [text, setText] = useState('');
  const submit = (event) => {
    event.preventDefault();
    const question = text.trim();
    if (!question || busy) return;
    onSend(question);
    setText('');
  };
  return (
    <form onSubmit={submit} className="surface flex items-end gap-2 p-2">
      <Textarea
        aria-label="Ask about your money"
        value={text}
        rows={1}
        maxLength={1000}
        disabled={disabled}
        placeholder="Ask about your money…"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) submit(event);
        }}
        className="max-h-40 min-h-10 resize-none border-none bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      {busy ? (
        <Button type="button" size="icon" variant="outline" onClick={onStop} aria-label="Stop">
          <Square aria-hidden="true" />
        </Button>
      ) : (
        <Button type="submit" size="icon" disabled={!text.trim() || disabled} aria-label="Send">
          <ArrowUp aria-hidden="true" />
        </Button>
      )}
    </form>
  );
}

export function AssistantPage() {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('chat');
  const { data: ai } = useAiStatus();
  const aiReady = ai ? ai.enabled && ai.configured : true;
  const { data: sessions = [] } = useChatSessions();
  const { data: conversation, isPending: loadingChat } = useChatSession(sessionId);
  const removeChat = useDeleteChat();
  const { ask, pending, error, stop, clearError } = useAskAssistant();
  const [deleting, setDeleting] = useState(null);
  const bottomRef = useRef(null);

  const messages = conversation?.messages ?? [];
  const showPending = pending && pending.sessionId === sessionId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, pending?.text, pending?.steps.length]);

  const openChat = (id) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set('chat', id);
      else next.delete('chat');
      return next;
    });

  const send = async (question) => {
    clearError();
    let id = sessionId;
    if (!id) {
      try {
        id = (await createSession()).id;
      } catch (err) {
        toast.error(err.message);
        return;
      }
      openChat(id);
    }
    ask(id, question);
  };

  const confirmDelete = () =>
    removeChat.mutate(deleting.id, {
      onSuccess: () => {
        if (deleting.id === sessionId) openChat(null);
        toast.success('Chat deleted');
      },
      onError: (err) => toast.error(err.message),
      onSettled: () => setDeleting(null),
    });

  return (
    <>
      <PageHeader
        title="Assistant"
        description="Ask about your money in plain words"
        actions={
          <Button variant="outline" onClick={() => openChat(null)} disabled={!sessionId}>
            <MessageSquarePlus aria-hidden="true" />
            New chat
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
        <nav
          aria-label="Chats"
          className="surface hidden min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1 p-2 lg:grid"
        >
          {sessions.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">Your chats will show up here.</p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'group flex min-w-0 items-center rounded-lg text-sm hover:bg-muted/70',
                  s.id === sessionId && 'bg-primary/10 font-medium text-foreground',
                )}
              >
                <button
                  type="button"
                  onClick={() => openChat(s.id)}
                  aria-current={s.id === sessionId ? 'page' : undefined}
                  className="min-w-0 flex-1 truncate px-2.5 py-2 text-left"
                >
                  {s.title}
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete chat "${s.title}"`}
                  onClick={() => setDeleting(s)}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))
          )}
        </nav>

        <section aria-label="Conversation" className="flex min-h-[60vh] flex-col gap-4">
          {!aiReady && (
            <FormAlert tone="info">
              {ai?.configured
                ? 'The assistant uses AI, which is turned off. '
                : 'AI isn’t set up on this server yet, so the assistant can’t answer. '}
              {ai?.configured && (
                <Link to="/settings" className="font-medium underline">
                  Turn it on in Settings.
                </Link>
              )}
            </FormAlert>
          )}

          <div className="flex flex-1 flex-col gap-3" aria-live="polite">
            {!sessionId && !showPending ? (
              <EmptyState
                icon={MessagesSquare}
                title="Ask me anything about your money"
                description="I look at your own payments, budgets and goals to answer. I can’t change anything."
                action={
                  <div className="flex max-w-xl flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        disabled={!aiReady}
                        onClick={() => send(question)}
                        className="rounded-full border bg-background/60 px-3 py-1.5 text-sm transition-all duration-200 hover:-translate-y-px hover:border-primary/40 active:scale-95 disabled:opacity-50"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                }
              />
            ) : loadingChat && !showPending ? (
              <LoaderCircle
                className="mx-auto my-10 size-6 animate-spin text-primary"
                aria-label="Loading chat"
              />
            ) : (
              <>
                {messages.map((message) => (
                  <Bubble key={message.id} role={message.role}>
                    {message.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <>
                        <MessageText text={message.content} />
                        <ChatChart chart={message.chart} />
                      </>
                    )}
                  </Bubble>
                ))}
                <AnimatePresence>
                  {showPending && (
                    <>
                      {/* A new chat may load with the question already saved; don't show it twice. */}
                      {!(
                        messages.at(-1)?.role === 'user' &&
                        messages.at(-1)?.content === pending.question
                      ) && (
                        <Bubble role="user">
                          <p className="text-sm whitespace-pre-wrap">{pending.question}</p>
                        </Bubble>
                      )}
                      <Bubble role="assistant">
                        <Steps steps={pending.steps} done={Boolean(pending.text)} />
                        {pending.text ? (
                          <MessageText text={pending.text} />
                        ) : (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                            Thinking…
                          </p>
                        )}
                        <ChatChart chart={pending.chart} />
                      </Bubble>
                    </>
                  )}
                </AnimatePresence>
              </>
            )}
            <div ref={bottomRef} />
          </div>

          <FormAlert>{error?.message}</FormAlert>
          <Composer onSend={send} busy={Boolean(pending)} onStop={stop} disabled={!aiReady} />
          <p className="text-center text-xs text-muted-foreground">
            Answers come from your own data. They’re not financial advice.
          </p>
        </section>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.title}"?`}
        description="The whole conversation is removed."
        pending={removeChat.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
