import { OSConfig, OSName, VFS } from '../types';

export const OS_CONFIGS: Record<OSName, OSConfig> = {
  'ubuntu-debian': {
    id: 'ubuntu-debian',
    name: 'Linux (Debian/Ubuntu)',
    icon: '🐧',
    promptChar: '$',
    defaultUser: 'user',
    defaultHost: 'debian-lab',
    rootDir: '/',
    userHome: '/home/user',
    packageManager: 'apt-get',
    envLibs: {
      python: ['numpy', 'pandas', 'requests', 'flask', 'django', 'scikit-learn'],
      node: ['express', 'lodash', 'axios', 'dotenv', 'chalk', 'uuid'],
      apt: ['git', 'curl', 'wget', 'neofetch', 'build-essential', 'htop', 'tmux', 'vim']
    }
  },
  'arch-linux': {
    id: 'arch-linux',
    name: 'Arch Linux',
    icon: '⚙️',
    promptChar: '$',
    defaultUser: 'user',
    defaultHost: 'arch-box',
    rootDir: '/',
    userHome: '/home/user',
    packageManager: 'pacman',
    envLibs: {
      python: ['numpy', 'scipy', 'matplotlib', 'tensorflow', 'pytorch'],
      node: ['typescript', 'ts-node', 'next', 'react', 'tailwind-merge'],
      pacman: ['git', 'neofetch', 'zsh', 'yay', 'docker', 'ripgrep', 'fd-find']
    }
  },
  'macos': {
    id: 'macos',
    name: 'macOS (Darwin)',
    icon: '🍎',
    promptChar: '%',
    defaultUser: 'user',
    defaultHost: 'MacBook-Pro',
    rootDir: '/',
    userHome: '/Users/user',
    packageManager: 'brew',
    envLibs: {
      python: ['requests', 'flask', 'pandas', 'openpyxl', 'pillow'],
      node: ['vite', 'eslint', 'prettier', 'vitest', 'lucide-react', 'motion'],
      brew: ['wget', 'htop', 'jq', 'neofetch', 'tree', 'ffmpeg', 'gh', 'kubernetes-cli']
    }
  },
  'windows-powershell': {
    id: 'windows-powershell',
    name: 'Windows PowerShell',
    icon: '🪟',
    promptChar: '>',
    defaultUser: 'user',
    defaultHost: 'DESKTOP-LAB',
    rootDir: 'C:\\',
    userHome: 'C:\\Users\\user',
    packageManager: 'choco',
    envLibs: {
      python: ['win32api', 'requests', 'django', 'pandas', 'matplotlib'],
      node: ['express', 'nodemon', 'concurrently', 'rimraf', 'cross-env'],
      choco: ['git', 'vscode', 'nodejs', 'python', 'curl', '7zip', 'notepadplusplus']
    }
  }
};

