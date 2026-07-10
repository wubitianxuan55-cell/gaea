# gaeaW v0.13.1 release

- **版本**: v0.13.1
- **发布日期**: 2026-07-20
- **Git 提交**: `41f41f0` — release: v0.13.1 — costdb + knowledge + KnowledgePanel
- **Git tag**: `v0.13.1`

## 产物路径

- CLI: `release/v0.13.1/gaeaW.exe` (26MB)
- 桌面端: `release/v0.13.1/gaeaW-desktop.exe` (20MB)
- SHA256: `release/v0.13.1/SHA256SUMS`

```
63e182b10c7637aa271d7dc3b015001ea019df993a116ace3c15ec850e2ca81b  gaeaW-desktop.exe
9b0c030032b5474c20bbaadd2b87a15437baf2776fd5f1446d8c0659bce5825e  gaeaW.exe
```

## 关键变更

### 新增

- **工程知识库**：新增 `knowledge` 包，提供基于文件的工程知识条目管理（YAML frontmatter + Markdown body），支持 8 个工程分类（规范标准/工程案例/经验总结/材料工艺/法规政策/调查报告/设计方案/其他），配套 `knowledge_add` / `knowledge_search` MCP 工具（`internal/knowledge/`）
- **计算成本数据库**：新增 `costdb` 包，提供结构化的工程计算成本查询与存储，支持按计算类型/参数组合检索历史成本数据（`internal/costdb/`），配套 `cost_query` 工具（`internal/tool/builtin/cost_query.go`）
- **KnowledgePanel 前端**：知识库浏览覆盖层面板，支持搜索/分类筛选/展开详情，侧边栏知识库按钮（`BookOpen` 图标），`Shift+K` 快捷键打开（`desktop/frontend/src/components/KnowledgePanel.tsx`）

### 变更

- **替换 v0.13.0 的垂直能力模块**：删除 SpecPanel（`specdata/`, `spec_judge_test.go`, `spec_query_test.go`, `SpecPanel.tsx`）、contam_check、risk_calc、sampling_plan 及其测试，保留规范查询工具（`spec_query.go`）
- **前端样式重构**：全面转换为 Tailwind CSS 类，配置检查前移
- **report 工具升级**：`bid_proposal`/`survey_report`/`cost_estimate` 三合一文件生成逻辑重构

## 测试

- Go 后端: 全部 PASS
- 前端: 32/32 PASS（vitest）
