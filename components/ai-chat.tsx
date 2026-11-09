'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Bot, User, Loader2, X, MessageCircle, Minimize2,
  RotateCcw, AlertTriangle, Copy, Check, Sparkles, ShieldAlert
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isEmergency?: boolean;
}

interface AiChatProps {
  mode: 'inline' | 'bubble';
  initialMessage?: string;
}

const SUGGESTED_QUESTIONS = [
  'What is the 20-20-20 rule?',
  'Why does screen time cause blurry vision?',
  'How does lack of sleep affect eye strain?',
  'How do I set optimal screen brightness?',
];

/**
 * Formats markdown-like text safely: renders emergency callouts, bold tags,
 * bullet lists, and paragraphs cleanly.
 */
function FormattedMessage({ content }: { content: string }) {
  const isEmergency = content.includes('[EMERGENCY CLINICAL NOTICE]');

  // If message contains an emergency alert, separate the alert header from the rest
  let alertText = '';
  let bodyText = content;

  if (isEmergency) {
    const parts = content.split('\n');
    const alertLines: string[] = [];
    const bodyLines: string[] = [];
    let capturingAlert = true;

    for (const line of parts) {
      if (capturingAlert) {
        alertLines.push(line);
        if (line.includes('cannot be evaluated by EyeGuard') || line.trim() === '') {
          capturingAlert = false;
        }
      } else {
        bodyLines.push(line);
      }
    }
    alertText = alertLines.join('\n').replace(/⚠️?\s*\[EMERGENCY CLINICAL NOTICE\]:?/, '').trim();
    bodyText = bodyLines.join('\n').trim();
  }

  const renderFormattedLines = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-1.5" />;

      // Bullet points
      const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
      const cleanLine = isBullet ? trimmed.replace(/^[•\-*]\s*/, '') : trimmed;

      // Parse bold segments **word**
      const segments = cleanLine.split(/(\*\*.*?\*\*)/g);
      const parsedContent = segments.map((seg, sIdx) => {
        if (seg.startsWith('**') && seg.endsWith('**')) {
          return <strong key={sIdx} className="font-semibold text-foreground">{seg.slice(2, -2)}</strong>;
        }
        return seg;
      });

      if (isBullet) {
        return (
          <div key={idx} className="flex items-start gap-2 pl-1 my-1">
            <span className="text-[#f97316] font-bold text-xs select-none mt-0.5">•</span>
            <span className="flex-1">{parsedContent}</span>
          </div>
        );
      }

      return (
        <p key={idx} className="mb-1.5 last:mb-0">
          {parsedContent}
        </p>
      );
    });
  };

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {/* Emergency Red Flag Notice Banner */}
      {isEmergency && (
        <div className="p-3.5 rounded-xl bg-red-500/15 border-2 border-red-500/40 text-red-200 text-xs space-y-1.5 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-red-400 uppercase tracking-wide text-[11px]">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>Emergency Clinical Triage Notice</span>
          </div>
          <p className="leading-relaxed text-red-100 font-medium">
            {alertText || 'This symptom requires immediate emergency medical evaluation by an eye care specialist or hospital ER.'}
          </p>
        </div>
      )}

      {/* Main body text */}
      {bodyText && <div>{renderFormattedLines(bodyText)}</div>}
    </div>
  );
}

