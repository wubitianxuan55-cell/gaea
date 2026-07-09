package builtin

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestCostEstimate_BasicParamsGeneratesTable(t *testing.T) {
	args := json.RawMessage(`{"project_name":"测试项目","soil_volume":1000,"tech_type":"化学氧化"}`)
	result, err := costEstimate{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "测试项目") {
		t.Errorf("result should contain project name, got:\n%s", result)
	}
	if !strings.Contains(result, "成本测算表") {
		t.Errorf("result should contain cost table title, got:\n%s", result)
	}
}

func TestCostEstimate_IncludesSevenCategories(t *testing.T) {
	args := json.RawMessage(`{"project_name":"测试项目","soil_volume":1000,"tech_type":"化学氧化"}`)
	result, err := costEstimate{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	categories := []string{
		"勘察钻孔费",
		"采样检测费",
		"药剂/材料费",
		"土方工程费",
		"设备费",
		"人工费",
		"效果评估费",
	}
	for _, cat := range categories {
		if !strings.Contains(result, cat) {
			t.Errorf("result should contain category %q", cat)
		}
	}
}

func TestCostEstimate_OutputIsValidMarkdown(t *testing.T) {
	args := json.RawMessage(`{"project_name":"测试项目","soil_volume":1000,"tech_type":"化学氧化"}`)
	result, err := costEstimate{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Result is wrapped in a JSON envelope by tool.WrapText
	if !strings.Contains(result, `"ok":true`) {
		t.Errorf("result should contain success envelope, got:\n%s", result)
	}
	// Envelope message should contain markdown heading
	if !strings.Contains(result, "# 测试项目") {
		t.Errorf("result should contain markdown heading, got:\n%s", result)
	}
	// Envelope message should contain direct cost section
	if !strings.Contains(result, "直接成本") {
		t.Errorf("result should contain direct cost section, got:\n%s", result)
	}
}

func TestCostEstimate_MissingRequiredReturnsError(t *testing.T) {
	args := json.RawMessage(`{"project_name":""}`)
	_, err := costEstimate{}.Execute(context.Background(), args)
	if err == nil {
		t.Fatal("expected error for empty required fields, got nil")
	}
}
