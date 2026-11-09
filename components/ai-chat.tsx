'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, X, MessageCircle, Minimize2, RotateCcw } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatProps {
  mode: 'inline' | 'bubble';
  initialMessage?: string;
}

const SUGGESTED_QUESTIONS = [
  'What is the 20-20-20 rule?',
  'How can I reduce eye strain?',
  'Is my screen time too high?',
  'How does sleep affect eye health?',
];

const STORAGE_KEY = 'eyeguard_user_chat_session';

export function AiChat({ mode, initialMessage }: AiChatProps) {
  const defaultMsg: Message = {
    role: 'assistant',
    content:
      initialMessage ??
      "Hi! I'm EyeGuard AI 👋 I can answer your eye health questions and give personalised advice based on your data. What would you like to know?",
  };

  // Restore conversation from sessionStorage
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [defaultMsg];
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
      return saved?.messages?.length ? saved.messages : [defaultMsg];
    } catch {
      return [defaultMsg];
    }
  });

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (mode !== 'bubble' || typeof window === 'undefined') return false;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
      return Boolean(saved?.isOpen);
    } catch {
      return false;
    }
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync state to sessionStorage whenever messages or isOpen changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          messages,
          isOpen: mode === 'bubble' ? isOpen : false,
        })
      );
    } catch {
      /* storage quota exceeded - ignore */
    }
  }, [messages, isOpen, mode]);

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
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            messages: [defaultMsg],
            isOpen: mode === 'bubble' ? isOpen : false,
          })
        );
      } catch {
        /* ignore */
      }
    }
  }, [defaultMsg, isOpen, mode]);

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
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
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
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs ${
              msg.role === 'assistant'
                ? 'bg-[#f97316]/20 text-[#f97316]'
                : 'bg-[#fff7ed]/10 text-[#fff7ed]/60'
            }`}>
              {msg.role === 'assistant' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            </div>
            <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === 'assistant'
                ? 'bg-[#f97316]/8 text-[#fff7ed]/85 rounded-tl-sm border border-[#f97316]/10'
                : 'bg-[#f97316] text-[#0f0a07] rounded-tr-sm font-medium'
            }`}>
              {msg.role === 'assistant'
                ? msg.content
                    .replace(/^#{1,6}\s+/gm, '')         // strip # headings
                    .replace(/\*\*(.+?)\*\*/g, '$1')     // strip **bold**
                    .replace(/\*(.+?)\*/g, '$1')          // strip *italic*
                    .replace(/^[-•]\s+/gm, '• ')         // normalise bullets
                    .replace(/---+/g, '')                 // strip dividers
                    .trim()
                    .split('\n')
                    .filter(line => line.trim() !== '')
                    .map((line, idx, arr) => (
                      <span key={idx} className={`block ${idx < arr.length - 1 ? 'mb-1' : ''}`}>
                        {line}
                      </span>
                    ))
                : msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#f97316]/20 text-[#f97316] flex items-center justify-center">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-[#f97316]/8 border border-[#f97316]/10 rounded-2xl rounded-tl-sm px-3.5 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f97316]/60" />
              <span className="text-xs text-[#fff7ed]/40">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-xs px-3 py-1.5 rounded-full border border-[#f97316]/15 bg-[#f97316]/5 hover:bg-[#f97316]/15 transition-colors text-[#fff7ed]/55 hover:text-[#fff7ed]"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-[#f97316]/12">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about eye health…"
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
        <p className="text-[10px] text-[#fff7ed]/25 mt-2 text-center">
          AI advice is informational only — not a substitute for medical care.
        </p>
      </div>
    </div>
  );

  /* ── INLINE MODE ── */
  if (mode === 'inline') {
    return (
      <div className="border border-[#f97316]/15 bg-[#f97316]/[0.03] rounded-xl overflow-hidden flex flex-col h-[480px]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f97316]/12 bg-[#f97316]/5">
          <div className="w-8 h-8 rounded-full bg-[#f97316]/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-[#f97316]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">EyeGuard AI</p>
            <p className="text-xs text-[#fff7ed]/40">Eye health assistant</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={clearChat}
              title="Reset conversation"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md border border-border hover:bg-muted"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs text-[#fff7ed]/40">Online</span>
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
          className="fixed bottom-20 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] h-[520px] max-h-[calc(100vh-6rem)] bg-[#1a1008] border border-[#f97316]/20 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
          role="dialog"
          aria-label="EyeGuard AI chat"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#f97316]/12 bg-[#f97316]/5 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#f97316]/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-[#f97316]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#fff7ed]">EyeGuard AI</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[10px] text-[#fff7ed]/40">Online · Eye health assistant</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
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
