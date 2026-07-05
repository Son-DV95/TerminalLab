export type OSName = 'ubuntu-debian' | 'arch-linux' | 'macos' | 'windows-powershell';

export interface VFSFile {
  content: string;
  type: 'file';
  updatedAt: number;
}

export interface VFSDirectory {
  type: 'dir';
  updatedAt: number;
}

export type VFS = Record<string, VFSFile | VFSDirectory>;

export interface CommandItem {
  id: string;
  text: string;
  type: 'input' | 'output' | 'error' | 'success' | 'system' | 'header';
  timestamp: number;
}

export interface GitCommit {
  id: string;
  message: string;
  author: string;
  timestamp: number;
  parent: string | null;
  changes: Record<string, string>; // path -> content state at this commit
}

export interface GitState {
  isInitialized: boolean;
  stagedFiles: string[]; // paths of files staged for commit
  commits: GitCommit[];
  branches: string[];
  currentBranch: string;
  head: string | null; // commit ID
}

export interface OSConfig {
  id: OSName;
  name: string;
  icon: string;
  promptChar: string;
  defaultUser: string;
  defaultHost: string;
  rootDir: string;
  userHome: string;
  packageManager: string;
  envLibs: Record<string, string[]>; // list of simulated libraries (e.g., Python packages, npm modules, brew formulas)
}

export interface LessonChallenge {
  id: string;
  title: string;
  os: OSName | 'all';
  difficulty: 'Cơ bản' | 'Trung bình' | 'Nâng cao';
  description: string;
  task: string;
  instructions: string[];
  hint: string;
  validate: (vfs: VFS, lastCmd: string, gitState: GitState) => { success: boolean; message: string };
}

export interface ProjectSession {
  id: string;
  name: string;
  os: OSName;
  vfs: VFS;
  gitState: GitState;
  activeFilePath: string;
  currentDir: string;
  cmdHistory: string[];
  updatedAt: number;
  userId: string;
}
