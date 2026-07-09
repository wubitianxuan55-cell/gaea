package builtin

import (
	"strings"
	"testing"
)

func TestCostQueryKeywordDrilling(t *testing.T) {
	cq := costQuery{}
	result, err := cq.Execute(nil, toJSON(t, map[string]interface{}{
		"keyword": "钻孔",
	}))
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if len(result) == 0 {
		t.Fatal("expected non-empty result for keyword=钻孔")
	}
	if !strings.Contains(result, "DR-001") {
		t.Error("expected result to contain DR-001 (钻孔条目)")
	}
}

func TestCostQueryKindMaterial(t *testing.T) {
	cq := costQuery{}
	result, err := cq.Execute(nil, toJSON(t, map[string]interface{}{
		"kind":    "material",
		"keyword": "过硫酸钠",
	}))
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if len(result) == 0 {
		t.Fatal("expected non-empty result for material query")
	}
	if !strings.Contains(result, "5450") {
		t.Error("expected material price 5450 in result")
	}
}

func TestCostQueryOverview(t *testing.T) {
	cq := costQuery{}
	result, err := cq.Execute(nil, toJSON(t, map[string]interface{}{}))
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if len(result) == 0 {
		t.Fatal("expected non-empty overview")
	}
	if !strings.Contains(result, "成本库概览") {
		t.Error("expected 成本库概览 in overview")
	}
	if !strings.Contains(result, "钻孔勘察") {
		t.Error("expected 钻孔勘察 category in overview")
	}
}

func TestCostQueryKindLabor(t *testing.T) {
	cq := costQuery{}
	result, err := cq.Execute(nil, toJSON(t, map[string]interface{}{
		"kind": "labor",
	}))
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if len(result) == 0 {
		t.Fatal("expected non-empty result for labor query")
	}
	if !strings.Contains(result, "普工") {
		t.Error("expected 普工 in labor results")
	}
}

func TestCostQueryKindMachine(t *testing.T) {
	cq := costQuery{}
	result, err := cq.Execute(nil, toJSON(t, map[string]interface{}{
		"kind": "machine",
	}))
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if len(result) == 0 {
		t.Fatal("expected non-empty result for machine query")
	}
	if !strings.Contains(result, "ALLU") {
		t.Error("expected ALLU in machine results")
	}
}

func TestCostQueryByCategory(t *testing.T) {
	cq := costQuery{}
	result, err := cq.Execute(nil, toJSON(t, map[string]interface{}{
		"category": "药剂材料",
	}))
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if len(result) == 0 {
		t.Fatal("expected non-empty result for category 药剂材料")
	}
	if !strings.Contains(result, "MA-001") {
		t.Error("expected MA-001 in results")
	}
}
