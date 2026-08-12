import React, { useState } from 'react';
import { Send, Eye, EyeOff, MessageSquare } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatInputBarProps {
  quietMode: boolean;
  chatHistory: ChatMessage[];
  onSendMessage: (text: string) => void;
  onToggleQuietMode: () => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  quietMode,
  chatHistory,
  onSendMessage,
  onToggleQuietMode,
}) => {
  const [text, setText] = useState('');
  const [showLog, setShowLog] = useState(false);
  const [lastSentTime, setLastSentTime] = useState(0);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim().slice(0, 60);
    if (!trimmed) return;

    // Rate limiting: 1 message per 2 seconds
    const now = Date.now();
    if (now - lastSentTime < 2000) {
      alert('Ribbit! Please wait 2 seconds between messages.');
      return;
    }

    onSendMessage(trimmed);
    setText('');
    setLastSentTime(now);
  };

  return (
    <div className="w-full bg-white/10 border border-white/20 rounded-2xl p-3 shadow-2xl backdrop-blur-md">
      {/* Expandable Chat Log Drawer */}
      {showLog && (
        <div className="mb-3 max-h-40 overflow-y-auto p-2.5 bg-black/30 rounded-xl border border-white/10 space-y-1.5 text-xs">
          {chatHistory.length === 0 ? (
            <p className="text-white/50 italic text-center py-2">No messages yet in this pond. Say something!</p>
          ) : (
            chatHistory.slice(-10).map((msg) => (
              <div key={msg.messageId} className="flex items-start gap-2">
                <span className="font-bold text-amber-300 font-mono">{msg.displayName}:</span>
                <span className="text-white bg-white/10 px-2.5 py-0.5 rounded-md text-[11px] font-medium">{msg.text}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Input Form Controls */}
      <form onSubmit={handleSend} className="flex items-center gap-2">
        {/* Toggle Chat Log Drawer */}
        <button
          type="button"
          onClick={() => setShowLog(!showLog)}
          title="Toggle Chat History Log"
          className={`p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
            showLog
              ? 'bg-emerald-500 text-emerald-950 border-emerald-400 shadow-md'
              : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Log</span>
        </button>

        {/* Quiet Mode Toggle */}
        <button
          type="button"
          onClick={onToggleQuietMode}
          title={quietMode ? 'Quiet Mode Active (Speech bubbles hidden)' : 'Quiet Mode Off'}
          className={`p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
            quietMode
              ? 'bg-amber-500 text-amber-950 border-amber-400 shadow-md'
              : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
          }`}
        >
          {quietMode ? <EyeOff className="w-4 h-4 text-amber-950" /> : <Eye className="w-4 h-4 text-emerald-300" />}
          <span className="hidden sm:inline">{quietMode ? 'Bubbles Off' : 'Bubbles On'}</span>
        </button>

        {/* Main Text Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 60))}
            placeholder={quietMode ? 'Quiet mode ON...' : 'Say something...'}
            className="w-full bg-black/20 border border-white/20 text-white placeholder:text-white/40 text-xs sm:text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 font-sans"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/40 font-mono">
            {text.length}/60
          </span>
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-emerald-950 font-black uppercase text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:translate-y-0.5 border-b-2 border-emerald-700"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
