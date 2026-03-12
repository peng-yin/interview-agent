# AI 语音技术面试官 - 系统设计方案

## 一、项目概述

一个基于 LiveKit 实时音视频框架的 **AI 语音模拟面试平台**，通过 SiliconFlow 提供的大语言模型（DeepSeek-V3）、语音识别（SenseVoiceSmall）和语音合成（CosyVoice2），结合 RAG 知识库检索，实现沉浸式的语音技术面试体验。

支持岗位：前端工程师 / 后端工程师 / 全栈工程师

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                              │
│  Next.js 15 + React 19 + LiveKit Components + Tailwind CSS  │
│                                                             │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │ 首页     │  │ /api/token    │  │ InterviewRoom 组件   │  │
│  │ 面试配置 │──│ Token生成 +   │──│ 语音通话 + 状态展示  │  │
│  │          │  │ Agent调度     │  │                      │  │
│  └──────────┘  └───────────────┘  └──────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │ WebRTC 音频流
                  ▼
┌─────────────────────────────────────────────────────────────┐
│               LiveKit Server (Docker)                       │
│               ws://localhost:7880                            │
│               房间管理 + 音频路由 + Agent调度                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Node.js Agent                             │
│                                                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────────────────┐│
│  │Silero  │  │STT     │  │LLM     │  │TTS                 ││
│  │VAD     │──│Sense   │──│DeepSeek│──│CosyVoice2          ││
│  │端点检测│  │Voice   │  │V3      │  │语音合成             ││
│  └────────┘  └────────┘  └───┬────┘  └────────────────────┘│
│                              │                              │
│                    ┌─────────▼──────────┐                   │
│                    │  RAG 知识库检索     │                   │
│                    │  ChromaDB +         │                   │
│                    │  bge-large-zh-v1.5  │                   │
│                    └────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## 三、核心数据流

```
用户说话 → Silero VAD(端点检测) → STT(语音转文字)
    → RAG(检索相关面试题) → LLM(生成面试官回复)
    → TTS(文字转语音) → 用户耳机播放
```

1. 用户在首页选择岗位/难度，可选粘贴简历文本或上传简历文件（PDF/DOCX）
2. 前端 POST `/api/token` 获取 LiveKit Token，同时通过 `AgentDispatchClient` 显式调度 Agent
3. 用户通过 WebRTC 发送语音，Agent 接收并处理
4. Agent 每轮对话触发 RAG 检索，将相关题库注入 LLM 上下文
5. LLM 生成回复后通过 TTS 合成语音返回

## 四、技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js 15 + React 19 | App Router，SSR |
| UI | Tailwind CSS 3 | 暗色主题，毛玻璃效果 |
| 实时通信 | LiveKit (WebRTC) | 仅音频，低延迟 |
| 前端组件 | @livekit/components-react | 音频轨道、房间状态管理 |
| Agent 框架 | @livekit/agents (Node.js) | Voice Agent Pipeline |
| 语音检测 | Silero VAD | 本地端点检测 |
| 语音识别 | SenseVoiceSmall (SiliconFlow) | 中文 STT，language='zh' |
| 大语言模型 | DeepSeek-V3 (SiliconFlow) | OpenAI 兼容接口 |
| 语音合成 | CosyVoice2-0.5B (SiliconFlow) | 中文 TTS |
| 向量嵌入 | BAAI/bge-large-zh-v1.5 | 中文向量模型 |
| 向量数据库 | ChromaDB | 面试题库存储与检索 |
| 容器编排 | Docker Compose | 4 服务编排 |

## 五、模块设计

### 5.1 前端模块

#### 首页 (`/`)
- 用户名输入
- 岗位选择（卡片式：前端/后端/全栈）
- 难度选择（初级/中级/高级）
- 简历输入（可选）：支持粘贴文本或上传文件（PDF / DOCX）
  - 统一输入区域：textarea + 底部工具栏（上传按钮 + 格式提示）
  - 拖拽上传：拖拽文件到输入区域，显示全屏覆盖层
  - 文件解析：通过 `/api/upload-resume` 服务端解析
  - 简历预览：上传或输入后显示可编辑预览区，支持清除
- 表单校验后跳转面试页

