package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"gaeaW/internal/costdb"
	"gaeaW/internal/tool"
)

func init() { tool.RegisterBuiltin(costQuery{}) }

// costQuery queries the cost database for engineering cost items, labor rates,
// material prices, and machine rental rates.
type costQuery struct{}

func (costQuery) Name() string { return "cost_query" }

func (costQuery) Description() string {
	return "查询工程成本数据：造价、人工单价、材料价格、机械台班费。支持按名称/编码关键词、分类、地区筛选。内置四川/重庆/西藏地区系数。"
}

func (costQuery) Schema() json.RawMessage {
	return json.RawMessage(`{
"type":"object",
"properties":{
  "keyword":{"type":"string","description":"名称或编码关键词（可选，不填返回概览）"},
  "category":{"type":"string","description":"分类筛选（可选）：钻孔勘察/采样检测/药剂材料/土方运输/设备租赁/人工/效果评估"},
  "region":{"type":"string","description":"地区（可选）：四川/重庆/西藏"},
  "kind":{"type":"string","description":"查询类型（可选）：cost(成本条目)/labor(人工)/material(材料)/machine(机械)，默认cost"}
}
}`)
}

func (costQuery) ReadOnly() bool { return true }

func (costQuery) CompactDescription() string { return compactDesc["cost_query"] }
func (costQuery) CompactSchema() json.RawMessage   { return compactSchema["cost_query"] }

