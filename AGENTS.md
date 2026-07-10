# gaea — 工程办公 AI 助手

gaea 是面向土壤修复与环境工程领域的 AI 办公助手，底层基于 tianxuan agent 引擎（Hermes 规划 + Hephaestus 执行），提供 CLI 与桌面 GUI 双模式。

---

## Always Do

- **使用内置工程工具**。代码内置 40+ 工程专用工具（`calc_*` 计算、`cost_estimate` 成本测算、`chart_gen` / `gantt_gen` 图表、`csv_parse` / `xlsx_read` / `docx_read` 文档解析、`pdf_create` / `pptx_create` / `xlsx_write` 报告生成、`spec_query` / `spec_judge` 规范查询）。优先使用这些工具而非手写脚本。
- **利用技能模块**。`.gaeaW/skills/` 下有 `site-survey`（场地调查）、`risk-assessment`（风险评估）、`remed-design`（修复设计）、`bid-package`（投标方案）、`data-report`（数据报告）等技能，使用前先检查。
- **模板引擎驱动报告**。报告生成走 `template_engine` 工具，不手写格式；图表用 `chart_gen` / `gantt_gen` 生成嵌入。
- **中文工程数据格式**。工程文件可能 GB2312/GBK 编码，CSV 分隔符以逗号为主，XLSX 首行为列名。`encoding_helpers` / `format_convert` 处理编码转换。
- **工程计算精度**。`calc_math` / `calc_stats` / `calc_unit` 工具默认 SI 单位制，保留 3 位小数。

## Never Do

- **不要虚构工具**。不使用未在 `gaeaW.example.toml` 中配置的 MCP 插件或代码中不存在的伪工具。所有内置工具在 `internal/tool/builtin/` 下，MCP 插件在 `gaeaW.example.toml` 的 `[mcp.servers]` 节。
- **不要在无规范依据时给工程结论**。必须引用具体规范（`spec_query`），不要猜测。
- **不要跳过技能模块直接写代码**。即使任务简单，先检查 `.gaeaW/skills/` 下是否有可用技能。
- **不要假设数据编码**。先检查文件编码再解析，中文工程文件可能 GBK。
- **不要越过 agent 控制流直接改引擎**。业务逻辑走 `internal/tool/builtin/` 工具扩展，不改 `internal/agent/` 规划循环。

## 架构

```
gaeaW/
├── cmd/                    # 入口点
│   ├── gaeaW/              # CLI 主程序
│   └── cacheguard/         # 缓存守护
├── internal/               # 核心引擎
│   ├── agent/              # Hermes(规划) + Hephaestus(执行) 双模型
│   ├── control/            # 对话控制流
│   ├── tool/               # 工具注册表 + 47 个 builtin 工具
│   ├── plugin/             # MCP 插件编排（非虚构，真实存在）
│   ├── provider/           # LLM 提供方（OpenAI / Anthropic / xAI）
│   ├── memory/             # 会话记忆
│   ├── knowledge/          # 知识库检索
│   ├── config/             # 配置管理（TOML）
│   ├── hook/               # 事件钩子系统
│   ├── costdb/             # 成本数据库
│   ├── sandbox/            # 沙箱执行
│   └── skill/              # 技能系统
├── desktop/                # Wails v2 桌面壳
│   ├── frontend/           # React + Vite + Tailwind + Lucide
│   │   └── src/
│   │       ├── components/ # UI 组件
│   │       ├── lib/        # 状态 / i18n / bridge
│   │       └── locales/    # 中英文语言包
│   └── build/              # 构建产物
└── .gaeaW/skills/          # 工程技能模块
```

## 构建

| 命令 | 产物 | 用途 |
|------|------|------|
| `cd desktop && wails build` | `desktop/build/bin/gaeaW-desktop.exe` | 完整桌面端（含窗口、托盘、icon） |
| `cd desktop && go build -o gaea-desktop.exe .` | `desktop/gaea-desktop.exe` | 轻量 Go 编译 |
| `cd desktop/frontend && pnpm run build` | `desktop/frontend/dist/` | 前端静态资源 |
| `cd desktop/frontend && pnpm run test` | — | 前端 Vitest（37 tests） |
| `go test ./...` | — | Go 全量测试 |

## 命名约定

- **产品名**（用户可见）：`gaea`
- **Go module**：`gaeaW`
- **CLI 二进制**：`gaeaW.exe`
- **桌面二进制**：`gaeaW-desktop.exe`
- **配置**：`gaeaW.example.toml`
- **前端主题**：`data-theme="dark"`，accent `#6366F1`（indigo），background `#0F172A`

## 8 个工程技能模块

Welcome 页面入口，每个对应 `.gaeaW/skills/` 下的技能：

1. **场地环境调查** — `site-survey`：现场勘测、采样方案、调查报告
2. **投标方案编制** — `bid-package`：招标评审、投标书、技术方案
3. **修复方案设计** — `remed-design`：治理工艺、工程设计、施工图纸说明
4. **数据报告生成** — `data-report`：检测数据整理、报告模板填充
5. **污染风险评估** — `risk-assessment`：暴露评估、风险表征、修复目标
6. **成本测算** — `cost_estimate`：工程量清单、单价分析、总价汇总
7. **图表生成** — `chart_gen` / `gantt_gen`：工程图表、甘特图
8. **文档汇总** — `doc_merge` / `pdf_create` / `pptx_create`：多格式报告合成

## 工具速查

所有工具在 `internal/tool/builtin/` 下，按类别：

| 类别 | 工具 |
|------|------|
| 🧮 计算 | `calc_math` `calc_stats` `calc_unit` |
| 📄 文档解析 | `csv_parse` `xlsx_read` `docx_read` `pdf_extract` |
| 📝 报告生成 | `pdf_create` `pptx_create` `xlsx_write` `doc_merge` |
| 📊 图表 | `chart_gen` `gantt_gen` |
| 🏗️ 工程造价 | `cost_estimate` `cost_query` `material_query` |
| 📋 规范 | `spec_query` `spec_judge` |
| 📂 文件 | `readfile` `writefile` `ls` `workspace` `archive` |
| 🌐 网络 | `webfetch` `websearch` |
| 🧠 知识 | `knowledge_add` `knowledge_search` `memory_search` |
| 🎯 任务 | `todo` `completestep` `bash` `bgjobs` |
| 🖥️ 自动化 | `computer_use` `hide_window` |
| 🏗️ 项目 | `project_init` `survey_report` `bid_proposal` |
| 🔧 工具链 | `template_engine` `format_convert` `encoding_helpers` `confine` |

## MCP 插件

由 `internal/plugin/` 作为通用 MCP 客户端连接，在 `gaeaW.example.toml` 的 `[mcp.servers]` 中配置：

| 插件 | 启动命令 | 用途 |
|------|----------|------|
| `chrome` | `npx @modelcontextprotocol/server-puppeteer` | 网页浏览/内容抓取 |
| `github` | `npx @modelcontextprotocol/server-github` | 代码仓库管理 |
| `computer-use` | `uvx windows-mcp serve` | Windows 桌面自动化 |
| `documents` | `npx @modelcontextprotocol/server-filesystem` | 文件系统读写 |
| `spreadsheets` | `npx mcp-google-sheets` | Google Sheets 读写 |
