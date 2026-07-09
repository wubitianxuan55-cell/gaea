package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"gaeaW/internal/tool"
)

func init() { tool.RegisterBuiltin(samplingPlan{}) }

type samplingPlan struct{}

func (samplingPlan) Name() string { return "sampling_plan" }

func (samplingPlan) Description() string {
	return "土壤污染采样布点方案生成器：基于HJ 25.1-2019布点规则，输入场地参数，生成初步/详细调查的采样布点方案，含网格坐标、检测指标和深度建议。"
}

func (samplingPlan) Schema() json.RawMessage {
	return json.RawMessage(`{
"type":"object",
"properties":{
  "phase":{"type":"string","description":"调查阶段：phase1（初步调查）、phase2（详细调查）"},
  "site_area":{"type":"number","description":"场地面积(m²)"},
  "site_shape":{"type":"string","description":"场地形状：rectangular（矩形，默认）、irregular（不规则）"},
  "pollutants_suspected":{"type":"array","items":{"type":"string"},"description":"疑似污染物列表（可选）"},
  "groundwater_depth":{"type":"number","description":"地下水位深度(m)（可选）"}
},
"required":["phase","site_area"]
}`)
}

func (samplingPlan) ReadOnly() bool { return true }
func (samplingPlan) CompactDescription() string { return "采样布点方案" }
func (samplingPlan) CompactSchema() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{"phase":{"type":"string"},"site_area":{"type":"number"}},"required":["phase","site_area"]}`)
}

type planInput struct {
	Phase              string   `json:"phase"`
	SiteArea           float64  `json:"site_area"`
	SiteShape          string   `json:"site_shape,omitempty"`
	PollutantsSuspected []string `json:"pollutants_suspected,omitempty"`
	GroundwaterDepth   *float64 `json:"groundwater_depth,omitempty"`
}

func (samplingPlan) Execute(ctx context.Context, args json.RawMessage) (string, error) {
	var p planInput
	if err := json.Unmarshal(args, &p); err != nil {
		return "", fmt.Errorf("参数无效: %w", err)
	}
	p.Phase = strings.TrimSpace(strings.ToLower(p.Phase))
	if p.Phase != "phase1" && p.Phase != "phase2" {
		return "", fmt.Errorf("phase 必须为 phase1 或 phase2")
	}
	if p.SiteArea <= 0 {
		return "", fmt.Errorf("site_area 必须大于 0")
	}
	isPhase2 := p.Phase == "phase2"

	// 布点参数
	gridSize := 40.0
	gridArea := 1600.0
	minPoints := 3
	phaseLabel := "初步调查"
	if isPhase2 {
		gridSize = 20.0
		gridArea = 400.0
		minPoints = 6
		phaseLabel = "详细调查"
	}

	// 计算最少点数
	calcPoints := int(math.Ceil(p.SiteArea / gridArea))
	if calcPoints < minPoints {
		calcPoints = minPoints
	}

	isSmall := p.SiteArea < gridArea
	shape := strings.ToLower(p.SiteShape)
	isRect := shape == "" || shape == "rectangular"

	var b strings.Builder
	fmt.Fprintf(&b, "# 土壤污染%s 采样布点方案\n\n", phaseLabel)
	fmt.Fprintf(&b, "**依据标准**：HJ 25.1-2019《建设用地土壤污染状况调查技术导则》\n\n")

	fmt.Fprintf(&b, "## 一、布点方案总览\n\n")
	fmt.Fprintf(&b, "| 项目 | 参数 |\n|------|------|\n")
	fmt.Fprintf(&b, "| 调查阶段 | %s |\n", phaseLabel)
	fmt.Fprintf(&b, "| 场地面积 | %.2f m² |\n", p.SiteArea)
	fmt.Fprintf(&b, "| 布点方法 | 系统布点法 |\n")
	fmt.Fprintf(&b, "| 网格密度 | %.0fm × %.0fm |\n", gridSize, gridSize)
	fmt.Fprintf(&b, "| 最少采样点数 | **%d** 个 |\n", calcPoints)
	if isSmall {
		fmt.Fprintf(&b, "| 说明 | ⚠ 面积小于单个网格，建议全覆盖采样 |\n")
	}

	fmt.Fprintf(&b, "\n## 二、布点网格\n\n")
	if isRect {
		// 矩形地块：按行列编号
		cols := int(math.Ceil(math.Sqrt(float64(calcPoints) * p.SiteArea / gridArea / gridSize)))
		if cols < 1 {
			cols = 1
		}
		rows := (calcPoints + cols - 1) / cols
		if rows < 1 {
			rows = 1
		}
		fmt.Fprintf(&b, "建议按 %d 行 × %d 列网格布设，网格间距 %.0fm。\n\n", rows, cols, gridSize)
		fmt.Fprintf(&b, "| 点号 | 行号 | 列号 | 说明 |\n|------|------|------|------|\n")
		pointID := 1
		for r := 1; r <= rows; r++ {
			for c := 1; c <= cols; c++ {
				if pointID > calcPoints {
					break
				}
				note := ""
				if r == 1 || r == rows || c == 1 || c == cols {
					note = "边界"
				}
				fmt.Fprintf(&b, "| S%03d | %d | %d | %s |\n", pointID, r, c, note)
				pointID++
			}
			if pointID > calcPoints {
				break
			}
		}
	} else {
		fmt.Fprintf(&b, "不规则场地建议按面积比例布点，重点区域（疑似污染区）加密。\n")
		fmt.Fprintf(&b, "共布设 %d 个采样点，均匀覆盖场地范围。\n", calcPoints)
		fmt.Fprintf(&b, "建议在以下区域重点布点：\n")
		fmt.Fprintf(&b, "- 疑似污染区域（生产车间、储罐区等）\n")
		fmt.Fprintf(&b, "- 边界区域（确定污染范围）\n")
		fmt.Fprintf(&b, "- 地下水上游/下游方向\n")
	}

	fmt.Fprintf(&b, "\n## 三、采样深度建议\n\n")
	fmt.Fprintf(&b, "| 层位 | 深度范围 | 说明 |\n|------|----------|------|\n")
	fmt.Fprintf(&b, "| 表层 | 0~0.5m | 地表污染判断 |\n")
	gwNote := "穿透污染层或不浅于3m"
	if p.GroundwaterDepth != nil && *p.GroundwaterDepth > 0 {
		gwNote = fmt.Sprintf("穿透污染层或到达地下水位(%.1fm)", *p.GroundwaterDepth)
	}
	fmt.Fprintf(&b, "| 中层 | 0.5m~地下水位 | %s |\n", gwNote)
	fmt.Fprintf(&b, "| 深层 | 地下水位以下 | 确认底部污染边界 |\n")

	fmt.Fprintf(&b, "\n## 四、检测指标建议\n\n")
	if len(p.PollutantsSuspected) > 0 {
		fmt.Fprintf(&b, "疑似污染物：%s\n\n", strings.Join(p.PollutantsSuspected, "、"))
		fmt.Fprintf(&b, "建议检测项目：\n")
		fmt.Fprintf(&b, "- GB 36600-2018 表1 基本项目45项\n")
		fmt.Fprintf(&b, "- 特征污染物：%s\n", strings.Join(p.PollutantsSuspected, "、"))
	} else {
		fmt.Fprintf(&b, "建议检测项目包括：\n")
		fmt.Fprintf(&b, "- GB 36600-2018 表1 基本项目45项（重金属、VOCs、SVOCs）\n")
		if isPhase2 {
			fmt.Fprintf(&b, "- 根据初调结果增加特征污染物检测\n")
		}
	}

	fmt.Fprintf(&b, "\n## 五、采样记录表\n\n")
	fmt.Fprintf(&b, "| 点号 | 坐标X | 坐标Y | 采样深度 | 样品编号 | 检测项目 | 现场描述 |\n")
	fmt.Fprintf(&b, "|------|--------|--------|----------|----------|----------|----------|\n")
	for i := 1; i <= minPoints && i <= calcPoints; i++ {
		fmt.Fprintf(&b, "| S%03d | | | | | | |\n", i)
	}
	fmt.Fprintf(&b, "\n---\n*方案由 gaeaW sampling_plan 自动生成，需结合现场实际情况调整。*\n")

	return tool.WrapText(b.String()), nil
}
