'use client';



import { useState, useRef, useEffect, useCallback } from 'react';

import { usePathname } from 'next/navigation';

import { Send, Bot, Loader2, X, MessageCircle, Minimize2, Search } from 'lucide-react';



interface Message {

  role: 'user' | 'assistant';

  content: string;

}



interface UserOption {

  id: string;

  email: string;

  name?: string;

  age?: number | null;

  gender?: string | null;

  fieldOfStudy?: string | null;

  yearLevel?: string | null;

}



const SUGGESTED_QUESTIONS = [

  'Show me high-risk users',

  'Analyze screen time trends',

  'What are the top symptoms?',

  'Who needs intervention?',

];



export function AdminAiChatBubble() {

  const pathname = usePathname();



  // Detect if we're on a user detail page: /admin/users/[userId]

  const userDetailMatch = pathname?.match(/^\/admin\/users\/([^/]+)$/);

  const pageUserId = userDetailMatch ? decodeURIComponent(userDetailMatch[1]) : null;

  // pageUserId could be a UUID (registered user) or an encoded email (survey respondent)

  const isUUID = pageUserId ? /^[0-9a-f-]{36}$/i.test(pageUserId) : false;



  const defaultMsg: Message = {

    role: 'assistant',

    content: pageUserId && isUUID

      ? `I'm now focused on this user's data. Ask me anything about their health logs, risk levels, or patterns.`

      : "Hi! I'm EyeGuard Admin AI 👋 I can access all user data and analytics. Ask me about specific users or system-wide trends. What would you like to know?",

  };



  // ── Persist conversation across admin panel navigation ────────────────────
  const STORAGE_KEY = 'eyeguard_admin_chat_session';

  const loadSession = () => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'); } catch { return null; }
  };

  const savedSession = loadSession();
  // Only restore generic session when NOT on a user detail page
  const restoredMessages: Message[] = (!pageUserId && savedSession?.messages?.length)
    ? savedSession.messages
    : [defaultMsg];

  const [messages, setMessages] = useState<Message[]>(restoredMessages);

  const [input, setInput] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const [isOpen, setIsOpen] = useState(false);

  const [targetUserId, setTargetUserId] = useState<string>(isUUID && pageUserId ? pageUserId : (savedSession?.targetUserId ?? ''));

  const [userSearch, setUserSearch] = useState(!pageUserId && savedSession?.userSearch ? savedSession.userSearch : '');

  const [users, setUsers] = useState<UserOption[]>([]);

  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const [loadingUsers, setLoadingUsers] = useState(false);

  const [selectedUserInfo, setSelectedUserInfo] = useState<UserOption | null>(!pageUserId && savedSession?.selectedUserInfo ? savedSession.selectedUserInfo : null);



  // When navigating to/from a user detail page, auto-set the target user

  // Only reset messages when ENTERING a user detail page — preserve history otherwise

  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {

    const prevPathname = prevPathnameRef.current;

    prevPathnameRef.current = pathname;



    if (isUUID && pageUserId) {

      // Entered a user detail page — switch context to this user

      setTargetUserId(pageUserId);

      setUserSearch('');

      setSelectedUserInfo(null);

      setMessages([{

        role: 'assistant',

        content: `I'm now focused on this user's data. Ask me anything about their health logs, risk levels, or patterns.`,

      }]);

    } else if (prevPathname && /^\/admin\/users\/[^/]+$/.test(prevPathname) && !isUUID) {

      // Just left a user detail page — go back to system context, restore session

      setTargetUserId('');

      setUserSearch('');

      setSelectedUserInfo(null);

      const saved = loadSession();

      setMessages(saved?.messages?.length ? saved.messages : [defaultMsg]);

    }

    // Any other navigation (dashboard → analytics, etc.) — do nothing, keep convo

  // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [pathname]);

  const bottomRef = useRef<HTMLDivElement>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);



  // Persist conversation to sessionStorage whenever state changes

  useEffect(() => {

    if (typeof window === 'undefined') return;

    if (pageUserId) return; // Don't persist user-specific conversations

    try {

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({

        messages,

        targetUserId,

        userSearch,

        selectedUserInfo,

      }));

    } catch { /* storage quota exceeded — ignore */ }

  }, [messages, targetUserId, userSearch, selectedUserInfo, pageUserId]);



  useEffect(() => {

    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  }, [messages]);



  useEffect(() => {

    if (isOpen) {

      setTimeout(() => inputRef.current?.focus(), 100);

    }

  }, [isOpen]);



  // Search users

  useEffect(() => {

    if (userSearch.length < 2) {

      setUsers([]);

      return;

    }



    setLoadingUsers(true);

    fetch(`/api/admin/search-users?search=${encodeURIComponent(userSearch)}`)

      .then((r) => r.json())

      .then((data) => setUsers(data.users || []))

      .catch((e) => {

        console.error('Failed to search users:', e);

        setUsers([]);

      })

      .finally(() => setLoadingUsers(false));

  }, [userSearch]);



  const selectUser = (userId: string, userEmail: string, userInfo: UserOption) => {

    setTargetUserId(userId);

    setUserSearch(userEmail);

    setSelectedUserInfo(userInfo);

    setShowUserDropdown(false);

  };



  const clearUserFilter = () => {

    setTargetUserId('');

    setUserSearch('');

    setSelectedUserInfo(null);

  };



  const sendMessage = useCallback(

    async (text: string) => {

      const trimmed = text.trim();

      if (!trimmed || isLoading) return;



      const userMsg: Message = { role: 'user', content: trimmed };

      const newMessages = [...messages, userMsg];

      setMessages(newMessages);

      setInput('');

      setIsLoading(true);



      try {

        const res = await fetch('/api/admin/chat', {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({

            message: trimmed,

            history: messages,

            targetUserId: targetUserId || null,

            userDemographics: selectedUserInfo ? {

              email: selectedUserInfo.email,

              age: selectedUserInfo.age,

              gender: selectedUserInfo.gender,

              fieldOfStudy: selectedUserInfo.fieldOfStudy,

              yearLevel: selectedUserInfo.yearLevel,

            } : null,

          }),

        });



        const data = await res.json();

        const reply = data.reply ?? (data.error ? `Error: ${data.error}` : 'Sorry, something went wrong. Please try again.');

        setMessages([...newMessages, { role: 'assistant', content: reply }]);

      } catch (error) {

        console.error('Chat error:', error);

        setMessages([...newMessages, { role: 'assistant', content: 'Connection error. Please check your internet and try again.' }]);

      } finally {

        setIsLoading(false);

      }

    },

    [messages, isLoading, targetUserId]

  );



  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {

    if (e.key === 'Enter' && !e.shiftKey) {

      e.preventDefault();

      sendMessage(input);

    }

  };



  return (

    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">

      {/* Chat Window */}

      {isOpen && (

        <div className="w-96 max-w-[calc(100vw-2rem)] bg-background border border-border rounded-lg shadow-lg flex flex-col h-[600px] animate-in fade-in slide-in-from-bottom-4">

          {/* Header */}

          <div className="border-b p-4 bg-muted/50 flex items-center justify-between rounded-t-lg">

            <div className="flex items-center gap-2">

              <Bot className="w-4 h-4 text-primary" />

              <h3 className="font-semibold text-sm">Admin AI</h3>

              {isUUID && pageUserId && (

                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">

                  User context

                </span>

              )}

            </div>

            <button

              onClick={() => setIsOpen(false)}

              className="p-1 hover:bg-muted rounded transition-colors"

            >

              <Minimize2 className="w-4 h-4" />

            </button>

          </div>



          {/* User Selector — hidden when auto-context is active from the page URL */}

          {!isUUID && (

          <div className="border-b p-3 bg-background">

            <div className="relative">

              <div className="flex items-center border rounded-md bg-background px-2 py-1.5">

                <Search className="w-3 h-3 text-muted-foreground mr-1" />

                <input

                  type="text"

                  placeholder="Search user..."

                  value={userSearch}

                  onChange={(e) => {

                    setUserSearch(e.target.value);

                    setShowUserDropdown(true);

                  }}

                  onFocus={() => userSearch && setShowUserDropdown(true)}

                  className="flex-1 outline-none bg-transparent text-xs"

                />

                {targetUserId && (

                  <button

                    onClick={clearUserFilter}

                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"

                  >

                    <X className="w-3 h-3" />

                  </button>

                )}

              </div>



              {/* Dropdown */}

              {showUserDropdown && userSearch && (

                <div

                  ref={dropdownRef}

                  className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-background shadow-lg z-50 max-h-40 overflow-y-auto"

                >

                  {loadingUsers ? (

                    <div className="p-2 text-center text-xs text-muted-foreground">Loading...</div>

                  ) : users.length > 0 ? (

                    users.map((user) => (

                      <button

                        key={user.id}

                        onClick={() => selectUser(user.id, user.email, user)}

                        className="w-full text-left px-3 py-2 hover:bg-muted text-xs border-b last:border-b-0"

                      >

                        <div className="font-medium">{user.name || user.email}</div>

                        <div className="text-xs text-muted-foreground mt-0.5">

                          {[user.age && `${user.age}yo`, user.gender, user.yearLevel, user.fieldOfStudy].filter(Boolean).join(' • ')}

                        </div>

                      </button>

                    ))

                  ) : (

                    <div className="p-2 text-center text-xs text-muted-foreground">No users found</div>

                  )}

                </div>

              )}

            </div>

          </div>

          )}



          {/* Messages */}

          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {messages.map((msg, i) => (

              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                <div

                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs ${

                    msg.role === 'assistant' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'

                  }`}

                >

                  {msg.role === 'assistant' ? <Bot className="w-3 h-3" /> : 'You'}

                </div>

                <div

                  className={`max-w-[70%] rounded-lg px-3 py-2 text-xs leading-relaxed ${

                    msg.role === 'assistant'

                      ? 'bg-muted text-foreground rounded-tl-sm'

                      : 'bg-primary text-primary-foreground rounded-tr-sm'

                  }`}

                >

                  {msg.content}

                </div>

              </div>

            ))}



            {isLoading && (

              <div className="flex gap-2">

                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">

                  <Bot className="w-3 h-3" />

                </div>

                <div className="bg-muted text-foreground rounded-lg rounded-tl-sm px-3 py-2 flex items-center gap-1">

                  <Loader2 className="w-3 h-3 animate-spin" />

                  <span className="text-xs">Analyzing...</span>

                </div>

              </div>

            )}



            <div ref={bottomRef} />

          </div>



          {/* Suggested questions (only on first message) */}

          {messages.length === 1 && !targetUserId && (

            <div className="px-3 pb-3 border-t">

              <div className="grid grid-cols-1 gap-1">

                {SUGGESTED_QUESTIONS.map((q, i) => (

                  <button

                    key={i}

                    onClick={() => sendMessage(q)}

                    className="text-left text-xs p-1.5 rounded border border-border hover:bg-muted transition-colors line-clamp-1"

                  >

                    {q}

                  </button>

                ))}

              </div>

            </div>

          )}



          {/* Selected user info */}

          {selectedUserInfo && (

            <div className="bg-muted/50 px-3 py-2 text-xs space-y-1">

              <div className="font-semibold text-foreground">{selectedUserInfo.name || selectedUserInfo.email}</div>

              <div className="text-muted-foreground">

                {[selectedUserInfo.age && `${selectedUserInfo.age} years old`, selectedUserInfo.gender, selectedUserInfo.yearLevel, selectedUserInfo.fieldOfStudy].filter(Boolean).join(' • ')}

              </div>

            </div>

          )}



          {/* Input */}

          <div className="border-t p-3 bg-muted/30">

            <div className="flex gap-1.5">

              <textarea

                ref={inputRef}

                value={input}

                onChange={(e) => setInput(e.target.value)}

                onKeyDown={handleKeyDown}

                placeholder={targetUserId ? 'Ask about this user...' : 'Ask me anything...'}

                className="flex-1 resize-none bg-background border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"

                rows={2}

              />

              <button

                onClick={() => sendMessage(input)}

                disabled={!input.trim() || isLoading}

                className="px-2 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-fit flex items-center"

              >

                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}

              </button>

            </div>

          </div>

        </div>

      )}



      {/* Chat Bubble Button */}

      {!isOpen && (

        <button

          onClick={() => setIsOpen(true)}

          className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-all hover:scale-110 animate-in fade-in"

          aria-label="Open AI chat"

        >

          <MessageCircle className="w-6 h-6" />

        </button>

      )}

    </div>

  );

}

