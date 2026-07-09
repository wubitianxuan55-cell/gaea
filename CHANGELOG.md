
## v0.13.1 (2026-07-20)

### 新增

- **计算成本数据库**：新增 `costdb` 包，提供结构化的工程计算成本查询与存储，支持按计算类型/参数组合检索历史成本数据（`internal/costdb/`）
- **工程知识库**：新增 `knowledge` 包，提供基于文件的知识条目管理（YAML frontmatter + Markdown body），支持 8 个工程分类（规范标准/工程案例/经验总结/材料工艺/法规政策/调查报告/设计方案/其他），配套 `knowledge_add` / `knowledge_search` MCP 工具（`internal/knowledge/`）
- **KnowledgePanel 前端**：知识库浏览覆盖层面板，支持搜索/分类筛选/展开详情，侧边栏知识库按钮（`BookOpen` 图标），`Shift+K` 快捷键打开（`desktop/frontend/src/components/KnowledgePanel.tsx`）

### 变更

- **替换 v0.13.0 的垂直能力模块**：删除 SpecPanel (`specdata/`, `spec_judge_test.go`, `spec_query_test.go`, `SpecPanel.tsx`)、contam_check、risk_calc、sampling_plan 及其测试，保留规范查询工具 (`spec_query.go`)
- **前端样式重构**：全面转换为 Tailwind CSS 类（`styles.css`, `tailwind.css`），配置检查前移（`eslint.config.js` → `package.json`）
- **report 工具升级**：`bid_proposal`/`survey_report`/`cost_estimate` 三合一文件生成逻辑重构

### 构建

- CLI：`release/v0.13.1/gaeaW.exe`
- 桌面端：`release/v0.13.1/gaeaW-desktop.exe`
- SHA256：`release/v0.13.1/SHA256SUMS`

## v0.12.0 (2026-07-10)

### 新增

- **规划者能力升级**：HermesPrompt 从 4 条设计原则扩展为 7 条专业判断原则（Evidence over assumptions / Push back / Clarify / Simpler / Never agree / Design quality / Verifiable criterion），新增结构化数据处理指导和工程规范引用机制（GB 36600-2018 / GB 15618-2018 / HJ 25.1~25.6）（`internal/agent/hermes.go`）
- **执行者独立提示**：新增 `HephaestusPrompt` 常量，包含 5 个结构化段落（角色与原则 / 执行-验证-签退三阶段工作流 / 错误恢复模式 / 工程办公质量检查点 / 禁止事项），`formatHandoff` 改为引用该常量而非内联 bullet（`internal/agent/hermes.go`）
- **双向互知增强**：HermesPrompt 新增 About Hephaestus 段落，HephaestusPrompt 新增 About Hermes 段落，统一术语闭环（success criterion ↔ complete_step evidence）（`internal/agent/hermes.go`）
- **DefaultSystemPrompt 更新**：工作流段新增"已由系统自动编排"说明，原则段新增"执行后必验证"（`internal/config/config.go`）

### 修复

- **执行失败反馈缺失**：`execResult==nil` 且 `execErr!=nil` 时，用 `execErr.Error()` 构造 `[上一轮执行结果] errors` 注入 planner 会话（`internal/agent/hermes.go`）
- **planStream 会话持久化**：planStream 末尾新增 `hermesSess.Add(user input + assistant response)`，与 planWithTools 行为一致（`internal/agent/hermes.go`）
- **重规划输入累积**：引入 `originalTask` 变量，handoff 始终使用原始任务而非累积反馈（`internal/agent/hermes.go`）
- **ResetSession 泄漏历史**：`ResetSession` 替换 `hermesSess` 后同步 `plannerAgent.SetSession`，避免引用旧 session（`internal/agent/hermes.go`）
- **planWithTools session 污染**：plan 调用前捕获 `planPreLen`，失败时 `Truncate(planPreLen)` 回滚部分 tool-call 消息（`internal/agent/hermes.go`）

### 变更

