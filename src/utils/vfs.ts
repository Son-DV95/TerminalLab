import { VFS, GitState, OSName, CommandItem, GitCommit } from '../types';

// Helper to normalize paths
export const normalizePath = (path: string, os: OSName): string => {
  if (os === 'windows-powershell') {
    // Replace forward slashes with backward slashes
    let normalized = path.replace(/\//g, '\\');
    // Ensure uppercase drive letter
    if (normalized.startsWith('c:')) {
      normalized = 'C:' + normalized.slice(2);
    }
    // Remove trailing slash unless it's root
    if (normalized.endsWith('\\') && normalized.length > 3) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } else {
    // Unix
    let normalized = path.replace(/\\/g, '/');
    normalized = normalized.replace(/\/+/g, '/');
    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }
};

// Resolve relative path to absolute
export const resolvePath = (currentDir: string, relPath: string, os: OSName): string => {
  const isWindows = os === 'windows-powershell';
  const sep = isWindows ? '\\' : '/';
  
  if (!relPath || relPath === '.') return currentDir;

  let result = '';
  if (isWindows) {
    if (relPath.toUpperCase().startsWith('C:')) {
      result = relPath;
    } else {
      result = currentDir.endsWith('\\') ? currentDir + relPath : currentDir + sep + relPath;
    }
  } else {
    if (relPath.startsWith('/')) {
      result = relPath;
    } else {
      result = currentDir === '/' ? '/' + relPath : currentDir + '/' + relPath;
    }
  }

  // Handle ..
  const parts = isWindows ? result.split('\\') : result.split('/');
  const stack: string[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === '' && i > 0) continue;
    if (part === '.') continue;
    if (part === '..') {
      if (stack.length > (isWindows ? 1 : 0)) { // Don't pop drive letter or Unix root
        stack.pop();
      }
    } else {
      stack.push(part);
    }
  }

  if (isWindows) {
    if (stack.length === 1 && stack[0].endsWith(':')) {
      return stack[0] + '\\';
    }
    return stack.join('\\');
  } else {
    const res = '/' + stack.filter(Boolean).join('/');
    return res === '' ? '/' : res;
  }
};

// Helper to check if path exists in VFS
export const pathExists = (vfs: VFS, path: string): boolean => {
  return vfs[path] !== undefined;
};

// Helper to check if a directory has children
export const getChildren = (vfs: VFS, dirPath: string, os: OSName): string[] => {
  const isWindows = os === 'windows-powershell';
  const normDir = normalizePath(dirPath, os);
  
  return Object.keys(vfs).filter(p => {
    if (p === normDir) return false;
    if (isWindows) {
      if (!p.startsWith(normDir)) return false;
      const relative = p.slice(normDir.length).replace(/^\\/, '');
      return relative && !relative.includes('\\');
    } else {
      if (!p.startsWith(normDir === '/' ? '/' : normDir + '/')) return false;
      const relative = normDir === '/' ? p.slice(1) : p.slice(normDir.length + 1);
      return relative && !relative.includes('/');
    }
  });
};

