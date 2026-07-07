# Changelog

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