#### 简历上传 API (`/api/upload-resume`)
- 接收 multipart/form-data 文件上传
- 支持 PDF（pdf-parse）和 DOCX（mammoth）两种格式
- 文件大小限制 10MB，文本长度限制 8000 字
- 自动清理多余空行，返回提取的文本内容

#### Token API (`/api/token`)
- 生成 LiveKit AccessToken（30分钟有效期）
- 权限：roomJoin + roomCreate + canPublish + canSubscribe
- 通过 AgentDispatchClient 显式调度 interview-agent 到指定房间
- 将面试配置写入 token metadata 和 participant attributes

#### 面试房间 (`/interview`)
- LiveKitRoom 连接（仅音频模式）
- AI 面试官头像 + 音频可视化动画（发光环 + 音频条）
- Agent 状态追踪：connecting → connected → listening → thinking → speaking
- 计时器（从 00:00 开始）
- 控制栏：静音/取消静音 + 结束面试

### 5.2 Agent 模块

#### 入口 (`main.ts`)
- dotenv 加载环境变量（ESM 兼容，顶部导入）
- 预热 Silero VAD 模型
- 解析 Job metadata 获取面试配置
- 配置 SiliconFlow 为 STT/LLM/TTS 提供商
- 创建 InterviewAgent 并启动 AgentSession

#### 面试 Agent (`interview-agent.ts`)
- 继承 `voice.Agent`
- 构造时通过 `getInterviewerInstructions()` 生成系统提示词
- 注册 `endInterview` 工具供 LLM 调用结束面试
- `onUserTurnCompleted` 钩子：用户说完后触发 RAG 检索，将相关面试题作为隐藏参考注入对话

#### 提示词 (`prompts/interviewer.ts`)
- 角色设定：资深面试官，10年经验
- 语言要求（最高优先级）：必须简体中文
- 面试流程：7 个阶段自然过渡
- 提问策略：由浅入深，动态调整，追问不超过 3 轮
- 评价维度：技术深度、实战经验、问题解决、沟通表达、学习能力
- 简历针对性提问（可选）

### 5.3 RAG 模块

#### 向量嵌入 (`rag/embeddings.ts`)
- 懒加载初始化 OpenAI 客户端（解决 ESM 模块加载顺序问题）
- 使用 bge-large-zh-v1.5 中文嵌入模型
- 支持单条和批量嵌入（每批 20 条）

#### 知识库检索 (`rag/knowledge-base.ts`)
- 连接 ChromaDB，集合名 `interview_questions`
- 基于 cosine 相似度检索
- 支持按岗位筛选（position metadata）
- 返回 top-K 相关面试题并格式化为参考文本

#### 知识库索引 (`scripts/index-knowledge.ts`)
- 读取 4 个 JSON 题库文件（frontend/backend/fullstack/common）
- 拼接题目、关键点、评分标准为文档文本
- 批量生成嵌入向量写入 ChromaDB

### 5.4 题库设计

| 岗位 | 分类数 | 题目数 | 覆盖内容 |
|------|--------|--------|----------|
| 前端 | 6 | 17 | JS基础、React、CSS布局、网络浏览器、工程化、TypeScript |
| 后端 | 5 | 10 | 数据结构算法、数据库、系统设计、网络协议、运维部署 |
| 全栈 | 3 | 4 | 全栈架构、安全、性能优化 |
| 通用 | 3 | 3 | 自我介绍、项目经验、软技能 |

每道题包含：题目、分类、难度、关键考察点、评分标准、追问方向

## 六、部署架构

### Docker Compose 服务编排

| 服务 | 镜像 | 端口 | 依赖 |
|------|------|------|------|
| livekit-server | livekit/livekit-server:latest | 7880(WS), 7881(TCP), 50000-50100(UDP) | - |
| chromadb | chromadb/chroma:latest | 8000 | - |
| frontend | 自建 (Next.js) | 3000 | livekit-server |
| agent | 自建 (Node.js 22) | - | livekit-server, chromadb |

### 环境变量

**Agent:**
- `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`
- `SILICONFLOW_API_KEY` / `SILICONFLOW_BASE_URL`
- `LLM_MODEL` / `STT_MODEL` / `TTS_MODEL` / `TTS_VOICE` / `EMBEDDING_MODEL`

