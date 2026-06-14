# Gaea V0.1

个人 AI 桌面操作系统 — DeepSeek 驱动，语音优先，粒子可视化。

---

> Gaea 不是又一个 AI 助手。它是第一个真正属于你的 AI 操作系统。

---

## 架构

| 层 | 技术 |
|---|------|
| 桌面壳 | Tauri v2 + Rust + WebView2 |
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS v4 + Framer Motion |
| 后端 | Node.js + Express + Socket.io + SQLite |
| AI 引擎 | DeepSeek (主) + Ollama/LMStudio (本地回退) |
| 语音 | Deepgram STT + GPT-SoVITS TTS |
| 工具生态 | MCP 协议 · 101 工具 (87内置+14外部) |

## 核心特性

### Codex 三栏布局
- 左侧图标导航 · 中间语音/对话 · 右侧神经监视器
- 语音优先：粒子云点球体可视化，实时转录，TTS 播放
- 一键切换文字对话模式

### LLM — DeepSeek 专精
- 主引擎：DeepSeek (deepseek-chat / deepseek-reasoner)
- 本地回退：Ollama + LM Studio 自动检测
- 隐私模式（可选本地-only，数据不外传）

### 语音交互
- **粒子云点球体** — 800-2200 粒子 3D 可视化，随音频呼吸
- **TTS** — GPT-SoVITS 语音合成
- **STT** — Deepgram 流式识别

### MCP 生态系统
101 个工具（87 内置 + 14 外部），覆盖文件操作、桌面自动化、代码执行、Git 操作等。

### 持久记忆
长期记忆存储，巩固与演化时间线，关系网络自动构建。

### CLI 终端
`npm run cli` — 轻量终端对话界面。

---

## 快速开始

```bash
cp .env.example .env
# 编辑 .env → 填入 DEEPSEEK_API_KEY

npm install
npm run dev          # 后端 → http://localhost:3000

# 桌面端
cd src-tauri && cargo build
./target/debug/lumi-os.exe

# CLI 模式
npm run cli
```

### 数据目录

所有用户数据存储在 `~/Gaea/`（独立于代码仓库）：

| 路径 | 内容 |
|------|------|
| `~/Gaea/data/gaea.db` | SQLite 数据库 |
| `~/Gaea/data/keys.json` | API Key 存储 |
| `~/Gaea/data/knowledge/` | 知识库文件 |
| `~/gaea_skills/` | MCP 技能包 |

---

## License

GNU Affero General Public License v3.0 (AGPL-3.0)