export const getInitialVFS = (os: OSName): VFS => {
  const now = Date.now();
  switch (os) {
    case 'ubuntu-debian':
      return {
        '/': { type: 'dir', updatedAt: now },
        '/home': { type: 'dir', updatedAt: now },
        '/home/user': { type: 'dir', updatedAt: now },
        '/home/user/welcome.sh': {
          type: 'file',
          content: '#!/bin/bash\necho "Chào mừng bạn đến với Terminal Lab - Debian/Ubuntu Simulation!"\necho "Hãy thử các lệnh cơ bản: ls, pwd, cd, cat"\necho "Chúc bạn học tập vui vẻ!"\n',
          updatedAt: now
        },
        '/home/user/app.py': {
          type: 'file',
          content: 'import math\n\ndef main():\n    print("--- Khởi chạy chương trình Python mô phỏng ---")\n    ban_kinh = 5\n    dien_tich = math.pi * ban_kinh * ban_kinh\n    print(f"Bán kính hình tròn: {ban_kinh}")\n    print(f"Diện tích hình tròn: {dien_tich:.2f}")\n\nif __name__ == "__main__":\n    main()\n',
          updatedAt: now
        },
        '/home/user/package.json': {
          type: 'file',
          content: '{\n  "name": "debian-app",\n  "version": "1.0.0",\n  "description": "Dự án học tập Debian",\n  "main": "index.js",\n  "dependencies": {\n    "express": "^4.18.2"\n  }\n}\n',
          updatedAt: now
        },
        '/etc': { type: 'dir', updatedAt: now },
        '/etc/apt': { type: 'dir', updatedAt: now },
        '/etc/apt/sources.list': {
          type: 'file',
          content: 'deb http://deb.debian.org/debian stable main contrib non-free\ndeb-src http://deb.debian.org/debian stable main contrib non-free\n',
          updatedAt: now
        },
        '/var': { type: 'dir', updatedAt: now },
        '/var/log': { type: 'dir', updatedAt: now },
        '/var/log/syslog': {
          type: 'file',
          content: 'Jun 30 09:00:01 debian systemd[1]: Started Periodic Command Scheduler.\nJun 30 09:10:05 debian sshd[1245]: Server listening on 0.0.0.0 port 22.\nJun 30 09:15:22 debian kernel: [0.000000] Linux version 5.10.0-23-amd64\n',
          updatedAt: now
        }
      };

    case 'arch-linux':
      return {
        '/': { type: 'dir', updatedAt: now },
        '/home': { type: 'dir', updatedAt: now },
        '/home/user': { type: 'dir', updatedAt: now },
        '/home/user/welcome.sh': {
          type: 'file',
          content: '#!/bin/bash\necho "Arch Linux Simulator khởi chạy!"\necho "Đặc trưng: pacman, rolling release, cấu hình tối giản."\necho "Hãy thử: pacman -Syu để cập nhật hệ thống mô phỏng!"\n',
          updatedAt: now
        },
        '/home/user/index.js': {
          type: 'file',
          content: 'const os = require("os");\nconsole.log("--- NodeJS Simulator ---");\nconsole.log("Hệ điều hành mô phỏng: Arch Linux");\nconsole.log("RAM ảo: 8GB");\n',
          updatedAt: now
        },
        '/etc': { type: 'dir', updatedAt: now },
        '/etc/pacman.conf': {
          type: 'file',
          content: '[options]\nHoldPkg = pacman glibc\nArchitecture = auto\n\n[core]\nInclude = /etc/pacman.d/mirrorlist\n\n[extra]\nInclude = /etc/pacman.d/mirrorlist\n',
          updatedAt: now
        }
      };

    case 'macos':
      return {
        '/': { type: 'dir', updatedAt: now },
        '/Users': { type: 'dir', updatedAt: now },
        '/Users/user': { type: 'dir', updatedAt: now },
        '/Users/user/welcome.sh': {
          type: 'file',
          content: '#!/bin/zsh\necho "Chào mừng đến với macOS Zsh Simulator!"\necho "Sử dụng các lệnh Unix quen thuộc hoặc gõ brew help để học về Homebrew."\n',
          updatedAt: now
        },
        '/Users/user/analyzer.py': {
          type: 'file',
          content: 'print("--- macOS Script Analyzer ---")\nimport sys\nprint("Script arguments:", sys.argv)\nprint("Thực hiện phân tích hệ thống... OK")\n',
          updatedAt: now
        },
        '/Users/user/Library': { type: 'dir', updatedAt: now },
        '/Users/user/Library/Preferences': { type: 'dir', updatedAt: now },
        '/Users/user/Library/Preferences/com.apple.terminal.plist': {
          type: 'file',
          content: '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">\n<plist version="1.0">\n<dict>\n  <key>WindowSize</key>\n  <string>80x24</string>\n  <key>Theme</key>\n  <string>Basic-Dark</string>\n</dict>\n</plist>\n',
          updatedAt: now
        },
        '/Applications': { type: 'dir', updatedAt: now },
        '/Applications/Xcode.app': { type: 'dir', updatedAt: now }
      };

    case 'windows-powershell':
      return {
        'C:\\': { type: 'dir', updatedAt: now },
        'C:\\Users': { type: 'dir', updatedAt: now },
        'C:\\Users\\user': { type: 'dir', updatedAt: now },
        'C:\\Users\\user\\welcome.ps1': {
          type: 'file',
          content: 'Write-Host "Chào mừng đến với Windows PowerShell Simulator!" -ForegroundColor Cyan\nWrite-Host "Gõ: dir hoặc Get-ChildItem để xem danh sách tập tin."\nWrite-Host "Gõ: Get-Process để xem các tiến trình ảo."\n',
          updatedAt: now
        },
        'C:\\Users\\user\\Documents': { type: 'dir', updatedAt: now },
        'C:\\Users\\user\\Documents\\notes.txt': {
          type: 'file',
          content: '--- Ghi chú học tập --- \n1. Lệnh xem file trong Windows: "type filename" hoặc "cat filename"\n2. Lệnh xem IP: "ipconfig"\n3. Quản lý gói: "choco search <package>"\n',
          updatedAt: now
        },
        'C:\\Windows': { type: 'dir', updatedAt: now },
        'C:\\Windows\\System32': { type: 'dir', updatedAt: now },
        'C:\\Windows\\System32\\drivers': { type: 'dir', updatedAt: now },
        'C:\\Windows\\System32\\drivers\\etc': { type: 'dir', updatedAt: now },
        'C:\\Windows\\System32\\drivers\\etc\\hosts': {
          type: 'file',
          content: '127.0.0.1       localhost\n::1             localhost\n127.0.0.1       terminallab.dev\n',
          updatedAt: now
        }
      };
  }
};
