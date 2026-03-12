# AI 语音技术面试官 - 系统设计方案

## 一、项目概述

一个基于 LiveKit 实时音视频框架的 **AI 语音模拟面试平台**，通过 SiliconFlow 提供的大语言模型（DeepSeek-V3）、语音识别（SenseVoiceSmall）和语音合成（CosyVoice2），结合 RAG 知识库检索，实现沉浸式的语音技术面试体验。

支持**双角色模式**：
- **快速体验模式**：候选人无需注册，直接选择岗位和难度即可开始 AI 模拟面试
- **招聘者模式**：招聘者创建面试 → 生成候选人专属链接 → 候选人填写信息加入 → 招聘者查看报告

支持岗位：前端工程师 / 后端工程师 / 全栈工程师

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                              │
│  Next.js 15 + React 19 + LiveKit Components + Tailwind CSS  │
│                                                             │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │ 首页     │  │ API 层        │  │ InterviewRoom 组件   │  │
│  │ 双入口   │──│ Token/面试CRUD│──│ 语音通话 + 实时转录  │  │
│  │ 招聘/快速│  │ 简历上传      │  │                      │  │
│  └──────────┘  └──────┬────────┘  └──────────────────────┘  │
└─────────────────┬─────┼───────────────────────────────────┘
                  │     │ SQLite 持久化
                  │     ▼
                  │  ┌────────────────┐
                  │  │ SQLite (WAL)   │
                  │  │ 面试记录/报告  │
                  │  └────────────────┘
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

1. **快速体验流程**：用户在 `/quick` 页面选择岗位/难度，可选上传简历
2. **招聘者流程**：招聘者在 `/recruiter` 创建面试 → 候选人通过 `/c/[id]` 链接加入
3. 前端 POST `/api/token` 获取 LiveKit Token，同时通过 `AgentDispatchClient` 显式调度 Agent
4. 用户通过 WebRTC 发送语音，Agent 接收并处理
5. Agent 每轮对话触发 RAG 检索，将相关题库注入 LLM 上下文
6. LLM 生成回复后通过 TTS 合成语音返回
7. 面试结束后报告通过 DataChannel 返回前端，招聘者模式下同步持久化到 SQLite

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
| 业务数据库 | SQLite (better-sqlite3) | 面试记录持久化，WAL 模式 |
| 容器编排 | Docker Compose | 4 服务编排 |

## 五、模块设计

### 5.1 前端模块

#### 首页 (`/`)
- 角色选择入口页，提供两个入口卡片：
  - **招聘者入口**：跳转 `/recruiter`，创建面试、管理候选人、查看报告
  - **快速体验**：跳转 `/quick`，无需注册直接开始 AI 模拟面试

#### 快速体验配置页 (`/quick`)
- 用户名输入
- 岗位选择（卡片式：前端/后端/全栈，含技术栈描述）
- 难度选择（初级/中级/高级）
- 简历输入（可选）：支持粘贴文本或上传文件（PDF / DOCX）
  - 统一输入区域：textarea + 底部工具栏（上传按钮 + 格式提示）
  - 拖拽上传：拖拽文件到输入区域，显示全屏覆盖层
  - 文件解析：通过 `/api/upload-resume` 服务端解析
  - 简历预览：上传或输入后显示可编辑预览区，支持清除
- 表单校验后跳转 `/interview` 面试页

#### 招聘者管理面板 (`/recruiter`)
- 面试列表管理：展示所有已创建的面试，含状态（等待面试/面试中/已完成/已过期）、岗位、难度、时长等
- 创建面试（弹窗模态框）：选择岗位、难度、时长（5-60 分钟滑块）、上传候选人简历（可选）
- 复制候选人面试链接（`/c/[id]` 格式）
- 查看已完成面试的报告，跳转 `/recruiter/report/[id]`
- 删除面试记录
- 列表每 10 秒自动轮询刷新

#### 招聘者报告页 (`/recruiter/report/[id]`)
- 从 API 获取面试详情和报告数据
- 展示：综合评分、推荐等级（强烈推荐/推荐/待定/不推荐）、总体评价
- 4 维能力评分（技术能力、沟通表达、项目经验、问题解决）带动画进度条
- 亮点和待提高清单、详细反馈、候选人信息
- 操作：导出报告（TXT）、复制报告摘要、返回管理面板

#### 候选人面试入口页 (`/c/[id]`)
- 候选人通过招聘者分享的链接访问
- 展示面试岗位、难度、时长信息
- 校验面试状态：已完成/进行中/无效链接显示对应错误提示
- 候选人填写姓名和邮箱后点击"加入面试"
- 跳转 `/c/[id]/interview` 开始面试

#### 候选人面试房间 (`/c/[id]/interview`)
- 获取面试详情并校验面试状态
- 通过 Server Actions 更新候选人信息到数据库，将面试状态设为 `in_progress`
- 使用招聘者预先上传的简历
- 获取 LiveKit Token 并渲染 `InterviewRoom` 组件
- 面试结束后通过 PATCH API 将报告保存到数据库，跳转完成页

#### 候选人面试完成页 (`/c/[id]/complete`)
- 显示"面试已结束"提示
- 告知候选人面试报告将由招聘方审阅
- 提示可安全关闭页面

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

