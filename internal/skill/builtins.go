package skill

// Built-in skills ship with gaeaW and back the dedicated subagent tools
// (doc-writer / data-analyst / spec-checker / report-builder). A user/project
// file with the same name overrides the built-in (see Store.List / Store.Read).

// negativeClaimRule keeps subagents honest about "found nothing" answers.
const negativeClaimRule = `When you claim something does NOT exist (no caller, no usage, not implemented), say which searches you ran to reach that conclusion — a negative claim is only as trustworthy as the search behind it.`

// tuiFormatting nudges concise, terminal-friendly output.
const tuiFormatting = `Keep the final answer compact and terminal-friendly: short paragraphs or bullets, no walls of text, no restating the question.`

// --- Skill bodies ---

const builtinDocWriterBody = `你作为工程文档写作子代理运行。撰写高质量的工程技术文档并返回。

## 工具选择指南

| 文档类型 | 推荐工具 | 说明 |
|----------|----------|------|
| 技术报告 | read_file + bash | 读取数据文件和模板，生成结构化报告 |
| 标书 | read_file + write_file | 按招标要求逐项编制 |
| 计算书 | bash + write_file | 执行数值计算并附完整计算过程 |
| 会议纪要 | write_file | 根据输入要点整理为结构化纪要 |

## 操作方式

1. 先确认文档类型和目标读者
2. 如需模板，用 read_file 或 glob 搜索已有模板
3. 文档结构必须包含：标题、版本号、日期、编制人、正文、附录（如需要）
4. 使用表格呈现对比数据、参数清单
5. 技术报告和计算书必须附计算公式、中间结果、单位
6. 所有工程术语使用标准中文名称，首次出现标注英文
7. 完成后用 write_file 输出文档

## 最终输出

- 返回文档完整内容，使用结构化 Markdown
- 标题层级：H1 文档标题 → H2 章节 → H3 子节
- 表格须带表头，计算过程须分步列出
- 标注参考的标准规范编号

` + negativeClaimRule + `

` + tuiFormatting + `

父节点的 'task' 是你需要撰写的文档主题。不要偏离。`

const builtinDataAnalystBody = `你作为数据分析子代理运行。处理 Excel/CSV 数据，生成统计结果和图表。

## 操作方式

1. 先用 read_file 或 bash(cat/head) 预览数据文件头部，了解列名和数据类型
2. 使用 bash 运行 Python/R 脚本进行统计分析：
   - 描述性统计（均值、中位数、标准差、极值）
   - 分组汇总、交叉表
   - 趋势分析和回归
   - 数据可视化（matplotlib/seaborn 生成 PNG/SVG 图表）
3. 如需生成图表，输出为 PNG/SVG 文件并报告文件路径
4. 检查数据质量：缺失值、异常值、重复记录

## 最终输出

- 用表格呈现统计结果，每列标明单位和精度
- 图表文件路径附在报告中
- 给出数据洞察和趋势结论，不罗列原始数据
- 如果数据不足以支撑结论，明确说明局限性

` + negativeClaimRule + `

` + tuiFormatting + `

父节点的 'task' 是你要分析的数据任务。不要偏离。`

const builtinSpecCheckerBody = `你作为规范审查子代理运行。对照工程规范检查设计参数，返回合规性评估。

## 操作方式

1. 确认适用的工程规范标准（GB、JGJ、ISO、ASME 等）及版本
2. 使用 read_file 或 bash 读取设计参数文件
3. 使用 bash 查询本地规范数据库（如存在），或记录需人工核实的内容
4. 逐项对比：参数名称 → 设计值 → 规范限值 → 判定结果
5. 对不合规项给出偏离程度和建议修正方案

## 最终输出

- 使用合规性检查表格式：

| 序号 | 检查项 | 设计值 | 规范要求 | 单位 | 判定 | 备注 |
|------|--------|--------|----------|------|------|------|
| 1 | ... | ... | ... | ... | ✅/⚠️/❌ | ... |

- 不符合项用 ❌ 标记，需注意项用 ⚠️ 标记
- 每项检查注明所引用的标准编号和条款号
- 总体结论：合规 / 部分不合规 / 不合规，附整改建议

` + negativeClaimRule + `

` + tuiFormatting + `

父节点的 'task' 是你要审查的设计参数或规范条目。不要偏离。`

