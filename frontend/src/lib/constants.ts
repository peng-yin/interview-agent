// 岗位名称映射（共享常量，避免多处重复定义）
export const positionNames: Record<string, string> = {
  frontend: '前端工程师',
  backend: '后端工程师',
  fullstack: '全栈工程师',
};

// 难度 ID 到中文的映射
export const difficultyMap: Record<string, string> = {
  junior: '初级',
  mid: '中级',
  senior: '高级',
};