- **AGENTS.md / CLAUDE.md 解耦**：移除规划者专属指令（"规划阶段用 ask 确认"）和过程性指令（"调用 spec_judge 前…"），重写数据格式条目为陈述式领域约定（"中文工程数据格式约定"），两份文档现为纯共享领域知识（`AGENTS.md`, `CLAUDE.md`）
- **operational task 硬约束**：从软性"skip investigation"升级为"FIRST AND ONLY action = <!--plan-->"，禁止任何工具调用（`internal/agent/hermes.go`）
- **重复段落消除**：HermesPrompt 合并 About Hephaestus 与 WHAT/HOW 段；HephaestusPrompt 删除重复标题、重复步骤 2、重复禁止项（`internal/agent/hermes.go`）
- **术语统一**：HermesPrompt "coding agent" → "execution agent"（`internal/agent/hermes.go`）

### 测试

- **3 个 HermesPrompt 内容测试**：工程规范引用、数据格式指导、设计原则
- **HephaestusPrompt 段落测试**：验证 5 个段落标题
- **双向互知测试**：HermesPrompt_KnowsHephaestus、HephaestusPrompt_KnowsHermes
- **formatHandoff 更新**：验证新的 `## Hephaestus 执行规范` 段落

### 构建

- CLI：`release/v0.12.0/gaeaW.exe`
- 桌面端：`release/v0.12.0/gaeaW-desktop.exe`
- SHA256：`release/v0.12.0/SHA256SUMS`
## v0.11.1 (2026-07-08)

### 修复

- **`newReadOnlyRegistry` 空 if 修复**：只读工具注册到空 `if` 块，工具未实际加入只读注册表，现已正确调用 `ro.Add(t)`（`internal/boot/boot.go`）
- **`ensureWorkspace` 静默吞错修复**：工作目录确定失败时静默无输出，现在 `os.UserHomeDir()` 失败时通过 `fmt.Fprintf(os.Stderr, ...)` 输出中文诊断信息（`desktop/workspace.go`）

### 新增

- **扫描件 PDF OCR 回退**：`format_convert` PDF→Markdown 路径新增 OCR 回退——文本提取为空时自动调用 `pdftoppm`（PDF→PNG）+ `tesseract`（OCR）流水线，支持中文简体/繁体/英文混合文档（`internal/tool/builtin/format_convert.go`）

### 文档

- **配置注释补充**：`gaeaW.toml` 中 `mimo-pro` 的 base_url 添加注释说明自有配额域名、`[office]` 段注明尚未实现
- **compact 描述更新**：`format_convert` 的简洁描述添加 "含 OCR 扫描件回退"（`internal/tool/builtin/compact.go`）

### 构建

- CLI：`release/v0.11.1/gaeaW.exe`
- 桌面端：`release/v0.11.1/gaeaW-desktop.exe`

## v0.11.0 (2026-07-08)

### 新增

- **5 个 MCP 插件集成**：chrome（Puppeteer 浏览器）、github（仓库管理）、computer-use（Windows 桌面自动化）、documents（文件系统）、spreadsheets（Google 电子表格）
- **桌面端配置自动发现**：从可执行文件向上搜索 gaeaW.toml，双击 exe 也能找到项目根目录配置
- **插件工具描述压缩**：插件工具描述自动取首句、去冗余前缀、80 字符截断，与内置工具一致的紧凑表示

### 变更

- **规划者工具集优化**：删除 CodeGraph/GitNexus 硬编码例外，所有 MCP 只读工具自动进入规划者工具集
- **工程办公方法论**：AGENTS.md / CLAUDE.md 替换为工程办公方法论，去掉全部编程内容

### 清理

- **编程残留全面清理**：agent 提示中 "coding agent" 改为 "engineering office assistant"、删除 LSP 工具过滤、删除 cli codegraph 命令、清理 config.go 废弃注释、删除 inline-diff CSS 样式等 16 项

### 修复

- **TOML 路径解析错误**：filesystem 插件路径反斜杠导致 \U 转义报错，改为正斜杠
- **重复注释/测试用例**：删除 boot.go / tool_coherence_test.go 中的重复行
- **lsp_* 残余引用**：删除提示和注释中对已删除 LSP 工具的引用

### 构建

- CLI：release/v0.11.0/gaeaW.exe
- 桌面端：release/v0.11.0/gaeaW-desktop.exe


## v0.10.0 (2026-07-08)

### 新增

