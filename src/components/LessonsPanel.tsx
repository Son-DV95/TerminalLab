import React, { useState } from 'react';
import { LessonChallenge, OSName } from '../types';
import { LESSON_CHALLENGES } from '../data/challenges';
import { BookOpen, Award, CheckCircle, HelpCircle, Terminal, RefreshCw, ChevronRight, Play } from 'lucide-react';

interface LessonsPanelProps {
  os: OSName;
  activeChallengeIdx: number;
  onSelectChallenge: (index: number) => void;
  challengeStatuses: Record<string, 'pending' | 'success'>;
  onInsertCommand: (cmd: string) => void;
}

export default function LessonsPanel({
  os,
  activeChallengeIdx,
  onSelectChallenge,
  challengeStatuses,
  onInsertCommand
}: LessonsPanelProps) {
  const [activeTab, setActiveTab] = useState<'challenges' | 'cheatsheet'>('challenges');
  const [cheatCategory, setCheatCategory] = useState<'files' | 'system' | 'packages' | 'git'>('files');
  const [showHint, setShowHint] = useState(false);

  // Filter challenges appropriate for this OS (or 'all')
  const filteredChallenges = LESSON_CHALLENGES.filter(c => c.os === 'all' || c.os === os);
  const currentChallenge = filteredChallenges[activeChallengeIdx] || filteredChallenges[0];

  // Cheat Sheet commands based on OS and category
  const getCheatCommands = () => {
    const isWindows = os === 'windows-powershell';
    
    if (cheatCategory === 'files') {
      return [
        { cmd: isWindows ? 'pwd' : 'pwd', desc: 'In đường dẫn thư mục làm việc hiện tại (Print Working Directory).' },
        { cmd: isWindows ? 'dir' : 'ls -la', desc: 'Liệt kê danh sách tệp tin và thư mục (kèm chi tiết ẩn).' },
        { cmd: isWindows ? 'cd C:\\Users\\user' : 'cd /home/user', desc: 'Di chuyển về thư mục Home của người dùng.' },
        { cmd: isWindows ? 'md backup' : 'mkdir backup', desc: 'Tạo một thư mục mới tên là "backup".' },
        { cmd: isWindows ? 'echo "Hello" > note.txt' : 'echo "Hello" > note.txt', desc: 'Tạo file note.txt và ghi chữ "Hello" vào.' },
        { cmd: isWindows ? 'type note.txt' : 'cat note.txt', desc: 'Xem nội dung chi tiết của tệp note.txt.' },
        { cmd: isWindows ? 'del note.txt' : 'rm note.txt', desc: 'Xóa tệp tin note.txt ra khỏi hệ thống.' }
      ];
    }
    
    if (cheatCategory === 'system') {
      return [
        { cmd: 'neofetch', desc: 'Hiển thị cấu hình phần cứng ảo và logo hệ điều hành dạng nghệ thuật ASCII.' },
        { cmd: isWindows ? 'systeminfo' : 'uname -a', desc: 'Xem thông tin tóm tắt chi tiết cấu trúc hệ thống.' },
        { cmd: isWindows ? 'ipconfig' : 'ip a', desc: 'Kiểm tra cấu hình IP mạng và adapter ảo.' },
        { cmd: isWindows ? 'Get-Process' : 'ps aux', desc: 'Liệt kê tất cả các tiến trình phần mềm đang chạy trong nền.' }
      ];
    }
    
    if (cheatCategory === 'packages') {
      const pm = os === 'ubuntu-debian' ? 'apt-get' : os === 'arch-linux' ? 'pacman' : os === 'macos' ? 'brew' : 'choco';
      if (os === 'ubuntu-debian') {
        return [
          { cmd: 'apt-get update', desc: 'Cập nhật danh sách gói phần mềm từ máy chủ Debian.' },
          { cmd: 'apt-get install htop', desc: 'Tải và cài đặt công cụ theo dõi tài nguyên hệ thống htop.' }
        ];
      }
      if (os === 'arch-linux') {
        return [
          { cmd: 'pacman -Syu', desc: 'Đồng bộ hóa các kho và nâng cấp toàn bộ hệ thống Arch.' },
          { cmd: 'pacman -S neofetch', desc: 'Cài đặt gói neofetch bằng Pacman.' }
        ];
      }
      if (os === 'macos') {
        return [
          { cmd: 'brew update', desc: 'Cập nhật cơ sở dữ liệu Homebrew.' },
          { cmd: 'brew install wget', desc: 'Tải công cụ wget tải tệp tin qua giao thức HTTP/FTP.' }
        ];
      }
      return [
        { cmd: 'choco search nodejs', desc: 'Tìm kiếm gói Node.js trên thư viện Chocolatey.' },
        { cmd: 'choco install git', desc: 'Cài đặt Git quản lý mã nguồn trên Windows.' }
      ];
    }
    
    // git
    return [
      { cmd: 'git init', desc: 'Khởi tạo một kho chứa Git cục bộ (Local Repository) trong dự án.' },
      { cmd: 'git status', desc: 'Kiểm tra trạng thái các thay đổi của tệp tin trong dự án.' },
      { cmd: 'git add .', desc: 'Đưa toàn bộ tệp tin thay đổi vào khu vực chờ (Staging Area).' },
      { cmd: 'git commit -m "first commit"', desc: 'Ghi lại các thay đổi đã đưa vào staging cùng lời thông điệp.' },
      { cmd: 'git log', desc: 'Xem lại toàn bộ lịch sử commit trước đây của dự án.' },
      { cmd: 'git branch', desc: 'Liệt kê toàn bộ các nhánh hiện tại trong kho lưu trữ.' }
    ];
  };

  const cheatCommands = getCheatCommands();

  const handleRunCheat = (cmd: string) => {
    onInsertCommand(cmd);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border border-slate-800 rounded-xl overflow-hidden" id="lessons-panel">
      {/* Tab Selectors */}
      <div className="flex border-b border-slate-800 bg-[#161b22]">
        <button
          onClick={() => { setActiveTab('challenges'); setShowHint(false); }}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-3 text-xs font-bold uppercase tracking-wider font-sans border-b-2 transition cursor-pointer ${
            activeTab === 'challenges'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-250 hover:bg-slate-800/30'
          }`}
          id="tab-challenges"
        >
          <Award className="h-4 w-4" />
          <span>Thử thách ({filteredChallenges.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('cheatsheet')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-3 text-xs font-bold uppercase tracking-wider font-sans border-b-2 transition cursor-pointer ${
            activeTab === 'cheatsheet'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-250 hover:bg-slate-800/30'
          }`}
          id="tab-cheatsheet"
        >
          <BookOpen className="h-4 w-4" />
          <span>Sổ tay lệnh</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0d1117]/30">
        {activeTab === 'challenges' ? (
          // Challenges Mode
          <div className="space-y-4" id="challenges-view">
            {/* Challenge List Selector (horizontal list) */}
            <div className="flex space-x-1 overflow-x-auto pb-1.5 border-b border-slate-800 custom-scrollbar">
              {filteredChallenges.map((ch, idx) => {
                const status = challengeStatuses[ch.id] || 'pending';
                const isActive = activeChallengeIdx === idx;
                return (
                  <button
                    key={ch.id}
                    onClick={() => { onSelectChallenge(idx); setShowHint(false); }}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded text-xs shrink-0 transition cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : status === 'success'
                        ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/50 font-medium'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
                    }`}
                  >
                    {status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400/10" />}
                    <span>Lớp {idx + 1}</span>
                  </button>
                );
              })}
            </div>

            {/* Current Active Challenge Card */}
            {currentChallenge ? (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase font-mono ${
                    currentChallenge.difficulty === 'Cơ bản'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : currentChallenge.difficulty === 'Trung bình'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {currentChallenge.difficulty}
                  </span>
                  <div className="flex items-center gap-1 font-sans">
                    <span className="text-xs text-slate-500 font-mono">Trạng thái:</span>
                    {(challengeStatuses[currentChallenge.id] || 'pending') === 'success' ? (
                      <span className="text-xs text-emerald-400 font-bold font-mono flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 fill-emerald-500/10" /> Hoàn thành
                      </span>
                    ) : (
                      <span className="text-xs text-amber-500 font-bold font-mono animate-pulse">
                        Chưa hoàn tất
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-extrabold text-slate-100 font-sans tracking-tight">
                    {currentChallenge.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">
                    {currentChallenge.description}
                  </p>
                </div>

                <div className="bg-slate-900/30 border border-slate-800 p-3.5 rounded-xl space-y-2">
                  <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider font-mono">Mục tiêu của bạn</h4>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans font-semibold">
                    {currentChallenge.task}
                  </p>
                </div>

                {/* Instructions steps */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-slate-400 font-mono">Hướng dẫn thực hiện:</h4>
                  <ul className="space-y-1.5">
                    {currentChallenge.instructions.map((ins, idx) => (
                      <li key={idx} className="text-xs text-slate-400 flex items-start space-x-1.5 leading-relaxed font-sans">
                        <ChevronRight className="h-3.5 w-3.5 text-indigo-400 mt-0.5 shrink-0" />
                        <span>{ins}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Hint Button */}
                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className="flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 transition cursor-pointer font-semibold font-sans"
                    id="toggle-hint-btn"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>{showHint ? 'Ẩn gợi ý cứu trợ' : 'Xem gợi ý / Câu lệnh mẫu'}</span>
                  </button>

                  {showHint && (
                    <div className="mt-2.5 p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-300 leading-relaxed font-sans">
                      {currentChallenge.hint}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs font-sans">Không có bài tập bài học khả dụng cho hệ điều hành này.</div>
            )}
          </div>
        ) : (
          // Cheat Sheet Mode
          <div className="space-y-4" id="cheatsheet-view">
            {/* Category Selectors */}
            <div className="grid grid-cols-4 gap-1 border-b border-slate-800 pb-2">
              {(['files', 'system', 'packages', 'git'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCheatCategory(cat)}
                  className={`py-1.5 text-center rounded text-[10px] font-bold uppercase font-mono tracking-wider transition cursor-pointer ${
                    cheatCategory === cat
                      ? 'bg-slate-800 text-slate-100'
                      : 'bg-slate-900/40 text-slate-500 hover:bg-slate-900 hover:text-slate-300'
                  }`}
                >
                  {cat === 'files' ? 'Tệp tin' : cat === 'system' ? 'Hệ thống' : cat === 'packages' ? 'Gói' : 'Git'}
                </button>
              ))}
            </div>

            {/* Scrollable Command List */}
            <div className="space-y-2.5" id="cheatsheet-list">
              {cheatCommands.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-900/20 border border-slate-800 rounded-xl hover:border-slate-700 transition flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <Terminal className="h-3 w-3 text-emerald-400 shrink-0" />
                      <code className="text-xs font-bold text-emerald-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded truncate select-all">
                        {item.cmd}
                      </code>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                      {item.desc}
                    </p>
                  </div>

                  <button
                    onClick={() => handleRunCheat(item.cmd)}
                    className="p-1.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-indigo-400 hover:bg-slate-750 rounded-lg shrink-0 transition cursor-pointer"
                    title="Gửi câu lệnh này vào Terminal để chạy"
                  >
                    <Play className="h-3 w-3 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
