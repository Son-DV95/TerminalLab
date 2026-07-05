import { LessonChallenge, VFS, GitState } from '../types';

export const LESSON_CHALLENGES: LessonChallenge[] = [
  {
    id: 'nav_basic',
    title: 'Khám phá Hệ Thống (Navigation)',
    os: 'all',
    difficulty: 'Cơ bản',
    description: 'Tìm hiểu vị trí hiện tại và xem danh sách các tập tin, thư mục trong hệ thống.',
    task: 'Kiểm tra đường dẫn thư mục hiện tại của bạn, sau đó liệt kê các tệp tin trong thư mục đó.',
    instructions: [
      'Linux/macOS: Gõ "pwd" để in đường dẫn hiện tại, gõ "ls" để liệt kê tệp tin.',
      'Windows: Gõ "pwd" (hoặc Get-Location) và "dir" (hoặc ls) để xem danh sách.'
    ],
    hint: 'Sử dụng lệnh "pwd" để xem thư mục hiện tại, và "ls" (Unix) hoặc "dir" (Windows) để liệt kê tệp.',
    validate: (vfs: VFS, lastCmd: string, gitState: GitState) => {
      const cleanCmd = lastCmd.trim().toLowerCase();
      if (cleanCmd === 'ls' || cleanCmd === 'dir' || cleanCmd === 'pwd' || cleanCmd.includes('get-childitem')) {
        return { success: true, message: 'Tuyệt vời! Bạn đã nắm được cách định vị và xem tệp tin.' };
      }
      return { success: false, message: 'Hãy gõ "ls" (Linux/macOS) hoặc "dir" (Windows) để hoàn thành thử thách.' };
    }
  },
  {
    id: 'create_files',
    title: 'Tạo Thư Mục & Tệp Tin mới',
    os: 'all',
    difficulty: 'Cơ bản',
    description: 'Tạo cấu trúc thư mục mới và một tập tin trống bên trong thư mục đó để quản lý mã nguồn.',
    task: 'Tạo thư mục mới tên là "project", sau đó tạo một tệp tin trống tên là "server.js" bên trong thư mục "project" đó (hoặc tạo trực tiếp "project/server.js").',
    instructions: [
      'Linux/macOS/Windows: Sử dụng lệnh "mkdir project" để tạo thư mục.',
      'Sau đó sử dụng lệnh "touch project/server.js" (Unix) hoặc "echo $null > project/server.js" (Windows) để tạo tập tin.'
    ],
    hint: 'Gõ "mkdir project" trước, sau đó tạo file bằng "touch project/server.js" hoặc gõ lần lượt "cd project" rồi "touch server.js" (Windows: "echo > server.js").',
    validate: (vfs: VFS, lastCmd: string, gitState: GitState) => {
      // Find if project/server.js exists in the virtual filesystem (taking into account both Unix and Windows path separators)
      const hasDirLinux = Object.keys(vfs).some(path => path.endsWith('/project') || path.endsWith('\\project'));
      const hasFileLinux = Object.keys(vfs).some(path => path.endsWith('/project/server.js') || path.endsWith('\\project\\server.js'));
      
      if (hasDirLinux && hasFileLinux) {
        return { success: true, message: 'Hoàn hảo! Thư mục "project" và tập tin "server.js" đã được tạo thành công.' };
      }
      if (hasDirLinux) {
        return { success: false, message: 'Đã thấy thư mục "project", nhưng chưa thấy tập tin "server.js" bên trong. Hãy dùng lệnh touch hoặc echo.' };
      }
      return { success: false, message: 'Hãy dùng lệnh "mkdir project" để bắt đầu.' };
    }
  },
  {
    id: 'run_python',
    title: 'Khởi Chạy Script Python',
    os: 'all',
    difficulty: 'Trung bình',
    description: 'Thực thi các script lập trình trực tiếp thông qua Terminal gắn kèm.',
    task: 'Chạy tệp tin Python "app.py" (hoặc "analyzer.py" đối với macOS) đã có sẵn trong thư mục home để xem kết quả tính toán hoặc phân tích.',
    instructions: [
      'Linux/macOS: Gõ "python3 app.py" hoặc "python app.py" (đối với macOS: "python3 analyzer.py" hoặc "python analyzer.py").',
      'Windows: Gõ "python welcome.ps1" hoặc đơn giản chạy script bằng lệnh "python app.py" nếu đã tạo.'
    ],
    hint: 'Hãy gõ "python app.py" hoặc "python3 app.py" (đối với macOS: "python analyzer.py" hoặc "python3 analyzer.py") để thực thi.',
    validate: (vfs: VFS, lastCmd: string, gitState: GitState) => {
      const cleanCmd = lastCmd.trim().toLowerCase();
      if (cleanCmd.includes('python') && (cleanCmd.includes('app.py') || cleanCmd.includes('analyzer.py'))) {
        return { success: true, message: 'Xuất sắc! Bạn đã thực thi thành công chương trình Python và xem kết quả ảo trên Terminal.' };
      }
      return { success: false, message: 'Hãy thử gõ "python app.py" (hoặc "python analyzer.py" trên macOS) để chạy script.' };
    }
  },
  {
    id: 'git_init',
    title: 'Khởi Tạo Kho Chứa Git',
    os: 'all',
    difficulty: 'Trung bình',
    description: 'Quản lý phiên bản mã nguồn của bạn bằng cách khởi tạo Git Repo ảo ngay trong Terminal.',
    task: 'Khởi tạo Git repo trong thư mục hiện hành, sau đó kiểm tra trạng thái tệp tin.',
    instructions: [
      'Gõ lệnh "git init" để tạo môi trường Git.',
      'Sau đó gõ "git status" để xem danh sách tệp tin chưa được theo dõi (untracked files).'
    ],
    hint: 'Sử dụng lệnh "git init" trước, sau đó gõ "git status".',
    validate: (vfs: VFS, lastCmd: string, gitState: GitState) => {
      if (gitState.isInitialized) {
        return { success: true, message: 'Tuyệt vời! Git đã được khởi tạo và đang sẵn sàng theo dõi các thay đổi của bạn.' };
      }
      return { success: false, message: 'Vui lòng thực hiện lệnh "git init" để khởi tạo kho lưu trữ.' };
    }
  },
  {
    id: 'git_commit',
    title: 'Thực Hiện Commit Đầu Tiên',
    os: 'all',
    difficulty: 'Nâng cao',
    description: 'Lưu lại dấu mốc lịch sử phát triển code bằng cách thêm tệp tin vào khu vực chờ (staged area) và tiến hành commit.',
    task: 'Đưa một tệp tin (ví dụ welcome.sh hoặc welcome.ps1) vào khu vực theo dõi và tiến hành commit với thông điệp "first commit".',
    instructions: [
      'Đảm bảo đã chạy "git init" thành công trước.',
      'Sử dụng lệnh "git add welcome.sh" (hoặc tên file khác) để đưa file vào hàng chờ.',
      'Gõ lệnh "git commit -m "first commit"" để lưu lại thay đổi.'
    ],
    hint: 'Sử dụng "git add <tên_file>" rồi "git commit -m \"first commit\"".',
    validate: (vfs: VFS, lastCmd: string, gitState: GitState) => {
      if (!gitState.isInitialized) {
        return { success: false, message: 'Bạn cần khởi tạo Git bằng lệnh "git init" trước.' };
      }
      if (gitState.commits.length > 0) {
        return { success: true, message: 'Tuyệt cú mèo! Bạn đã hoàn thành Commit đầu tiên để ghi lại lịch sử dự án.' };
      }
      if (gitState.stagedFiles.length > 0) {
        return { success: false, message: 'Đã thấy các tệp được đưa vào Staged (git add). Hãy tiếp tục gõ: git commit -m "first commit".' };
      }
      return { success: false, message: 'Hãy đưa tệp vào danh sách chuẩn bị bằng: git add <tên-tệp>.' };
    }
  },
  {
    id: 'shell_script',
    title: 'Viết & Chạy Script Shell',
    os: 'all',
    difficulty: 'Nâng cao',
    description: 'Tự động hóa các tác vụ lặp đi lặp lại bằng cách tạo một tệp tin script và thực thi nó.',
    task: 'Tạo một tập tin script tên là "test.sh" (hoặc "test.ps1" đối với Windows) có nội dung chứa "echo hello", sau đó thực thi tập tin đó.',
    instructions: [
      '1. Chọn trình soạn thảo code ở bên phải, tạo tệp tin mới tên là "test.sh" (Windows: "test.ps1").',
      '2. Viết mã: echo "Hello Terminal Lab" và nhấn lưu file.',
      '3. Chạy lệnh trong Terminal: "bash test.sh" hoặc "sh test.sh" (Windows: "./test.ps1" hoặc "powershell test.ps1").'
    ],
    hint: 'Bạn có thể sử dụng Trình soạn thảo bên cạnh để viết code nhanh hơn, sau đó chạy lệnh "bash test.sh" hoặc "powershell test.ps1" trong Terminal.',
    validate: (vfs: VFS, lastCmd: string, gitState: GitState) => {
      const cleanCmd = lastCmd.trim().toLowerCase();
      const hasScriptFile = Object.keys(vfs).some(path => path.endsWith('test.sh') || path.endsWith('test.ps1'));
      
      if (!hasScriptFile) {
        return { success: false, message: 'Chưa tìm thấy tập tin "test.sh" hoặc "test.ps1" trong hệ thống tập tin.' };
      }
      if (cleanCmd.includes('test.sh') || cleanCmd.includes('test.ps1') || cleanCmd.includes('bash test') || cleanCmd.includes('./test')) {
        return { success: true, message: 'Thành công rực rỡ! Bạn đã vừa tự tay viết kịch bản shell và chạy trực tiếp trên trình duyệt.' };
      }
      return { success: false, message: 'Đã tìm thấy tệp script! Hãy thực thi nó bằng lệnh: "bash test.sh" (Unix) hoặc "./test.ps1" (Windows).' };
    }
  }
];
