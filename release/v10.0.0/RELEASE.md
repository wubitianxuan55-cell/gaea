# V10.0.0 Release Notes

**Date:** 2026-06-25
**Previous:** V9.3.0
**Commits:** 4f4a1a4 → fb40dc1 → 2164fae

---

## Highlights

DeepSeek-Reasonix V1.12 逐行对比吸收，三轮提交，10 文件，+307/-47 行。

### 功能移植（4f4a1a4）

| # | Feature | Source | Files |
|---|---------|--------|-------|
| 1 | Schema 预归一化缓存 | Reasonix `tool.go` | `internal/tool/tool.go` |
| 2 | SanitizeToolPairing Fast Path | Reasonix `provider.go` | `internal/provider/provider.go` |
| 3 | 401/403 智能重试 | Reasonix `openai.go` | `internal/provider/openai/openai.go` |
| 4 | Grace Round 机制 | Reasonix `agent.go` | `internal/agent/agent_run.go` |
| 5 | SuspendPrefix/ResumePrefix | Reasonix `tool.go` | `internal/tool/tool.go` |

### 代码质量（fb40dc1）

| # | Improvement | Source | Files |
|---|-------------|--------|-------|
| 6 | summarize select-on-ctx 防泄露 | Reasonix `compact.go` | `internal/agent/compact.go` |
| 7 | forget Archive (.archive 目录) | Reasonix `store.go` | `internal/memory/store.go`, `forget.go` |
| 8 | AuthError +KeySource/+HasKey | Reasonix `provider.go` | `internal/provider/provider.go` |
| 9 | chatFunction omitempty | Reasonix `openai.go` | `internal/provider/openai/openai.go` |

### KeepPolicy 系统（2164fae）

| # | Feature | Files |
|---|---------|-------|
| 10 | KeepPolicy 类型（KeepErrors/KeepUserMarked） | `internal/agent/agent.go` |
| 11 | keepIndexes + keepToolCallGroup + 6 helpers | `internal/agent/compact.go` |
| 12 | planCompaction 无窗口回退分支 | `internal/agent/compact.go` |
| 13 | prune.go KeepErrors 保护 | `internal/agent/prune.go` |

### 已确认无需移植
- `parallel_skills` — DAG 并行调度已存在
- Storm Breaker — `(name, error)` 签名已存在
- compactStuck — 检测机制已存在

### 缓存验证
- `TestCacheHitPrefixStable` ✅ prefix 稳定 0%→44%→64%
- `TestCacheHitClimbsWithoutCompaction` ✅ 14 轮攀升至 93%
- `TestCacheHitSurvivesTooSmallWindow` ✅ 压缩后恢复至 96%
- `TestRealDeepSeekCacheProbe` ✅ 冷启动 88%，warm 96%

---

## Build Artifact

| File | Size |
|------|------|
| `gaeaW-desktop.exe` (UPX) | 4.6 MB |
| Original (pre-UPX) | 15.4 MB |

**Build command:** `cd gaeaW/desktop && wails build`
**Archive:** `gaeaW/release/v10.0.0/`