- **xai-oauth 完整集成**：支持 OAuth PKCE 登录/登出，设置面板中提供「🔑 登录 XAI」按钮和 OAuth 状态徽章，模型切换器正常显示
- **主题系统重设计**：暗岩/深壤/墨金/素纸/砂岩/晨雾 6 套主题（3 亮 + 3 暗）
- **欢迎界面重设计**：技能模块入口布局，去掉输入框
- **Logo 重设计**：亮色大地风，暖白背景 + teal 山形 W + 四层山脉
- **右侧边栏优化**：精简布局、默认展开、宽度增加至 340px
- **报告面板扩展**：支持 pdf/pptx/html/png/svg 全部格式
- **托盘图标修复**：改用 .ico 格式，暗色 teal 底 + 白色 W，系统托盘正常显示
- **pptx/xlsx 图表嵌入增强**
- **版本管理**：VERSION 文件统一管理版本号

### 修复

- **设置面板 XAI 不可见**：`desktop/main.go` 添加 xai 空白导入
- **模型列表 XAI 被过滤**：`app_meta.go` `Models()` 改用 `xai.IsLoggedIn()` 检查
- **托盘图标空白**：PNG→ICO 格式转换，`//go:embed tray_icon.ico`
- **默认配置缺失 xai**：`config.go` `Default()` 添加 `xai-oauth` 条目
- **配置校验拦截**：`config.go` `Validate()` 对 `kind="xai"` 跳过 API Key 检查

### 构建

- 桌面端：`desktop/build/bin/gaeaW-desktop.exe`（17 MB）
- 校验：`SHA256: a56179f7e73e6e3441bc21e04ffebb5d494c68df1b7cadc4f90aaa7bf8efe6bb`

---

## v0.9.1 (2026-07-08)

### 修复

- **右侧边栏宽度调整**：`--workspace-width` 从 280px 改为 340px，统计标签三列不再挤成两行
- **右侧边栏默认展开**：`workspacePanelOpen` 默认值改为 `true`
- **恢复功能面板**：CapabilitiesPanel（技能/工具/MCP 按钮）恢复显示
- **恢复记忆按钮文字**：Sidebar 中记忆按钮的文本标签补回
- **报告面板扩展**：.pdf / .pptx / .html / .txt / .png / .svg 文件现可在报告面板中显示，每种格式有独立图标和颜色

### 构建

- 桌面端：`desktop/build/bin/gaeaW-desktop.exe`（16.6 MB）

---

## v0.9.0 (2026-07-08)

### 新增

#### 欢迎界面重设计 — 技能模块化入口
- **移除中央输入框**：不再直接输入，改为技能卡片网格引导工作流
- **8 个工程技能模块**：场地环境调查、投标方案编制、修复方案设计、数据报告生成、污染风险评估、成本测算、图表生成、文档汇总
- **每张卡片**：图标 + 名称 + 描述（2行截断）+ 类型徽章（🧬子代理/📄文档/📊图表）
- **保留最近会话**列表和自由提问提示条

#### 主题系统重设计 — 3 暗 + 3 亮
- **3 暗色**：暗岩 Slate（`#0F172A`+靛蓝）、深壤 Earth（`#1A1512`+大地棕）、墨金 Noir（`#111113`+暗金）
- **3 亮色**：素纸 Paper（`#F8FAFC`+天蓝）、砂岩 Sand（`#FDF6EC`+铜棕）、晨雾 Mist（`#F2F5F8`+青绿）
- **自动迁移**：旧主题名（dark→slate、light→paper、warm→sand、ice→slate、forest→slate）无缝映射

#### 文档图表增强
- **PPT 图表嵌入**：`pptx_create` 支持 `chart` 参数（文件路径或 data:image/png;base64,...），嵌入幻灯片
- **Excel 图表嵌入**：`xlsx_write` 支持 `chart` 字段（bar/column/line/pie 四种类型），生成完整 OOXML 图表

### 精简

- **删除"消息"标签**：右侧边栏去掉了消息过滤标签
- **删除"功能"面板**：移除 CapabilitiesPanel 入口按钮和组件
- **删除"追踪"面板**：TracePanel 与对话内实时显示完全重复（劣化副本），移除 TracePanel 和 traceStore
- **删除 code-review skill**：编程专属 skill 归 tianxuan 管理
- **清理 compact.go**：移除 10 个未实现的编程工具条目
- **清理 config.go**：移除 5 个 git 工具默认启用

### 构建

