# V10.18.0 发布记录

**发布日期**: 2026-07-03
**构建产物**: `release/v10.18.0/gaeaW-desktop.exe`
**SHA256**: `5f21eef3549e2977be2a9ced09623e464de31feb42af8c8124e822d3b4e377fd`
**构建命令**: `cd gaeaW/desktop && wails build`
**提交范围**: V10.17.5 + 4 commits + 37 文件未提交变更

---

## Bug 修复

| 修复 | 文件 |
|------|------|
| 新建会话后统计面板数据不清空 — resetKey/sessionKey 竞态合并 | `StatsPanel.tsx` |
| 消息面板点击用户消息不跳转 — Transcript 卸载时清除 scrollToTurn | `Transcript.tsx` |
| FactCard 编辑模式 Cancel 按钮硬编码英文 → i18n | `FactCard.tsx` |
| renderWithLinks 硬编码中文 title → i18n 动态翻译 | `FactCard.tsx` |
| 记忆面板筛选芯片/类型 badge 显示英文 type 值 | `MemoryPanel.tsx`, `FactCard.tsx`, `ArchivesSection.tsx` |
| 顶栏变更按钮消失 — 补充 onOpenChanges 回调 | `App.tsx` (commit 8804600) |

## 新功能

| 功能 | 文件 |
|------|------|
| 顶栏增加 GitBranch 变更查看按钮（提取 handleViewChanges 共享回调） | `App.tsx` |
| 记忆类型翻译系统 — `factTypeLabel()` 共享函数 + 7 种 type 值中/英/繁翻译 | `factTypeLabel.ts` (新), `locales/*.ts` |
| TodoPanel 全面优化 — 进度条加高渐变+百分比、始终显示关闭、进行中动画、自动滚动 | `TodoPanel.tsx` |
| AskCard 全面优化 — 拖拽手柄 i18n、键盘 Enter 提交、多选/单选视觉区分、hover 反馈 | `AskCard.tsx` |

## i18n 新增 key

| Key | 中文 | English | 繁體 |
|-----|------|---------|------|
| `memory.typeUser` | 用户 | User | 使用者 |
| `memory.typeProject` | 项目 | Project | 專案 |
| `memory.typeFeedback` | 反馈 | Feedback | 回饋 |
| `memory.typeSemantic` | 语义 | Semantic | 語義 |
| `memory.typeEpisodic` | 情景 | Episodic | 情景 |
| `memory.typeProcedural` | 规程 | Procedural | 規程 |
| `memory.typeReference` | 参考 | Reference | 參考 |
| `ask.dragHint` | 拖拽移动 | Drag to move | 拖曳移動 |

## 代码质量

- 提取 `handleViewChanges` 为命名回调，消除 StatusBar 内 12 行内联 useCallback 重复
- 新建 `factTypeLabel.ts` 共享模块，消除 3 处重复类型翻译逻辑
- TodoPanel 删除未使用的 `allDone` 变量
- AskCard 新增全局 Enter 键提交 + 输入框内 Enter 提交

## 构建统计

- 37 文件变更
- +962 / -247 行
- TypeScript 零错误
- Vite 构建 3.04s
- wails build 14.4s
- 二进制大小: 15.6 MB
