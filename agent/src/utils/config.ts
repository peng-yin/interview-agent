// SiliconFlow 配置（共享，避免多处重复硬编码 baseURL 默认值）
export function getSiliconFlowConfig() {
  return {
    baseURL: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',
    apiKey: process.env.SILICONFLOW_API_KEY,
  };
}

// ChromaDB 配置
export const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
export const CHROMA_COLLECTION_NAME = 'interview_questions';
export const CHROMA_COLLECTION_METADATA = { 'hnsw:space': 'cosine' } as const;

// 岗位名称映射
export const positionNames: Record<string, string> = {
  frontend: '前端工程师',
  backend: '后端工程师',
  fullstack: '全栈工程师',
};
