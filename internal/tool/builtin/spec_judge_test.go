package builtin

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestSpecJudge_ExceedReturnsOverLimit(t *testing.T) {
	// 砷(As) 二类用地筛选值 60mg/kg, 管控值 140mg/kg
	// 输入 100mg/kg 应超过筛选值
	args := json.RawMessage(`{"pollutants":[{"name":"砷","value":100}],"land_type":"二类用地"}`)
	result, err := specJudge{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "超过筛选值") {
		t.Errorf("result should indicate exceed screening, got:\n%s", result)
	}
	if !strings.Contains(result, "100.") {
		t.Errorf("result should contain the input value, got:\n%s", result)
	}
}

func TestSpecJudge_BelowScreeningReturnsPass(t *testing.T) {
	// 砷(As) 二类用地筛选值 60mg/kg，输入 10mg/kg 未超过
	args := json.RawMessage(`{"pollutants":[{"name":"砷","value":10}],"land_type":"二类用地"}`)
	result, err := specJudge{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "未超过") {
		t.Errorf("result should indicate not exceeded, got:\n%s", result)
	}
}

func TestSpecJudge_EmptyPollutantsReturnsError(t *testing.T) {
	args := json.RawMessage(`{"pollutants":[],"land_type":"二类用地"}`)
	_, err := specJudge{}.Execute(context.Background(), args)
	if err == nil {
		t.Fatal("expected error for empty pollutants, got nil")
	}
	if !strings.Contains(err.Error(), "不能为空") {
		t.Errorf("error should mention empty, got: %v", err)
	}
}

func TestSpecJudge_UnknownPollutantReturnsNotFound(t *testing.T) {
	args := json.RawMessage(`{"pollutants":[{"name":"不存在元素","value":100}],"land_type":"二类用地"}`)
	result, err := specJudge{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "不在") {
		t.Errorf("result should indicate pollutant not in list, got:\n%s", result)
	}
}
