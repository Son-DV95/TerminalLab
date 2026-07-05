import React, { useState, useEffect, useRef } from 'react';
import { CommandItem, OSConfig, OSName, VFS } from '../types';
import { Terminal, Send, Sparkles, RefreshCw, ChevronRight, HelpCircle, CornerDownLeft } from 'lucide-react';
import { getChildren } from '../utils/vfs';

interface TerminalPanelProps {
  osConfig: OSConfig;
  terminalHistory: CommandItem[];
  currentDir: string;
  vfs: VFS;
  onSubmitCommand: (command: string) => void;
  onClearHistory: () => void;
}

export default function TerminalPanel({
  osConfig,
  terminalHistory,
  currentDir,
  vfs,
  onSubmitCommand,
  onClearHistory
}: TerminalPanelProps) {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandList, setCommandList] = useState<string[]>([]);
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotResponse, setCopilotResponse] = useState<string>('');
  const [suggestedCommand, setSuggestedCommand] = useState<string>('');
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on content updates
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalHistory]);

  // Command history collection for Up/Down arrows
  useEffect(() => {
    const inputsOnly = terminalHistory
      .filter((item) => item.type === 'input')
      .map((item) => item.text);
    // Unique inputs reverse ordered
    setCommandList(Array.from(new Set(inputsOnly)));
    setHistoryIndex(-1);
  }, [terminalHistory]);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  // Keyboard navigation and autocompletion
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandList.length === 0) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx < commandList.length) {
        setHistoryIndex(nextIdx);
        // commandList is ordered from newest to oldest if we reverse it, or we just pull from tail
        const command = commandList[commandList.length - 1 - nextIdx];
        if (command) setInput(command);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = historyIndex - 1;
      if (nextIdx >= 0) {
        setHistoryIndex(nextIdx);
        const command = commandList[commandList.length - 1 - nextIdx];
        if (command) setInput(command);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Tab Autocompletion of files in current VFS folder
      const parts = input.trim().split(' ');
      const lastPart = parts[parts.length - 1] || '';
      
      if (!lastPart) return;

      const children = getChildren(vfs, currentDir, osConfig.id).map(p => {
        return p.split(osConfig.id === 'windows-powershell' ? '\\' : '/').pop() || '';
      });

      const match = children.find(name => name.toLowerCase().startsWith(lastPart.toLowerCase()));
      if (match) {
        parts[parts.length - 1] = match;
        setInput(parts.join(' '));
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const command = input.trim();
    if (!command) return;

    onSubmitCommand(command);
    setInput('');
  };

  // Trigger Gemini Copilot query
  const handleAskCopilot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotQuery.trim()) return;

    setIsCopilotLoading(true);
    setCopilotResponse('');
    setSuggestedCommand('');

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: copilotQuery.trim(),
          currentDir,
          os: osConfig.id
        })
      });

      const data = await res.json();
      setCopilotResponse(data.reply || 'Không có phản hồi từ máy chủ Copilot.');
      setSuggestedCommand(data.suggestedCommand || '');
    } catch (err) {
      setCopilotResponse(`Không thể kết nối máy chủ Copilot: ${(err as Error).message}`);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const runSuggestedCmd = () => {
    if (suggestedCommand) {
      onSubmitCommand(suggestedCommand);
      setCopilotQuery('');
      setCopilotResponse('');
      setSuggestedCommand('');
      setShowCopilot(false);
    }
  };

  // Format terminal logs
  const renderLogText = (item: CommandItem) => {
    if (item.type === 'input') {
      return (
        <span className="font-mono">
          <span className="text-zinc-500 font-bold select-none">{osConfig.defaultUser}@{osConfig.defaultHost}</span>
          <span className="text-zinc-400 font-bold select-none">:{currentDir}{osConfig.promptChar} </span>
          <span className="text-white font-semibold">{item.text}</span>
        </span>
      );
    }

    if (item.type === 'error') {
      return <span className="text-rose-400 font-mono leading-relaxed whitespace-pre-wrap">{item.text}</span>;
    }

    if (item.type === 'success') {
      return <span className="text-emerald-400 font-mono leading-relaxed whitespace-pre-wrap font-semibold">{item.text}</span>;
    }

    if (item.type === 'system') {
      return <span className="text-zinc-500 font-mono text-[11px] leading-relaxed italic">{item.text}</span>;
    }

    if (item.type === 'header') {
      return (
        <div className="bg-[#161b22] border border-slate-800 p-3.5 rounded-lg mb-4 space-y-1 select-none">
          <div className="text-xs text-indigo-400 font-bold font-mono">Terminal Lab OS Emulator Core v1.5 [Online]</div>
          <div className="text-[11px] text-slate-400 font-mono leading-relaxed">{item.text}</div>
        </div>
      );
    }

    // Standard outputs
    return <span className="text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">{item.text}</span>;
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0d1117] border border-slate-800 rounded-xl overflow-hidden relative" id="terminal-panel" onClick={focusInput}>
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-800 bg-[#161b22] select-none">
        <div className="flex items-center space-x-2">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200 font-mono uppercase tracking-wider">{osConfig.name} Console</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCopilot(!showCopilot)}
            className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
              showCopilot 
                ? 'bg-indigo-600/10 text-indigo-300 border border-indigo-500/30' 
                : 'bg-slate-800 border border-slate-700 text-slate-300 hover:text-indigo-400 hover:border-indigo-500/20'
            }`}
            id="copilot-toggle-btn"
          >
            <Sparkles className="h-3 w-3 animate-pulse text-indigo-400" />
            <span>Hỏi OS Copilot AI</span>
          </button>
          
          <button
            onClick={onClearHistory}
            className="px-2 py-1 text-[10px] bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 rounded transition font-mono cursor-pointer"
            title="Làm sạch màn hình (cls/clear)"
            id="clear-terminal-btn"
          >
            Clear Log
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Logs Stream */}
        <div 
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-4 bg-black/40 custom-scrollbar flex flex-col space-y-1.5 min-w-0"
        >
          {terminalHistory.map((item) => (
            <div key={item.id} className="text-xs">
              {renderLogText(item)}
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>

        {/* Sliding AI Copilot Sidebar */}
        {showCopilot && (
          <div className="w-80 border-l border-slate-800 bg-[#161b22] flex flex-col shrink-0 animate-in slide-in-from-right duration-200 select-text" id="copilot-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-slate-800 bg-[#0d1117] flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> OS Copilot AI
              </span>
              <button
                onClick={() => setShowCopilot(false)}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar bg-[#0d1117]/30">
              {copilotResponse ? (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-xl space-y-2 text-slate-300">
                    <p className="text-xs leading-relaxed font-sans whitespace-pre-wrap">
                      {copilotResponse}
                    </p>
                    {suggestedCommand && (
                      <div className="pt-2.5 border-t border-indigo-950/40 mt-2 flex flex-col gap-1.5">
                        <span className="text-[10px] text-indigo-400 font-semibold font-mono">Lệnh đề xuất từ AI:</span>
                        <div className="flex items-center justify-between gap-2 bg-[#0d1117] px-2 py-1.5 rounded border border-slate-800">
                          <code className="text-xs text-emerald-400 font-mono truncate">{suggestedCommand}</code>
                          <button
                            onClick={runSuggestedCmd}
                            className="flex items-center space-x-1 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            <span>Chạy ngay</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setCopilotResponse(''); setSuggestedCommand(''); }}
                    className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
                  >
                    Hỏi câu khác
                  </button>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs flex flex-col items-center font-sans">
                  <HelpCircle className="h-6 w-6 text-slate-600 mb-2" />
                  Bạn đang bí lệnh? Hãy gõ câu hỏi bất kỳ bằng tiếng Việt (ví dụ: "cách lọc file log") để Copilot hỗ trợ.
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleAskCopilot} className="p-3 border-t border-slate-800 bg-[#0d1117]/50 flex gap-2">
              <input
                type="text"
                value={copilotQuery}
                onChange={(e) => setCopilotQuery(e.target.value)}
                placeholder="Hỏi cách tạo file, lọc git..."
                className="flex-1 px-3 py-2 text-xs bg-[#0d1117] border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                disabled={isCopilotLoading}
              />
              <button
                type="submit"
                disabled={isCopilotLoading || !copilotQuery.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition cursor-pointer"
              >
                {isCopilotLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Actual Shell Input Line */}
      <form onSubmit={handleFormSubmit} className="flex items-center border-t border-slate-800 px-4 py-3 bg-[#0d1117] font-mono text-xs">
        <span className="text-slate-500 font-bold select-none shrink-0">{osConfig.defaultUser}@{osConfig.defaultHost}</span>
        <span className="text-slate-400 font-bold select-none shrink-0">:{currentDir}{osConfig.promptChar}&nbsp;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-white outline-none caret-indigo-400 min-w-0 font-semibold"
          placeholder="Nhập lệnh ở đây (nhấn Tab để tự động hoàn tất file)..."
          spellCheck="false"
          autoFocus
        />
        <button type="submit" className="text-slate-500 hover:text-slate-300 ml-2 transition cursor-pointer">
          <CornerDownLeft className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
