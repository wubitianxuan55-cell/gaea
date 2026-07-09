package builtin

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestSurveyReport_BasicParamsGeneratesTitle(t *testing.T) {
	args := json.RawMessage(`{"site_name":"测试地块","survey_company":"测试公司","client":"委托方"}`)
	result, err := surveyReport{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "测试地块") {
		t.Errorf("result should contain site name, got:\n%s", result)
	}
	if !strings.Contains(result, "土壤污染状况") {
		t.Errorf("result should contain report type title, got:\n%s", result)
	}
}

func TestSurveyReport_ContainsHJ251Reference(t *testing.T) {
	args := json.RawMessage(`{"site_name":"测试地块"}`)
	result, err := surveyReport{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "HJ 25.1") {
		t.Errorf("result should reference HJ 25.1, got:\n%s", result)
	}
	if !strings.Contains(result, "GB 36600") {
		t.Errorf("result should reference GB 36600, got:\n%s", result)
	}
}

func TestSurveyReport_ContainsReviewReminder(t *testing.T) {
	args := json.RawMessage(`{"site_name":"测试地块"}`)
	result, err := surveyReport{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "审核") {
		t.Errorf("result should contain review reminder (审核), got:\n%s", result)
	}
}

func TestSurveyReport_EmptySiteNameReturnsError(t *testing.T) {
	args := json.RawMessage(`{"site_name":""}`)
	_, err := surveyReport{}.Execute(context.Background(), args)
	if err == nil {
		t.Fatal("expected error for empty site_name, got nil")
	}
}