// Mock Terminal execution engine
export const executeLocalCommand = (
  cmdStr: string,
  currentDir: string,
  vfs: VFS,
  os: OSName,
  gitState: GitState
): {
  output: string;
  newDir: string;
  newVfs: VFS;
  newGit: GitState;
  isError: boolean;
} => {
  const isWindows = os === 'windows-powershell';
  const trimmed = cmdStr.trim();
  const result = {
    output: '',
    newDir: currentDir,
    newVfs: { ...vfs },
    newGit: { ...gitState },
    isError: false
  };

  if (!trimmed) return result;

  // Add to localStorage command history
  try {
    const histStr = localStorage.getItem('terminal_lab_cmd_history') || '[]';
    const histList = JSON.parse(histStr) as string[];
    if (histList[histList.length - 1] !== trimmed) {
      histList.push(trimmed);
      if (histList.length > 100) histList.shift();
      localStorage.setItem('terminal_lab_cmd_history', JSON.stringify(histList));
    }
  } catch (e) {
    console.error('Error saving command history', e);
  }

  // Split arguments (handling quotes roughly)
  const args: string[] = [];
  let currentArg = '';
  let inQuotes = false;
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (currentArg) {
        args.push(currentArg);
        currentArg = '';
      }
    } else {
      currentArg += char;
    }
  }
  if (currentArg) args.push(currentArg);

  const cmdName = args[0].toLowerCase();

  // Navigation commands
  if (cmdName === 'cd' || cmdName === 'set-location') {
    const target = args[1] || (isWindows ? 'C:\\Users\\user' : '/home/user');
    const absTarget = normalizePath(resolvePath(currentDir, target, os), os);
    
    if (pathExists(vfs, absTarget)) {
      if (vfs[absTarget].type === 'dir') {
        result.newDir = absTarget;
      } else {
        result.output = isWindows 
          ? `cd : Set-Location : Cannot find path '${target}' because it is a file.`
          : `cd: not a directory: ${target}`;
        result.isError = true;
      }
    } else {
      result.output = isWindows
        ? `cd : Set-Location : Cannot find path '${target}' because it does not exist.`
        : `cd: no such file or directory: ${target}`;
      result.isError = true;
    }
    return result;
  }

  // Print current directory
  if (cmdName === 'pwd' || cmdName === 'get-location') {
    result.output = currentDir;
    return result;
  }

  // Clear command (handled in UI, return blank marker)
  if (cmdName === 'clear' || cmdName === 'cls') {
    result.output = '___CLEAR_TERMINAL___';
    return result;
  }

  // Directory listing
  if (cmdName === 'ls' || cmdName === 'dir' || cmdName === 'get-childitem' || cmdName === 'gci') {
    const target = args[1] ? normalizePath(resolvePath(currentDir, args[1], os), os) : currentDir;
    
    if (!pathExists(vfs, target)) {
      result.output = `Error: Cannot find path '${target}' because it does not exist.`;
      result.isError = true;
      return result;
    }

    if (vfs[target].type === 'file') {
      result.output = target.split(isWindows ? '\\' : '/').pop() || '';
      return result;
    }

    const childrenPaths = getChildren(vfs, target, os);
    if (childrenPaths.length === 0) {
      result.output = '(Thư mục trống)';
      return result;
    }

    const formattedList = childrenPaths.map(p => {
      const name = p.split(isWindows ? '\\' : '/').pop() || '';
      const item = vfs[p];
      const timeStr = new Date(item.updatedAt).toLocaleTimeString();
      const typeStr = item.type === 'dir' ? '<DIR>' : '     ';
      const sizeStr = item.type === 'file' ? `${item.content.length} B` : '';
      
      if (isWindows) {
        return `${timeStr}    ${typeStr.padEnd(7)} ${sizeStr.padStart(8)} ${name}`;
      } else {
        // Unix style colored/styled outputs
        if (item.type === 'dir') {
          return `📁 \x1b[34m${name}/\x1b[0m`;
        }
        return `📄 ${name}`;
      }
    });

    if (isWindows) {
      result.output = `    Directory of ${target}\n\n` + formattedList.join('\n');
    } else {
      result.output = formattedList.join('\n');
    }
    return result;
  }

  // View file contents
  if (cmdName === 'cat' || cmdName === 'type' || cmdName === 'get-content') {
    if (!args[1]) {
      result.output = `Error: Missing path. Usage: ${cmdName} <filename>`;
      result.isError = true;
      return result;
    }
    const target = normalizePath(resolvePath(currentDir, args[1], os), os);
    if (pathExists(vfs, target)) {
      if (vfs[target].type === 'file') {
        result.output = vfs[target].content;
      } else {
        result.output = `Error: '${args[1]}' is a directory.`;
        result.isError = true;
      }
    } else {
      result.output = `Error: File not found: ${args[1]}`;
      result.isError = true;
    }
    return result;
  }

  // Create empty file
  if (cmdName === 'touch') {
    if (!args[1]) {
      result.output = 'touch: missing file operand';
      result.isError = true;
      return result;
    }
    const target = normalizePath(resolvePath(currentDir, args[1], os), os);
    result.newVfs[target] = {
      type: 'file',
      content: '',
      updatedAt: Date.now()
    };
    result.output = `Đã tạo tệp tin trống: ${args[1]}`;
    return result;
  }

  // Create folder
  if (cmdName === 'mkdir' || cmdName === 'md') {
    if (!args[1]) {
      result.output = 'mkdir: missing operand';
      result.isError = true;
      return result;
    }
    const target = normalizePath(resolvePath(currentDir, args[1], os), os);
    result.newVfs[target] = {
      type: 'dir',
      updatedAt: Date.now()
    };
    result.output = `Đã tạo thư mục: ${args[1]}`;
    return result;
  }

  // Remove file or folder
  if (cmdName === 'rm' || cmdName === 'del' || cmdName === 'rmdir') {
    if (!args[1]) {
      result.output = 'rm: missing operand';
      result.isError = true;
      return result;
    }
    const target = normalizePath(resolvePath(currentDir, args[1], os), os);
    if (pathExists(vfs, target)) {
      // Remove this item and any children recursive
      delete result.newVfs[target];
      Object.keys(result.newVfs).forEach(p => {
        if (p.startsWith(target + (isWindows ? '\\' : '/'))) {
          delete result.newVfs[p];
        }
      });
      result.output = `Đã xóa: ${args[1]}`;
    } else {
      result.output = `rm: cannot remove '${args[1]}': No such file or directory`;
      result.isError = true;
    }
    return result;
  }

  // Echo command
  if (cmdName === 'echo') {
    // Check for redirection: echo "hello" > file.txt
    const redirectIndex = args.indexOf('>');
    const appendIndex = args.indexOf('>>');
    
    if (redirectIndex !== -1 || appendIndex !== -1) {
      const isAppend = appendIndex !== -1;
      const index = isAppend ? appendIndex : redirectIndex;
      const echoParts = args.slice(1, index);
      const fileTarget = args[index + 1];
      
      if (!fileTarget) {
        result.output = 'Syntax error: missing file after redirection';
        result.isError = true;
        return result;
      }
      
      const content = echoParts.join(' ');
      const target = normalizePath(resolvePath(currentDir, fileTarget, os), os);
      
      const existingContent = (isAppend && vfs[target] && vfs[target].type === 'file')
        ? (vfs[target].content + '\n')
        : '';
        
      result.newVfs[target] = {
        type: 'file',
        content: existingContent + content,
        updatedAt: Date.now()
      };
      result.output = `Đã ghi vào tệp: ${fileTarget}`;
      return result;
    }
    
    result.output = args.slice(1).join(' ');
    return result;
  }

  // History command
  if (cmdName === 'history' || cmdName === 'get-history' || cmdName === 'h') {
    try {
      const histStr = localStorage.getItem('terminal_lab_cmd_history') || '[]';
      const histList = JSON.parse(histStr) as string[];
      if (histList.length === 0) {
        result.output = 'Lịch sử lệnh trống.';
      } else {
        result.output = histList.map((cmd, idx) => `  ${String(idx + 1).padStart(3)}  ${cmd}`).join('\n');
      }
    } catch (e) {
      result.output = 'Error reading command history';
      result.isError = true;
    }
    return result;
  }

  // Alias command
  if (cmdName === 'alias' || cmdName === 'get-alias') {
    const aliases = isWindows ? {
      'gci': 'Get-ChildItem',
      'ls': 'Get-ChildItem',
      'dir': 'Get-ChildItem',
      'cat': 'Get-Content',
      'type': 'Get-Content',
      'gc': 'Get-Content',
      'cls': 'Clear-Host',
      'clear': 'Clear-Host',
      'rm': 'Remove-Item',
      'del': 'Remove-Item',
      'cp': 'Copy-Item',
      'copy': 'Copy-Item',
      'mv': 'Move-Item',
      'move': 'Move-Item',
      'ren': 'Rename-Item',
      'md': 'mkdir',
      'h': 'Get-History',
      'history': 'Get-History'
    } : {
      'll': 'ls -la',
      'la': 'ls -a',
      'md': 'mkdir',
      'rd': 'rmdir',
      'g': 'git',
      'cls': 'clear',
      'h': 'history'
    };
    
    result.output = Object.entries(aliases)
      .map(([k, v]) => isWindows ? `Alias: ${k} -> ${v}` : `alias ${k}='${v}'`)
      .join('\n');
    return result;
  }

  // Environment variables
  if (cmdName === 'env' || cmdName === 'printenv' || cmdName === 'set' || cmdName === 'gci env:') {
    const envVars = {
      'USER': 'user',
      'HOME': isWindows ? 'C:\\Users\\user' : '/home/user',
      'PATH': isWindows 
        ? 'C:\\Windows\\system32;C:\\Windows;C:\\ProgramData\\chocolatey\\bin' 
        : '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      'SHELL': isWindows ? 'PowerShell' : '/bin/bash',
      'LANG': 'en_US.UTF-8',
      'TERM': 'xterm-256color',
      'OS': isWindows ? 'Windows_NT' : 'GNU/Linux',
      'TERMINAL_LAB_VERSION': '1.5.0',
      'GEMINI_ENGINE': 'gemini-3.5-flash-virtual'
    };
    
    result.output = Object.entries(envVars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    return result;
  }

  // Find command
  if (cmdName === 'find' || cmdName === 'get-childitem -recurse') {
    const searchDir = args[1] || '.';
    let namePattern = '';
    const nameIndex = args.indexOf('-name');
    if (nameIndex !== -1 && args[nameIndex + 1]) {
      namePattern = args[nameIndex + 1].replace(/['"^*]/g, '');
    } else if (args[1] && args[1] !== '.' && !args[1].startsWith('-')) {
      namePattern = args[1];
    }
    
    const absSearchDir = normalizePath(resolvePath(currentDir, searchDir, os), os);
    const matched: string[] = [];
    
    Object.keys(vfs).forEach(p => {
      if (p.startsWith(absSearchDir)) {
        const relative = p.replace(absSearchDir, '').replace(/^[\\\/]/, '') || '.';
        const filename = p.split(isWindows ? '\\' : '/').pop() || '';
        if (!namePattern || filename.toLowerCase().includes(namePattern.toLowerCase())) {
          matched.push(p);
        }
      }
    });
    
    if (matched.length === 0) {
      result.output = 'Không tìm thấy tệp hoặc thư mục phù hợp.';
    } else {
      result.output = matched.join('\n');
    }
    return result;
  }

  // Word count command
  if (cmdName === 'wc') {
    const fileArg = args.filter(a => !a.startsWith('-'))[1];
    if (!fileArg) {
      result.output = 'Usage: wc [-l] [-w] [-c] <file_path>';
      result.isError = true;
      return result;
    }
    
    const target = normalizePath(resolvePath(currentDir, fileArg, os), os);
    if (!pathExists(vfs, target)) {
      result.output = `wc: ${fileArg}: No such file or directory`;
      result.isError = true;
      return result;
    }
    if (vfs[target].type !== 'file') {
      result.output = `wc: ${fileArg}: Is a directory`;
      result.isError = true;
      return result;
    }
    
    const content = vfs[target].content;
    const lines = content.split('\n').length;
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    
    const showLines = args.includes('-l') || !args.some(a => a.startsWith('-'));
    const showWords = args.includes('-w') || !args.some(a => a.startsWith('-'));
    const showChars = args.includes('-c') || !args.some(a => a.startsWith('-'));
    
    const outParts: string[] = [];
    if (showLines) outParts.push(` ${lines}`);
    if (showWords) outParts.push(` ${words}`);
    if (showChars) outParts.push(` ${chars}`);
    outParts.push(` ${fileArg}`);
    
    result.output = outParts.join('');
    return result;
  }

  // Diff command
  if (cmdName === 'diff' || cmdName === 'compare-object') {
    const file1 = args[1];
    const file2 = args[2];
    if (!file1 || !file2) {
      result.output = `Usage: ${cmdName} <file1> <file2>`;
      result.isError = true;
      return result;
    }
    
    const t1 = normalizePath(resolvePath(currentDir, file1, os), os);
    const t2 = normalizePath(resolvePath(currentDir, file2, os), os);
    
    if (!pathExists(vfs, t1) || !pathExists(vfs, t2)) {
      result.output = `Error: Một hoặc cả hai tệp tin không tồn tại.`;
      result.isError = true;
      return result;
    }
    
    if (vfs[t1].type !== 'file' || vfs[t2].type !== 'file') {
      result.output = `Error: So sánh diff chỉ áp dụng cho tệp tin văn bản.`;
      result.isError = true;
      return result;
    }
    
    const lines1 = vfs[t1].content.split('\n');
    const lines2 = vfs[t2].content.split('\n');
    
    if (vfs[t1].content === vfs[t2].content) {
      result.output = `Các tệp tin '${file1}' và '${file2}' hoàn toàn giống nhau.`;
      return result;
    }
    
    const diffOut: string[] = [];
    const maxLines = Math.max(lines1.length, lines2.length);
    for (let i = 0; i < maxLines; i++) {
      const l1 = lines1[i];
      const l2 = lines2[i];
      if (l1 !== l2) {
        if (l1 !== undefined) diffOut.push(`< dòng ${i+1}: ${l1}`);
        if (l2 !== undefined) diffOut.push(`> dòng ${i+1}: ${l2}`);
        diffOut.push('---');
      }
    }
    result.output = diffOut.slice(0, -1).join('\n') || 'Không có sự khác biệt rõ rệt.';
    return result;
  }

  // Base64 command
  if (cmdName === 'base64') {
    const isDecode = args.includes('-d') || args.includes('--decode');
    const fileArg = args.filter(a => a !== '-d' && a !== '--decode' && a !== 'base64')[0];
    
    if (!fileArg) {
      result.output = 'Usage: base64 [-d] <file_path>';
      result.isError = true;
      return result;
    }
    
    const target = normalizePath(resolvePath(currentDir, fileArg, os), os);
    if (!pathExists(vfs, target)) {
      result.output = `base64: ${fileArg}: No such file or directory`;
      result.isError = true;
      return result;
    }
    if (vfs[target].type !== 'file') {
      result.output = `base64: ${fileArg}: Is a directory`;
      result.isError = true;
      return result;
    }
    
    try {
      const content = vfs[target].content;
      if (isDecode) {
        result.output = atob(content);
      } else {
        result.output = btoa(content);
      }
    } catch (e) {
      result.output = `base64 error: ${(e as Error).message}`;
      result.isError = true;
    }
    return result;
  }

  // md5sum and certutil hashfile
  if (cmdName === 'md5sum' || (cmdName === 'certutil' && args[1]?.toLowerCase() === '-hashfile')) {
    let fileArg = '';
    if (cmdName === 'md5sum') {
      fileArg = args[1] || '';
    } else {
      fileArg = args[2] || '';
    }
    
    if (!fileArg) {
      result.output = cmdName === 'md5sum' 
        ? 'Usage: md5sum <file_path>' 
        : 'Usage: certutil -hashfile <file_path> MD5|SHA256';
      result.isError = true;
      return result;
    }
    
    const target = normalizePath(resolvePath(currentDir, fileArg, os), os);
    if (!pathExists(vfs, target)) {
      result.output = `Error: File not found: ${fileArg}`;
      result.isError = true;
      return result;
    }
    if (vfs[target].type !== 'file') {
      result.output = `Error: '${fileArg}' is a directory.`;
      result.isError = true;
      return result;
    }
    
    const content = vfs[target].content;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = (hash << 5) - hash + content.charCodeAt(i);
      hash |= 0;
    }
    const hexHash = Math.abs(hash).toString(16).padStart(32, '0');
    
    if (cmdName === 'md5sum') {
      result.output = `${hexHash}  ${fileArg}`;
    } else {
      const algo = (args[3] || 'MD5').toUpperCase();
      result.output = `${algo} hash of file ${fileArg}:\n${hexHash}\nCertUtil: -hashfile command completed successfully.`;
    }
    return result;
  }

  // Tar, Zip, Unzip simulation
  if (cmdName === 'tar' || cmdName === 'zip' || cmdName === 'unzip') {
    if (cmdName === 'zip') {
      const zipFile = args[1];
      const targetFiles = args.slice(2);
      if (!zipFile || targetFiles.length === 0) {
        result.output = 'Usage: zip <archive.zip> <file1> <file2>...';
        result.isError = true;
        return result;
      }
      
      const zipPath = normalizePath(resolvePath(currentDir, zipFile, os), os);
      const manifest: string[] = [];
      const contents: string[] = [];
      
      for (const f of targetFiles) {
        const fPath = normalizePath(resolvePath(currentDir, f, os), os);
        if (pathExists(vfs, fPath) && vfs[fPath].type === 'file') {
          manifest.push(f);
          contents.push(`--- FILE: ${f} ---\n${vfs[fPath].content}`);
        }
      }
      
      result.newVfs[zipPath] = {
        type: 'file',
        content: `MOCK_ZIP_ARCHIVE\nFiles: ${manifest.join(',')}\n\n${contents.join('\n\n')}`,
        updatedAt: Date.now()
      };
      result.output = `adding: ${targetFiles.join(', ')} (deflated 45%)\nCreated ZIP archive: ${zipFile}`;
      return result;
    }
    
    if (cmdName === 'unzip') {
      const zipFile = args[1];
      if (!zipFile) {
        result.output = 'Usage: unzip <archive.zip>';
        result.isError = true;
        return result;
      }
      
      const zipPath = normalizePath(resolvePath(currentDir, zipFile, os), os);
      const zipItem = vfs[zipPath];
      if (!pathExists(vfs, zipPath) || zipItem.type !== 'file' || !zipItem.content.startsWith('MOCK_ZIP_ARCHIVE')) {
        result.output = `unzip: cannot find or extract from ${zipFile}`;
        result.isError = true;
        return result;
      }
      
      const content = zipItem.content;
      const fileMatch = content.match(/Files: (.*)\n/);
      if (fileMatch) {
        const filesList = fileMatch[1].split(',');
        filesList.forEach(filename => {
          const regex = new RegExp(`--- FILE: ${filename} ---\\n([\\s\\S]*?)(?=\\n\\n--- FILE:|\\n\\nMOCK_ZIP|$)`);
          const fileContentMatch = content.match(regex);
          if (fileContentMatch) {
            const extPath = normalizePath(resolvePath(currentDir, filename, os), os);
            result.newVfs[extPath] = {
              type: 'file',
              content: fileContentMatch[1].trim(),
              updatedAt: Date.now()
            };
          }
        });
        result.output = `Archive:  ${zipFile}\n  inflating: ${filesList.join('\n  inflating: ')}`;
      } else {
        result.output = `unzip: corrupted archive format.`;
        result.isError = true;
      }
      return result;
    }
    
    if (cmdName === 'tar') {
      const isCreate = args.includes('-cvf') || args.includes('cvf');
      const isExtract = args.includes('-xvf') || args.includes('xvf');
      
      if (isCreate) {
        const tarFile = args[args.indexOf('-cvf') !== -1 ? args.indexOf('-cvf') + 1 : args.indexOf('cvf') + 1];
        const startIdx = Math.max(args.indexOf('-cvf'), args.indexOf('cvf')) + 2;
        const targetFiles = args.slice(startIdx);
        
        if (!tarFile || targetFiles.length === 0) {
          result.output = 'Usage: tar -cvf <archive.tar> <file1> <file2>...';
          result.isError = true;
          return result;
        }
        
        const tarPath = normalizePath(resolvePath(currentDir, tarFile, os), os);
        const manifest: string[] = [];
        const contents: string[] = [];
        
        for (const f of targetFiles) {
          const fPath = normalizePath(resolvePath(currentDir, f, os), os);
          if (pathExists(vfs, fPath) && vfs[fPath].type === 'file') {
            manifest.push(f);
            contents.push(`--- FILE: ${f} ---\n${vfs[fPath].content}`);
          }
        }
        
        result.newVfs[tarPath] = {
          type: 'file',
          content: `MOCK_TAR_ARCHIVE\nFiles: ${manifest.join(',')}\n\n${contents.join('\n\n')}`,
          updatedAt: Date.now()
        };
        result.output = targetFiles.map(f => `a ${f}`).join('\n') + `\nCreated Tar archive: ${tarFile}`;
        return result;
      }
      
      if (isExtract) {
        const tarFile = args[args.indexOf('-xvf') !== -1 ? args.indexOf('-xvf') + 1 : args.indexOf('xvf') + 1];
        if (!tarFile) {
          result.output = 'Usage: tar -xvf <archive.tar>';
          result.isError = true;
          return result;
        }
        
        const tarPath = normalizePath(resolvePath(currentDir, tarFile, os), os);
        const tarItem = vfs[tarPath];
        if (!pathExists(vfs, tarPath) || tarItem.type !== 'file' || !tarItem.content.startsWith('MOCK_TAR_ARCHIVE')) {
          result.output = `tar: cannot open archive ${tarFile}: No such file or directory`;
          result.isError = true;
          return result;
        }
        
        const content = tarItem.content;
        const fileMatch = content.match(/Files: (.*)\n/);
        if (fileMatch) {
          const filesList = fileMatch[1].split(',');
          filesList.forEach(filename => {
            const regex = new RegExp(`--- FILE: ${filename} ---\\n([\\s\\S]*?)(?=\\n\\n--- FILE:|$)`);
            const fileContentMatch = content.match(regex);
            if (fileContentMatch) {
              const extPath = normalizePath(resolvePath(currentDir, filename, os), os);
              result.newVfs[extPath] = {
                type: 'file',
                content: fileContentMatch[1].trim(),
                updatedAt: Date.now()
              };
            }
          });
          result.output = filesList.map(f => `x ${f}`).join('\n');
        } else {
          result.output = `tar: corrupted tape archive.`;
          result.isError = true;
        }
        return result;
      }
      
      result.output = 'Usage: tar -cvf <archive.tar> <files...> OR tar -xvf <archive.tar>';
      result.isError = true;
      return result;
    }
  }

  // Whoami command
  if (cmdName === 'whoami') {
    result.output = isWindows ? 'desktop-simulator\\user' : 'user';
    return result;
  }

  // Date command
  if (cmdName === 'date' || cmdName === 'get-date') {
    result.output = new Date().toString();
    return result;
  }

  // Uname or ver command
  if (cmdName === 'uname') {
    if (os === 'macos') {
      result.output = 'Darwin terminal-lab 23.4.0 Darwin Kernel Version 23.4.0: Fri Mar  8 00:07:42 PST 2026; root:xnu-10063.101.17~2/RELEASE_ARM64_T8112 arm64';
    } else {
      result.output = 'Linux terminal-lab 6.8.0-virtual-gemini #1 SMP PREEMPT_DYNAMIC Tue Jun 30 09:00:00 UTC 2026 x86_64 GNU/Linux';
    }
    return result;
  }
  if (cmdName === 'ver') {
    result.output = isWindows 
      ? 'Microsoft Windows [Version 10.0.22631.3527]' 
      : "ver: command not found (Did you mean 'uname' for Linux/macOS?)";
    if (!isWindows) result.isError = true;
    return result;
  }

  // Hostname command
  if (cmdName === 'hostname') {
    result.output = isWindows ? 'DESKTOP-SIMULATOR' : 'terminal-lab';
    return result;
  }

  // Uptime command
  if (cmdName === 'uptime') {
    result.output = isWindows 
      ? 'Uptime: 0 days, 2 hours, 15 minutes, 33 seconds' 
      : ' 09:45:12 up 2:15,  1 user,  load average: 0.08, 0.04, 0.01';
    return result;
  }

  // Ping command
  if (cmdName === 'ping') {
    const host = args[1];
    if (!host) {
      result.output = isWindows 
        ? 'Ping: host is required.\nUsage: ping <hostname_or_ip>' 
        : "ping: missing host operand\nTry 'ping --help' or 'ping <host>' for more information.";
      result.isError = true;
      return result;
    }
    
    const latencies = [
      12 + Math.floor(Math.random() * 8),
      11 + Math.floor(Math.random() * 8),
      14 + Math.floor(Math.random() * 8),
      13 + Math.floor(Math.random() * 8)
    ];
    
    if (isWindows) {
      result.output = `\nPinging ${host} with 32 bytes of data:\nReply from ${host}: bytes=32 time=${latencies[0]}ms TTL=54\nReply from ${host}: bytes=32 time=${latencies[1]}ms TTL=54\nReply from ${host}: bytes=32 time=${latencies[2]}ms TTL=54\nReply from ${host}: bytes=32 time=${latencies[3]}ms TTL=54\n\nPing statistics for ${host}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = ${Math.min(...latencies)}ms, Maximum = ${Math.max(...latencies)}ms, Average = ${Math.round(latencies.reduce((a,b)=>a+b,0)/4)}ms`;
    } else {
      result.output = `\nPING ${host} (${host}) 56(84) bytes of data.\n64 bytes from ${host}: icmp_seq=1 ttl=54 time=${latencies[0]}.4 ms\n64 bytes from ${host}: icmp_seq=2 ttl=54 time=${latencies[1]}.2 ms\n64 bytes from ${host}: icmp_seq=3 ttl=54 time=${latencies[2]}.9 ms\n64 bytes from ${host}: icmp_seq=4 ttl=54 time=${latencies[3]}.1 ms\n\n--- ${host} ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss, time 3004ms\nrtt min/avg/max/mdev = ${Math.min(...latencies)}.2/${(latencies.reduce((a,b)=>a+b,0)/4).toFixed(1)}/${Math.max(...latencies)}.9/0.82 ms`;
    }
    return result;
  }

  // Curl or wget command
  if (cmdName === 'curl' || cmdName === 'wget' || cmdName === 'iwr' || cmdName === 'invoke-webrequest') {
    let url = '';
    let outFile = '';
    
    if (cmdName === 'curl') {
      const oIndex = args.indexOf('-o');
      if (oIndex !== -1 && args[oIndex + 1]) {
        outFile = args[oIndex + 1];
        url = args.filter((_, idx) => idx !== 0 && idx !== oIndex && idx !== oIndex + 1)[0] || '';
      } else {
        url = args[1] || '';
      }
    } else if (cmdName === 'wget') {
      const oIndex = args.indexOf('-O');
      if (oIndex !== -1 && args[oIndex + 1]) {
        outFile = args[oIndex + 1];
        url = args.filter((_, idx) => idx !== 0 && idx !== oIndex && idx !== oIndex + 1)[0] || '';
      } else {
        url = args[1] || '';
      }
    } else {
      const oIndex = args.indexOf('-OutFile');
      if (oIndex !== -1 && args[oIndex + 1]) {
        outFile = args[oIndex + 1];
        url = args.filter((_, idx) => idx !== 0 && idx !== oIndex && idx !== oIndex + 1)[0] || '';
      } else {
        url = args[1] || '';
      }
    }
    
    if (!url) {
      result.output = `Usage: ${cmdName} [options] <url>`;
      result.isError = true;
      return result;
    }

    const domain = url.replace(/^https?:\/\//, '').split('/')[0];
    const pathPart = url.replace(/^https?:\/\/[^\/]+/, '') || '/';
    let responseBody = '';
    let contentType = 'text/html';
    
    if (url.includes('api/') || url.includes('.json')) {
      contentType = 'application/json';
      responseBody = JSON.stringify({
        status: "success",
        message: "Chào mừng bạn tới endpoint API ảo của Terminal Lab!",
        data: {
          requestUrl: url,
          timestamp: Date.now(),
          clientIp: "192.168.1.100",
          protocol: url.startsWith('https') ? "HTTPS" : "HTTP",
          userAgent: "TerminalLab/1.0"
        }
      }, null, 2);
    } else {
      responseBody = `<!DOCTYPE html>\n<html>\n<head>\n    <title>Chào mừng tới ${domain}</title>\n</head>\n<body>\n    <h1>Trang web được giả lập thành công!</h1>\n    <p>Bạn đã yêu cầu trang: ${pathPart} từ tên miền: ${domain}</p>\n    <p>Uptime của máy chủ: 100%.</p>\n</body>\n</html>`;
    }

    if (outFile) {
      const target = normalizePath(resolvePath(currentDir, outFile, os), os);
      result.newVfs[target] = {
        type: 'file',
        content: responseBody,
        updatedAt: Date.now()
      };
      
      if (cmdName === 'wget') {
        result.output = `\n--2026-06-30 09:46:22--  ${url}\nResolving ${domain} (${domain})... 172.217.161.110\nConnecting to ${domain} (${domain})|172.217.161.110|:443... connected.\nHTTP request sent, awaiting response... 200 OK\nLength: ${responseBody.length} [${contentType}]\nSaving to: ‘${outFile}’\n\n${outFile}          100%[===================>] ${responseBody.length}  --.-KB/s    in 0.05s   \n\n2026-06-30 09:46:22 (450 KB/s) - ‘${outFile}’ saved [${responseBody.length}/${responseBody.length}]`;
      } else if (isWindows) {
        result.output = `\nStatusCode        : 200\nStatusDescription : OK\nContent           : ${responseBody.slice(0, 100)}...\nRawContent        : HTTP/1.1 200 OK\n                    Content-Length: ${responseBody.length}\n                    Content-Type: ${contentType}\n                    \n                    ${responseBody.slice(0, 100)}...\nHeaders           : {[Content-Length, ${responseBody.length}], [Content-Type, ${contentType}]}\nImages            : {}\nInputFields       : {}\nLinks             : {}`;
      } else {
        result.output = `  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100  ${responseBody.length}  100  ${responseBody.length}    0     0   2000      0 --:--:-- --:--:-- --:--:--  2000`;
      }
    } else {
      if (cmdName === 'wget') {
        result.output = "wget: Must specify output file (use '-O -' to print to stdout). In local simulation, try using 'curl' instead!";
        result.isError = true;
      } else if (isWindows && cmdName !== 'curl') {
        result.output = `\nStatusCode        : 200\nStatusDescription : OK\nContent           : ${responseBody}\nRawContent        : HTTP/1.1 200 OK\n                    Content-Length: ${responseBody.length}\n                    Content-Type: ${contentType}\n                    \n                    ${responseBody}`;
      } else {
        result.output = responseBody;
      }
    }
    return result;
  }

  // df and du command
  if (cmdName === 'df') {
    result.output = '\nFilesystem     1K-blocks      Used Available Use% Mounted on\noverlay         61253408  22451324  38785684  37% /\ntmpfs              65536         0     65536   0% /dev\n/dev/sda1       61253408  22451324  38785684  37% /etc/hosts\nshm                65536         0     65536   0% /dev/shm';
    return result;
  }

  if (cmdName === 'du') {
    const target = args[1] ? normalizePath(resolvePath(currentDir, args[1], os), os) : currentDir;
    
    if (!pathExists(vfs, target)) {
      result.output = `du: cannot access '${args[1]}': No such file or directory`;
      result.isError = true;
      return result;
    }
    
    const paths = Object.keys(vfs).filter(p => p.startsWith(target));
    let totalSize = 0;
    const lines: string[] = [];
    
    paths.forEach(p => {
      const item = vfs[p];
      if (item.type === 'file') {
        const size = Math.ceil((item.content?.length || 0) / 1024) || 1;
        totalSize += size;
        const relativeName = p.replace(currentDir, '').replace(/^[\\\/]/, '') || '.';
        lines.push(`${size}K\t${relativeName}`);
      }
    });
    
    result.output = lines.join('\n') + `\n${totalSize}K\t.`;
    return result;
  }

  // ps or tasklist command
  if (cmdName === 'ps' || cmdName === 'tasklist') {
    if (isWindows) {
      result.output = '\nImage Name                     PID Session Name        Session#    Mem Usage\n========================= ======== ================ =========== ============\nSystem Idle Process              0 Services                   0         8 K\nSystem                           4 Services                   0       156 K\nsmss.exe                       120 Services                   0       450 K\ncsrss.exe                      340 Services                   0     3,200 K\nwininit.exe                    412 Services                   0     1,240 K\nservices.exe                   512 Services                   0    12,450 K\nlsass.exe                      520 Services                   0     8,120 K\nsvchost.exe                    844 Services                   0    24,560 K\nexplorer.exe                  1240 Console                    1    85,120 K\npowershell.exe                2512 Console                    1    45,300 K\ntasklist.exe                  3412 Console                    1     4,220 K';
    } else {
      result.output = '\n  PID TTY          TIME CMD\n 1102 pts/0    00:00:01 systemd\n 1105 pts/0    00:00:00 bash\n 2514 pts/0    00:00:02 python3\n 2640 pts/0    00:00:00 node\n 3544 pts/0    00:00:00 ps';
    }
    return result;
  }

  // kill or taskkill command
  if (cmdName === 'kill' || cmdName === 'taskkill') {
    const pid = args[1];
    if (!pid) {
      result.output = isWindows 
        ? 'ERROR: PID or image name required.' 
        : "kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l";
      result.isError = true;
      return result;
    }
    result.output = isWindows 
      ? `SUCCESS: Sent termination signal to process with PID ${pid}.`
      : `Process with PID ${pid} terminated.`;
    return result;
  }

  // chmod command
  if (cmdName === 'chmod') {
    if (!args[1] || !args[2]) {
      result.output = 'Usage: chmod <mode> <file_path>';
      result.isError = true;
      return result;
    }
    const target = normalizePath(resolvePath(currentDir, args[2], os), os);
    if (!pathExists(vfs, target)) {
      result.output = `chmod: cannot access '${args[2]}': No such file or directory`;
      result.isError = true;
      return result;
    }
    result.output = `Đã phân quyền '${args[1]}' cho tệp tin/thư mục '${args[2]}' thành công!`;
    return result;
  }

  // Copy command
  if (cmdName === 'cp' || cmdName === 'copy') {
    if (!args[1] || !args[2]) {
      result.output = `Usage: ${cmdName} <source> <destination>`;
      result.isError = true;
      return result;
    }
    const src = normalizePath(resolvePath(currentDir, args[1], os), os);
    const dest = normalizePath(resolvePath(currentDir, args[2], os), os);
    
    if (!pathExists(vfs, src)) {
      result.output = `Error: Source path '${args[1]}' does not exist.`;
      result.isError = true;
      return result;
    }
    
    if (vfs[src].type === 'dir') {
      result.output = `Error: Copying directories is not supported locally. Use AI simulation for advanced directory actions.`;
      result.isError = true;
      return result;
    }

    result.newVfs[dest] = {
      type: 'file',
      content: vfs[src].content || '',
      updatedAt: Date.now()
    };
    result.output = `Đã sao chép '${args[1]}' sang '${args[2]}'`;
    return result;
  }

  // Move/Rename command
  if (cmdName === 'mv' || cmdName === 'move' || cmdName === 'ren' || cmdName === 'rename') {
    if (!args[1] || !args[2]) {
      result.output = `Usage: ${cmdName} <source> <destination>`;
      result.isError = true;
      return result;
    }
    const src = normalizePath(resolvePath(currentDir, args[1], os), os);
    const dest = normalizePath(resolvePath(currentDir, args[2], os), os);
    
    if (!pathExists(vfs, src)) {
      result.output = `Error: Source path '${args[1]}' does not exist.`;
      result.isError = true;
      return result;
    }

    if (vfs[src].type === 'dir') {
      result.output = `Error: Moving directories is not supported locally. Use AI simulation for advanced directory actions.`;
      result.isError = true;
      return result;
    }

    result.newVfs[dest] = {
      type: 'file',
      content: vfs[src].content || '',
      updatedAt: Date.now()
    };
    delete result.newVfs[src];
    result.output = `Đã di chuyển/đổi tên '${args[1]}' thành '${args[2]}'`;
    return result;
  }

  // Grep / Select-String command
  if (cmdName === 'grep' || cmdName === 'select-string') {
    // Basic search: grep <pattern> <file> or grep -i <pattern> <file>
    let pattern = '';
    let targetFile = '';
    let ignoreCase = false;
    
    const patternArgs = args.slice(1);
    const iIndex = patternArgs.indexOf('-i');
    if (iIndex !== -1) {
      ignoreCase = true;
      patternArgs.splice(iIndex, 1);
    }
    
    pattern = patternArgs[0] || '';
    targetFile = patternArgs[1] || '';
    
    if (!pattern || !targetFile) {
      result.output = `Usage: ${cmdName} [-i] <pattern> <file_path>`;
      result.isError = true;
      return result;
    }
    
    const target = normalizePath(resolvePath(currentDir, targetFile, os), os);
    if (!pathExists(vfs, target)) {
      result.output = `Error: File not found: ${targetFile}`;
      result.isError = true;
      return result;
    }
    
    if (vfs[target].type !== 'file') {
      result.output = `Error: '${targetFile}' is a directory.`;
      result.isError = true;
      return result;
    }
    
    const lines = vfs[target].content.split('\n');
    const matchedLines: string[] = [];
    
    const searchRegex = new RegExp(pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), ignoreCase ? 'i' : '');
    
    lines.forEach((line, index) => {
      if (searchRegex.test(line)) {
        matchedLines.push(`${index + 1}: ${line}`);
      }
    });
    
    if (matchedLines.length === 0) {
      result.output = `Không tìm thấy kết quả khớp cho "${pattern}"`;
    } else {
      result.output = matchedLines.join('\n');
    }
    return result;
  }

  // Head and Tail commands
  if (cmdName === 'head' || cmdName === 'tail') {
    let targetFile = '';
    let linesCount = 10;
    
    // Check for -n parameter
    const nIndex = args.indexOf('-n');
    if (nIndex !== -1 && args[nIndex + 1]) {
      linesCount = parseInt(args[nIndex + 1], 10) || 10;
      targetFile = args.filter((_, idx) => idx !== 0 && idx !== nIndex && idx !== nIndex + 1)[0] || '';
    } else {
      targetFile = args[1] || '';
    }
    
    if (!targetFile) {
      result.output = `Usage: ${cmdName} [-n <lines_count>] <file_path>`;
      result.isError = true;
      return result;
    }
    
    const target = normalizePath(resolvePath(currentDir, targetFile, os), os);
    if (!pathExists(vfs, target)) {
      result.output = `Error: File not found: ${targetFile}`;
      result.isError = true;
      return result;
    }
    
    if (vfs[target].type !== 'file') {
      result.output = `Error: '${targetFile}' is a directory.`;
      result.isError = true;
      return result;
    }
    
    const fileLines = vfs[target].content.split('\n');
    const outputLines = cmdName === 'head' 
      ? fileLines.slice(0, linesCount) 
      : fileLines.slice(-linesCount);
      
    result.output = outputLines.join('\n');
    return result;
  }

  // Custom neofetch or systeminfo
  if (cmdName === 'neofetch' || cmdName === 'systeminfo') {
    if (cmdName === 'systeminfo' && isWindows) {
      result.output = `
OS Name:                   Microsoft Windows 11 Education Simulator
OS Version:                10.0.22631 N/A Build 22631
OS Manufacturer:           Terminal Lab Corp.
System Boot Time:          30/06/2026, 09:00:00
System Model:              Virtual Sandbox Client
Processor(s):              Gemini 3.5 Virtual Core
BIOS Version:              AIS-VBIOS - 2026
Total Physical Memory:     8.192 MB
Virtual Memory: Max Size:  16.384 MB
Network Card(s):           1 NIC(s) Installed.
                           [01]: Realtek Virtual PCIe GbE Family Controller
                                 Connection Name: Ethernet Virtual
                                 IP address:      192.168.1.100
`;
    } else {
      const art = isWindows ? '🪟 Windows PS' : os === 'macos' ? '🍎 macOS Darwin' : os === 'arch-linux' ? '⚙️ Arch Linux' : '🐧 Debian Linux';
      result.output = `
\x1b[32m       _.---._         \x1b[0m   \x1b[1;36muser\x1b[0m@\x1b[1;36mterminal-lab\x1b[0m
\x1b[32m     .\'       \'.       \x1b[0m   -----------------
\x1b[32m    /   \x1b[33m_\x1b[32m   \x1b[33m_\x1b[32m   \\      \x1b[0m   \x1b[1;33mOS\x1b[0m: ${art} Virtual Simulator
\x1b[32m   |   \x1b[31m(_)\x1b[32m \x1b[31m(_)\x1b[32m   |     \x1b[0m   \x1b[1;33mKernel\x1b[0m: 6.8.0-virtual-gemini
\x1b[32m   |   \\_     _/   |     \x1b[0m   \x1b[1;33mUptime\x1b[0m: 23 mins
\x1b[32m    \\    \'---\'    /      \x1b[0m   \x1b[1;33mPackages\x1b[0m: 1045 (mocked)
\x1b[32m     \'.         .\'       \x1b[0m   \x1b[1;33mShell\x1b[0m: ${isWindows ? 'PowerShell' : os === 'macos' ? 'zsh' : 'bash'}
\x1b[32m       \'-._____.-\'       \x1b[0m   \x1b[1;33mTerminal\x1b[0m: HTML5 Terminal Lab Emulator
                            \x1b[1;33mCPU\x1b[0m: Gemini AI Cognitive Engine (v3.5)
                            \x1b[1;33mMemory\x1b[0m: 4096MiB / 8192MiB (Virtual)
`;
    }
    return result;
  }

  // Package Managers
  if (cmdName === 'apt-get' || cmdName === 'apt') {
    const action = args[1];
    if (action === 'update') {
      result.output = `
Hit:1 http://deb.debian.org/debian stable InRelease
Get:2 http://deb.debian.org/debian stable-updates InRelease [55.4 kB]
Get:3 http://security.debian.org/debian-security stable-security InRelease [48.4 kB]
Fetched 104 kB in 1s (104 kB/s)
Reading package lists... Done
Building dependency tree... Done
All simulated packages are up to date.
`;
    } else if (action === 'install' && args[2]) {
      result.output = `
Reading package lists... Done
Building dependency tree... Done
The following NEW packages will be installed:
  ${args[2]}
0 upgraded, 1 newly installed, 0 to remove.
Need to get 145 kB of archives.
Unpacking ${args[2]}...
Setting up ${args[2]}...
Processing triggers for man-db... Done
\x1b[32m✔ Gói '${args[2]}' đã được cài đặt vào môi trường Debian ảo!\x1b[0m
`;
    } else {
      result.output = 'Usage: apt-get [update | install <package>]';
    }
    return result;
  }

  if (cmdName === 'pacman') {
    const flag = args[1];
    if (flag === '-syu') {
      result.output = `
:: Synchronizing package databases...
 core is up to date
 extra is up to date
 community is up to date
:: Starting full system upgrade...
 there is nothing to do.
`;
    } else if (flag === '-s' && args[2]) {
      result.output = `
resolving dependencies...
looking for conflicting packages...

Packages (1) ${args[2]}-1.0.0

Total Installed Size:  0.45 MiB

:: Proceed with installation? [Y/n] y
(1/1) checking keys                                 [######################] 100%
(1/1) installing ${args[2]}                           [######################] 100%
:: Running post-transaction hooks...
\x1b[32m✔ Gói '${args[2]}' đã được cài đặt vào môi trường Arch Linux ảo!\x1b[0m
`;
    } else {
      result.output = 'Usage: pacman [-Syu | -S <package>]';
    }
    return result;
  }

  if (cmdName === 'brew') {
    const action = args[1];
    if (action === 'install' && args[2]) {
      result.output = `
==> Downloading https://formulae.brew.sh/api/formula/${args[2]}.json
==> Fetching ${args[2]}
==> Pouring ${args[2]}--1.0.0.bottle.tar.gz
🍺  /opt/homebrew/Cellar/${args[2]}/1.0.0: 12 files, 450KB
==> Running \`brew cleanup ${args[2]}\`...
\x1b[32m✔ Gói '${args[2]}' đã cài đặt thành công qua Homebrew!\x1b[0m
`;
    } else {
      result.output = 'Usage: brew install <package>';
    }
    return result;
  }

  if (cmdName === 'choco') {
    const action = args[1];
    if (action === 'install' && args[2]) {
      result.output = `
Chocolatey v1.1.0
Installing ${args[2]}...
${args[2]} package files install completed. Performing other installation steps.
The install of ${args[2]} was successful.
  Software installed to 'C:\\ProgramData\\chocolatey\\lib\\${args[2]}'
choco install completed.
`;
    } else {
      result.output = 'Usage: choco install <package>';
    }
    return result;
  }

  // Language Run Simulation (Local parsing for simple scripts)
  if (cmdName === 'python' || cmdName === 'python3' || cmdName === 'node') {
    const fileArg = args[1];
    if (!fileArg) {
      // Interactive Mode Mock
      result.output = cmdName.startsWith('py') 
        ? `Python 3.10.12 (virtual shell, Jun 30 2026)\n>>> ` 
        : `Welcome to Node.js v18.16.0 (virtual shell).\n> `;
      return result;
    }

    const target = normalizePath(resolvePath(currentDir, fileArg, os), os);
    if (pathExists(vfs, target)) {
      if (vfs[target].type === 'file') {
        const content = vfs[target].content;
        // Check if we can execute simple local script parsing
        // We'll support simple printing and arithmetic logic
        try {
          const lines = content.split('\n');
          const consoleOutputs: string[] = [];
          
          if (cmdName.startsWith('py')) {
            // Very simple Python print parser
            lines.forEach(line => {
              const printMatch = line.match(/^\s*print\s*\(\s*f?["'](.*?)["']\s*\)/);
              if (printMatch) {
                let text = printMatch[1];
                // Replace simple variables
                text = text.replace(/\{ban_kinh\}/, '5');
                text = text.replace(/\{dien_tich:.2f\}/, '78.54');
                consoleOutputs.push(text);
              } else if (line.trim() && !line.startsWith('#') && !line.startsWith('def') && !line.startsWith('import') && !line.startsWith('if') && !line.trim().startsWith('print')) {
                // Ignore general variables
              }
            });
            if (consoleOutputs.length === 0) {
              // Standard message if code is too complex for our tiny parser
              result.output = `[Terminal Lab Engine]: Đang chạy script Python bằng AI Engine...\n` + 
                `--- Python Output ---\n` +
                `Khởi chạy script Python thành công.\n`;
            } else {
              result.output = consoleOutputs.join('\n');
            }
          } else {
            // NodeJS print parser
            lines.forEach(line => {
              const logMatch = line.match(/console\.log\(\s*["'](.*?)["']\s*\)/);
              if (logMatch) {
                consoleOutputs.push(logMatch[1]);
              }
            });
            if (consoleOutputs.length === 0) {
              result.output = `[Terminal Lab Engine]: Đang chạy NodeJS script bằng AI Engine...\n` +
                `--- Node Output ---\n` +
                `Khởi chạy script NodeJS thành công.\n`;
            } else {
              result.output = consoleOutputs.join('\n');
            }
          }
        } catch (e) {
          result.output = `Error running script: ${(e as Error).message}`;
          result.isError = true;
        }
      } else {
        result.output = `Error: ${fileArg} is a directory.`;
        result.isError = true;
      }
    } else {
      result.output = `Error: File not found: ${fileArg}`;
      result.isError = true;
    }
    return result;
  }

  // Shell scripting execution (e.g. bash welcome.sh or ./welcome.sh)
  if (cmdName === 'bash' || cmdName === 'sh' || cmdName === 'zsh' || cmdName.startsWith('./')) {
    const scriptFile = cmdName.startsWith('./') ? cmdName.slice(2) : args[1];
    if (!scriptFile) {
      result.output = `Interactive ${cmdName} terminal started.`;
      return result;
    }

    const target = normalizePath(resolvePath(currentDir, scriptFile, os), os);
    if (pathExists(vfs, target) && vfs[target].type === 'file') {
      const content = vfs[target].content;
      const outputs: string[] = [];
      const lines = content.split('\n');
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('echo ')) {
          // simple echo parser, strip quotes
          const echoText = trimmedLine.slice(5).replace(/^['"]|['"]$/g, '');
          outputs.push(echoText);
        }
      });
      result.output = outputs.join('\n');
    } else {
      result.output = `Error: Script not found or permission denied: ${scriptFile}`;
      result.isError = true;
    }
    return result;
  }

  // Git Simulator Engine
  if (cmdName === 'git') {
    const gitAction = args[1];
    
    if (!gitAction) {
      result.output = `
usage: git [--version] [--help] <command> [<args>]
These are common Git commands:
   init       Create an empty Git repository
   status     Show the working tree status
   add        Add file contents to the index
   commit     Record changes to the repository
   branch     List, create, or delete branches
   checkout   Switch branches or restore working tree files
   log        Show commit logs
   diff       Show changes between commits
`;
      return result;
    }

    if (gitAction === 'init') {
      result.newGit.isInitialized = true;
      result.newGit.stagedFiles = [];
      result.newGit.commits = [];
      result.newGit.branches = ['main'];
      result.newGit.currentBranch = 'main';
      result.newGit.head = null;
      
      // Seed .git folder in VFS
      const gitDir = normalizePath(currentDir + (isWindows ? '\\.git' : '/.git'), os);
      result.newVfs[gitDir] = { type: 'dir', updatedAt: Date.now() };
      result.output = 'Initialized empty Git repository in ' + gitDir;
      return result;
    }

    // Guard for non-initialized repo
    if (!gitState.isInitialized) {
      result.output = 'fatal: not a git repository (or any of the parent directories): .git';
      result.isError = true;
      return result;
    }

    if (gitAction === 'status') {
      const allFiles = Object.keys(vfs).filter(p => {
        // filter out folders, .git folder, etc.
        if (vfs[p].type === 'dir') return false;
        if (p.includes('.git')) return false;
        return p.startsWith(currentDir);
      });

      const staged = gitState.stagedFiles;
      const untracked = allFiles.filter(f => !staged.includes(f));

      let output = `On branch ${gitState.currentBranch}\n`;
      if (staged.length > 0) {
        output += `\nChanges to be committed:\n  (use "git restore --staged <file>..." to unstage)\n`;
        staged.forEach(f => {
          const filename = f.split(isWindows ? '\\' : '/').pop() || '';
          output += `\t\x1b[32mnew file:   ${filename}\x1b[0m\n`;
        });
      }

      if (untracked.length > 0) {
        output += `\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n`;
        untracked.forEach(f => {
          const filename = f.split(isWindows ? '\\' : '/').pop() || '';
          output += `\t\x1b[31m${filename}\x1b[0m\n`;
        });
      }

      if (staged.length === 0 && untracked.length === 0) {
        output += `nothing to commit, working tree clean`;
      }
      result.output = output;
      return result;
    }

    if (gitAction === 'add') {
      const fileArg = args[2];
      if (!fileArg) {
        result.output = 'Nothing specified, nothing added.';
        return result;
      }

      const allFiles = Object.keys(vfs).filter(p => vfs[p].type === 'file' && !p.includes('.git'));
      
      if (fileArg === '.' || fileArg === '*') {
        // Add all files in currentDir
        const targets = allFiles.filter(p => p.startsWith(currentDir));
        result.newGit.stagedFiles = Array.from(new Set([...gitState.stagedFiles, ...targets]));
        result.output = `Đã đưa ${targets.length} tệp tin vào khu vực chờ commit.`;
      } else {
        const absFile = normalizePath(resolvePath(currentDir, fileArg, os), os);
        if (pathExists(vfs, absFile)) {
          result.newGit.stagedFiles = Array.from(new Set([...gitState.stagedFiles, absFile]));
          result.output = `Đã chuẩn bị (staged) tệp tin: ${fileArg}`;
        } else {
          result.output = `fatal: pathspec '${fileArg}' did not match any files`;
          result.isError = true;
        }
      }
      return result;
    }

    if (gitAction === 'commit') {
      // Find index of -m flag
      const mIndex = args.indexOf('-m');
      let commitMsg = '';
      if (mIndex !== -1 && args[mIndex + 1]) {
        commitMsg = args[mIndex + 1];
      } else {
        commitMsg = 'Cập nhật định kỳ';
      }

      if (gitState.stagedFiles.length === 0) {
        result.output = 'On branch ' + gitState.currentBranch + '\nnothing to commit, working tree clean';
        return result;
      }

      // Capture snapshot
      const snapshot: Record<string, string> = {};
      Object.keys(vfs).forEach(p => {
        if (vfs[p].type === 'file' && !p.includes('.git')) {
          snapshot[p] = vfs[p].content;
        }
      });

      const commitId = 'c' + Math.random().toString(16).slice(2, 9);
      const newCommit: GitCommit = {
        id: commitId,
        message: commitMsg,
        author: 'Learner <learner@terminallab.dev>',
        timestamp: Date.now(),
        parent: gitState.head,
        changes: snapshot
      };

      result.newGit.commits = [newCommit, ...gitState.commits];
      result.newGit.head = commitId;
      result.newGit.stagedFiles = [];
      result.output = `[${gitState.currentBranch} ${commitId}] ${commitMsg}\n ${Object.keys(snapshot).length} files changed, commit recorded.`;
      return result;
    }

    if (gitAction === 'log') {
      if (gitState.commits.length === 0) {
        result.output = 'fatal: your current branch does not have any commits yet';
        result.isError = true;
        return result;
      }

      result.output = gitState.commits.map(c => {
        const dateStr = new Date(c.timestamp).toUTCString();
        return `\x1b[33mcommit ${c.id}\x1b[0m\nAuthor: ${c.author}\nDate:   ${dateStr}\n\n    ${c.message}\n`;
      }).join('\n');
      return result;
    }

    if (gitAction === 'branch') {
      const branchName = args[2];
      if (!branchName) {
        // List branches
        result.output = gitState.branches.map(b => {
          if (b === gitState.currentBranch) {
            return `* \x1b[32m${b}\x1b[0m`;
          }
          return `  ${b}`;
        }).join('\n');
      } else {
        if (gitState.branches.includes(branchName)) {
          result.output = `fatal: A branch named '${branchName}' already exists.`;
          result.isError = true;
        } else {
          result.newGit.branches = [...gitState.branches, branchName];
          result.output = `Đã tạo nhánh mới: ${branchName}`;
        }
      }
      return result;
    }

    if (gitAction === 'checkout') {
      const target = args[2];
      if (!target) {
        result.output = 'fatal: branch name or commit hash required';
        result.isError = true;
        return result;
      }

      if (gitState.branches.includes(target)) {
        result.newGit.currentBranch = target;
        result.output = `Switched to branch '${target}'`;
      } else {
        // Check if commit ID
        const commit = gitState.commits.find(c => c.id === target);
        if (commit) {
          result.newGit.head = commit.id;
          // Restore VFS state of that commit
          Object.keys(commit.changes).forEach(p => {
            result.newVfs[p] = {
              type: 'file',
              content: commit.changes[p],
              updatedAt: Date.now()
            };
          });
          result.output = `Note: switching to '${target}'.\nYou are in 'detached HEAD' state.`;
        } else {
          result.output = `error: pathspec '${target}' did not match any file(s) known to git`;
          result.isError = true;
        }
      }
      return result;
    }

    result.output = `git: '${gitAction}' is not a fully supported simulation command. Try: init, status, add, commit, branch, checkout, log.`;
    return result;
  }

  // If command not matched locally, return false or standard error message
  // We can let the calling function know it can call the Gemini simulator if it wants
  result.output = `__NOT_FOUND__`;
  result.isError = true;
  return result;
};