- 桌面端：`desktop/build/bin/gaeaW-desktop.exe`（16.6 MB）
- CLI：`cmd/gaeaW` → `gaeaW.exe`（25.9 MB）
- 缓存守卫：`cmd/cacheguard` → `cacheguard.exe`（3.2 MB）
- 插件示例：`cmd/gaeaW-plugin-example` → `gaeaW-plugin-example.exe`（3.1 MB）

---

## v0.8.0 (2026-07-08)
## v0.8.0 (2026-07-08)

### 新增

#### Logo 全面重设计 — 山形 W
- **几何山形 W**：4 块 teal 平行四边形组成抽象 W/山峰，纯几何语言，小尺寸辨识度高
- **全面替换**：主 SVG/PNG(512×512)/ICO(16/32/48/256)/托盘图标/appicon/favicon/docs
- **白底+浅灰边框**：`#FFFFFF` + `#E2E8F0`，所有背景下均清晰可见

#### 开机动画「大地呼吸」
- **logo 呼吸动画**：3.5s 周期 `scale(1↔1.045)`，模拟大地缓慢呼吸
- **径向光晕**：logo 背后 teal 色圆形渐变光晕随呼吸同步缩放
- **teal 呼吸进度条**：32px × 3px 横条替代三圆点脉冲，`scaleX(0.4↔1)`

#### 欢迎界面动画联动
- **同一呼吸动画持续**：从开机到欢迎页 logo 呼吸不间断，形成无缝过渡
- **Stagger 入场**：logo → tagline → 输入框 → 快捷命令各延迟 80ms 依次淡入
- **间距调整**：logo 与 tagline 间距加大，布局更舒展

#### 托盘图标重设计
- 旧绿色嫩芽 → 透明底山形 W（32×32），与主 logo 视觉统一

### 变更

- **Favicon**：`index.html` 新增 `<link rel="icon" type="image/svg+xml">`
- **清理残留**：删除 `internal/serve/webui/assets/logo-DUNCzphC.png` 旧 hash 文件

### 构建

- CLI: `release/v0.8.0/gaeaW.exe` (19MB)
- Desktop: `release/v0.8.0/gaeaW-desktop.exe` (16MB)
- CacheGuard: `release/v0.8.0/cacheguard.exe` (2.2MB)
- Plugin: `release/v0.8.0/gaeaW-plugin-example.exe` (2.1MB)
- SHA256: `release/v0.8.0/SHA256SUMS`

---

## v0.7.0 (2026-07-08)

### 新增

#### bash 工具：长期运行进程智能检测
- **`isLongRunningCommand`** — 匹配 18 种 Dev 服务器/长期运行命令模式（`wails dev/serve`、`npm start/dev/serve`、`npx vite/next/tsx watch`、`pnpm dev/start`、`yarn dev/start`、`go run`、`Start-Process`、`start `、`python -m http.server/flask/uvicorn/fastapi`）
- **`hasServerStartupOutput`** — 检测 12+ 种服务器启动输出特征（`listening on`、`serving at`、`localhost:`、`VITE v`、`compiled successfully`、`Press Ctrl+C`、含端口的 `http://` 链接等）
- **双路径等待**：启动后先等 8 秒，仍在运行时判断是否长期进程→早期返回不杀进程
- **`earlyReturnCh` 信号量**：防止 ctx 取消时误杀用户想保持运行的服务器进程
- **JSON 输出模式同步支持**：返回 `{ok:true, running:true, stdout, stderr}`

### 变更

#### 右侧栏重构
- **右侧栏"工具/技能"标签删除**：`App.tsx` 移除 `RuntimePanel` 和 `SkillsPanel` 的 import/渲染，`rightTab` 类型去掉 `runtime`/`skills`
- **融入左侧 Capabilities 抽屉**：`CapabilitiesPanel` 新增"工具"tab，内联 `TOOL_DESC`/`SECTIONS`/`ToolCard`/`ToolGroup`/`ToolsTabContent`，技能列表显示使用次数计数
- **右侧面板启动可见性修复**：顶栏工具栏新增 `PanelRightOpen`/`PanelRightClose` 开关按钮

#### 简洁 Logo 重设计
- **极简三要素设计**：深青绿圆角方底 + 水平地表线 + 翡翠绿双叶嫩芽
- **全面替换**：SVG/PNG(512×512)/ICO(6分辨率)/托盘图标/文档副本/WebUI serve 资源

### 构建

