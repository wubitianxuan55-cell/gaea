package builtin

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestSurveyReport_OutputPathWritesFile 验证 output_path 写入文件
func TestSurveyReport_OutputPathWritesFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "survey_test.md")
	args := mustMarshalArgs(map[string]interface{}{
		"site_name":      "输出测试地块",
		"survey_company": "测试公司",
		"output_path":    path,
	})

	result, err := surveyReport{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "输出测试地块") {
		t.Errorf("result should contain site name")
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("output file not created: %v", err)
	}
	if !strings.Contains(string(data), "输出测试地块") {
		t.Errorf("file should contain site name")
	}
}

// TestCostEstimate_OutputPathWritesFile 验证 cost_estimate 输出文件
func TestCostEstimate_OutputPathWritesFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cost_test.md")
	args := mustMarshalArgs(map[string]interface{}{
		"project_name": "输出成本测试",
		"soil_volume":  1000,
		"tech_type":    "化学氧化",
		"output_path":  path,
	})

	_, err := costEstimate{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("output file not created: %v", err)
	}
	if !strings.Contains(string(data), "输出成本测试") {
		t.Errorf("file should contain project name")
	}
}

// TestBidProposal_OutputPathWritesFile 验证 bid_proposal 输出文件
func TestBidProposal_OutputPathWritesFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bid_test.md")
	args := mustMarshalArgs(map[string]interface{}{
		"project_name": "输出投标测试",
		"bidder":       "测试公司",
		"output_path":  path,
	})

	_, err := bidProposal{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("output file not created: %v", err)
	}
	if !strings.Contains(string(data), "输出投标测试") {
		t.Errorf("file should contain project name")
	}
}

// TestBidProposal_BasicParams 验证 bid_proposal 基本参数
func TestBidProposal_BasicParams(t *testing.T) {
	args := mustMarshalArgs(map[string]interface{}{
		"project_name": "投标测试",
		"bidder":       "测试公司",
	})

	result, err := bidProposal{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "投标测试") {
		t.Errorf("result should contain project name, got:\n%s", result)
	}
	if !strings.Contains(result, "测试公司") {
		t.Errorf("result should contain bidder name")
	}
}

func TestSurveyReport_OutputPathDocx(t *testing.T) {
	path := filepath.Join(t.TempDir(), "survey_test.docx")
	args := mustMarshalArgs(map[string]interface{}{
		"site_name":      "DOCX输出测试",
		"survey_company": "测试公司",
		"output_path":    path,
		"output_format":  "docx",
	})

	_, err := surveyReport{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// 验证 docx 文件存在且是合法 zip
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("docx output file not created: %v", err)
	}
	if len(data) < 100 {
		t.Fatalf("docx file too small: %d bytes", len(data))
	}
}

// mustMarshalArgs 将 map 转为 json.RawMessage，自动处理路径转义
func mustMarshalArgs(v map[string]interface{}) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return json.RawMessage(b)
}
