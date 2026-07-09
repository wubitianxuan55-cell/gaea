package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"gaeaW/internal/tool"
)

func init() { tool.RegisterBuiltin(contamCheck{}) }

type contamCheck struct{}

func (contamCheck) Name() string { return "contam_check" }

func (contamCheck) Description() string {
	return "土壤污染风险筛查计算器：输入检测数据和用地类型，对照 GB 36600-2018/GB 15618-2018 标准，返回超标判定、超标倍数和风险等级。"
}

func (contamCheck) Schema() json.RawMessage {
	return json.RawMessage(`{
"type":"object",
"properties":{
  "land_use":{"type":"string","description":"用地类型：一类用地（居住/学校等敏感用地）、二类用地（工业/商业）、农用地"},
  "ph":{"type":"number","description":"土壤pH值（仅农用地判定需要）"},
  "samples":{"type":"array","items":{"type":"object","properties":{"pollutant":{"type":"string","description":"污染物名称，如砷、镉、铅、汞、镍、铜"},"measured_value":{"type":"number","description":"实测浓度(mg/kg)"}},"required":["pollutant","measured_value"]},"description":"污染物检测数据列表"}
},
"required":["land_use","samples"]
}`)
}

func (contamCheck) ReadOnly() bool { return true }

func (contamCheck) CompactDescription() string { return "土壤污染风险筛查" }
func (contamCheck) CompactSchema() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{"land_use":{"type":"string"},"ph":{"type":"number"},"samples":{"type":"array"}},"required":["land_use","samples"]}`)
}

// 建设用地 GB 36600-2018 表1 筛选值和管控值
type constLimit struct {
	ScrI, CtrlI, ScrII, CtrlII float64 // 一类/二类用地的筛选值/管控值
}

var constructionLimitsGB = map[string]constLimit{
	"砷":       {20, 120, 60, 140},
	"镉":       {20, 47, 65, 172},
	"六价铬":    {3.0, 30, 5.0, 78},
	"铜":       {2000, 8000, 18000, 36000},
	"铅":       {400, 800, 800, 2500},
	"汞":       {8, 33, 38, 82},
	"镍":       {150, 600, 900, 2000},
	"四氯化碳":   {0.9, 5, 2.8, 36},
	"氯仿":     {0.3, 2, 0.9, 10},
}

// 农用地 GB 15618-2018 表1 按pH分级的筛选值
type agriPHLimit struct {
	PHLe65, PH5_65, PH6_75, PHGt75 float64
}

var agriLimitsGB = map[string]agriPHLimit{
	"镉": {0.3, 0.4, 0.6, 0.8},
	"汞": {1.3, 1.8, 2.4, 3.4},
	"砷": {40, 40, 30, 25},
	"铅": {70, 90, 120, 170},
	"铬": {150, 150, 200, 250},
	"铜": {50, 50, 100, 100},
	"镍": {60, 70, 100, 190},
	"锌": {200, 200, 250, 300},
}

type sampleInput struct {
	Pollutant     string  `json:"pollutant"`
	MeasuredValue float64 `json:"measured_value"`
}

type contamInput struct {
	LandUse string        `json:"land_use"`
	PH      *float64      `json:"ph,omitempty"`
	Samples []sampleInput `json:"samples"`
}

type contamResult struct {
	Name        string  `json:"name"`
	Measured    float64 `json:"measured"`
	Screening   float64 `json:"screening"`
	Control     float64 `json:"control,omitempty"`
	ExceedType  string  `json:"exceed_type"` // none / screening / control
	ExceedRatio float64 `json:"exceed_ratio"`
	RiskLevel   string  `json:"risk_level"` // 低 / 中 / 高
}

func (contamCheck) Execute(ctx context.Context, args json.RawMessage) (string, error) {
	var p contamInput
	if err := json.Unmarshal(args, &p); err != nil {
		return "", fmt.Errorf("参数无效: %w", err)
	}
	p.LandUse = strings.TrimSpace(p.LandUse)
	if p.LandUse == "" {
		return "", fmt.Errorf("land_use 不能为空")
	}
	if len(p.Samples) == 0 {
		return "", fmt.Errorf("samples 不能为空")
	}
	for _, s := range p.Samples {
		if s.Pollutant == "" {
			return "", fmt.Errorf("污染物名称不能为空")
		}
		if s.MeasuredValue < 0 {
			return "", fmt.Errorf("实测值不能为负")
		}
	}

	isAgri := strings.Contains(p.LandUse, "农")
	isClassI := strings.Contains(p.LandUse, "一类") || strings.Contains(p.LandUse, "敏感")

	var results []contamResult

	for _, s := range p.Samples {
		res := contamResult{
			Name:     s.Pollutant,
			Measured: s.MeasuredValue,
		}

		if isAgri {
			limit, ok := agriLimitsGB[s.Pollutant]
			if !ok {
				return "", fmt.Errorf("污染物「%s」不在 GB 15618-2018 农用地标准列表内", s.Pollutant)
			}
			screening := getAgriScreeningGB(limit, p.PH)
			res.Screening = screening
			if s.MeasuredValue > screening {
				res.ExceedType = "screening"
				res.ExceedRatio = roundTo2(s.MeasuredValue/screening)
				res.RiskLevel = "中"
			} else {
				res.ExceedType = "none"
				res.RiskLevel = "低"
			}
		} else {
			limit, ok := constructionLimitsGB[s.Pollutant]
			if !ok {
				return "", fmt.Errorf("污染物「%s」不在 GB 36600-2018 标准列表内", s.Pollutant)
			}
			if isClassI {
				res.Screening = limit.ScrI
				res.Control = limit.CtrlI
			} else {
				res.Screening = limit.ScrII
				res.Control = limit.CtrlII
			}
			if s.MeasuredValue > res.Control {
				res.ExceedType = "control"
				res.ExceedRatio = roundTo2(s.MeasuredValue / res.Control)
				res.RiskLevel = "高"
			} else if s.MeasuredValue > res.Screening {
				res.ExceedType = "screening"
				res.ExceedRatio = roundTo2(s.MeasuredValue / res.Screening)
				res.RiskLevel = "中"
			} else {
				res.ExceedType = "none"
				res.RiskLevel = "低"
			}
		}
		results = append(results, res)
	}

	// 输出 Markdown
	var b strings.Builder
	landLabel := p.LandUse
	if isAgri {
		landLabel = "农用地"
	} else if isClassI {
		landLabel = "一类用地（敏感）"
	} else {
		landLabel = "二类用地（工业/商业）"
	}
	fmt.Fprintf(&b, "## 土壤污染风险筛查报告\n\n")
	fmt.Fprintf(&b, "**评价标准**：")
	if isAgri {
		fmt.Fprintf(&b, "GB 15618-2018 农用地土壤污染风险筛选值")
	} else {
		fmt.Fprintf(&b, "GB 36600-2018 建设用地土壤污染风险筛选值和管控值")
	}
	fmt.Fprintf(&b, "\n**用地类型**：%s\n\n", landLabel)

	fmt.Fprintf(&b, "| 污染物 | 实测值(mg/kg) | 筛选值 | 管控值 | 超标倍数 | 判定 | 风险等级 |\n")
	fmt.Fprintf(&b, "|--------|---------------|--------|--------|----------|------|----------|\n")
	for _, r := range results {
		ctrlStr := "-"
		if r.Control > 0 {
			ctrlStr = fmt.Sprintf("%.4f", r.Control)
		}
		ratioStr := "-"
		if r.ExceedRatio > 0 {
			ratioStr = fmt.Sprintf("%.2f", r.ExceedRatio)
		}
		judge := "达标"
		if r.ExceedType == "screening" {
			judge = "超过筛选值"
		} else if r.ExceedType == "control" {
			judge = "超过管控值"
		}
		fmt.Fprintf(&b, "| %s | %.4f | %.4f | %s | %s | %s | %s |\n",
			r.Name, r.Measured, r.Screening, ctrlStr, ratioStr, judge, r.RiskLevel)
	}

	return tool.WrapText(b.String()), nil
}

func getAgriScreeningGB(limit agriPHLimit, ph *float64) float64 {
	if ph == nil {
		return limit.PHGt75
	}
	v := *ph
	switch {
	case v <= 5.5:
		return limit.PHLe65
	case v <= 6.5:
		return limit.PH5_65
	case v <= 7.5:
		return limit.PH6_75
	default:
		return limit.PHGt75
	}
}

func roundTo2(v float64) float64 {
	return math.Round(v*100) / 100
}
