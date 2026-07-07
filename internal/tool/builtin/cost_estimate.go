package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"gaeaW/internal/tool"
)

func init() { tool.RegisterBuiltin(costEstimate{}) }

type costEstimate struct{}

func (costEstimate) Name() string { return "cost_estimate" }

func (costEstimate) Description() string {
	return "生成土壤修复项目成本测算表：输入工程量清单，按钻孔/检测/药剂/土方/设备/人工/效果评估七项汇总，输出分项成本和总估算。"
}

func (costEstimate) Schema() json.RawMessage {
	return json.RawMessage(`{
"type":"object",
"properties":{
  "project_name":{"type":"string","description":"项目名称"},
  "soil_volume":{"type":"number","description":"修复土方量(m3)"},
  "tech_type":{"type":"string","description":"修复技术类型：化学氧化/固化稳定化/SVE/热脱附/生物修复/土壤淋洗"},
  "borehole_count":{"type":"integer","description":"钻孔数量"},
  "sampling_count":{"type":"integer","description":"采样数量"},
  "lab_cost_per_sample":{"type":"number","description":"单样检测费(元)","default":1200},
  "unit_medicament_cost":{"type":"number","description":"单位药剂成本(元/m3)"},
  "unit_transport_cost":{"type":"number","description":"单位土方运输成本(元/m3)"},
  "unit_disposal_cost":{"type":"number","description":"单位土方处置费(元/m3)"},
  "equipment_cost":{"type":"number","description":"设备总费用(元)"},
  "labor_months":{"type":"number","description":"人工月数(人·月)"},
  "labor_monthly_rate":{"type":"number","description":"人均月工资(元/月)","default":10000},
  "overhead_rate":{"type":"number","description":"管理费比例(%)","default":10},
  "profit_rate":{"type":"number","description":"利润率(%)","default":8},
  "tax_rate":{"type":"number","description":"税率(%)","default":6}
},
"required":["project_name","soil_volume","tech_type"]
}`)
}

func (costEstimate) ReadOnly() bool { return true }

func (costEstimate) CompactDescription() string { return compactDesc["cost_estimate"] }
func (costEstimate) CompactSchema() json.RawMessage   { return compactSchema["cost_estimate"] }

type costInput struct {
	ProjectName      string  `json:"project_name"`
	SoilVolume       float64 `json:"soil_volume"`
	TechType         string  `json:"tech_type"`
	BoreholeCount    int     `json:"borehole_count,omitempty"`
	SamplingCount    int     `json:"sampling_count,omitempty"`
	LabCostPerSample float64 `json:"lab_cost_per_sample,omitempty"`
	UnitMedCost      float64 `json:"unit_medicament_cost,omitempty"`
	UnitTransCost    float64 `json:"unit_transport_cost,omitempty"`
	UnitDisposalCost float64 `json:"unit_disposal_cost,omitempty"`
	EquipCost        float64 `json:"equipment_cost,omitempty"`
	LaborMonths      float64 `json:"labor_months,omitempty"`
	LaborRate        float64 `json:"labor_monthly_rate,omitempty"`
	OverheadRate     float64 `json:"overhead_rate,omitempty"`
	ProfitRate       float64 `json:"profit_rate,omitempty"`
	TaxRate          float64 `json:"tax_rate,omitempty"`
}

type costItem struct {
	Name   string  `json:"name"`
	Amount float64 `json:"amount"`
	Note   string  `json:"note"`
}

