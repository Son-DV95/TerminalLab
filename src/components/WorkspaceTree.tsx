import React, { useState } from 'react';
import { VFS, OSName } from '../types';
import { FileCode, File, Folder, Plus, Trash2, ChevronDown, ChevronRight, Edit } from 'lucide-react';
import { normalizePath, resolvePath } from '../utils/vfs';

interface WorkspaceTreeProps {
  vfs: VFS;
  currentDir: string;
  os: OSName;
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onCreateFile: (name: string) => void;
  onDeleteFile: (path: string) => void;
}

export default function WorkspaceTree({
  vfs,
  currentDir,
  os,
  activeFilePath,
  onSelectFile,
  onCreateFile,
  onDeleteFile
}: WorkspaceTreeProps) {
  const [newFileName, setNewFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const isWindows = os === 'windows-powershell';

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    onCreateFile(newFileName.trim());
    setNewFileName('');
    setIsCreating(false);
  };

  // Get only files and directories within currentDir (flat level for absolute simplicity and maximum UI legibility)
  const getFileItems = () => {
    const list: { path: string; name: string; type: 'file' | 'dir' }[] = [];
    
    Object.entries(vfs).forEach(([path, item]) => {
      // Filter based on path prefix
      if (path === currentDir) return;

      // Ensure it's a direct child of the current directory
      let relative = '';
      if (isWindows) {
        if (path.startsWith(currentDir)) {
          relative = path.slice(currentDir.length).replace(/^\\/, '');
          if (relative && !relative.includes('\\')) {
            list.push({ path, name: relative, type: item.type });
          }
        }
      } else {
        const prefix = currentDir === '/' ? '/' : currentDir + '/';
        if (path.startsWith(prefix)) {
          relative = path.slice(prefix.length);
          if (relative && !relative.includes('/')) {
            list.push({ path, name: relative, type: item.type });
          }
        }
      }
    });

    // Sort: directories first, then files alphabetically
    return list.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  };

  const fileItems = getFileItems();

  const getFileIcon = (name: string, type: 'file' | 'dir') => {
    if (type === 'dir') {
      return <Folder className="h-4 w-4 text-amber-400 fill-amber-400/20" />;
    }
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'sh' || ext === 'zsh') {
      return <FileCode className="h-4 w-4 text-emerald-400" />;
    }
    if (ext === 'ps1') {
      return <FileCode className="h-4 w-4 text-cyan-400" />;
    }
    if (ext === 'py') {
      return <FileCode className="h-4 w-4 text-yellow-400" />;
    }
    if (ext === 'js' || ext === 'ts' || ext === 'json') {
      return <FileCode className="h-4 w-4 text-orange-400" />;
    }
    return <File className="h-4 w-4 text-zinc-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border border-slate-800 rounded-xl overflow-hidden" id="workspace-tree">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-800 bg-[#161b22]">
        <div className="flex items-center space-x-1.5">
          <Folder className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">Dự án hiện hành</span>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="p-1 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded transition cursor-pointer"
          title="Tạo tập tin mới"
          id="toggle-create-file-btn"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Path Display */}
      <div className="px-3.5 py-2 bg-[#0d1117] border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-500 truncate">
        <span className="truncate">Cwd: <span className="text-slate-300 font-medium">{currentDir}</span></span>
      </div>

      {/* New File Inline Form */}
      {isCreating && (
        <form onSubmit={handleCreate} className="p-2 border-b border-slate-800 bg-slate-900/20 flex gap-1.5" id="create-file-form">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="script.py, app.js, welcome.sh..."
            className="flex-1 px-2.5 py-1 text-xs bg-[#161b22] border border-slate-800 rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            autoFocus
          />
          <button
            type="submit"
            className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded transition cursor-pointer"
          >
            Tạo
          </button>
        </form>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
        {fileItems.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            Thư mục này trống.<br />Nhấp nút <span className="text-indigo-400 font-bold">+</span> để tạo file mới.
          </div>
        ) : (
          fileItems.map((item) => {
            const isActive = activeFilePath === item.path;
            return (
              <div
                key={item.path}
                onClick={() => item.type === 'file' && onSelectFile(item.path)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition group cursor-pointer ${
                  isActive
                    ? 'bg-slate-800/80 text-white border border-slate-700'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  {getFileIcon(item.name, item.type)}
                  <span className="truncate">{item.name}</span>
                </div>

                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition">
                  {item.type === 'file' && (
                    <span className="text-[10px] text-slate-500 mr-1.5">
                      {isActive ? 'Đang mở' : 'Mở tệp'}
                    </span>
                  )}
                  {/* Prevent deletion of core default home scripts if possible or just allow full deletion to learn rm */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(item.path);
                    }}
                    className="p-0.5 hover:bg-slate-850 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                    title="Xóa tập tin"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