- CLI: `release/v0.7.0/gaeaW.exe`
- Desktop: `release/v0.7.0/gaeaW-desktop.exe`
- CacheGuard: `release/v0.7.0/cacheguard.exe`
- Plugin: `release/v0.7.0/gaeaW-plugin-example.exe`
- SHA256: `release/v0.7.0/SHA256SUMS`

---



### 修复

- **编译错误修复**：`internal/agent/output_continue_test.go` 和 `recall_reminder_test.go` 使用 `strings.Contains` 替代未定义的 `containsStr`；`internal/boot/boot.go` 删除重复的 `return ro` 语句
- **go vet 全通过**：`go vet ./...` 无警告

### 验证

- **工具注册验证**：35 个内置工具全部正确通过 `init()` 注册，7 个辅助文件（compact/confine/encoding_helpers/hide_window/workspace/websearch_config）确认非工具不需注册
- **Agent 端到端测试**：CLI 版本显示、DeepSeek API 连接、`gaeaW run` 任务执行均正常
- **关键工具验证**：`pdf_create`、`pptx_create`、`docx_read/write`、`xlsx_write`、`survey_report`、`cost_estimate`、`spec_judge` 7 个工具接口完整
- **规范库验证**：GB 36600-2018（16种污染物限值）、GB 15618-2018（8种农用地限值）、HJ 25.1~6 等 21 条规范条文完整
- **桌面端构建**：Vite 前端构建（1960 模块）+ Wails build 通过，生成 `gaeaW-desktop.exe`
- **前端组件完整性**：63 个组件齐全，FileTree/FilePreview/WorkspacePanel 就绪，Composer 支持拖拽上传和多模态输入

### 构建

- CLI: `release/v0.6.0/gaeaW.exe`（19MB）
- Desktop: `release/v0.6.0/gaeaW-desktop.exe`（16MB）
- CacheGuard: `release/v0.6.0/cacheguard.exe`
- Plugin: `release/v0.6.0/gaeaW-plugin-example.exe`
- SHA256: `release/v0.6.0/SHA256SUMS`

---


---

## v0.5.0 (2026-07-07)

### 新增

#### 文档生成工具（4个）
- **`pdf_create`** — PDF 文件生成（纯 Go 实现 A4 页面文本排版，支持标题/多级标题/自动换行/分页/页脚，零外部依赖）
- **`pptx_create`** — PPT 演示文稿生成（接收 JSON 幻灯片数组，生成兼容 PowerPoint/WPS 的 .pptx，含标题/正文要点布局和主题配色）
- **docx_write 增强** — 新增 ### 三级标题（Heading3）、无序/有序列表（bullet/decimal）、Markdown 表格（`|col1|col2|` 管道语法）、行内 `**加粗**`/`*斜体*` 格式
- **xlsx_write 增强** — 公式识别（`=`开头的单元格自动转为 `<f>`）、数值类型自动检测（`isNumeric`）、多工作表支持（`sheets` 参数）、列宽设置

#### 拖拽 & 多模态输入增强
- **非图片文件拖放** — 拖入任意文件（非图片）自动上传至 `.gaeaW/attachments/`，在输入框中插入 `@` 文件引用标签
- **文件粘贴支持** — Ctrl+V 从资源管理器粘贴文件，走上传+引用插入流程
- **视觉拖放指示器** — 拖入文件时显示半透明 overlay + 下载图标动画 + "释放以添加文件" 文案
- **大文件警告** — >10MB 文件弹出确认提示
- **消息历史中附件渲染** — `[image]` 文本替换为实际 `<img>` 缩略图（通过 `AttachmentDataURL` 安全 data URL），非图片文件显示文件图标+文件名

#### 工作区文件管理面板
- **FileTree 组件** — 递归目录树，按扩展名区分图标（文件夹/图片/文本/通用），展开/折叠，懒加载子目录，隐藏文件过滤
- **FilePreview 组件** — 文本文件 `<pre>` 渲染、图片文件 `<img>` 渲染、二进制文件大小信息、"在外部程序打开"按钮
- **WorkspacePanel 重写** — 替换原有的简化桩，左栏 FileTree（可变宽度拖拽）+ 右栏 FilePreview，顶部面包屑路径导航+刷新按钮

