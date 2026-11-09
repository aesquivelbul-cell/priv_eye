'use client';

import { MainLayout } from '@/components/main-layout';
import { AiChat } from '@/components/ai-chat';
import { Bot, Sparkles, ShieldCheck, HeartHandshake } from 'lucide-react';

export default function AiAssistantPage() {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6 py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-2.5 text-foreground">
              <Bot className="w-8 h-8 text-primary" />
              AI Health Assistant
            </h1>
            <p className="text-sm text-muted-foreground">
              Your conversational eye wellness companion. Ask questions about your screen fatigue, ergonomic recommendations, or the 20-20-20 rule.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            Empowered by EyeGuard Core
          </div>
        </div>

        {/* Embedded Full Chat Window */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden h-[640px] flex flex-col">
          <AiChat mode="inline" />
        </div>

        {/* Informational Guidance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl border border-border bg-card/50 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-1 text-muted-foreground">
              <span className="font-semibold text-foreground block">Evidence-Based Answers</span>
              Responses reference clinical guidelines from the American Optometric Association (AOA) and validated CVS-Smart criteria.
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card/50 flex items-start gap-3">
            <HeartHandshake className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-1 text-muted-foreground">
              <span className="font-semibold text-foreground block">Non-Diagnostic Support</span>
              EyeGuard AI provides behavioral and ergonomic triage tips, and cannot replace a clinical comprehensive eye exam.
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
