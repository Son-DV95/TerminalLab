import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Ensure Gemini API key is configured
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoint 1: Advanced command simulation via Gemini AI
  app.post('/api/simulate-command', async (req, res) => {
    try {
      const { command, currentDir, os, vfs } = req.body;

      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      if (!ai) {
        return res.status(503).json({
          output: `[Terminal Lab]: Chế độ ngoại tuyến (Offline mode). Để bật AI Simulator chạy các script nâng cao, vui lòng cấu hình GEMINI_API_KEY trong Cài đặt (Settings). Chạy các lệnh cd, ls, mkdir, touch, cat, git bình thường!`,
          isError: true,
          vfsChanges: {}
        });
      }

      // We pass a concise representation of the VFS to stay within prompt tokens and ensure safety
      const vfsFilesSummary = Object.entries(vfs as Record<string, any>).map(([path, data]) => {
        return {
          path,
          type: data.type,
          contentPreview: data.type === 'file' ? (data.content.length > 300 ? data.content.slice(0, 300) + '...' : data.content) : ''
        };
      });

      const prompt = `
        Bạn là nhân điều khiển thiết bị ảo Terminal Lab cho hệ điều hành "${os}".
        Nhiệm vụ của bạn là giả lập chính xác kết quả thực thi lệnh sau: "${command}"
        Thư mục làm việc hiện tại: "${currentDir}"
        Hệ thống tệp tin ảo hiện hành (VFS):
        ${JSON.stringify(vfsFilesSummary, null, 2)}

        Hãy mô phỏng kết quả thực thi lệnh này:
        1. Tạo ra đầu ra Terminal (stdout/stderr) thật chi tiết và giống đời thực 100% (bao gồm cả các thông báo lỗi nếu lệnh sai, các bảng kết quả của lệnh nâng cao, hoặc các dòng debug).
        2. Nếu lệnh này làm thay đổi VFS (ví dụ: chạy python tạo file, ghi đè file, biên dịch, v.v.), hãy cho biết những thay đổi đó trong vfsChanges.

        Bạn bắt buộc phải phản hồi ở định dạng JSON thô duy nhất, không bọc trong các đoạn văn giải thích, không viết thêm markdown ngoại trừ block json. Định dạng JSON:
        {
          "output": "chuỗi kết quả in ra màn hình terminal. Nếu là mã màu ANSI có thể viết bình thường. Viết bằng tiếng Việt hoặc tiếng Anh phù hợp với OS.",
          "isError": false, // true nếu lệnh thất bại hoặc không chạy được
          "vfsChanges": {
            // Danh sách các file bị thay đổi (nếu có)
            "/home/user/file_moi.txt": { "type": "file", "content": "nội dung file" },
            "/home/user/file_cu.txt": null // giá trị null đại diện cho việc xóa file
          }
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text || '{}';
      try {
        const parsed = JSON.parse(responseText.trim());
        return res.json(parsed);
      } catch (e) {
        console.error('Error parsing Gemini response:', responseText, e);
        return res.json({
          output: `Executed command with output: \n${responseText}`,
          isError: false,
          vfsChanges: {}
        });
      }

    } catch (error) {
      console.error('Simulate command error:', error);
      return res.status(500).json({
        output: `Lỗi kết nối máy chủ AI: ${(error as Error).message}`,
        isError: true,
        vfsChanges: {}
      });
    }
  });

  // API endpoint 2: Chat Copilot assisting OS education
  app.post('/api/copilot', async (req, res) => {
    try {
      const { query, currentDir, os } = req.body;

      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      if (!ai) {
        return res.json({
          reply: 'Chào bạn! Hiện tại ứng dụng đang chạy ở chế độ ngoại tuyến (Offline Mode). Vui lòng cấu hình `GEMINI_API_KEY` trong Settings để trò chuyện trực tiếp với Trợ lý ảo AI Copilot, giúp bạn học lệnh Linux/Windows/macOS và tạo code nhanh chóng.',
          suggestedCommand: ''
        });
      }

      const prompt = `
        Bạn là "OS Copilot" - trợ lý ảo học tập hệ điều hành chuyên nghiệp tại Terminal Lab.
        Người học đang thực hành hệ điều hành: "${os}"
        Thư mục hiện tại: "${currentDir}"
        Câu hỏi của người học: "${query}"

        Nhiệm vụ của bạn:
        1. Giải thích một cách ngắn gọn, súc tích, dễ hiểu bằng tiếng Việt về lệnh hoặc khái niệm được hỏi.
        2. Đưa ra chính xác câu lệnh terminal tốt nhất để giải quyết vấn đề của người học (nếu có).
        3. Phản hồi ở định dạng JSON thô sau đây:
        {
          "reply": "Nội dung giải thích chi tiết, kèm định dạng Markdown để dễ đọc. Giọng điệu thân thiện, khoa học.",
          "suggestedCommand": "câu lệnh terminal có thể copy/run trực tiếp (nếu có, không có thì để trống)"
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text || '{}';
      try {
        const parsed = JSON.parse(responseText.trim());
        return res.json(parsed);
      } catch (e) {
        return res.json({
          reply: responseText,
          suggestedCommand: ''
        });
      }

    } catch (error) {
      console.error('Copilot helper error:', error);
      return res.status(500).json({
        reply: `Có lỗi xảy ra khi kết nối trợ lý AI: ${(error as Error).message}`,
        suggestedCommand: ''
      });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', hasAi: !!ai });
  });

  // Serve static assets or mount Vite dev server
  if (process.env.NODE_ENV !== 'production') {
    console.log('Starting server in development mode with Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Starting server in production mode serving static assets...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
