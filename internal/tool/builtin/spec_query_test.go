package builtin

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestSpecQuery_GB36600_QueryReturnsResults(t *testing.T) {
	args := json.RawMessage(`{"question":"砷"}`)
	result, err := specQuery{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "GB 36600") {
		t.Errorf("result should contain GB 36600 reference, got:\n%s", result)
	}
	if !strings.Contains(result, "GB 15618") {
		t.Errorf("result should contain GB 15618 reference, got:\n%s", result)
	}
}

func TestSpecQuery_NoMatchFallsBackToCategoryNav(t *testing.T) {
	args := json.RawMessage(`{"question":"不存在的关键词xyz123"}`)
	result, err := specQuery{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should fall back to category navigation or full list
	if !strings.Contains(result, "未找到") && !strings.Contains(result, "GB 36600") {
		t.Errorf("result should indicate no match or show full list, got:\n%s", result)
	}
}

func TestSpecQuery_ResultContainsCodeAndTitle(t *testing.T) {
	args := json.RawMessage(`{"question":"布点"}`)
	result, err := specQuery{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "HJ 25.1") {
		t.Errorf("result should contain standard code (HJ 25.1), got:\n%s", result)
	}
	if !strings.Contains(result, "技术导则") {
		t.Errorf("result should contain standard title (技术导则), got:\n%s", result)
	}
}

func TestSpecQuery_EmptyQuestionReturnsError(t *testing.T) {
	args := json.RawMessage(`{"question":""}`)
	_, err := specQuery{}.Execute(context.Background(), args)
	if err == nil {
		t.Fatal("expected error for empty question, got nil")
	}
	if !strings.Contains(err.Error(), "不能为空") {
		t.Errorf("error should mention empty, got: %v", err)
	}
}
