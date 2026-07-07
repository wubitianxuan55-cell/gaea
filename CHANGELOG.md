# Changelog

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

### 变更

- **品牌名**：tianxuan → gaeaW，天璇 → 盖亚
- **配置系统**：废弃 [lsp]/[codegraph] 配置段，新增 [office] 办公配置段（模板路径、规范库、单位制、计算精度）
- **桌面端**：工具分组从编程分类改为办公分类，快捷指令更新，欢迎页/国际化更新
- **Go 依赖**：移除 LSP/CodeGraph/checkpoint 相关依赖，保留核心 agent/provider/event 框架不动
