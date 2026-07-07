# V10.32.0 项目基准

## 版本概览

- **版本**: V10.32.0
- **日期**: 2026-07-04
- **分支**: release/v10.17.5（工作分支）
- **核心主题**: Hermes/Hephaestus 双代理架构 + 统计面板修复

## 构建命令

```bash
# 桌面端（唯一正确方式）
cd gaeaW/desktop && wails build
# 产物: build/bin/gaeaW-desktop.exe

# CLI
cd gaeaW && go build -ldflags="-s -w" -o release/vX.Y.Z/gaeaW.exe ./cmd/gaeaW/

# 测试
cd gaeaW && go test ./...
cd gaeaW/desktop && go test ./...
cd gaeaW/desktop/frontend && npx tsc --noEmit
```

## 核心架构: Hermes/Hephaestus

```
用户输入
  │
  ▼
Hermes.Run()
  ├── shouldSkipPlanner? → Hephaestus 快速执行
  ├── Hermes.plan() → planWithTools (AgentRunner + 只读工具)
  │                   或 planStream (纯文本回退)
  ├── isAnswerNotAction? → Hermes 直答（不启动 Hephaestus）
  └── Hephaestus.Run(formatHandoff(input, plan))
       └── runDirect() for loop: LLM↔工具循环
```

### Hermes (规划 Agent)
- `hermesProvider`: LLM 模型
- `hermesSess`: 独立会话（prefix cache 稳定）
- `readonlyTools`: 只读工具注册表 (read_file/grep/glob/web_search/codegraph_*/gitnexus_*/lsp_*/git_status|diff|log/memory_search/read_skill)
- `planMaxSteps`: 最多 5 步工具调用

### Hephaestus (执行 Agent)
- 完整 `AgentRunner`（全部读写工具）
- 标准 LLM↔工具循环（runDirect）
- 接收 `formatHandoff()` 包装的 Hermes 计划

## 关键模块

| 模块 | 文件 | 职责 |
|------|------|------|
| Hermes 双代理 | `internal/agent/hermes.go` | Hermes+Hephaestus 编排 |
| 只读工具过滤 | `internal/boot/boot.go:newReadOnlyRegistry()` | 按 ReadOnly() 接口构建子集 |
| 客户端拦截 | `desktop/frontend/src/App.tsx` | `/model <ref>` 前端拦截 |
| 统计面板 | `desktop/frontend/src/components/StatsPanel.tsx` | 三列统计 + 趋势图 |
| 模型切换 | `desktop/frontend/src/components/ModelSwitcher.tsx` | 下拉显示 provider/model |

## 已知问题

- boot 测试失败（预先存在）：`planner_model "deepseek-pro/deepseek-v4-pro"` 未配置
- 前端仅 3 个 .tsx 文件入口，实际组件在 `desktop/frontend/src/` 下

## 依赖

- Go 1.22+
- Wails v2.12.0
- React 18 + Vite 6 + Zustand 5
- DeepSeek API (OpenAI 兼容)