func (costQuery) Execute(_ context.Context, args json.RawMessage) (string, error) {
	var p struct {
		Keyword  string `json:"keyword,omitempty"`
		Category string `json:"category,omitempty"`
		Region   string `json:"region,omitempty"`
		Kind     string `json:"kind,omitempty"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return "", fmt.Errorf("参数无效: %w", err)
	}

	db, err := costdb.Load("")
	if err != nil {
		return "", fmt.Errorf("加载成本库失败: %w", err)
	}

	kind := strings.ToLower(p.Kind)
	if kind == "" {
		kind = "cost"
	}

	switch kind {
	case "labor":
		return queryLabor(db, p.Keyword, p.Region)
	case "material":
		return queryMaterial(db, p.Keyword, p.Region)
	case "machine":
		return queryMachine(db, p.Keyword, p.Region)
	default:
		return queryCost(db, p.Keyword, p.Category, p.Region)
	}
}

func queryCost(db *costdb.CostDB, keyword, category, region string) (string, error) {
	if keyword == "" && category == "" && region == "" {
		// Overview: list categories and counts.
		return costOverview(db)
	}

	filter := costdb.Filter{
		Category:    category,
		NameKeyword: keyword,
		Region:      region,
	}
	items := db.QueryCost(filter)
	if len(items) == 0 {
		return "未找到匹配的成本条目。", nil
	}

	var b strings.Builder
	fmt.Fprintf(&b, "## 成本条目查询结果\n\n")
	fmt.Fprintf(&b, "| 编码 | 名称 | 单位 | 单价(元) | 人工费 | 材料费 | 机械费 | 来源 | 置信度 |\n")
	fmt.Fprintf(&b, "|------|------|------|----------|--------|--------|--------|------|--------|\n")
	for _, it := range items {
		fmt.Fprintf(&b, "| %s | %s | %s | %.0f | %.0f | %.0f | %.0f | %s | %.1f |\n",
			it.Code, it.Name, it.Unit, it.BasePrice,
			it.LaborCost, it.MaterialCost, it.MachineCost,
			it.Source, it.Confidence)
	}
	return b.String(), nil
}

func costOverview(db *costdb.CostDB) (string, error) {
	var b strings.Builder
	b.WriteString("## 成本库概览\n\n")

	b.WriteString("### 分类及条目数\n\n")
	b.WriteString("| 分类 | 条目数 |\n|------|--------|\n")
	cats := db.Categories()
	total := 0
	for _, c := range cats {
		count := len(db.QueryCost(costdb.Filter{Category: c}))
		fmt.Fprintf(&b, "| %s | %d |\n", c, count)
		total += count
	}
	fmt.Fprintf(&b, "| **合计** | **%d** |\n\n", total)

	b.WriteString("### 人工单价\n\n")
	b.WriteString("| 工种 | 单位 | 单价 |\n|------|------|------|\n")
	for _, l := range db.Labor {
		fmt.Fprintf(&b, "| %s | %s | %.0f |\n", l.TradeType, l.Unit, l.Price)
	}

	b.WriteString("\n### 材料价格\n\n")
	b.WriteString("| 名称 | 单位 | 单价 |\n|------|------|------|\n")
	for _, m := range db.Materials {
		fmt.Fprintf(&b, "| %s | %s | %.0f |\n", m.NameSpec, m.Unit, m.Price)
	}

	b.WriteString("\n### 机械台班\n\n")
	b.WriteString("| 名称 | 单位 | 台班费 |\n|------|------|--------|\n")
	for _, m := range db.Machines {
		fmt.Fprintf(&b, "| %s | %s | %.0f |\n", m.NameSpec, m.Unit, m.PurchasePrice)
	}

	b.WriteString("\n### 地区系数\n\n")
	b.WriteString("| 地区 | 系数 |\n|------|------|\n")
	for _, r := range db.Regions {
		fmt.Fprintf(&b, "| %s | %.2f |\n", r.Region, r.AdjustmentFactor)
	}

	return b.String(), nil
}

func queryLabor(db *costdb.CostDB, keyword, region string) (string, error) {
	items := db.QueryLabor(keyword, region)
	if len(items) == 0 {
		return "未找到匹配的人工单价。", nil
	}

	var b strings.Builder
	b.WriteString("## 人工单价查询结果\n\n")
	b.WriteString("| 工种 | 单位 | 单价 | 地区 | 日期 |\n")
	b.WriteString("|------|------|------|------|------|\n")
	sort.Slice(items, func(i, j int) bool { return items[i].TradeType < items[j].TradeType })
	for _, it := range items {
		fmt.Fprintf(&b, "| %s | %s | %.0f | %s | %s |\n",
			it.TradeType, it.Unit, it.Price, it.Region, it.PriceDate)
	}
	return b.String(), nil
}

func queryMaterial(db *costdb.CostDB, keyword, region string) (string, error) {
	items := db.QueryMaterial(keyword, region)
	if len(items) == 0 {
		return "未找到匹配的材料价格。", nil
	}

	var b strings.Builder
	b.WriteString("## 材料价格查询结果\n\n")
	b.WriteString("| 名称规格 | 单位 | 单价 | 地区 | 日期 | 来源 |\n")
	b.WriteString("|----------|------|------|------|------|------|\n")
	sort.Slice(items, func(i, j int) bool { return items[i].NameSpec < items[j].NameSpec })
	for _, it := range items {
		fmt.Fprintf(&b, "| %s | %s | %.0f | %s | %s | %s |\n",
			it.NameSpec, it.Unit, it.Price, it.Region, it.PriceDate, it.Source)
	}
	return b.String(), nil
}

func queryMachine(db *costdb.CostDB, keyword, region string) (string, error) {
	items := db.QueryMachine(keyword, region)
	if len(items) == 0 {
		return "未找到匹配的机械台班。", nil
	}

	var b strings.Builder
	b.WriteString("## 机械台班查询结果\n\n")
	b.WriteString("| 名称规格 | 单位 | 台班费 | 小时费率 | 燃油费 | 人工费 |\n")
	b.WriteString("|----------|------|--------|----------|--------|--------|\n")
	sort.Slice(items, func(i, j int) bool { return items[i].NameSpec < items[j].NameSpec })
	for _, it := range items {
		fmt.Fprintf(&b, "| %s | %s | %.0f | %.0f | %.0f | %.0f |\n",
			it.NameSpec, it.Unit, it.PurchasePrice, it.HourlyRate, it.FuelRate, it.OperatorLabor)
	}
	return b.String(), nil
}
