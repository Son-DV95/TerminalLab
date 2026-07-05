import React, { useState, useEffect, useRef } from 'react';
import { Save, Play, FileCode, Edit, HelpCircle, RefreshCw } from 'lucide-react';

interface EditorPanelProps {
  activeFilePath: string;
  initialContent: string;
  onSave: (content: string) => void;
  onRunScript: (cmdToRun: string) => void;
}

export default function EditorPanel({
  activeFilePath,
  initialContent,
  onSave,
  onRunScript
}: EditorPanelProps) {
  const [code, setCode] = useState(initialContent);
  const [isModified, setIsModified] = useState(false);
  const [lineCount, setLineCount] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCode(initialContent);
    setIsModified(false);
  }, [initialContent, activeFilePath]);

  useEffect(() => {
    const lines = code.split('\n').length;
    setLineCount(lines || 1);
  }, [code]);

  // Sync scroll between textarea and line numbers
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
    setIsModified(true);
  };

  // Support Tab key indentation inside textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      const newValue = value.substring(0, start) + '    ' + value.substring(end);
      setCode(newValue);
      setIsModified(true);

      // Reset selection range after state update
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
  };

  const handleSaveClick = () => {
    onSave(code);
    setIsModified(false);
  };

  // Run script logic based on extension
  const handleRunClick = () => {
    // First save if modified
    if (isModified) {
      onSave(code);
      setIsModified(false);
    }

    const filename = activeFilePath.split('/').pop()?.split('\\').pop() || '';
    const ext = filename.split('.').pop()?.toLowerCase();

    let cmd = '';
    if (ext === 'py') {
      cmd = `python3 ${filename}`;
    } else if (ext === 'sh' || ext === 'zsh') {
      cmd = `bash ${filename}`;
    } else if (ext === 'js') {
      cmd = `node ${filename}`;
    } else if (ext === 'ps1') {
      cmd = `./${filename}`;
    } else {
      cmd = `cat ${filename}`;
    }

    onRunScript(cmd);
  };

  const fileName = activeFilePath.split('/').pop()?.split('\\').pop() || 'Chưa mở file';

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border border-slate-800 rounded-xl overflow-hidden" id="editor-panel">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-800 bg-[#161b22]">
        <div className="flex items-center space-x-2 truncate">
          <FileCode className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-200 truncate font-mono">
            {fileName} {isModified && <span className="text-amber-400 font-bold">•</span>}
          </span>
        </div>

        {activeFilePath && (
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleSaveClick}
              disabled={!isModified}
              className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded transition font-medium cursor-pointer ${
                isModified
                  ? 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'text-slate-600 border border-transparent cursor-not-allowed opacity-50'
              }`}
              id="editor-save-btn"
            >
              <Save className="h-3 w-3" />
              <span>Lưu (Ctrl+S)</span>
            </button>
            <button
              onClick={handleRunClick}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition font-semibold cursor-pointer shadow-md"
              id="editor-run-btn"
            >
              <Play className="h-3 w-3 fill-white" />
              <span>Chạy lệnh</span>
            </button>
          </div>
        )}
      </div>

      {/* Editor Canvas */}
      {activeFilePath ? (
        <div className="flex-1 flex overflow-hidden font-mono text-sm leading-6">
          {/* Line Numbers */}
          <div
            ref={lineNumbersRef}
            className="w-10 bg-[#0d1117] text-right pr-2 select-none border-r border-slate-800 text-slate-600 py-3 overflow-hidden font-mono text-xs select-none"
          >
            {Array.from({ length: lineCount }).map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            className="flex-1 bg-[#0d1117] text-slate-100 p-3 outline-none resize-none overflow-y-auto font-mono text-xs leading-5 custom-scrollbar"
            placeholder="// Viết kịch bản shell hoặc mã nguồn tại đây và nhấn Chạy..."
            spellCheck="false"
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
          <HelpCircle className="h-8 w-8 text-slate-600 mb-2" />
          <p className="text-xs font-sans">
            Chưa có tệp tin nào được mở.<br />
            Nhấn đúp hoặc chọn tệp tin từ cây dự án bên trái để bắt đầu lập trình.
          </p>
        </div>
      )}

      {/* Footer Specs */}
      <div className="px-3 py-1.5 bg-[#161b22]/50 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex justify-between items-center">
        <span>Path: {activeFilePath || 'N/A'}</span>
        <span>UTF-8 | Lines: {lineCount}</span>
      </div>
    </div>
  );
}
