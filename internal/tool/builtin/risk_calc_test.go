package builtin

import (
	"context"
	"strings"
	"testing"
)

func TestRiskCalc_ResidentialAdultArsenic20(t *testing.T) {
	// 住宅用地、成人受体、砷浓度20mg/kg → 计算CR和HQ
	args := mustMarshalArgsForTest(map[string]interface{}{
		"scenario":     "residential",
		"receptor":     "adult",
		"contaminants": []map[string]interface{}{{"name": "砷", "concentration": 20}},
	})
	result, err := riskCalc{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "砷") {
		t.Errorf("result should contain contaminant name")
	}
	if !strings.Contains(result, "致癌风险") && !strings.Contains(result, "CR") && !strings.Contains(result, "危害") {
		t.Errorf("result should contain risk assessment results")
	}
}

func TestRiskCalc_IndustrialChildCadmium65(t *testing.T) {
	// 工业用地、儿童受体、镉浓度65mg/kg → HQ应>1（超标）
	args := mustMarshalArgsForTest(map[string]interface{}{
		"scenario":     "industrial",
		"receptor":     "child",
		"contaminants": []map[string]interface{}{{"name": "镉", "concentration": 65}},
	})
	result, err := riskCalc{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 查是否有超标提示
	if !strings.Contains(result, "不可接受") && !strings.Contains(result, ">") && !strings.Contains(result, "危害") {
		t.Errorf("high cadmium should show concern indicators")
	}
}

func TestRiskCalc_CustomParams(t *testing.T) {
	// 覆盖默认暴露参数
	args := mustMarshalArgsForTest(map[string]interface{}{
		"scenario":     "residential",
		"receptor":     "adult",
		"contaminants": []map[string]interface{}{{"name": "砷", "concentration": 10}},
		"body_weight":  80,
	})
	result, err := riskCalc{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "砷") {
		t.Errorf("result should contain contaminant name")
	}
}

func TestRiskCalc_EmptyContaminantsError(t *testing.T) {
	args := mustMarshalArgsForTest(map[string]interface{}{
		"scenario":     "residential",
		"receptor":     "adult",
		"contaminants": []map[string]interface{}{},
	})
	_, err := riskCalc{}.Execute(context.Background(), args)
	if err == nil {
		t.Fatal("expected error for empty contaminants, got nil")
	}
}
