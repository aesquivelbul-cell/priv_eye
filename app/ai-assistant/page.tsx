'use client';

import { useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';

export default function AiAssistantPage() {
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    // Open the floating AI chat popup automatically when the page loads
    const btn = document.querySelector<HTMLButtonElement>('[data-ai-chat-trigger]');
    if (btn) btn.click();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="w-8 h-8 text-primary" />
      </div>
      <div className="max-w-sm space-y-2">
        <h1 className="text-2xl font-bold text-foreground">AI Health Assistant</h1>
        <p className="text-muted-foreground text-sm">
          Your personal eye health coach. Ask me anything about your screen habits, risk factors, or how to improve your scores.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        The chat window should open automatically. If it did not, click the{' '}
        <strong>chat button</strong> in the bottom-right corner of the screen.
      </p>
    </div>
  );
}