func (costEstimate) Execute(ctx context.Context, args json.RawMessage) (string, error) {
	var p costInput
	if err := json.Unmarshal(args, &p); err != nil {
		return "", fmt.Errorf("参数无效: %w", err)
	}
	if p.ProjectName == "" || p.SoilVolume <= 0 {
		return "", fmt.Errorf("project_name 和 soil_volume(>0) 必填")
	}
	if p.LabCostPerSample <= 0 {
		p.LabCostPerSample = 1200
	}
	if p.LaborRate <= 0 {
		p.LaborRate = 10000
	}
	if p.OverheadRate <= 0 {
		p.OverheadRate = 10
	}
	if p.ProfitRate <= 0 {
		p.ProfitRate = 8
	}
	if p.TaxRate <= 0 {
		p.TaxRate = 6
	}

	tech := strings.ToLower(p.TechType)

	// 估算各种成本
	items := estimateCosts(tech, p)

	totalDirect := 0.0
	for _, item := range items {
		totalDirect += item.Amount
	}

	overhead := totalDirect * p.OverheadRate / 100
	profit := (totalDirect + overhead) * p.ProfitRate / 100
	tax := (totalDirect + overhead + profit) * p.TaxRate / 100
	total := totalDirect + overhead + profit + tax

	var b strings.Builder
	fmt.Fprintf(&b, "# %s\n", p.ProjectName)
	fmt.Fprintf(&b, "## 成本测算表\n\n")
	fmt.Fprintf(&b, "修复技术：%s\n", p.TechType)
	fmt.Fprintf(&b, "修复方量：%.2f m3\n\n", p.SoilVolume)

	fmt.Fprintf(&b, "---\n\n")
	fmt.Fprintf(&b, "### 一、直接成本\n\n")
	fmt.Fprintf(&b, "| 序号 | 费用项目 | 金额（元） | 说明 |\n|------|----------|-----------|------|\n")
	for i, item := range items {
		fmt.Fprintf(&b, "| %d | %s | %.2f | %s |\n", i+1, item.Name, item.Amount, item.Note)
	}
	fmt.Fprintf(&b, "| | **直接成本小计** | **%.2f** | |\n", totalDirect)

	fmt.Fprintf(&b, "\n### 二、间接成本\n\n")
	fmt.Fprintf(&b, "| 费用项目 | 计算基数 | 费率 | 金额（元） |\n|----------|----------|------|-----------|\n")
	fmt.Fprintf(&b, "| 管理费 | 直接成本 | %.1f%% | %.2f |\n", p.OverheadRate, overhead)
	fmt.Fprintf(&b, "| 利润 | 直接成本+管理费 | %.1f%% | %.2f |\n", p.ProfitRate, profit)
	fmt.Fprintf(&b, "| 税金 | 直接成本+管理费+利润 | %.1f%% | %.2f |\n", p.TaxRate, tax)

	fmt.Fprintf(&b, "\n### 三、费用汇总\n\n")
	fmt.Fprintf(&b, "| 项目 | 金额（元） | 占比 |\n|------|-----------|------|\n")
	fmt.Fprintf(&b, "| 直接成本 | %.2f | %.1f%% |\n", totalDirect, totalDirect/total*100)
	fmt.Fprintf(&b, "| 管理费 | %.2f | %.1f%% |\n", overhead, overhead/total*100)
	fmt.Fprintf(&b, "| 利润 | %.2f | %.1f%% |\n", profit, profit/total*100)
	fmt.Fprintf(&b, "| 税金 | %.2f | %.1f%% |\n", tax, tax/total*100)
	fmt.Fprintf(&b, "| **总计** | **%.2f** | **100%%** |\n", total)
	fmt.Fprintf(&b, "\n| 单位方量成本 | **%.2f 元/m3** |\n", total/p.SoilVolume)

	return tool.WrapText(b.String()), nil
}

