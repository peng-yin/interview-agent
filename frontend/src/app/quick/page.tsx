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
  { id: 'junior', name: '初级', description: '1-3年经验', icon: '🌱' },
  { id: 'mid', name: '中级', description: '3-5年经验', icon: '🌿' },
  { id: 'senior', name: '高级', description: '5年以上经验', icon: '🌳' },
];

export default function QuickInterviewPage() {
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
      sessionStorage.setItem('interview-resume', resumeText);
      params.set('hasResume', 'true');
    }

    router.push(`/interview?${params.toString()}`);
  };

  return (
    <div className="min-h-screen gradient-bg relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-30">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute top-40 right-20 w-64 h-64 bg-accent/15 rounded-full blur-[100px]" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-8">
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-lg bg-surface-2 ring-1 ring-white/[0.06] text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-emerald-500/8 border border-emerald-500/15 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-emerald-400 font-medium">快速体验模式</span>
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 text-gradient tracking-tight">
            AI 模拟面试
          </h1>
          <p className="text-gray-500 text-lg max-w-md mx-auto">
            选择岗位，开始一场沉浸式的 AI 语音模拟面试
          </p>
          <div className="flex items-center justify-center gap-4 mt-5">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              通话时长 30 分钟
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-700" />
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              中文面试
            </div>
          </div>
        </div>

        {/* Main form card */}
        <div className="relative">
          <div className="absolute -inset-px bg-gradient-to-b from-primary/15 via-transparent to-transparent rounded-3xl" />

          <div className="relative glass-card rounded-3xl overflow-hidden">
            <div className="h-[2px] bg-gradient-to-r from-emerald-500 via-primary to-accent" />

            <div className="p-8 space-y-8">
              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2.5">你的名字</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="请输入你的名字"
                  className="w-full px-4 py-3.5 rounded-xl bg-surface-1 ring-1 ring-white/[0.06] text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>

              {/* Position Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">选择面试岗位</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {positions.map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => setSelectedPosition(pos.id)}
                      className={`group relative p-5 rounded-2xl ring-1 text-left transition-all duration-300 ${
                        selectedPosition === pos.id
                          ? 'ring-primary/40 bg-primary/8 shadow-glow-sm'
                          : 'ring-white/[0.06] bg-surface-1 hover:ring-white/[0.1] hover:bg-surface-2'
                      }`}
                    >
                      <div className="text-2xl mb-2.5">{pos.icon}</div>
                      <h3 className="text-base font-semibold mb-1 text-white">{pos.name}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{pos.description}</p>
                      {selectedPosition === pos.id && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-glow-sm">
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
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">面试难度</label>
                <div className="flex gap-3">
                  {difficulties.map((diff) => (
                    <button
                      key={diff.id}
                      onClick={() => setSelectedDifficulty(diff.id)}
                      className={`flex-1 py-3 px-4 rounded-xl ring-1 text-center transition-all duration-200 ${
                        selectedDifficulty === diff.id
                          ? 'ring-primary/40 bg-primary/8 text-brand-400'
                          : 'ring-white/[0.06] bg-surface-1 text-gray-500 hover:ring-white/[0.1]'
                      }`}
                    >
                      <div className="text-base mb-0.5">{diff.icon}</div>
                      <div className="font-medium text-sm">{diff.name}</div>
                      <div className="text-xs mt-0.5 opacity-60">{diff.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resume Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2.5">
                  简历信息
                  <span className="text-gray-600 font-normal ml-1">（可选，上传简历可获得针对性面试）</span>
                </label>

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
                    className={`relative rounded-xl ring-1 transition-all duration-300 ${
                      isDragOver
                        ? 'ring-primary bg-primary/5 scale-[1.002]'
                        : 'ring-white/[0.06] bg-surface-1'
                    }`}
                  >
                    {isDragOver && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/8 backdrop-blur-sm">
                        <div className="text-center">
                          <svg className="w-10 h-10 text-primary mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-primary font-medium">松开即可上传</p>
                        </div>
                      </div>
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <LoadingSpinner className="w-5 h-5 text-primary" />
                          <p className="text-gray-300">正在解析简历...</p>
                        </div>
                      </div>
                    )}
                    <textarea
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      placeholder="粘贴你的简历文本内容，AI 面试官会根据你的简历进行针对性提问..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-t-xl bg-transparent text-white placeholder-gray-600 focus:outline-none transition-colors resize-none text-sm"
                    />
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.04]">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        上传简历文件
                      </button>
                      <span className="text-xs text-gray-700">支持 PDF、DOCX，最大 10MB</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-xl bg-surface-1 ring-1 ring-white/[0.06] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {uploadedFileName ? (
                          <>
                            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm text-emerald-400">
                              已上传: {uploadedFileName}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-gray-500">简历内容（手动输入）</span>
                        )}
                      </div>
                      <button
                        onClick={clearResume}
                        className="text-gray-600 hover:text-red-400 transition-colors text-sm flex items-center gap-1"
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
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg bg-surface-2 ring-1 ring-white/[0.04] text-white text-sm focus:outline-none focus:ring-primary/30 transition-colors resize-none"
                    />
                    <p className="text-xs text-gray-600 mt-2">
                      {resumeText.length} 字 · 可编辑修改
                    </p>
                  </div>
                )}

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
                    ? 'btn-gradient text-white hover:shadow-glow-lg active:scale-[0.99]'
                    : 'bg-surface-2 text-gray-600 cursor-not-allowed ring-1 ring-white/[0.04]'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner />
                    正在准备面试...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    开始语音面试
                  </span>
                )}
              </button>
            </div>

            <div className="h-[2px] bg-gradient-to-r from-emerald-500 via-primary to-accent" />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-2">
          <p className="text-gray-600 text-sm flex items-center justify-center gap-2">
            <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            面试过程中请确保麦克风正常工作，AI 面试官会通过语音与你交流
          </p>
          <p className="text-gray-700 text-xs tracking-wider">
            Powered by LiveKit · DeepSeek · SiliconFlow
          </p>
        </div>
      </div>
    </div>
  );
}