#### 企业微信 Bot 接入
- **Webhook 接收器** — HTTP endpoint `/webhook/wecom`，支持 GET URL 验证和 POST 消息回调
- **消息验签解密** — 企业微信 `msg_signature`/`timestamp`/`nonce` 签名校验 + AES 解密回调消息体
- **消息路由** — 解析文本消息，`/help` 帮助、`/status` 状态查询、常规消息转发给 `Controller.Submit`
- **企业微信 API 回复** — 获取 `access_token`，通过 `message/send` 发送回复
- **配置集成** — `[bot]` 配置段（`gaeaW.example.toml` + `config.BotConfig`）

#### 自定义技能开发
- **Skill Creator 技能** — `.gaeaW/skills/skill-creator/SKILL.md`，引导 AI 帮助用户创建/编辑/测试/部署自定义技能

#### 土壤修复领域技能（5个）
- `site-survey` — 场地环境调查全流程（更新：新增 `pdf_create`/`chart_gen` 输出能力）
- `risk-assessment` — 风险评估与超标判定（新增）
- `remed-design` — 修复方案设计（更新：增强 `docx_write` 表格/列表输出）
- `bid-package` — 投标文件包生成（新增：含 `pptx_create` 演示 PPT）
- `data-report` — 检测数据报告生成（新增）

### 变更

- **`.gitignore`** — 添加 `!.gaeaW/skills/` 例外，使项目技能文件可被版本控制
- **删除** `.claude/skills/ui-ux-pro-max/`（tianxuan 遗留）

### 构建

- CLI: `release/v0.5.0/gaeaW.exe`
- Desktop: `release/v0.5.0/gaeaW-desktop.exe`
- SHA256: `release/v0.5.0/SHA256SUMS`

---

## v0.4.0 (2026-07-07)

### 清理

- **批量删除 tianxuan/reasonix 残留**：删除 `_archive/`、`benchmarks/`、`.codegraph/`、`.tianxuan/`、`.reasonix/`、`memory/`、`web/` 等 7 个顶级目录
- **release/ 精简**：删除 13 个 tianxuan v10.* 版本目录（保留 gaeaW v0.0.1、v0.2.0）
- **docs/ 清理**：删除 `superpowers/plans/` + `superpowers/specs/`（15 个设计文档）、`SPEC.md`、`CHECKPOINTS.md`、`MIGRATING.md`、截图和 Logo 等 10 个文件
- **编码残留删除**：`cmd/e2ebench/`、`scripts/` 3 个旧脚本、`internal/agent/checkpoint.go` 及测试、`desktop/sorting/`、桌面旧二进制和发布目录

### 品牌修正

- **README.md / README.zh-CN.md**：重写为土壤修复工程办公AI助手定位
- **CONTRIBUTING.md**：重写为 gaeaW 贡献指南
- **Makefile**：产物命名 `bin/tianxuan` → `bin/gaeaW`，删除 CodeGraph 相关变量
- **gaeaW.example.toml**：注释 `Reasonix` → `gaeaW`
- **源码品牌**：`desktop/cmd/sign/`、`internal/memory/doc.go`、`internal/config/expand_test.go`、`cmd/gaeaW-plugin-example/main.go` 中 25+ 处 Tianxuan/TIANXUAN → gaeaW/GAEAW
- **`TIANXUAN.md`**：删除（已由 AGENTS.md + 项目记忆取代）

### 构建

- CLI: `release/v0.4.0/gaeaW.exe`
- Desktop: `release/v0.4.0/gaeaW-desktop.exe`
- SHA256: `release/v0.4.0/SHA256SUMS`

---

## v0.3.0 (2026-07-07)

### 桌面端 UI 增强

- **品牌色系更新**：accent 从 `#22C55E`（绿）→ `#6366F1`（岩灰蓝/indigo），新增 `[data-theme="earth"]` 大地暖棕主题
- **新 Logo**：极简几何线条大地图标（地表线+地下分层+叶芽），indigo 配色
- **国际化文案**：三语（zh/en/zh-TW）全面修正为土壤修复场景
- **欢迎页定制**：6 个土壤修复快捷命令（场地调查/风险评估/修复方案/成本测算/数据分析/投标文件）
- **报告预览面板**：新建 `ReportPreviewPanel` 组件，支持通过 bridge API 读取报告文件列表
- **Branding 修复**：`INPUT_HISTORY_KEY` → `gaeaW.inputHistory`，index.html 新增 SEO meta
- **右侧面板 tab**：新增「报告」标签，支持 `/` 命令一键访问

### 构建

