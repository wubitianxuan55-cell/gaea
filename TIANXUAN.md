# gaeaW — 工程办公助理

gaeaW（盖亚）是基于 tianxuan（天璇）AI 编程助手改造的工程办公助理，专注于文档处理、工程计算、规范查询、图表生成和项目管理。

## 版本

v0.0.1 — 初始发布

## 核心能力

| 能力 | 说明 |
|------|------|
| **文档处理** | 读取/生成 Word、Excel、CSV、PDF、Markdown 格式的工程文档 |
| **工程计算** | 数学表达式求值、单位转换、统计分析 |
| **规范查询** | 工程材料属性查询（21种材料）、规范审查 |
| **图表生成** | Mermaid 甘特图、统计图表 |
| **项目管理** | 任务跟踪、项目目录初始化 |

## 内置工具

| 工具 | 描述 |
|------|------|
| `csv_parse` | CSV 数据解析与统计 |
| `calc_math` | 数学表达式计算（20+函数） |
| `calc_stats` | 基础统计分析 |
| `calc_unit` | 单位转换（长度/重量/温度/压力） |
| `material_query` | 21种工程材料属性查询 |
| `gantt_gen` | Mermaid 甘特图生成 |
| `project_init` | 4种工程模板目录初始化 |

## 内置技能

- `doc-writer` — 工程文档写作
- `data-analyst` — 数据分析
- `spec-checker` — 规范审查
- `report-builder` — 报告生成

## 架构

gaeaW 采用与 tianxuan 相同的分层架构：agent（执行引擎）、provider（模型适配）、tool（工具注册）、skill（技能系统）、event（事件流）。删除的编程模块包括 LSP、CodeGraph、diff、learning、checkpoint。

## 构建

```bash
# CLI
cd D:\AI\gaeaW && go build -o gaeaW.exe ./cmd/gaeaW/

# 桌面端
cd D:\AI\gaeaW\desktop && wails build
```

## 配置

参见 `gaeaW.example.toml`。新增 [office] 配置段：

```toml
[office]
default_template_dir = "~/.gaeaW/templates"
spec_library_dir = "~/.gaeaW/specs"
unit_system = "SI"
calc_precision = 3
```