func estimateCosts(tech string, p costInput) []costItem {
	var items []costItem

	// 1. 勘察/钻孔费
	boreholeCount := p.BoreholeCount
	if boreholeCount <= 0 {
		// 按每500m3一个钻孔估算
		boreholeCount = int(p.SoilVolume/500) + 3
	}
	boreholeUnitCost := 800.0 // 元/孔
	boreholeTotal := float64(boreholeCount) * boreholeUnitCost
	items = append(items, costItem{
		Name:   "勘察钻孔费",
		Amount: boreholeTotal,
		Note:   fmt.Sprintf("%d孔×%.0f元/孔", boreholeCount, boreholeUnitCost),
	})

	// 2. 采样检测费
	samplingCount := p.SamplingCount
	if samplingCount <= 0 {
		samplingCount = boreholeCount * 3 // 每孔3个样品
	}
	labTotal := float64(samplingCount) * p.LabCostPerSample
	items = append(items, costItem{
		Name:   "采样检测费",
		Amount: labTotal,
		Note:   fmt.Sprintf("%d样×%.0f元/样", samplingCount, p.LabCostPerSample),
	})

	// 3. 药剂/材料费
	medCost := p.UnitMedCost
	if medCost <= 0 {
		switch {
		case strings.Contains(tech, "化学氧化") || strings.Contains(tech, "化学氧化"):
			medCost = 350 // 元/m3
		case strings.Contains(tech, "固化") || strings.Contains(tech, "稳定化"):
			medCost = 180 // 元/m3（水泥）
		case strings.Contains(tech, "热脱附"):
			medCost = 100 // 元/m3（辅助材料）
		case strings.Contains(tech, "土壤淋洗"):
			medCost = 120 // 元/m3
		case strings.Contains(tech, "生物"):
			medCost = 200 // 元/m3
		case strings.Contains(tech, "sve") || strings.Contains(tech, "气相"):
			medCost = 50 // 元/m3
		default:
			medCost = 250
		}
	}
	medTotal := medCost * p.SoilVolume
	items = append(items, costItem{
		Name:   "药剂/材料费",
		Amount: medTotal,
		Note:   fmt.Sprintf("%.0f元/m3×%.2f m3", medCost, p.SoilVolume),
	})

	// 4. 土方工程费
	transCost := p.UnitTransCost
	if transCost <= 0 {
		transCost = 35
	}
	disposalCost := p.UnitDisposalCost
	if disposalCost <= 0 {
		disposalCost = 80
	}
	earthTotal := (transCost + disposalCost) * p.SoilVolume
	items = append(items, costItem{
		Name:   "土方工程费（运输+处置）",
		Amount: earthTotal,
		Note:   fmt.Sprintf("运输%.0f+处置%.0f=%.0f元/m3×%.2f m3", transCost, disposalCost, transCost+disposalCost, p.SoilVolume),
	})

	// 5. 设备费
	equipTotal := p.EquipCost
	if equipTotal <= 0 {
		rate := 120.0 // 元/m3
		if strings.Contains(tech, "热脱附") {
			rate = 250
		} else if strings.Contains(tech, "sve") || strings.Contains(tech, "气相") {
			rate = 80
		}
		equipTotal = rate * p.SoilVolume
	}
	items = append(items, costItem{
		Name:   "设备费（租赁/折旧）",
		Amount: equipTotal,
		Note:   fmt.Sprintf("%.0f元/m3×%.2f m3", equipTotal/p.SoilVolume, p.SoilVolume),
	})

	// 6. 人工费
	laborMonths := p.LaborMonths
	if laborMonths <= 0 {
		// 按5人×工期估算
		durationMonths := p.SoilVolume / 2000
		if durationMonths < 1 {
			durationMonths = 1
		}
		laborMonths = 5 * durationMonths
	}
	laborTotal := laborMonths * p.LaborRate
	items = append(items, costItem{
		Name:   "人工费",
		Amount: laborTotal,
		Note:   fmt.Sprintf("%.0f人·月×%.0f元/月", laborMonths, p.LaborRate),
	})

	// 7. 效果评估费
	assessTotal := p.SoilVolume * 15
	if assessTotal < 50000 {
		assessTotal = 50000
	}
	items = append(items, costItem{
		Name:   "效果评估费",
		Amount: assessTotal,
		Note:   fmt.Sprintf("含验收检测和报告编制"),
	})

	return items
}
