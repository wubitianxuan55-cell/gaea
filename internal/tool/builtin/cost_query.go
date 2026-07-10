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
	return "查询工程成本数据：造价、人工单价、材料价格、机械台班费。支持按名称/编码关键词、分类、地区筛选。内置四川/重庆/西藏/贵州/云南/青海地区系数。支持批量估算和统计。"
}

func (costQuery) Schema() json.RawMessage {
	return json.RawMessage(`{
"type":"object",
"properties":{
  \"action\":{\"type\":\"string\",\"description\":\"特殊操作：estimate(批量估算)/stats(分类统计)/regions(地区对比)/export_csv(导出CSV)\"},
  \"keyword\":{\"type\":\"string\",\"description\":\"名称或编码关键词（可选，不填返回概览）；export_csv时指定导出类型：items/labor/material/machine/regions\"},
  "region":{"type":"string","description":"地区（可选）：四川/重庆/西藏/贵州/云南/青海"},
  "kind":{"type":"string","description":"查询类型（可选）：cost(成本条目)/labor(人工)/material(材料)/machine(机械)，默认cost"},
  "codes":{"type":"array","items":{"type":"string"},"description":"估算用：条目编码数组，配合quantities使用"},
  "quantities":{"type":"array","items":{"type":"number"},"description":"估算用：数量数组，与codes一一对应"}
}
}`)
}

func (costQuery) ReadOnly() bool { return true }

func (costQuery) Execute(_ context.Context, args json.RawMessage) (string, error) {
	var p struct {
		Keyword    string    `json:"keyword,omitempty"`
		Category   string    `json:"category,omitempty"`
		Region     string    `json:"region,omitempty"`
		Kind       string    `json:"kind,omitempty"`
		Action     string    `json:"action,omitempty"`
		Codes      []string  `json:"codes,omitempty"`
		Quantities []float64 `json:"quantities,omitempty"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return "", fmt.Errorf("参数无效: %w", err)
	}

	db, err := costdb.Load("")
	if err != nil {
		return "", fmt.Errorf("加载成本库失败: %w", err)
	}

	// Handle special actions first.
	switch strings.ToLower(p.Action) {
	case "estimate":
		return runEstimate(db, p.Codes, p.Quantities, p.Region)
	case "stats":
		return runStats(db)
	case "regions":
		return runRegionsCompare(db, p.Keyword)
	case "export_csv":
		return runExportCSV(db, p.Keyword)
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

func runEstimate(db *costdb.CostDB, codes []string, quantities []float64, region string) (string, error) {
	if len(codes) == 0 {
		return "请提供 codes 和 quantities 参数进行批量估算。", nil
	}
	if len(codes) != len(quantities) {
		return "", fmt.Errorf("codes 和 quantities 长度不一致（%d vs %d）", len(codes), len(quantities))
	}
	if region == "" {
		region = "全国"
	}

	items := make([]costdb.EstimateItem, len(codes))
	for i := range codes {
		items[i] = costdb.EstimateItem{Code: codes[i], Quantity: quantities[i]}
	}

	total, breakdown, err := db.Estimate(items, region)
	if err != nil {
		return "", fmt.Errorf("估算失败: %w", err)
	}

	var b strings.Builder
	b.WriteString("## 批量估算结果\n\n")
	b.WriteString("| 编码 | 名称 | 单位 | 单价(元) | 数量 | 小计(元) |\n")
	b.WriteString("|------|------|------|----------|------|----------|\n")
	for _, r := range breakdown {
		fmt.Fprintf(&b, "| %s | %s | %s | %.2f | %.0f | %.2f |\n",
			r.Code, r.Name, r.Unit, r.UnitPrice, r.Quantity, r.Subtotal)
	}
	fmt.Fprintf(&b, "\n**合计：%.2f 元**\n", total)
	return b.String(), nil
}

func runStats(db *costdb.CostDB) (string, error) {
	stats := db.StatsByCategory()
	if len(stats) == 0 {
		return "暂无统计数据。", nil
	}

	var b strings.Builder
	b.WriteString("## 成本库统计\n\n")
	b.WriteString("| 分类 | 条目数 | 平均单价 | 最低价 | 最高价 | 中位数 |\n")
	b.WriteString("|------|--------|----------|--------|--------|--------|\n")
	// Sort categories for stable output.
	cats := make([]string, 0, len(stats))
	for c := range stats {
		cats = append(cats, c)
	}
	sort.Strings(cats)
	for _, c := range cats {
		s := stats[c]
		fmt.Fprintf(&b, "| %s | %d | %.0f | %.0f | %.0f | %.0f |\n",
			c, s.Count, s.Avg, s.Min, s.Max, s.Median)
	}
	return b.String(), nil
}

func runRegionsCompare(db *costdb.CostDB, itemCode string) (string, error) {
	if itemCode == "" {
		return "请提供 keyword 参数指定要对比的成本条目编码。", nil
	}
	result := db.RegionCompare(itemCode)
	if len(result) == 0 {
		return fmt.Sprintf("未找到条目或地区系数：%s", itemCode), nil
	}

	var b strings.Builder
	fmt.Fprintf(&b, "## 地区对比：%s\n\n", itemCode)
	b.WriteString("| 地区 | 调整后单价 |\n")
	b.WriteString("|------|-----------|\n")
	regions := make([]string, 0, len(result))
	for r := range result {
		regions = append(regions, r)
	}
	sort.Strings(regions)
	for _, r := range regions {
		fmt.Fprintf(&b, "| %s | %.2f |\n", r, result[r])
	}
	return b.String(), nil
}

func runExportCSV(db *costdb.CostDB, kind string) (string, error) {
	if kind == "" {
		kind = "items"
	}
	data, err := db.ExportCSV(kind)
	if err != nil {
		return "", fmt.Errorf("导出CSV失败: %w", err)
	}
	return "```csv\n" + string(data) + "```\n", nil
}
