'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface Interview {
  id: string;
  position: string;
  difficulty: string;
  duration: number;
  resume: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  status: string;
  room_name: string | null;
  report: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const positionNames: Record<string, string> = {
  frontend: '前端工程师',
  backend: '后端工程师',
  fullstack: '全栈工程师',
};

const difficultyNames: Record<string, string> = {
  junior: '初级',
  mid: '中级',
  senior: '高级',
};

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  pending: { label: '等待面试', color: 'text-amber-400', dot: 'bg-amber-400' },
  in_progress: { label: '面试中', color: 'text-blue-400', dot: 'bg-blue-400 animate-pulse' },
  completed: { label: '已完成', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  expired: { label: '已过期', color: 'text-gray-500', dot: 'bg-gray-600' },
};

const positions = [
  { id: 'frontend', name: '前端工程师', icon: '🖥️' },
  { id: 'backend', name: '后端工程师', icon: '⚙️' },
  { id: 'fullstack', name: '全栈工程师', icon: '🔗' },
];

const difficulties = [
  { id: 'junior', name: '初级', desc: '1-3年' },
  { id: 'mid', name: '中级', desc: '3-5年' },
  { id: 'senior', name: '高级', desc: '5年+' },
];

export default function RecruiterDashboard() {
  const router = useRouter();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPosition, setNewPosition] = useState('frontend');
  const [newDifficulty, setNewDifficulty] = useState('mid');
  const [newDuration, setNewDuration] = useState(30);
  const [resumeText, setResumeText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchInterviews = useCallback(async () => {
    try {
      const res = await fetch('/api/interviews');
      const data = await res.json();
      setInterviews(data.interviews || []);
    } catch (err) {
      console.error('Failed to fetch interviews:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterviews();
    const interval = setInterval(fetchInterviews, 10000);
    return () => clearInterval(interval);
  }, [fetchInterviews]);

  const handleFileUpload = useCallback(async (file: File) => {
    const fileName = file.name.toLowerCase();
    const isValidExt = fileName.endsWith('.pdf') || fileName.endsWith('.docx');
    if (!isValidExt) {
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
      const response = await fetch('/api/upload-resume', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) {
        setUploadError(data.error || '上传失败');
        return;
      }
      setResumeText(data.text);
      setUploadedFileName(data.fileName);
    } catch {
      setUploadError('上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: newPosition,
          difficulty: newDifficulty,
          duration: newDuration,
          resume: resumeText || undefined,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewPosition('frontend');
        setNewDifficulty('mid');
        setNewDuration(30);
        setResumeText('');
        setUploadedFileName('');
        setUploadError('');
        await fetchInterviews();
      }
    } catch (err) {
      console.error('Failed to create interview:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这场面试吗？')) return;
    try {
      await fetch(`/api/interviews/${id}`, { method: 'DELETE' });
      await fetchInterviews();
    } catch (err) {
      console.error('Failed to delete interview:', err);
    }
  };

  const copyLink = (id: string) => {
    const link = `${window.location.origin}/c/${id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.push('/')}
                className="p-2 rounded-lg bg-surface-2 ring-1 ring-white/[0.06] text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-white tracking-tight">面试管理</h1>
            </div>
            <p className="text-gray-600 text-sm ml-11">创建面试、分享链接给候选人、查看面试报告</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 rounded-xl btn-gradient text-white font-medium transition-all flex items-center gap-2"
          >
            <span className="relative flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              创建面试
            </span>
          </button>
        </div>

        {/* Create Interview Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
            <div className="glass-card rounded-3xl p-8 max-w-lg w-full mx-4 relative">
              <button
                onClick={() => setShowCreate(false)}
                className="absolute top-4 right-4 text-gray-600 hover:text-white transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h2 className="text-xl font-bold text-white mb-6 tracking-tight">创建新面试</h2>

              {/* Position */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-400 mb-2.5">面试岗位</label>
                <div className="grid grid-cols-3 gap-2">
                  {positions.map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => setNewPosition(pos.id)}
                      className={`p-3 rounded-xl ring-1 text-center transition-all ${
                        newPosition === pos.id
                          ? 'ring-primary/40 bg-primary/8 text-white'
                          : 'ring-white/[0.06] bg-surface-1 text-gray-500 hover:ring-white/[0.1]'
                      }`}
                    >
                      <div className="text-lg mb-1">{pos.icon}</div>
                      <div className="text-xs font-medium">{pos.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-400 mb-2.5">面试难度</label>
                <div className="flex gap-2">
                  {difficulties.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setNewDifficulty(d.id)}
                      className={`flex-1 py-2.5 rounded-xl ring-1 text-center transition-all ${
                        newDifficulty === d.id
                          ? 'ring-primary/40 bg-primary/8 text-brand-400'
                          : 'ring-white/[0.06] bg-surface-1 text-gray-500 hover:ring-white/[0.1]'
                      }`}
                    >
                      <div className="text-sm font-medium">{d.name}</div>
                      <div className="text-xs opacity-60">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration - Slider */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-400 mb-2.5">面试时长</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    value={newDuration}
                    onChange={(e) => setNewDuration(parseInt(e.target.value))}
                    min={5}
                    max={60}
                    step={5}
                    className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-surface-3 accent-primary
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-primary [&::-webkit-slider-thumb]:to-accent [&::-webkit-slider-thumb]:shadow-glow-sm [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20
                      [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-gradient-to-r [&::-moz-range-thumb]:from-primary [&::-moz-range-thumb]:to-accent [&::-moz-range-thumb]:shadow-glow-sm [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white/20"
                  />
                  <span className="min-w-[56px] text-center text-sm font-semibold text-white bg-surface-2 ring-1 ring-white/[0.06] rounded-lg px-3 py-1.5 tabular-nums">
                    {newDuration} 分钟
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-700 mt-1 px-0.5">
                  <span>5分钟</span>
                  <span>30分钟</span>
                  <span>60分钟</span>
                </div>
              </div>

              {/* Resume Upload (optional) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-400 mb-2.5">
                  候选人简历
                  <span className="text-gray-600 font-normal ml-1">（可选，提升面试针对性）</span>
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                {!resumeText ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file) handleFileUpload(file);
                    }}
                    className={`relative rounded-xl border-2 border-dashed transition-all ${
                      isDragOver
                        ? 'border-primary bg-primary/5'
                        : 'border-white/[0.06] bg-surface-1 hover:border-white/[0.1]'
                    }`}
                  >
                    {isUploading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <LoadingSpinner className="w-5 h-5 text-primary" />
                          <p className="text-gray-300 text-sm">正在解析简历...</p>
                        </div>
                      </div>
                    )}
                    <div className="p-5 text-center">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-surface-3 flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="text-sm text-primary hover:text-primary-light font-medium transition-colors disabled:opacity-50"
                      >
                        点击上传
                      </button>
                      <span className="text-sm text-gray-600"> 或拖拽文件到此处</span>
                      <p className="text-xs text-gray-700 mt-1">支持 PDF / DOCX，最大 10MB</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-emerald-500/5 ring-1 ring-emerald-500/15 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm text-emerald-400 font-medium">
                            {uploadedFileName || '简历已上传'}
                          </p>
                          <p className="text-xs text-gray-600">{resumeText.length} 字</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setResumeText(''); setUploadedFileName(''); setUploadError(''); }}
                        className="text-gray-600 hover:text-red-400 transition-colors p-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <p className="mt-2 text-red-400 text-xs flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {uploadError}
                  </p>
                )}
              </div>

              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full py-3 rounded-xl btn-gradient text-white font-medium transition-all disabled:opacity-50"
              >
                {creating ? (
                  <span className="relative flex items-center justify-center gap-2">
                    <LoadingSpinner className="w-4 h-4" />
                    创建中...
                  </span>
                ) : <span className="relative">创建面试</span>}
              </button>
            </div>
          </div>
        )}

        {/* Interview List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner className="w-8 h-8 text-primary" />
          </div>
        ) : interviews.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-surface-2 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">暂无面试</h3>
            <p className="text-gray-600 text-sm mb-6">点击上方"创建面试"按钮，开始安排第一场面试</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-2.5 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/15 ring-1 ring-primary/15 transition-all"
            >
              创建面试
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {interviews.map((interview) => {
              const sc = statusConfig[interview.status] || statusConfig.pending;
              return (
                <div key={interview.id} className="glass-card-hover rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 ring-1 ring-primary/10 flex items-center justify-center text-xl">
                        {positions.find((p) => p.id === interview.position)?.icon || '💼'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">
                            {positionNames[interview.position] || interview.position}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 text-gray-500 ring-1 ring-white/[0.04]">
                            {difficultyNames[interview.difficulty] || interview.difficulty}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 text-gray-500 ring-1 ring-white/[0.04]">
                            {interview.duration}分钟
                          </span>
                          {interview.resume && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/8 text-emerald-400 ring-1 ring-emerald-500/15">
                              含简历
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            <span className={sc.color}>{sc.label}</span>
                          </div>
                          {interview.candidate_name && (
                            <span>候选人: {interview.candidate_name}</span>
                          )}
                          <span>{new Date(interview.created_at).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Copy link */}
                      <button
                        onClick={() => copyLink(interview.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                          copiedId === interview.id
                            ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/15'
                            : 'bg-surface-2 text-gray-500 hover:text-white ring-1 ring-white/[0.06] hover:ring-white/[0.1]'
                        }`}
                      >
                        {copiedId === interview.id ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            已复制
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            复制链接
                          </>
                        )}
                      </button>

                      {/* View report */}
                      {interview.status === 'completed' && interview.report && (
                        <button
                          onClick={() => router.push(`/recruiter/report/${interview.id}`)}
                          className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 ring-1 ring-primary/15 transition-all flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          查看报告
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(interview.id)}
                        className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/8 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-gray-700 text-xs mt-10 tracking-wider">
          Powered by LiveKit · DeepSeek · SiliconFlow
        </p>
      </div>
    </div>
  );
}