**Frontend:**
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL`
- `AGENT_NAME`

## 七、面试结束与报告生成

### 7.1 三种结束触发方式

| 触发方式 | 来源 | 信号 |
|---------|------|------|
| 点击"结束面试"按钮 | 前端 InterviewRoom | DataChannel topic: `end-interview` |
| 30 分钟超时自动触发 | 前端 Timer | DataChannel topic: `end-interview`, reason: `timeout` |
| 语音说"结束面试"等关键词 | Agent InterviewAgent | DataChannel topic: `end-interview-voice` |

### 7.2 报告生成流程

```
触发结束 → Agent 口头总结(2-3句话) → 等待 5 秒
         → 独立 LLM 调用生成 JSON 报告
         → DataChannel topic: interview-report 发送到前端
         → 前端存入 sessionStorage → 跳转 /report 页面
```

报告生成采用**代码直接调用 LLM** 而非依赖 LLM 工具调用，确保报告生成的可靠性。如果 LLM 返回非 JSON 格式，会自动发送 fallback 默认报告。

### 7.3 报告数据结构

```typescript
{
  type: 'interview-report',
  position: string,           // 岗位
  difficulty: string,         // 难度（初级/中级/高级）
  timestamp: string,          // ISO 时间戳
  overallComment: string,     // 总体评价
  technicalScore: number,     // 技术能力 1-10
  communicationScore: number, // 沟通表达 1-10
  experienceScore: number,    // 项目经验 1-10
  problemSolvingScore: number,// 问题解决 1-10
  highlights: string[],       // 亮点列表
  improvements: string[],     // 改进点列表
  recommendation: string,     // 强烈推荐/推荐/待定/不推荐
  detailedFeedback: string    // 详细反馈
}
```

## 八、前端页面路由

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | 首页 | 用户名、岗位选择、难度选择、简历输入（文本粘贴 / 文件上传） |
| `/interview` | 面试房间 | LiveKit 语音通话、Agent 状态、计时器、控制栏 |
| `/report` | 面试报告 | 综合评分、分项评分条、亮点/待提高、推荐等级 |
| `/api/token` | Token API | 生成 LiveKit Token + 调度 Agent |
| `/api/upload-resume` | 简历上传 API | 解析 PDF/DOCX 文件，提取简历文本 |

## 九、关键设计决策

1. **Explicit Agent Dispatch**：使用 `AgentDispatchClient` 在 Token 生成时显式调度 Agent，确保 Agent 可靠加入指定房间
2. **ESM 兼容性**：dotenv 在文件最顶部导入，OpenAI 客户端使用懒加载模式，避免 ESM import 提升导致环境变量未加载
3. **RAG 增强面试**：每轮用户回答后触发检索，将相关题库作为隐藏参考注入，让 AI 提问更专业、覆盖更全面
4. **仅音频模式**：面试场景不需要视频，降低带宽和延迟
5. **中文优先**：STT 显式设置 `language: 'zh'`，系统提示词中设置中文为最高优先级约束
6. **SiliconFlow 统一接入**：STT/LLM/TTS/Embedding 全部通过 SiliconFlow OpenAI 兼容接口，简化配置
7. **代码生成报告**：不依赖 LLM 工具调用（不可靠），改为代码中独立 LLM 调用生成 JSON 报告，附带 fallback 机制
8. **难度值统一映射**：前端使用英文 ID（junior/mid/senior），Token API 层统一映射为中文（初级/中级/高级）后传递给 Agent 和报告
9. **麦克风降级处理**：LiveKitRoom 启动时 `audio=false`，连接后手动申请麦克风权限，失败时降级显示"麦克风不可用"而非中断连接
10. **安全超时兜底**：面试结束后 60 秒内未收到报告，强制断开连接跳转首页，防止用户卡死

## 十、安全注意事项

- `docker-compose.yml` 中敏感配置（API Key 等）通过 `${ENV_VAR}` 引用，实际值存放在 `.env` 文件中
- `.env` 和 `.env.local` 文件不应提交到版本控制
- LiveKit API Key/Secret 为开发用默认值（devkey/secret），生产环境需更换
