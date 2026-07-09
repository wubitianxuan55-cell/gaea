package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"gaeaW/internal/tool"
)

func init() { tool.RegisterBuiltin(riskCalc{}) }

type riskCalc struct{}

func (riskCalc) Name() string { return "risk_calc" }

func (riskCalc) Description() string {
	return "健康风险评估计算器：基于HJ 25.3-2019暴露评估模型，输入污染物浓度，计算经口摄入/皮肤接触/呼吸吸入三种途径的致癌风险(CR)和危害指数(HQ)。"
}

func (riskCalc) Schema() json.RawMessage {
	return json.RawMessage(`{
"type":"object",
"properties":{
  "scenario":{"type":"string","description":"暴露场景：residential（住宅用地）、industrial（工业用地）"},
  "receptor":{"type":"string","description":"受体：adult（成人）、child（儿童）"},
  "contaminants":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"污染物名称"},"concentration":{"type":"number","description":"浓度(mg/kg)"}},"required":["name","concentration"]}},
  "body_weight":{"type":"number","description":"体重(kg，可选覆盖默认值)"},
  "exposure_years":{"type":"number","description":"暴露年限(年，可选覆盖默认值)"}
},
"required":["scenario","receptor","contaminants"]
}`)
}

func (riskCalc) ReadOnly() bool { return true }
func (riskCalc) CompactDescription() string { return "健康风险评估" }
func (riskCalc) CompactSchema() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{"scenario":{"type":"string"},"receptor":{"type":"string"},"contaminants":{"type":"array"}},"required":["scenario","receptor","contaminants"]}`)
}

// 暴露参数（来自 HJ 25.3-2019 表3）
type exposureParams struct {
	BW       float64 // 体重 kg
	IRoral   float64 // 土壤摄入量 mg/d
	IRinhale float64 // 呼吸量 m³/d
	SA       float64 // 皮肤表面积 m²
	ED       float64 // 暴露年限 year
	EF       float64 // 暴露频率 d/year
}

// 毒性参数（SF=致癌斜率因子, RfD=参考剂量）
type toxicityParams struct {
	SForal float64 // 经口致癌斜率因子 (mg/kg/d)⁻¹
	SFderm float64 // 皮肤接触致癌斜率因子
	RfDoral float64 // 经口参考剂量 mg/kg/d
}

// 8种常见污染物毒性参数（来自 HJ 25.3-2019 附录）
var toxicityDB = map[string]toxicityParams{
	"砷":       {SForal: 1.5, SFderm: 1.5, RfDoral: 0.0003},
	"镉":       {SForal: 6.1, SFderm: 6.1, RfDoral: 0.001},
	"六价铬":    {SForal: 0.5, SFderm: 0.5, RfDoral: 0.003},
	"铅":       {SForal: 0, SFderm: 0, RfDoral: 0.0035},
	"汞":       {SForal: 0, SFderm: 0, RfDoral: 0.0003},
	"镍":       {SForal: 0, SFderm: 0, RfDoral: 0.02},
	"苯":       {SForal: 0.055, SFderm: 0.055, RfDoral: 0.004},
	"苯并[a]芘": {SForal: 7.3, SFderm: 7.3, RfDoral: 0.0003},
}

type riskContaminant struct {
	Name         string  `json:"name"`
	Concentration float64 `json:"concentration"`
}

type riskInput struct {
	Scenario      string            `json:"scenario"`
	Receptor      string            `json:"receptor"`
	Contaminants  []riskContaminant `json:"contaminants"`
	BodyWeight    *float64          `json:"body_weight,omitempty"`
	ExposureYears *float64          `json:"exposure_years,omitempty"`
}

// 暴露途径结果
type pathwayResult struct {
	Pathway string  // oral / dermal / inhale
	ADD     float64 // 日均暴露量 mg/(kg·d)
	CR      float64 // 致癌风险
	HQ      float64 // 危害指数
}

func getExposureParams(scenario, receptor string, customBW, customED *float64) exposureParams {
	isChild := strings.Contains(receptor, "child") || strings.Contains(receptor, "儿童")
	isRes := strings.Contains(scenario, "res") || strings.Contains(scenario, "住宅")

	p := exposureParams{}
	if isChild {
		p.BW = 15
		p.IRoral = 200
		p.IRinhale = 7.5
		p.SA = 0.3
		p.ED = 6
	} else {
		p.BW = 70
		p.IRoral = 100
		p.IRinhale = 15
		p.SA = 1.8
		p.ED = 24
	}
	if isRes {
		p.EF = 350
	} else {
		p.EF = 250
	}
	if customBW != nil && *customBW > 0 {
		p.BW = *customBW
	}
	if customED != nil && *customED > 0 {
		p.ED = *customED
	}
	return p
}

func calcPathways(C, concUnit, SF, RfD float64, ep exposureParams, isCarc bool) []pathwayResult {
	Cmg := C * concUnit // convert to mg if needed; already mg/kg
	ATcarc := 70.0 * 365.0
	ATnon := ep.ED * 365.0

	var results []pathwayResult

	// 经口摄入
	addOral := Cmg * ep.IRoral * ep.EF * ep.ED / (ep.BW * ATcarc)
	crOral := addOral * SF
	hqOral := addOral / RfD
	results = append(results, pathwayResult{"经口摄入", addOral, crOral, hqOral})

	// 皮肤接触 (AF=0.2, ABS=0.1)
	af := 0.2
	abs := 0.1
	addDerm := Cmg * ep.SA * af * abs * ep.EF * ep.ED / (ep.BW * ATcarc)
	crDerm := addDerm * SF
	hqDerm := addDerm / RfD
	results = append(results, pathwayResult{"皮肤接触", addDerm, crDerm, hqDerm})

	// 吸入颗粒物 (PM10=0.15mg/m³)
	pm10 := 0.15
	addInh := Cmg * pm10 * ep.IRinhale * ep.EF * ep.ED / (ep.BW * ATcarc)
	crInh := addInh * SF
	hqInh := addInh / RfD
	results = append(results, pathwayResult{"吸入颗粒物", addInh, crInh, hqInh})

	// 非致癌用 ATnon 重新算 HQ（HQ 使用非致癌平均时间）
	for i := range results {
		if i == 0 { // oral
			results[i].HQ = (Cmg * ep.IRoral * ep.EF * ep.ED / (ep.BW * ATnon)) / RfD
		} else if i == 1 { // dermal
			results[i].HQ = (Cmg * ep.SA * af * abs * ep.EF * ep.ED / (ep.BW * ATnon)) / RfD
		} else { // inhale
			results[i].HQ = (Cmg * pm10 * ep.IRinhale * ep.EF * ep.ED / (ep.BW * ATnon)) / RfD
		}
	}

	return results
}

func (riskCalc) Execute(ctx context.Context, args json.RawMessage) (string, error) {
	var p riskInput
	if err := json.Unmarshal(args, &p); err != nil {
		return "", fmt.Errorf("参数无效: %w", err)
	}
	p.Scenario = strings.TrimSpace(strings.ToLower(p.Scenario))
	p.Receptor = strings.TrimSpace(strings.ToLower(p.Receptor))
	if p.Scenario == "" || p.Receptor == "" {
		return "", fmt.Errorf("scenario 和 receptor 不能为空")
	}
	if len(p.Contaminants) == 0 {
		return "", fmt.Errorf("contaminants 不能为空")
	}

	ep := getExposureParams(p.Scenario, p.Receptor, p.BodyWeight, p.ExposureYears)

	var b strings.Builder
	scenarioLabel := "住宅用地"
	if strings.Contains(p.Scenario, "ind") || strings.Contains(p.Scenario, "工业") {
		scenarioLabel = "工业用地"
	}
	receptorLabel := "成人"
	if strings.Contains(p.Receptor, "child") || strings.Contains(p.Receptor, "儿童") {
		receptorLabel = "儿童"
	}
	fmt.Fprintf(&b, "## 健康风险评估报告\n\n")
	fmt.Fprintf(&b, "**暴露场景**：%s　**受体**：%s\n\n", scenarioLabel, receptorLabel)
	fmt.Fprintf(&b, "**暴露参数**：体重 %.0fkg，土壤摄入 %.0fmg/d，呼吸量 %.1fm³/d，皮肤面积 %.1fm²，暴露年限 %.0f年，暴露频率 %.0fd/年\n\n",
		ep.BW, ep.IRoral, ep.IRinhale, ep.SA, ep.ED, ep.EF)

	for _, c := range p.Contaminants {
		tox, ok := toxicityDB[c.Name]
		if !ok {
			return "", fmt.Errorf("污染物「%s」无内置毒性参数", c.Name)
		}
		paths := calcPathways(c.Concentration, 1, tox.SForal, tox.RfDoral, ep, true)

		fmt.Fprintf(&b, "### %s（浓度：%.4f mg/kg）\n\n", c.Name, c.Concentration)
		fmt.Fprintf(&b, "| 暴露途径 | ADD(mg/kg·d) | SF/(RfD) | 致癌风险(CR) | 危害指数(HQ) |\n")
		fmt.Fprintf(&b, "|----------|-------------|----------|-------------|-------------|\n")

		totalCR := 0.0
		maxHQ := 0.0
		for _, pr := range paths {
			crStr := fmt.Sprintf("%.2e", pr.CR)
			if tox.SForal == 0 {
				crStr = "-"
			}
			hqStr := fmt.Sprintf("%.4f", pr.HQ)
			fmt.Fprintf(&b, "| %s | %.4e | %.4f/%.4f | %s | %s |\n",
				pr.Pathway, pr.ADD, tox.SForal, tox.RfDoral, crStr, hqStr)
			totalCR += pr.CR
			if pr.HQ > maxHQ {
				maxHQ = pr.HQ
			}
		}

		// 总风险
		crOK := totalCR < 1e-6
		hqOK := maxHQ < 1
		fmt.Fprintf(&b, "\n**总致癌风险(CR)**：%.2e %s\n", totalCR,
			map[bool]string{true: "✓ 可接受（<1E-6）", false: "✗ 不可接受（≥1E-6）"}[crOK])
		fmt.Fprintf(&b, "**总危害指数(HQ)**：%.4f %s\n\n",
			maxHQ, map[bool]string{true: "✓ 可接受（<1）", false: "✗ 不可接受（≥1）"}[hqOK])
	}

	return tool.WrapText(b.String()), nil
}

// suppress unused import lint
