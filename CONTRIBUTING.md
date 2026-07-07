# Contributing to gaeaW

感谢你对 gaeaW 的关注！本文档说明如何参与项目开发。

## 前置要求

- **Go 1.25+** — 项目追踪最新的稳定 Go 版本
- **Git** — 版本控制
- **Node.js**（可选）— 仅当修改桌面端时需

## 快速开始

```bash
go build ./cmd/gaeaW/    # 构建 CLI 二进制
go test ./...            # 运行全部测试
```

## 项目结构

| 目录 | 说明 |
|------|------|
| `cmd/gaeaW` | CLI 入口 |
| `cmd/gaeaW-plugin-example` | MCP 插件参考实现 |
| `internal/agent` | Agent 主循环、会话、协调器 |
| `internal/config` | TOML 配置加载 |
| `internal/tool/builtin` | 内置工具（bash, read_file 等） |
| `internal/provider` | 模型后端抽象 |
| `internal/provider/openai` | OpenAI 兼容 provider |
| `internal/plugin` | MCP 客户端（stdio + HTTP） |
| `internal/event` | 类型化事件流 |
| `internal/memory` | 记忆系统（AGENTS.md） |
| `internal/skill` | 技能发现（Markdown） |
| `internal/sandbox` | OS 级沙箱 |
| `internal/serve` | HTTP/SSE 服务器前端 |
| `desktop/` | Wails 桌面端（独立 Go module） |

## 开发工作流

### 构建

```bash
make build          # go build ./cmd/gaeaW/
make test           # go test ./...
make vet            # go vet ./...
make fmt            # gofmt -w .
make cross          # 交叉编译 6 个目标
```

### 运行测试

```bash
go test ./...                           # 全部测试
go test ./internal/agent/ -v            # 详细输出
go test ./internal/tool/builtin/ -run TestGrep
```

### 编码规范

- `gofmt` 由 CI 强制要求
- 使用 `fmt.Errorf("...: %w", err)` 包装错误
- 库代码不调用 `os.Exit` 或打印到 stdout/stderr
- 导出的标识符必须有文档注释

### 提交信息

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat(tool): add new built-in tool
fix: replace silent error discards with structured logging
docs: add CONTRIBUTING.md
```

## 许可

提交代码即表示你同意你的贡献遵循项目的 MIT 许可。
