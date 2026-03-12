'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const positions = [
  {
    id: 'frontend',
    name: '前端工程师',
    icon: '🖥️',
    description: 'React、Vue、JavaScript、CSS、工程化、性能优化',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'backend',
    name: '后端工程师',
    icon: '⚙️',
    description: '数据结构、数据库、系统设计、网络协议、微服务',
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'fullstack',
    name: '全栈工程师',
    icon: '🔗',
    description: '前后端架构、API 设计、安全、性能优化',
    color: 'from-purple-500 to-pink-500',
  },
];

const difficulties = [
  { id: 'junior', name: '初级', description: '1-3年经验' },
  { id: 'mid', name: '中级', description: '3-5年经验' },
  { id: 'senior', name: '高级', description: '5年以上经验' },
];

export default function Home() {
  const router = useRouter();
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('mid');
  const [userName, setUserName] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const fileName = file.name.toLowerCase();
    const isValidExt = fileName.endsWith('.pdf') || fileName.endsWith('.docx');

    if (!validTypes.includes(file.type) && !isValidExt) {
      setUploadError('请上传 PDF 或 DOCX 格式的文件');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('文件大小不能超过 10MB');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadError(data.error || '上传失败');
        return;
      }

      setResumeText(data.text);
      setUploadedFileName(data.fileName);
      setUploadError('');
    } catch {
      setUploadError('上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  }, [handleFileUpload]);

  const clearResume = useCallback(() => {
    setResumeText('');
    setUploadedFileName('');
    setUploadError('');
  }, []);

  const handleStartInterview = async () => {
    if (!selectedPosition || !userName) return;

    setIsLoading(true);

    const params = new URLSearchParams({
      position: selectedPosition,
      difficulty: selectedDifficulty,
      name: userName,
    });

    if (resumeText) {
      // 简历内容可能很长，通过 sessionStorage 传递避免 URL 过长
      sessionStorage.setItem('interview-resume', resumeText);
      params.set('hasResume', 'true');
    }

    router.push(`/interview?${params.toString()}`);
  };

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-primary">AI-Powered Voice Interview</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            AI 技术面试官
          </h1>
          <p className="text-gray-400 text-lg">
            选择岗位，开始一场沉浸式的 AI 语音模拟面试
          </p>
        </div>

        {/* Name Input */}
        <div className="mb-8">
          <label className="block text-sm text-gray-400 mb-2">你的名字</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="请输入你的名字"
            className="w-full px-4 py-3 rounded-xl bg-surface-light border border-surface-border text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Position Selection */}
        <div className="mb-8">
          <label className="block text-sm text-gray-400 mb-3">选择面试岗位</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {positions.map((pos) => (
              <button
                key={pos.id}
                onClick={() => setSelectedPosition(pos.id)}
                className={`relative p-6 rounded-2xl border text-left transition-all duration-300 ${
                  selectedPosition === pos.id
                    ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                    : 'border-surface-border bg-surface-light hover:border-gray-600'
                }`}
              >
                <div className="text-3xl mb-3">{pos.icon}</div>
                <h3 className="text-lg font-semibold mb-1">{pos.name}</h3>
                <p className="text-sm text-gray-400">{pos.description}</p>
                {selectedPosition === pos.id && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty Selection */}
        <div className="mb-8">
          <label className="block text-sm text-gray-400 mb-3">面试难度</label>
          <div className="flex gap-3">
            {difficulties.map((diff) => (
              <button
                key={diff.id}
                onClick={() => setSelectedDifficulty(diff.id)}
                className={`flex-1 py-3 px-4 rounded-xl border text-center transition-all ${
                  selectedDifficulty === diff.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-surface-border bg-surface-light text-gray-400 hover:border-gray-600'
                }`}
              >
                <div className="font-medium">{diff.name}</div>
                <div className="text-xs mt-1 opacity-70">{diff.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Resume Upload */}
        <div className="mb-10">
          <label className="block text-sm text-gray-400 mb-2">
            简历信息（可选，上传简历文件可获得针对性面试）
          </label>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {!resumeText ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative rounded-xl border-2 transition-all duration-300 ${
                isDragOver
                  ? 'border-primary bg-primary/5 scale-[1.005]'
                  : 'border-surface-border bg-surface-light'
              }`}
            >
              {isDragOver && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/10 backdrop-blur-sm">
                  <div className="text-center">
                    <svg className="w-10 h-10 text-primary mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-primary font-medium">松开即可上传</p>
                  </div>
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-surface-light/80 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <LoadingSpinner className="w-5 h-5 text-primary" />
                    <p className="text-gray-400">正在解析简历...</p>
                  </div>
                </div>
              )}
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="粘贴你的简历文本内容，AI 面试官会根据你的简历进行针对性提问..."
                rows={4}
                className="w-full px-4 py-3 rounded-t-xl bg-transparent text-white placeholder-gray-500 focus:outline-none transition-colors resize-none"
              />
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border/50">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-primary transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  上传简历文件
                </button>
                <span className="text-xs text-gray-600">支持 PDF、DOCX，最大 10MB</span>
              </div>
            </div>
          ) : (
            /* Resume preview */
            <div className="relative rounded-xl bg-surface-light border border-surface-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {uploadedFileName ? (
                    <>
                      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-green-400">
                        已上传: {uploadedFileName}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">简历内容（手动输入）</span>
                  )}
                </div>
                <button
                  onClick={clearResume}
                  className="text-gray-500 hover:text-red-400 transition-colors text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  清除
                </button>
              </div>
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 rounded-lg bg-surface-dark border border-surface-border text-white text-sm focus:outline-none focus:border-primary transition-colors resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                {resumeText.length} 字 · 可编辑修改
              </p>
            </div>
          )}

          {/* Upload error */}
          {uploadError && (
            <div className="mt-2 flex items-center gap-2 text-red-400 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {uploadError}
            </div>
          )}
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartInterview}
          disabled={!selectedPosition || !userName || isLoading}
          className={`w-full py-4 rounded-2xl text-lg font-semibold transition-all duration-300 ${
            selectedPosition && userName && !isLoading
              ? 'bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner />
              正在准备面试...
            </span>
          ) : (
            '开始面试'
          )}
        </button>

        {/* Footer tip */}
        <p className="text-center text-gray-500 text-sm mt-6">
          面试过程中请确保麦克风正常工作，AI 面试官会通过语音与你交流
        </p>
      </div>
    </div>
  );
}