#### 面试房间组件 (`InterviewRoom`)
- LiveKitRoom 连接（仅音频模式）
- AI 面试官头像 + 音频可视化动画（发光环 + 音频条 BarVisualizer）
- Agent 状态追踪：connecting → connected → listening → thinking → speaking
- 实时语音转录：打字机效果逐字显示，自动滚动，支持显示/隐藏字幕
- 面试计时器：顶部进度条显示已用/剩余时间，最后 5 分钟变红色并闪烁，到时自动结束
- 控制栏：静音/取消静音 + 结束面试
- 报告生成等待：结束时显示 overlay 等待报告
- DataChannel 通信：发送/接收结束信号和面试报告

#### 面试 CRUD API (`/api/interviews`)
- `GET /api/interviews` — 获取所有面试列表（按创建时间降序）
- `POST /api/interviews` — 创建新面试，生成 12 位 UUID 作为面试 ID，参数：岗位/难度/时长/简历
- `GET /api/interviews/[id]` — 获取单个面试详情（含报告）
- `PATCH /api/interviews/[id]` — 更新面试报告，同时将状态设为 `completed` 并记录完成时间
- `DELETE /api/interviews/[id]` — 删除面试记录

### 5.2 数据库模块

#### SQLite 数据层 (`lib/db.ts`)
- 数据库引擎：`better-sqlite3`，数据文件存储在 `data/interviews.db`
- 启用 WAL 模式和外键约束，含自动迁移逻辑
- 数据表 `interviews`，包含 12 个字段：

```typescript
{
  id: string,              // 12 位 UUID 主键
  position: string,        // 岗位（frontend/backend/fullstack）
  difficulty: string,      // 难度（junior/mid/senior）
  duration: number,        // 面试时长（分钟）
  resume: string | null,   // 简历文本
  candidate_name: string | null,  // 候选人姓名
  candidate_email: string | null, // 候选人邮箱
  status: string,          // 状态（pending/in_progress/completed/expired）
  room_name: string | null,       // LiveKit 房间名
  report: string | null,          // JSON 格式面试报告
  created_at: string,      // 创建时间
  started_at: string | null,      // 开始时间
  completed_at: string | null     // 完成时间
}
```

- 导出函数：`createInterview`、`getInterview`、`listInterviews`、`updateInterviewCandidate`、`updateInterviewRoom`、`updateInterviewReport`、`deleteInterview`

#### Server Actions (`c/[id]/interview/actions.ts`)
- `updateInterviewCandidate(id, name, email)` — 更新候选人信息并将面试状态改为 `in_progress`
- `updateInterviewRoom(id, roomName)` — 更新面试房间名

### 5.3 Agent 模块

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

### 5.4 RAG 模块

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

### 5.5 题库设计

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
| 30 分钟超时自动触发 | 前端 Timer | DataChannel topic: `end-interview`, reason: `timeout`（招聘者模式支持自定义 5-60 分钟） |
| 语音说"结束面试"等关键词 | Agent InterviewAgent | DataChannel topic: `end-interview-voice` |

### 7.2 报告生成流程

```
触发结束 → Agent 口头总结(2-3句话) → 等待 5 秒
         → 独立 LLM 调用生成 JSON 报告
         → DataChannel topic: interview-report 发送到前端
         → 快速体验模式：前端存入 sessionStorage → 跳转 /report 页面
         → 招聘者模式：PATCH /api/interviews/[id] 持久化到 SQLite → 跳转 /c/[id]/complete
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
| `/` | 首页 | 角色选择入口（招聘者入口 + 快速体验） |
| `/quick` | 快速体验配置 | 姓名、岗位选择、难度选择、简历上传 |
| `/interview` | 快速体验面试房间 | LiveKit 语音通话、实时转录、计时器、控制栏 |
| `/report` | 快速体验面试报告 | 综合评分、分项评分条、亮点/待提高、推荐等级 |
| `/recruiter` | 招聘者管理面板 | 创建面试、面试列表、复制链接、查看报告、删除 |
| `/recruiter/report/[id]` | 招聘者报告页 | 查看面试报告、导出 TXT、复制摘要 |
| `/c/[id]` | 候选人入口 | 面试信息展示、候选人填写姓名邮箱 |
| `/c/[id]/interview` | 候选人面试房间 | 候选人面试（复用 InterviewRoom 组件） |
| `/c/[id]/complete` | 面试完成页 | 面试结束提示、等待招聘方审阅 |
| `/api/token` | Token API | 生成 LiveKit Token + 调度 Agent |
| `/api/interviews` | 面试 CRUD API | 面试列表/创建 |
| `/api/interviews/[id]` | 面试详情 API | 查询/更新报告/删除 |
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
11. **双角色架构**：首页拆分为角色选择入口，快速体验（sessionStorage 临时存储）和招聘者模式（SQLite 持久化）两条独立流程
12. **SQLite WAL 模式**：业务数据库使用 WAL 模式提升并发读写性能，通过 better-sqlite3 同步 API 简化代码
13. **面试状态机**：面试记录通过 `pending → in_progress → completed/expired` 状态流转管理生命周期
14. **InterviewRoom 组件复用**：快速体验和候选人面试共用同一个面试房间组件，通过回调函数区分结束后的处理逻辑

## 十、安全注意事项

- `docker-compose.yml` 中敏感配置（API Key 等）通过 `${ENV_VAR}` 引用，实际值存放在 `.env` 文件中
- `.env` 和 `.env.local` 文件不应提交到版本控制
- LiveKit API Key/Secret 为开发用默认值（devkey/secret），生产环境需更换
