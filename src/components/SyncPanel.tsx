import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { Cloud, CloudOff, RefreshCw, User as UserIcon, Check, Copy, LogIn, LogOut } from 'lucide-react';

interface SyncPanelProps {
  onUserLoaded: (userId: string) => void;
  syncStatus: 'saved' | 'saving' | 'error' | 'offline';
  onForceSync: () => void;
}

export default function SyncPanel({ onUserLoaded, syncStatus, onForceSync }: SyncPanelProps) {
  const [user, setUser] = useState<User | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFirebaseAvailable, setIsFirebaseAvailable] = useState(true);
  const [localUid, setLocalUid] = useState<string>('');

  useEffect(() => {
    let cachedUid = '';
    try {
      cachedUid = localStorage.getItem('terminal_lab_local_uid') || '';
    } catch (e) {
      console.warn('localStorage is restricted:', e);
    }

    if (!cachedUid) {
      cachedUid = 'SV-' + Math.random().toString(36).slice(2, 10).toUpperCase();
      try {
        localStorage.setItem('terminal_lab_local_uid', cachedUid);
      } catch (e) {
        console.warn('Could not write local_uid to localStorage:', e);
      }
    }
    setLocalUid(cachedUid);

    // Default load: notify parent of local/offline user identifier first
    onUserLoaded(cachedUid);

    try {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          onUserLoaded(currentUser.uid);
          setIsFirebaseAvailable(true);
        } else {
          setUser(null);
          onUserLoaded(cachedUid);
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('Firebase Auth is not fully available:', e);
      setIsFirebaseAvailable(false);
      onUserLoaded(cachedUid);
    }
  }, [onUserLoaded]);

  const copySyncCode = () => {
    const codeToCopy = user ? user.uid : localUid;
    if (codeToCopy) {
      navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.warn('Lỗi đăng nhập Google hoặc bị hủy:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Lỗi đăng xuất:', err);
    }
  };

  return (
    <div className="flex items-center space-x-3 bg-[#161b22] border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300" id="sync-panel">
      {/* Cloud/Local Status Indicator */}
      <div className="flex items-center space-x-1.5 border-r border-slate-800 pr-3">
        {user ? (
          <>
            {syncStatus === 'saving' && (
              <span className="flex items-center text-amber-400 gap-1 font-mono">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Đang lưu...</span>
              </span>
            )}
            {syncStatus === 'saved' && (
              <span className="flex items-center text-emerald-400 gap-1 font-mono">
                <Cloud className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Đã đồng bộ</span>
              </span>
            )}
            {syncStatus === 'error' && (
              <span className="flex items-center text-rose-400 gap-1 font-mono">
                <CloudOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lỗi đồng bộ</span>
              </span>
            )}
            {syncStatus === 'offline' && (
              <span className="flex items-center text-slate-500 gap-1 font-mono">
                <CloudOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ngoại tuyến</span>
              </span>
            )}
          </>
        ) : (
          <span className="flex items-center text-indigo-400 gap-1 font-mono" title="Tiến trình học của bạn được lưu an toàn trong trình duyệt">
            <CloudOff className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Lưu cục bộ</span>
          </span>
        )}
      </div>

      {/* Sync Profile & Actions */}
      <div className="flex items-center space-x-2">
        <UserIcon className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-slate-300 font-medium">
          {user ? (
            <>
              Mã: <span className="font-mono text-emerald-400 select-all" title={user.uid}>{user.uid.slice(0, 8)}...</span>
            </>
          ) : (
            <>
              Cục bộ: <span className="font-mono text-indigo-400 select-all" title={localUid}>{localUid.slice(0, 8)}...</span>
            </>
          )}
        </span>
        
        {/* Copy Button */}
        <button
          onClick={copySyncCode}
          title="Sao chép mã đồng bộ đầy đủ"
          className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-slate-200 cursor-pointer"
          id="copy-sync-code-btn"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        </button>

        {/* Auth Actions */}
        {user ? (
          <>
            <button
              onClick={onForceSync}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium rounded transition cursor-pointer"
              title="Đồng bộ đám mây ngay lập tức"
              id="force-sync-btn"
            >
              Lưu mây
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-1 px-2 py-0.5 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/30 text-rose-300 font-medium rounded transition cursor-pointer"
              title="Đăng xuất khỏi tài khoản Google"
              id="google-sign-out-btn"
            >
              <LogOut className="h-3 w-3" />
              <span className="hidden md:inline">Đăng xuất</span>
            </button>
          </>
        ) : (
          <button
            onClick={handleSignIn}
            className="flex items-center space-x-1 px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded transition cursor-pointer shadow-sm animate-pulse hover:animate-none"
            title="Đăng nhập Google để đồng bộ tiến độ học tập"
            id="google-sign-in-btn"
          >
            <LogIn className="h-3 w-3" />
            <span>Đăng nhập Google</span>
          </button>
        )}
      </div>
    </div>
  );
}

