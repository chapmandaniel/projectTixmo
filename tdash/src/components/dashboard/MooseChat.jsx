import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { DashboardButton, DashboardSurface, DashboardTextInput } from './DashboardPrimitives';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';

const defaultTypingDelay = () => (import.meta.env.MODE === 'test' ? 0 : 550);

export const MooseChat = ({
    isDark,
    data,
    askQuestion,
    suggestions = [],
    welcomeText,
    resetKey,
    typingDelay,
    className,
}) => {
    const theme = getDashboardTheme(isDark);
    const delay = typingDelay ?? defaultTypingDelay();
    const welcome = useMemo(
        () => ({
            id: 'welcome',
            role: 'moose',
            text: welcomeText,
        }),
        [welcomeText]
    );

    const [messages, setMessages] = useState([welcome]);
    const [draft, setDraft] = useState('');
    const [pending, setPending] = useState(false);
    const listRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        setMessages([welcome]);
        setDraft('');
        setPending(false);
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, [resetKey, welcome]);

    useEffect(() => () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
    }, []);

    useEffect(() => {
        const node = listRef.current;
        if (node) node.scrollTop = node.scrollHeight;
    }, [messages, pending]);

    const ask = (question) => {
        const text = String(question || '').trim();
        if (!text || pending) return;
        const userId = `user-${Date.now()}`;
        setMessages((current) => [...current, { id: userId, role: 'user', text }]);
        setDraft('');
        setPending(true);
        const reply = askQuestion(text, data);
        const deliver = () => {
            setMessages((current) => [...current, { id: `moose-${Date.now()}`, role: 'moose', text: reply }]);
            setPending(false);
            timerRef.current = null;
        };
        if (delay <= 0) {
            deliver();
            return;
        }
        timerRef.current = window.setTimeout(deliver, delay);
    };

    const onSubmit = (event) => {
        event.preventDefault();
        ask(draft);
    };

    return (
        <DashboardSurface
            isDark={isDark}
            accent="brand"
            className={cn('flex h-[400px] flex-col overflow-hidden p-4 lg:h-full lg:min-h-0', className)}
            data-testid="moose-chat"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-md', isDark ? 'bg-pink-400/15 text-pink-300' : 'bg-pink-50 text-pink-600')}>
                        <Sparkles size={18} />
                    </span>
                    <div>
                        <h2 className={cn('text-sm font-light', theme.textPrimary)}>Moose</h2>
                        <p className={cn('text-xs font-light', theme.textMuted)}>Tixmo's AI assistant</p>
                    </div>
                </div>
            </div>

            <div
                ref={listRef}
                className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
                data-testid="moose-messages"
            >
                {messages.map((message) => (
                    <div
                        key={message.id}
                        data-testid={`moose-message-${message.role}`}
                        className={cn(
                            'max-w-[95%] rounded-md px-3 py-2 text-sm font-light leading-6',
                            message.role === 'user'
                                ? (isDark ? 'ml-auto bg-pink-400/15 text-zinc-100' : 'ml-auto bg-pink-50 text-slate-800')
                                : (isDark ? 'bg-white/5 text-zinc-200' : 'bg-slate-50 text-slate-700')
                        )}
                    >
                        {message.text}
                    </div>
                ))}
                {pending ? (
                    <p className={cn('text-xs font-light', theme.textMuted)} data-testid="moose-typing">
                        Moose is looking at the numbers...
                    </p>
                ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2" data-testid="moose-suggestions">
                {suggestions.map((question) => (
                    <button
                        key={question}
                        type="button"
                        className={cn(
                            'rounded-full border px-2.5 py-1 text-left text-[11px] font-light transition-colors',
                            isDark
                                ? 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        )}
                        disabled={pending}
                        onClick={() => ask(question)}
                    >
                        {question}
                    </button>
                ))}
            </div>

            <form className="mt-3 flex items-center gap-2" onSubmit={onSubmit} data-testid="moose-form">
                <DashboardTextInput
                    isDark={isDark}
                    className="h-10"
                    value={draft}
                    disabled={pending}
                    placeholder="Ask Moose about these numbers"
                    aria-label="Ask Moose about these numbers"
                    onChange={(event) => setDraft(event.target.value)}
                />
                <DashboardButton
                    isDark={isDark}
                    variant="primary"
                    className="h-10 shrink-0 px-3 py-0"
                    disabled={pending || !draft.trim()}
                    aria-label="Send question"
                >
                    <Send size={15} />
                </DashboardButton>
            </form>
        </DashboardSurface>
    );
};

export default MooseChat;