- CLI: `release/v0.3.0/gaeaW.exe`
- Desktop: `release/v0.3.0/gaeaW-desktop.exe`
- SHA256: `release/v0.3.0/SHA256SUMS`

---

## v0.2.0 (2025-07-07)

### 新增

#### 土壤修复专用工具（11个）
- **规范引擎**：`spec_query` 土壤修复规范智能查询（内置 HJ 25.1~6、GB 36600、GB 15618 等 15+ 规范条文索引）、`spec_judge` 超标判定（自动对标筛选值/管控值）
- **报告生成**：`survey_report` 初调/详调报告框架、`bid_proposal` 投标技术方案、`imple_plan` 修复实施方案、`cost_estimate` 成本测算表（七项汇总）
- **文档处理**：`xlsx_read/write` Excel 读写、`docx_read/write` Word 读写、`pdf_extract` PDF 文本提取

#### 从 gaea 移植的工具（5个）
- `format_convert` 文档格式转换（docx/xlsx/pdf→Markdown 统一入口）
- `chart_gen` matplotlib 图表生成（支持 bar/line/pie/scatter 四类）
- `doc_merge` 多 docx 文档合并（逐元素追加，保留格式）
- `archive` zip 打包/解压（含路径穿越安全检查）
- `save_template` / `run_template` 多步骤工具链模板（JSON 定义 + 参数替换 `{{.param}}`）

#### 现有工具增强
- `csv_parse` 新增自动编码检测（UTF-8/GBK）、分隔符自动检测、limit 参数
- `pdf_extract` 新增 pages 范围参数（支持 "1-5" / "1,3,5"）
- `xlsx_read` 新增 all_sheets 参数支持读取全部工作表

#### 内置技能（7个土壤修复专用 + 3个办公通用）
- **土壤修复子代理**：`site-survey` 场地调查、`bid-writer` 投标方案、`remed-plan` 修复方案、`cost-calc` 成本测算
- **办公通用子代理**：`format-convert` 文档格式转换、`chart-builder` 图表生成、`doc-assemble` 文档拼装

#### 系统提示词重构
- 身份从"工程办公助理"改为"**土壤修复工程办公专用AI助手**"
- 规范引用对齐 HJ 25.x + GB 36600/15618 土壤修复体系
- 子代理指向土壤修复专有技能

### 修复

- **P0: complete_step 严格验证不对称 bug**：`verifyStepEvidence` 和 `verifyTodoStep` 忽略 `strictVerify` 标志，在生产环境（`strictVerify=false`）下也强制执行命令精确匹配/路径全命中校验。修复：两函数开头添加 `!ledger.StrictVerification()` 短路返回；`execute_one.go` 移除无条件 `SetStrictVerification(false)` 重置，避免覆盖 Plan Mode 的显式设置。

### 构建

- CLI: `release/v0.2.0/gaeaW.exe` (19MB)
- Desktop: `release/v0.2.0/gaeaW-desktop.exe` (16MB)
- SHA256: `release/v0.2.0/SHA256SUMS`

---

## v0.0.1 (2025-07-07)

### 从 tianxuan 分叉

gaeaW 是 tianxuan（天璇）AI 编程助手的工程办公改造分支。

### 新增

- **7 个工程办公工具**：`csv_parse` CSV解析统计、`calc_math` 数学表达式计算、`calc_stats` 统计分析、`calc_unit` 单位转换、`material_query` 材料属性查询、`gantt_gen` 甘特图生成、`project_init` 项目目录初始化
- **系统提示词重构**：身份从"编程助手"改为"专业工程办公助理"，能力描述覆盖文档处理/工程计算/规范查询/图表生成/项目管理
- **内置技能替换**：`doc-writer` 工程文档写作、`data-analyst` 数据分析、`spec-checker` 规范审查、`report-builder` 报告生成

### 删除

- **编程模块**：LSP 语言服务器、CodeGraph 代码智能、代码差异计算(diff)、跨会话学习(learning)、编辑快照(checkpoint)
- **编程工具**：git_* 5个、glob、grep、codeindex、edit_file/multi_edit/edit_lines/delete_range/delete_symbol/move_file/notebook_edit、workspace、preview、compact
- **编程技能**：explore、research、review、security-review
- **前端组件**：DiffView、InlineDiff、CodeViewer、WorkspacePanel 及相关编辑器组件
