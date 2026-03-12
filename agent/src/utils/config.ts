// SiliconFlow 配置（STT/TTS/Embedding 默认使用此配置）
export function getSiliconFlowConfig() {
  return {
    baseURL: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',
    apiKey: process.env.SILICONFLOW_API_KEY,
  };
}

// LLM 独立配置（支持使用不同平台的 LLM，如阿里云百炼、火山引擎等）
// 如果未设置 LLM_API_KEY，则回退到 SiliconFlow 配置
export function getLLMConfig() {
  const llmApiKey = process.env.LLM_API_KEY;
  const llmBaseURL = process.env.LLM_BASE_URL;

  if (llmApiKey && llmBaseURL) {
    return {
      baseURL: llmBaseURL,
      apiKey: llmApiKey,
    };
  }

  // 回退到 SiliconFlow 配置
  return getSiliconFlowConfig();
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
