# Changelog

## V10.0.0 — 2026-06-25

DeepSeek-Reasonix V1.12 逐行对比吸收，三轮提交。

### Added
- **Schema 预归一化缓存**: `Registry.Add()` 时一次性 canonicalize，`Schemas()` 复用缓存，每轮省去重复 JSON 规范化
- **KeepPolicy 系统**: `KeepErrors`（保留 error:/blocked: 结果）、`KeepUserMarked`（保留 [[keep]] 标记消息），含 keepToolCallGroup 完整性保证
- **SuspendPrefix/ResumePrefix**: MCP server 会话级禁用，防止后台握手重添加
- **Grace Round**: maxSteps 耗尽后模型有一轮免工具总结机会
- **AuthError +KeySource/+HasKey**: 改善 401 报错可操作性

### Changed
- **SanitizeToolPairing Fast Path**: 健康历史（无 tool_calls/无孤儿 tool）零分配直通
- **401/403 智能重试**: 已验证 key 的 transient 401 额外重试 2 次
- **summarize select-on-ctx**: 防止流挂起导致 goroutine 泄露
- **forget Archive**: 移入 `.archive/` 目录而非真删，可恢复
- **chatFunction omitempty**: 减少请求体空字段序列化
- **planCompaction else 分支**: 无窗口时消息计数回退
- **prune.go KeepErrors 保护**: 跳过受保护错误消息

### Fixed
- 无

### Performance
- Schema 预缓存：每轮 ~10-50 工具省去重复 `CanonicalizeSchema` 调用
- Fast Path：短对话的 `SanitizeToolPairing` 零分配
- UPX 压缩：15.4 MB → 4.6 MB（30%）

---

## V9.3.0 — 2026-06-25

### Fixed
- 滚动锁定：流式输出期间 100ms 节流，降低粘底阈值 80→40px，rAF 二次检查
- 模型下拉：下拉方向 bottom-full→top-full
- JumpBar 跳转：virtualizer.scrollToIndex() 替换失效的 querySelector 方案

---

## V8.23.0 — 2026-06-23

### Added
- agentMode 三模式切换（explore/develop/orchestrate）
- YOLO 独立开关

### Changed
- 回退 V9.1/V9.2 破坏性变更
- 保留 agentMode 模式统一

---

## V8.22.1 — 2026-06-22

### Fixed
- 测试套件崩溃修复
- nil panic 防护
- 429 重试补全
- isServerError 补全

---

## V8.22.0 — 2026-06

### Changed
- L1 Token 优化：技能描述 + 子代理工具描述 + 记忆文件精简

---

## V8.21.0 — 2026-06

### Changed
- 设计系统落地 + UI 全面优化

---

## V8.20.0 — 2026-06-21

### Added
- Phase 1 Reasonix 动画体系
- Phase 2 Kun 设计系统
- 组件增强

---

## V8.18.0 — 2026-06

### Added
- TCCA 四层架构落地
