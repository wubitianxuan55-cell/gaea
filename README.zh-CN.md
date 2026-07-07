<p align="center">
  <img src="docs/logo.svg" alt="gaeaW" width="200"/>
</p>

<h3 align="center">gaeaW — 土壤修复工程办公AI助手</h3>
<p align="center">
  一个面向土壤修复与岩土工程领域的智能办公助理。<br/>
  文档处理 · 工程计算 · 规范查询 · 报告生成 · 项目管理
</p>

<br/>

## 概述

gaeaW（盖亚）是一个专为土壤修复与岩土工程领域设计的AI办公助理，提供从场地调查、风险评估、修复方案设计到施工管理、验收监测的全流程智能支持。基于 Go 语言构建的高性能 AI agent 内核，支持 CLI 与桌面 GUI 双模式。

## 核心能力

| 能力 | 说明 |
|------|------|
| **场地环境调查** | 初调/详调报告框架，场地基本信息梳理，敏感目标识别 |
| **污染风险评估** | 对标 GB 36600/GB 15618，超标判定与风险计算 |
| **修复技术方案** | 技术比选、工艺设计、施工部署方案撰写 |
| **成本测算** | 七项汇总成本测算表，涵盖调查/修复全流程 |
| **检测数据分析** | CSV 导入、统计分析、超标识别、空间分布 |
| **投标文件编制** | 技术标投标方案，施工组织设计，质量保证措施 |

## 安装

```bash
# CLI 构建
cd D:\AI\gaeaW && go build -o gaeaW.exe ./cmd/gaeaW/

# 桌面端构建（需要 Wails）
cd D:\AI\gaeaW\desktop && wails build
```

## 快速开始

```bash
# 启动 CLI
gaeaW.exe

# 启动桌面端
cd desktop && wails dev
```

## 配置

参见 `gaeaW.example.toml`。配置文件位于项目根目录，支持自定义模型、工具、权限等设置。

## 桌面端

gaeaW 提供一个基于 Wails + React + Tailwind CSS 构建的桌面客户端，支持：
- 多标签右侧面板（文件/工具/技能/统计/消息/报告）
- 国际化（简体中文/繁体中文/英文）
- 多主题（暗色/浅色/warm/ice/forest/earth）
- 报告文件预览与管理

## 技术栈

- **后端**：Go（单二进制，`CGO_ENABLED=0` 交叉编译）
- **内核**：Agent 引擎、Provider 适配、Tool 注册、Skill 系统
- **桌面端**：Wails v2 + React + TypeScript + Vite + Tailwind CSS v4
- **工具**：MCP 兼容插件系统、自定义斜杠命令

## 许可

MIT —— 见 [LICENSE](./LICENSE)