export function AiChat({ mode, initialMessage }: AiChatProps) {
  const supabase = createClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const defaultMsg: Message = {
    role: 'assistant',
    content:
      initialMessage ??
      "Hi! I'm EyeGuard AI 👋 I'm your evidence-based eye wellness companion. Ask me anything about your digital eye strain, ergonomic setup, or the 20-20-20 rule.",
  };

  const [messages, setMessages] = useState<Message[]>([defaultMsg]);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevUserRef = useRef<string | null>(null);

  // Clean up legacy unkeyed session key on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('eyeguard_user_chat_session');
    }
  }, []);

  // Monitor active user account
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const uid = user?.id ?? 'guest';
      setCurrentUserId(uid);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? 'guest';
      setCurrentUserId(uid);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Account switch detection: reload user-specific chat or reset when user changes
  useEffect(() => {
    if (!currentUserId || typeof window === 'undefined') return;

    const storageKey = `eyeguard_chat_${currentUserId}`;

    if (prevUserRef.current !== null && prevUserRef.current !== currentUserId) {
      // Switched accounts! Reset and load the new user's chat session
      try {
        const userSaved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
        setMessages(userSaved?.messages?.length ? userSaved.messages : [defaultMsg]);
        if (mode === 'bubble') {
          setIsOpen(Boolean(userSaved?.isOpen));
        }
      } catch {
        setMessages([defaultMsg]);
      }
    } else if (prevUserRef.current === null) {
      // First resolved user
      try {
        const userSaved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
        if (userSaved?.messages?.length) {
          setMessages(userSaved.messages);
        }
        if (mode === 'bubble' && userSaved?.isOpen != null) {
          setIsOpen(Boolean(userSaved.isOpen));
        }
      } catch {
        /* ignore */
      }
    }

    prevUserRef.current = currentUserId;
  }, [currentUserId, defaultMsg, mode]);

  // Sync state to user-specific sessionStorage key
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUserId) return;
    try {
      const storageKey = `eyeguard_chat_${currentUserId}`;
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          userId: currentUserId,
          messages,
          isOpen: mode === 'bubble' ? isOpen : false,
        })
      );
    } catch {
      /* storage quota exceeded - ignore */
    }
  }, [messages, isOpen, mode, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (mode === 'bubble' && isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  const clearChat = useCallback(() => {
    setMessages([defaultMsg]);
    if (typeof window !== 'undefined' && currentUserId) {
      try {
        sessionStorage.removeItem(`eyeguard_chat_${currentUserId}`);
      } catch {
        /* ignore */
      }
    }
  }, [defaultMsg, currentUserId]);

  const copyToClipboard = (text: string, index: number) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1800);
    }
  };

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: messages }),
      });
      const data = await res.json();
      const reply = data.reply ?? (data.error ? `Error: ${data.error}` : 'Sorry, something went wrong.');
      const isEmergency = Boolean(data.isEmergency || reply.includes('[EMERGENCY CLINICAL NOTICE]'));

      setMessages([...newMessages, { role: 'assistant', content: reply, isEmergency }]);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  /* ── Shared chat body ── */
  const ChatBody = (
    <div className="flex flex-col h-full bg-[#120b06]/60">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} group`}>
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs mt-0.5 ${
              msg.role === 'assistant'
                ? 'bg-[#f97316]/20 text-[#f97316]'
                : 'bg-[#fff7ed]/10 text-[#fff7ed]/60'
            }`}>
              {msg.role === 'assistant' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            </div>

            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed relative ${
              msg.role === 'assistant'
                ? msg.isEmergency
                  ? 'bg-red-950/20 text-[#fff7ed]/90 rounded-tl-sm border border-red-500/30 shadow-lg shadow-red-950/20'
                  : 'bg-[#f97316]/8 text-[#fff7ed]/85 rounded-tl-sm border border-[#f97316]/12 shadow-sm'
                : 'bg-[#f97316] text-[#0f0a07] rounded-tr-sm font-medium'
            }`}>
              {msg.role === 'assistant' ? (
                <>
                  <FormattedMessage content={msg.content} />
                  {/* Action row on hover */}
                  <div className="flex items-center justify-end gap-2 mt-2 pt-1 border-t border-[#f97316]/10 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => copyToClipboard(msg.content, i)}
                      title="Copy response"
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-[#fff7ed]/5"
                    >
                      {copiedIndex === i ? (
                        <>
                          <Check className="w-3 h-3 text-green-400" />
                          <span className="text-green-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#f97316]/20 text-[#f97316] flex items-center justify-center">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-[#f97316]/8 border border-[#f97316]/10 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f97316]/70" />
              <span className="text-xs text-[#fff7ed]/50 font-medium">Analyzing with EyeGuard Clinical Engine…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#f97316]" />
            Suggested Questions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-[#f97316]/15 bg-[#f97316]/5 hover:bg-[#f97316]/15 transition-colors text-[#fff7ed]/70 hover:text-[#fff7ed] text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-[#f97316]/12 bg-background/50">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about eye health, 20-20-20…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-[#f97316]/15 bg-[#fff7ed]/5 px-3.5 py-2.5 text-sm text-[#fff7ed] placeholder:text-[#fff7ed]/30 focus:outline-none focus:ring-2 focus:ring-[#f97316]/40 max-h-28 overflow-y-auto"
            style={{ minHeight: '40px' }}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            aria-label="Send"
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#f97316] text-[#0f0a07] flex items-center justify-center hover:bg-[#fb923c] transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center flex items-center justify-center gap-1">
          <AlertTriangle className="w-3 h-3 text-muted-foreground/60 shrink-0" />
          <span>Informational triage only — not a substitute for clinical optometric examination.</span>
        </p>
      </div>
    </div>
  );

  /* ── INLINE MODE ── */
  if (mode === 'inline') {
    return (
      <div className="border border-[#f97316]/15 bg-[#f97316]/[0.03] rounded-2xl overflow-hidden flex flex-col h-full min-h-[520px]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#f97316]/12 bg-[#f97316]/5">
          <div className="w-8 h-8 rounded-full bg-[#f97316]/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-[#f97316]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">EyeGuard Clinical AI</p>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20">
                AOA Guidelines
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Digital eye strain triage companion</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={clearChat}
              title="Reset conversation"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded-lg border border-border hover:bg-muted"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
        {ChatBody}
      </div>
    );
  }

  /* ── BUBBLE MODE ── */
  return (
    <>
      {/* Chat popup */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-5 z-50 w-[380px] max-w-[calc(100vw-2.5rem)] h-[540px] max-h-[calc(100vh-6rem)] bg-[#140c06] border border-[#f97316]/25 rounded-2xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden"
          role="dialog"
          aria-label="EyeGuard AI chat"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#f97316]/12 bg-[#f97316]/5 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#f97316]/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-[#f97316]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#fff7ed]">EyeGuard AI</p>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                  Triage
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[10px] text-[#fff7ed]/50">Online · Eye health assistant</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={clearChat}
                title="Reset conversation"
                className="p-1.5 hover:bg-[#fff7ed]/5 rounded-lg transition-colors text-[#fff7ed]/40 hover:text-[#fff7ed]/70"
                aria-label="Reset chat"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="p-1.5 hover:bg-[#fff7ed]/5 rounded-lg transition-colors text-[#fff7ed]/40 hover:text-[#fff7ed]/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {ChatBody}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label={isOpen ? 'Close AI chat' : 'Open AI chat'}
        className="fixed bottom-5 right-5 z-50 flex items-center justify-center w-13 h-13 rounded-full bg-gradient-to-br from-[#f97316] to-[#fb923c] text-[#0f0a07] shadow-lg shadow-[#f97316]/30 hover:opacity-90 hover:-translate-y-0.5 active:scale-95 transition-all"
        style={{ width: '52px', height: '52px' }}
      >
        {isOpen
          ? <Minimize2 className="w-5 h-5" />
          : <MessageCircle className="w-5 h-5" />}
        {/* online dot */}
        {!isOpen && (
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#0f0a07]" />
        )}
      </button>
    </>
  );
}
