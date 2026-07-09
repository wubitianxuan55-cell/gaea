package builtin

import (
	"context"
	"strings"
	"testing"
)

func TestSamplingPlan_Phase1_10000m2(t *testing.T) {
	// 10000m² 初调 → 至少7个点（10000/1600=6.25→ceil=7）
	args := mustMarshalArgsForTest(map[string]interface{}{
		"phase":     "phase1",
		"site_area": 10000,
	})
	result, err := samplingPlan{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "7") {
		t.Errorf("10000m2 phase1 should recommend at least 7 points, got:\n%s", result)
	}
}

func TestSamplingPlan_Phase2_5000m2(t *testing.T) {
	// 5000m² 详调 → 至少13个点（5000/400=12.5→ceil=13）
	args := mustMarshalArgsForTest(map[string]interface{}{
		"phase":     "phase2",
		"site_area": 5000,
	})
	result, err := samplingPlan{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "13") {
		t.Errorf("5000m2 phase2 should recommend at least 13 points, got:\n%s", result)
	}
}

func TestSamplingPlan_Phase1_SmallArea(t *testing.T) {
	// 面积过小时返回至少3个点
	args := mustMarshalArgsForTest(map[string]interface{}{
		"phase":     "phase1",
		"site_area": 500,
	})
	result, err := samplingPlan{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "3") {
		t.Errorf("small area phase1 should recommend at least 3 points, got:\n%s", result)
	}
}

func TestSamplingPlan_InvalidPhaseError(t *testing.T) {
	args := mustMarshalArgsForTest(map[string]interface{}{
		"phase":     "phase3",
		"site_area": 1000,
	})
	_, err := samplingPlan{}.Execute(context.Background(), args)
	if err == nil {
		t.Fatal("expected error for invalid phase, got nil")
	}
}
