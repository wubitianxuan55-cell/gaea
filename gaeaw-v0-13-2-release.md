# gaeaW v0.13.2 release

- **版本**: v0.13.2
- **发布日期**: 2026-07-21
- **Git 基线**: `41f41f0` (v0.13.1) + 未提交的 v0.13.2 变更
- **Git tag**: `v0.13.2`

## 产物路径

- CLI: `release/v0.13.2/gaeaW.exe` (19MB)
- 桌面端: `release/v0.13.2/gaeaW-desktop.exe` (15MB)
- SHA256: `release/v0.13.2/SHA256SUMS`

```
e3b66960404bc37236f2ded24e2fd128f899b7c240b35f0ef37ad11d47678db3  gaeaW.exe
39ce6fb5f305c52353cec1282f57bb61b07236525ab404e267bff1b96aa0548c  gaeaW-desktop.exe
```

## 关键变更

### 变更

- **成本库（costdb）全量优化**：修复 3 个并发安全 Bug（`Save()` 写锁、`SetData()` 无锁、CSV 导入竞态），新增 5 个 O(1) 哈希索引（`itemIndex`/`laborIndex`/`materialIndex`/`machineIndex`/`regionIndex`），所有 `find*`/`Delete*`/`Update*` 从 O(n) 线性扫描降为 O(1) 查找，`Estimate`/`RegionFactor`/`RegionCompare` 同步优化。10 个 `Delete*`/`Update*` 改用 swap-with-last 模式。`Load`/`loadSeed`/`SetData` 自动重建索引。64 个单元测试全部 PASS（`internal/costdb/`）
- **Provider HTTP 重试逻辑统一**：新增 `StreamHTTPClient` 类型（`internal/provider/stream_client.go`），封装 POST JSON body + 按 RetryPolicy 重试 + 返回 `*http.Response` 的通用逻辑。三个 provider（Anthropic/OpenAI/XAI）的 `sendWithRetry` 从手写 retry 循环（50-85 行）统一为调用 `sc.Do()` 的薄包装（10-20 行），移除各自独立的 `httpStatusError` / `isRetryableStatus` / `isTransientErr` 等辅助函数。新增 8 个 `stream_client_test.go` 单元测试覆盖 retry、auth、rate-limit、ctx cancel、Retry-After 等场景（`internal/provider/`）
- **废弃代码清理**：删除 `config.go` 中 Codegraph/LSP 已注释的废弃字段（4 行）及 `Default()` 中同类残留（1 行）（`internal/config/config.go`）
- **前端 store 测试强化**：导出 `ControllerState` / `applyEvent` / `flushPendingUser`，`store.test.ts` 重写为直接测试核心状态转换逻辑（10 个测试），`stats.test.ts` 保持 27 个测试覆盖（`desktop/frontend/src/lib/`）

### 杂项

- **xai 注释英文化**：`xai.go` / `auth.go` / `token.go` 共 26 处中文注释翻译为英文

## 测试

- Go 后端: 全部 PASS
- 前端: 37/37 PASS（vitest）
