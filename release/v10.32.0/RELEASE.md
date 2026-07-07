# V10.32.0 发布记录

**发布日期**: 2026-07-04
**SHA256**: `595330f5381a079980a7a26cf5ea2fc52a626fafde8b0f7b2306216a3ebd34e3`
**构建**: `wails build` (13.5s, Wails v2.12.0)
**自 V10.31.0 以来**: 8 commits, 6+ 文件变更

---

## 🏛️ Hermes/Hephaestus 双代理架构

核心重构：将规划者(planner)和执行者(executor)正式命名为 Hermes 和 Hephaestus。

### 规划者 Hermes
- **只读工具能力**: `newReadOnlyRegistry()` 从完整工具注册表中按 `ReadOnly()` 接口过滤，构建只读工具子集
- **AgentRunner 模式**: `planWithTools()` — Hermes 可作为 AgentRunner 调用只读工具做代码研究
- **纯文本回退**: `planStream()` — 零工具调用开销，向后兼容
- **直答模式**: `isAnswerNotAction()` — 不包含写操作术语的计划直接由 Hermes 回答，不启动 Hephaestus
- **系统提示重写**: `HermesPrompt` — 明确 DIRECT ANSWER / PLAN 双模式

### 执行者 Hephaestus
- 保留完整 AgentRunner 工具集（全部读写工具）
- 通过 `formatHandoff()` 接收 Hermes 的计划文本
- 标准 LLM↔工具调用循环（runDirect）

### 重命名清单
| 旧 | 新 |
|----|----|
| `Coordinator` | `Hermes` |
| `coordinator.go` | `hermes.go` |
| `NewCoordinator` | `NewHermes` |
| `DefaultPlannerPrompt` | `HermesPrompt` |
| `persistExecutorNoOp` | `persistAnswer` |
| `executorHandoffMarker` | `hephaestusHandoffMarker` |

---

## 🐛 统计面板修复（3 项）

1. **命中率双重渲染**: StatsTable 外部重复命中率%显示 + 子代理 HitRateTrend 重复行 → 已删除
2. **StatsTable 内部重复**: 表格底部汇总行命中率大字与表格行"缓存命中"列重复 → 已删除底部大字
3. **模型标签区分**: 多 provider 同模型名时 `label` 从 `entry.Model` → `entry.Name`，`ModelSwitcher` 下拉显示 `m.ref`

---

## 📁 变更文件

| 文件 | 变更 |
|------|------|
| `internal/agent/hermes.go` | 新建（原 coordinator.go 重命名），+110/-12 |
| `internal/boot/boot.go` | newReadOnlyRegistry() + Hermes 集成 |
| `desktop/app.go` | 模型标签 .Model→.Name |
| `desktop/frontend/src/components/StatsPanel.tsx` | 删除 3 处重复渲染 |
| `desktop/frontend/src/components/ModelSwitcher.tsx` | 下拉显示 m.ref |
| `internal/cli/cli.go` | 注释更新 |

---

## 🔮 V10.33 展望

- Hermes 支持 `explore` 子代理（通过 run_skill）进行深度代码调查
- 规划者 web_search 网络搜索增强
- 更多 read-only MCP 工具集成