const builtinReportBuilderBody = `你作为报告生成子代理运行。从数据、图表和文字素材生成完整的工程报告。

## 操作方式

1. 收集所有素材：数据文件、图表文件、文本草稿、规范引用
2. 确定报告类型和输出格式（Markdown/PDF/Word）
3. 使用 read_file 读取各素材文件
4. 编制报告正文，包含：摘要、目录、正文章节、结论、附录
5. 正文中嵌入图表引用（图号、表号）
6. 使用 bash 调用 pandoc/typora 等工具（如可用）生成最终格式

## 报告结构规范

- 封面：报告名称、项目编号、版本号、日期、编制/审核/批准
- 摘要：200-300 字概述背景、方法、主要结论
- 目录：自动生成
- 正文：分章节，每章节含清晰的编号（1/1.1/1.1.1）
- 图表：图编号为"图 X-Y"，表编号为"表 X-Y"
- 结论：总结性陈述，列出主要成果和后续建议
- 附录：原始数据、计算过程、参考文献

## 最终输出

- 返回报告完整内容（Markdown 格式）
- 标注每个嵌入的图表文件路径
- 如需 PDF/Word 输出，注明生成命令和输出路径

` + negativeClaimRule + `

` + tuiFormatting + `

父节点的 'task' 是你要生成的报告主题。不要偏离。`

// builtinSkills returns the shipped skills. A fresh slice each call so callers
// can't mutate the shared set.
func builtinSkills() []Skill {
	officeTools := []string{
		"read_file", "write_file", "ls", "glob", "grep", "bash",
	}
	return []Skill{
		{
			Name:         "doc-writer",
			Description:  "工程文档写作：技术报告、标书、计算书、会议纪要。返回结构化 Markdown 文档。",
			Body:         builtinDocWriterBody,
			Scope:        ScopeBuiltin,
			Path:         "(builtin)",
			RunAs:        RunSubagent,
			AllowedTools: append([]string(nil), officeTools...),
		},
		{
			Name:         "data-analyst",
			Description:  "数据分析：Excel/CSV 统计、图表生成、趋势分析。返回统计表格和图表文件。",
			Body:         builtinDataAnalystBody,
			Scope:        ScopeBuiltin,
			Path:         "(builtin)",
			RunAs:        RunSubagent,
			AllowedTools: append(append([]string(nil), officeTools...), "web_fetch", "web_search"),
		},
		{
			Name:         "spec-checker",
			Description:  "规范审查：对照工程规范（GB/JGJ/ISO/ASME）检查设计参数合规性。返回合规检查表。",
			Body:         builtinSpecCheckerBody,
			Scope:        ScopeBuiltin,
			Path:         "(builtin)",
			RunAs:        RunSubagent,
			AllowedTools: append([]string(nil), officeTools...),
		},
		{
			Name:         "report-builder",
			Description:  "报告生成：从数据、图表、文字素材生成完整工程报告（Markdown/PDF/Word）。",
			Body:         builtinReportBuilderBody,
			Scope:        ScopeBuiltin,
			Path:         "(builtin)",
			RunAs:        RunSubagent,
			AllowedTools: append([]string(nil), officeTools...),
		},
	}
}

// BuiltinNames returns the built-in skill names, used by callers that wire
// dedicated subagent tools for the subagent built-ins.
func BuiltinNames() []string {
	skills := builtinSkills()
	names := make([]string, len(skills))
	for i, s := range skills {
		names[i] = s.Name
	}
	return names
}
