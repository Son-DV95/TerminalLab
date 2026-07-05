import React, { useState, useEffect, useRef } from 'react';
import { OSName, VFS, GitState, CommandItem, OSConfig, ProjectSession } from './types';
import { OS_CONFIGS, getInitialVFS } from './data/osConfigs';
import { LESSON_CHALLENGES } from './data/challenges';
import { executeLocalCommand } from './utils/vfs';
import { db } from './lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Subcomponents
import SyncPanel from './components/SyncPanel';
import WorkspaceTree from './components/WorkspaceTree';
import EditorPanel from './components/EditorPanel';
import TerminalPanel from './components/TerminalPanel';
import LessonsPanel from './components/LessonsPanel';

import { Terminal, Code, RotateCcw, Monitor, RefreshCw, Layers } from 'lucide-react';

export default function App() {
  // OS and Workspace State
  const [activeOS, setActiveOS] = useState<OSName>('ubuntu-debian');
  const [currentDir, setCurrentDir] = useState('/home/user');
  const [vfs, setVfs] = useState<VFS>({});
  const [activeFilePath, setActiveFilePath] = useState('');
  const [activeFileContent, setActiveFileContent] = useState('');
  
  // Git state
  const [gitState, setGitState] = useState<GitState>({
    isInitialized: false,
    stagedFiles: [],
    commits: [],
    branches: [],
    currentBranch: 'main',
    head: null
  });

  // Terminal History
  const [terminalHistory, setTerminalHistory] = useState<CommandItem[]>([]);

  // Challenge tracker
  const [activeChallengeIdx, setActiveChallengeIdx] = useState(0);
  const [challengeStatuses, setChallengeStatuses] = useState<Record<string, 'pending' | 'success'>>({});

  // Sync state
  const [userId, setUserId] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'error' | 'offline'>('offline');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeOSConfig = OS_CONFIGS[activeOS];
  const filteredChallenges = LESSON_CHALLENGES.filter(c => c.os === 'all' || c.os === activeOS);

  // 1. Initial State Setup or OS Switch
  useEffect(() => {
    // Reset workspace depending on OS
    const initialVFS = getInitialVFS(activeOS);
    const homeDir = activeOSConfig.userHome;
    
    setVfs(initialVFS);
    setCurrentDir(homeDir);
    setActiveFilePath('');
    setActiveFileContent('');
    
    // Clear Git state
    setGitState({
      isInitialized: false,
      stagedFiles: [],
      commits: [],
      branches: [],
      currentBranch: 'main',
      head: null
    });

    // Seed terminal welcome log
    const welcomeId = 'welcome-' + Date.now();
    const systemId = 'sys-' + Date.now();
    const welcomeMsg = activeOS === 'windows-powershell'
      ? `Windows PowerShell\nCopyright (C) Microsoft Corporation. All rights reserved.\n\nGõ "welcome.ps1" để khởi động nhanh hoặc dùng sổ tay hướng dẫn bên trái.`
      : `${activeOSConfig.name} Core Simulator\nWelcome to your virtual terminal sandbox. Learn commands safely and test code instantly.\n\nType "./welcome.sh" to run your startup welcome script.`;

    setTerminalHistory([
      {
        id: welcomeId,
        text: welcomeMsg,
        type: 'header',
        timestamp: Date.now()
      }
    ]);

    setActiveChallengeIdx(0);

    // If userId exists, try loading state from Firestore or LocalStorage for this specific OS
    if (userId) {
      if (userId.startsWith('SV-')) {
        loadSessionFromLocalStorage(userId, activeOS);
      } else if (userId !== 'local-offline-user') {
        loadSessionFromCloud(userId, activeOS);
      }
    }
  }, [activeOS, userId]);

  // 1.5. Fetch session data from LocalStorage
  const loadSessionFromLocalStorage = (uid: string, os: OSName) => {
    try {
      const key = `terminal_lab_session_${uid}_${os}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        const data = JSON.parse(cached) as ProjectSession;
        if (data.vfs) setVfs(data.vfs);
        if (data.currentDir) setCurrentDir(data.currentDir);
        if (data.gitState) setGitState(data.gitState);
        if (data.activeFilePath) {
          setActiveFilePath(data.activeFilePath);
          const activeFile = data.vfs[data.activeFilePath];
          if (activeFile && activeFile.type === 'file') {
            setActiveFileContent(activeFile.content);
          }
        }
        
        setTerminalHistory(prev => [
          ...prev,
          {
            id: 'local-load-' + Date.now(),
            text: `[Hệ thống]: Đã khôi phục thành công tiến trình làm việc cục bộ của bạn từ bộ nhớ trình duyệt!`,
            type: 'system',
            timestamp: Date.now()
          }
        ]);
      }
      setSyncStatus('offline');
    } catch (e) {
      console.error('Error loading session from LocalStorage', e);
      setSyncStatus('offline');
    }
  };

  // 2. Fetch session data from Firestore
  const loadSessionFromCloud = async (uid: string, os: OSName) => {
    try {
      setSyncStatus('saving');
      const docRef = doc(db, 'projects', `user_${uid}_${os}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as ProjectSession;
        if (data.vfs) setVfs(data.vfs);
        if (data.currentDir) setCurrentDir(data.currentDir);
        if (data.gitState) setGitState(data.gitState);
        if (data.activeFilePath) {
          setActiveFilePath(data.activeFilePath);
          const activeFile = data.vfs[data.activeFilePath];
          if (activeFile && activeFile.type === 'file') {
            setActiveFileContent(activeFile.content);
          }
        }
        
        // Add log
        setTerminalHistory(prev => [
          ...prev,
          {
            id: 'sync-load-' + Date.now(),
            text: `[Cloud Status]: Dự án học tập của bạn đã được tải thành công từ máy chủ đám mây!`,
            type: 'system',
            timestamp: Date.now()
          }
        ]);
        setSyncStatus('saved');
      } else {
        setSyncStatus('saved');
      }
    } catch (e) {
      console.error('Error loading session from Firestore', e);
      setSyncStatus('error');
    }
  };

  // 3. Debounced save to cloud or local storage
  const triggerCloudSave = (currentVfs: VFS, dir: string, git: GitState, activeFile: string) => {
    if (!userId || userId === 'local-offline-user') {
      setSyncStatus('offline');
      return;
    }

    if (userId.startsWith('SV-')) {
      // Local offline user: Save to LocalStorage
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        try {
          const key = `terminal_lab_session_${userId}_${activeOS}`;
          const sessionData: ProjectSession = {
            id: `user_${userId}_${activeOS}`,
            name: `Dự án ${activeOSConfig.name}`,
            os: activeOS,
            vfs: currentVfs,
            gitState: git,
            activeFilePath: activeFile,
            currentDir: dir,
            cmdHistory: [],
            updatedAt: Date.now(),
            userId
          };
          localStorage.setItem(key, JSON.stringify(sessionData));
        } catch (e) {
          console.error('Failed to save to localStorage', e);
        }
      }, 1000);
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('saving');
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const docRef = doc(db, 'projects', `user_${userId}_${activeOS}`);
        await setDoc(docRef, {
          id: `user_${userId}_${activeOS}`,
          name: `Dự án ${activeOSConfig.name}`,
          os: activeOS,
          vfs: currentVfs,
          gitState: git,
          activeFilePath: activeFile,
          currentDir: dir,
          cmdHistory: [],
          updatedAt: Date.now(),
          userId
        });
        setSyncStatus('saved');
      } catch (err) {
        console.error('Error auto-saving session', err);
        setSyncStatus('error');
      }
    }, 1500);
  };

  // 4. Force cloud sync instantly on button click
  const handleForceSync = () => {
    if (!userId || userId === 'local-offline-user' || userId.startsWith('SV-')) return;
    
    setSyncStatus('saving');
    const docRef = doc(db, 'projects', `user_${userId}_${activeOS}`);
    setDoc(docRef, {
      id: `user_${userId}_${activeOS}`,
      name: `Dự án ${activeOSConfig.name}`,
      os: activeOS,
      vfs,
      gitState,
      activeFilePath,
      currentDir,
      cmdHistory: [],
      updatedAt: Date.now(),
      userId
    })
      .then(() => setSyncStatus('saved'))
      .catch((e) => {
        console.error('Force save error', e);
        setSyncStatus('error');
      });
  };

  // 5. Submit terminal command handler (bridging local and server side AI simulation)
  const handleSubmitCommand = async (commandStr: string) => {
    const inputId = 'input-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5);
    const inputItem: CommandItem = {
      id: inputId,
      text: commandStr,
      type: 'input',
      timestamp: Date.now()
    };

    setTerminalHistory(prev => [...prev, inputItem]);

    // Attempt local command evaluation first
    const localResult = executeLocalCommand(commandStr, currentDir, vfs, activeOS, gitState);
    
    if (localResult.output !== '__NOT_FOUND__') {
      // Local command successfully executed!
      if (localResult.output === '___CLEAR_TERMINAL___') {
        setTerminalHistory([]);
      } else {
        const outputId = 'out-' + Date.now();
        const outputItem: CommandItem = {
          id: outputId,
          text: localResult.output,
          type: localResult.isError ? 'error' : 'output',
          timestamp: Date.now()
        };
        setTerminalHistory(prev => [...prev, outputItem]);
      }

      setVfs(localResult.newVfs);
      setCurrentDir(localResult.newDir);
      setGitState(localResult.newGit);

      // If active file content has been updated by the command (e.g. echo "xyz" > file.txt)
      if (activeFilePath && localResult.newVfs[activeFilePath]) {
        const updatedFile = localResult.newVfs[activeFilePath];
        if (updatedFile && updatedFile.type === 'file') {
          setActiveFileContent(updatedFile.content);
        }
      }

      // Check challenge accomplishments
      validateChallenge(localResult.newVfs, commandStr, localResult.newGit);
      triggerCloudSave(localResult.newVfs, localResult.newDir, localResult.newGit, activeFilePath);

    } else {
      // Offline fallback indicator if command not supported locally and no backend API is online
      const sysId = 'sys-loading-' + Date.now();
      const loadingItem: CommandItem = {
        id: sysId,
        text: `[Terminal Lab]: Đang biên dịch và thực thi nâng cao trên AI Simulator...`,
        type: 'system',
        timestamp: Date.now()
      };
      setTerminalHistory(prev => [...prev, loadingItem]);

      try {
        const res = await fetch('/api/simulate-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: commandStr,
            currentDir,
            os: activeOS,
            vfs
          })
        });

        // Remove the loading line from terminal history for clean terminal layout
        setTerminalHistory(prev => prev.filter(item => item.id !== sysId));

        const data = await res.json();
        const outputId = 'out-ai-' + Date.now();
        const outputItem: CommandItem = {
          id: outputId,
          text: data.output,
          type: data.isError ? 'error' : 'output',
          timestamp: Date.now()
        };
        setTerminalHistory(prev => [...prev, outputItem]);

        // Process file system changes if returned by Gemini
        if (data.vfsChanges && Object.keys(data.vfsChanges).length > 0) {
          const updatedVFS = { ...vfs };
          Object.entries(data.vfsChanges).forEach(([filePath, fileData]) => {
            if (fileData === null) {
              delete updatedVFS[filePath];
              if (activeFilePath === filePath) {
                setActiveFilePath('');
                setActiveFileContent('');
              }
            } else {
              const fileObj = fileData as any;
              updatedVFS[filePath] = {
                type: fileObj.type || 'file',
                content: fileObj.content || '',
                updatedAt: Date.now()
              };
              if (activeFilePath === filePath) {
                setActiveFileContent(fileObj.content || '');
              }
            }
          });
          setVfs(updatedVFS);
          validateChallenge(updatedVFS, commandStr, gitState);
          triggerCloudSave(updatedVFS, currentDir, gitState, activeFilePath);
        } else {
          validateChallenge(vfs, commandStr, gitState);
          triggerCloudSave(vfs, currentDir, gitState, activeFilePath);
        }

      } catch (err) {
        setTerminalHistory(prev => prev.filter(item => item.id !== sysId));
        setTerminalHistory(prev => [
          ...prev,
          {
            id: 'err-net-' + Date.now(),
            text: `Lỗi kết nối máy chủ mô phỏng AI: ${(err as Error).message}. Vui lòng thử các lệnh nội tuyến!`,
            type: 'error',
            timestamp: Date.now()
          }
        ]);
      }
    }
  };

  // 6. Challenge complete validation
  const validateChallenge = (currentVfs: VFS, commandStr: string, currentGit: GitState) => {
    const currentChallenge = filteredChallenges[activeChallengeIdx];
    if (!currentChallenge) return;

    // Skip if already completed
    if (challengeStatuses[currentChallenge.id] === 'success') return;

    const valResult = currentChallenge.validate(currentVfs, commandStr, currentGit);
    if (valResult.success) {
      setChallengeStatuses(prev => ({
        ...prev,
        [currentChallenge.id]: 'success'
      }));

      // Append success indicator
      setTerminalHistory(prev => [
        ...prev,
        {
          id: 'challenge-success-' + Date.now(),
          text: `\n✨ THỬ THÁCH HOÀN THÀNH: ${valResult.message}\n`,
          type: 'success',
          timestamp: Date.now()
        }
      ]);
    }
  };

  // 7. Workspace and Editor events
  const handleSelectFile = (path: string) => {
    setActiveFilePath(path);
    if (vfs[path] && vfs[path].type === 'file') {
      setActiveFileContent(vfs[path].content);
    }
  };

  const handleCreateFile = (name: string) => {
    // Construct absolute path
    const separator = activeOS === 'windows-powershell' ? '\\' : '/';
    const newPath = currentDir === '/' || currentDir === 'C:\\' 
      ? `${currentDir}${name}` 
      : `${currentDir}${separator}${name}`;

    const updatedVFS = {
      ...vfs,
      [newPath]: {
        type: 'file' as const,
        content: '',
        updatedAt: Date.now()
      }
    };

    setVfs(updatedVFS);
    setActiveFilePath(newPath);
    setActiveFileContent('');
    
    // Auto-save and log
    setTerminalHistory(prev => [
      ...prev,
      {
        id: 'file-create-' + Date.now(),
        text: `[Hệ thống]: Đã tạo tệp tin mới: ${name}`,
        type: 'system',
        timestamp: Date.now()
      }
    ]);

    triggerCloudSave(updatedVFS, currentDir, gitState, newPath);
  };

  const handleDeleteFile = (path: string) => {
    const updatedVFS = { ...vfs };
    delete updatedVFS[path];
    
    setVfs(updatedVFS);
    if (activeFilePath === path) {
      setActiveFilePath('');
      setActiveFileContent('');
    }

    setTerminalHistory(prev => [
      ...prev,
      {
        id: 'file-delete-' + Date.now(),
        text: `[Hệ thống]: Đã xóa tệp tin khỏi dự án: ${path.split('/').pop()?.split('\\').pop()}`,
        type: 'system',
        timestamp: Date.now()
      }
    ]);

    triggerCloudSave(updatedVFS, currentDir, gitState, activeFilePath === path ? '' : activeFilePath);
  };

  const handleSaveFileContent = (content: string) => {
    if (!activeFilePath) return;

    const updatedVFS = {
      ...vfs,
      [activeFilePath]: {
        type: 'file' as const,
        content,
        updatedAt: Date.now()
      }
    };

    setVfs(updatedVFS);
    setActiveFileContent(content);

    setTerminalHistory(prev => [
      ...prev,
      {
        id: 'file-save-' + Date.now(),
        text: `[Hệ thống]: Đã ghi dữ liệu và lưu tệp: ${activeFilePath.split('/').pop()?.split('\\').pop()}`,
        type: 'system',
        timestamp: Date.now()
      }
    ]);

    triggerCloudSave(updatedVFS, currentDir, gitState, activeFilePath);
  };

  const handleResetVFS = () => {
    if (window.confirm('Bạn có chắc chắn muốn cài đặt lại hệ điều hành ảo về trạng thái xuất phát không? Toàn bộ các tệp tin tùy chỉnh sẽ bị xóa.')) {
      const initial = getInitialVFS(activeOS);
      setVfs(initial);
      setCurrentDir(activeOSConfig.userHome);
      setActiveFilePath('');
      setActiveFileContent('');
      setGitState({
        isInitialized: false,
        stagedFiles: [],
        commits: [],
        branches: [],
        currentBranch: 'main',
        head: null
      });
      setChallengeStatuses({});
      setTerminalHistory([
        {
          id: 'reset-' + Date.now(),
          text: `[Hệ thống]: Hệ điều hành ${activeOSConfig.name} đã được reset về ban đầu thành công!`,
          type: 'success',
          timestamp: Date.now()
        }
      ]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-slate-300 select-none overflow-hidden font-sans">
      {/* 1. Global Navigation Bar */}
      <header className="flex items-center justify-between px-4 bg-[#161b22] border-b border-slate-800 shrink-0 h-14">
        <div className="flex items-center space-x-4">
          {/* macOS Window Controls */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-500/90 border border-red-600/30"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/90 border border-yellow-600/30"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/90 border border-green-600/30"></div>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xs font-extrabold tracking-wider text-slate-200 flex items-center gap-1.5 uppercase">
              Terminal Lab <span className="text-[9px] bg-slate-800 border border-slate-700 text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold">v1.5</span>
            </h1>
            <p className="text-[9px] text-slate-500 font-sans">Môi trường thực hành ảo hóa tối ưu</p>
          </div>
        </div>

        {/* Header center: OS selection */}
        <div className="flex items-center">
          <nav className="flex space-x-1 bg-[#0d1117] rounded-lg p-1 border border-slate-800">
            {Object.values(OS_CONFIGS).map((cfg) => {
              const isActive = activeOS === cfg.id;
              return (
                <button
                  key={cfg.id}
                  onClick={() => setActiveOS(cfg.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {cfg.icon} <span className="hidden md:inline ml-1">{cfg.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Header Right: Firebase status */}
        <div className="flex items-center space-x-3">
          <SyncPanel
            onUserLoaded={(uid) => setUserId(uid)}
            syncStatus={syncStatus}
            onForceSync={handleForceSync}
          />

          <button
            onClick={handleResetVFS}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 hover:border-slate-600 hover:text-slate-200 rounded-lg text-slate-400 transition cursor-pointer font-semibold"
            title="Khởi tạo lại hệ điều hành ban đầu"
            id="global-reset-os-btn"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            <span>Reset OS</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3 bg-[#0d1117]">
        
        {/* Left column: Study, Lessons, File Tree (Sidebar) */}
        <div className="w-80 flex flex-col gap-3 shrink-0 overflow-hidden">
          {/* Top Half: Interactive Challenges */}
          <div className="flex-1 min-h-[50%]">
            <LessonsPanel
              os={activeOS}
              activeChallengeIdx={activeChallengeIdx}
              onSelectChallenge={(idx) => setActiveChallengeIdx(idx)}
              challengeStatuses={challengeStatuses}
              onInsertCommand={handleSubmitCommand}
            />
          </div>

          {/* Bottom Half: Workspace File Tree */}
          <div className="flex-1 min-h-[40%]">
            <WorkspaceTree
              vfs={vfs}
              currentDir={currentDir}
              os={activeOS}
              activeFilePath={activeFilePath}
              onSelectFile={handleSelectFile}
              onCreateFile={handleCreateFile}
              onDeleteFile={handleDeleteFile}
            />
          </div>
        </div>

        {/* Right column: Split screen with Code Editor & Terminal (IDE style) */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* Top Panel: Source code Editor */}
          <div className="flex-1 min-h-[45%]">
            <EditorPanel
              activeFilePath={activeFilePath}
              initialContent={activeFileContent}
              onSave={handleSaveFileContent}
              onRunScript={handleSubmitCommand}
            />
          </div>

          {/* Bottom Panel: Interactive Terminal */}
          <div className="flex-1 min-h-[45%]">
            <TerminalPanel
              osConfig={activeOSConfig}
              terminalHistory={terminalHistory}
              currentDir={currentDir}
              vfs={vfs}
              onSubmitCommand={handleSubmitCommand}
              onClearHistory={() => setTerminalHistory([])}
            />
          </div>
        </div>

      </main>

      {/* 3. Bottom Status Bar */}
      <footer className="h-6 bg-[#0d1117] border-t border-slate-800 flex items-center justify-between px-3 text-[10px] text-slate-500 shrink-0">
        <div className="flex items-center space-x-4">
          <span className="bg-blue-600 text-white px-1.5 py-0.5 font-bold rounded-sm">LINUX SIM</span>
          <span>UTF-8</span>
          <span>Cwd: {currentDir}</span>
          <span>Active File: {activeFilePath.split('/').pop()?.split('\\').pop() || 'None'}</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>High Efficiency Mode</span>
          </span>
          <span className="text-green-500 font-medium">● Online</span>
        </div>
      </footer>
    </div>
  );
}
