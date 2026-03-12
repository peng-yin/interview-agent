import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '面试 Voice Agent - AI 技术面试官',
  description: '基于 AI 的智能语音面试系统，支持前端、后端、全栈岗位模拟面试',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
