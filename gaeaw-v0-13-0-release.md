# gaeaW v0.13.0 release

- **版本**: v0.13.0
- **发布日期**: 2026-07-18
- **Git 提交**: `7a3b42c` — release: v0.13.0 — 工程办公助手三阶段优化
- **Git tag**: `v0.13.0`

## 产物路径

- CLI: `release/v0.13.0/gaeaW.exe` (19MB)
- 桌面端: `release/v0.13.0/gaeaW-desktop.exe` (17MB)
- SHA256: `release/v0.13.0/SHA256SUMS`

```
936376e27a7ce7e50a7ad6fded9fb089c337c7c0131aa3448b9076169a48f54e  gaeaW.exe
3fb6f14eb3f909718d6d1ef924c6283d07ff7c406262a8c05018474447f4e42c  gaeaW-desktop.exe
```

## 关键变更

### 第一阶段：补基础
- 前端 ESLint + Prettier 接入
- 4 个工程工具核心测试（16 用例）
- [office] 死配置修复：OfficeConfig + template_engine 配置注入
- docx_write 工具测试覆盖
- ReportPreviewPanel 组件测试

### 第二阶段：产品化工程工作台
- 规范数据外部化：specIndex 迁移到 JSON 文件，go:embed 嵌入，loadSpecs()
- 报告生成打通文件输出：survey_report/cost_estimate/bid_proposal 新增 output_path
- 规范浏览器 SpecPanel：后端 SearchSpecs + 前端搜索组件
- 报告面板升级：内联预览 + 快捷生成按钮

### 第三阶段：深化垂直能力
- 风险筛查计算器 `contam_check` — GB 36600/GB 15618 超标判定
- 健康风险评估计算器 `risk_calc` — HJ 25.3 暴露公式的 CR/HQ 计算
- 采样方案生成器 `sampling_plan` — HJ 25.1 布点方案生成

## 测试

- Go 后端: 全部 PASS（含 internal/agent ~135s、internal/boot ~13s）
- 前端: 39/39 PASS（含 ReportPreviewPanel 5 + SpecPanel 2）
