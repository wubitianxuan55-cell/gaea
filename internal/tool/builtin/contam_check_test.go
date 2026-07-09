package builtin

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestContamCheck_ClassI_ArsenicExceedsScreening(t *testing.T) {
	// 一类用地，砷 25mg/kg → 筛选值20，超筛选值但未超管控值120
	args := mustMarshalArgsForTest(map[string]interface{}{
		"land_use": "一类用地",
		"samples": []map[string]interface{}{
			{"pollutant": "砷", "measured_value": 25},
		},
	})
	result, err := contamCheck{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "砷") {
		t.Errorf("result should contain pollutant name")
	}
	if !strings.Contains(result, "超过筛选值") {
		t.Errorf("arsenic 25 > class I screening 20 should show exceed screening, got:\n%s", result)
	}
}

func TestContamCheck_Agri_CadmiumExceedsByPH(t *testing.T) {
	// 农用地，pH=6.0，镉 0.5mg/kg → pH≤6.5 筛选值0.4，超筛选值
	args := mustMarshalArgsForTest(map[string]interface{}{
		"land_use": "农用地",
		"ph":       6.0,
		"samples": []map[string]interface{}{
			{"pollutant": "镉", "measured_value": 0.5},
		},
	})
	result, err := contamCheck{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "超过") {
		t.Errorf("cadmium 0.5 > agri screening 0.4 should show exceed, got:\n%s", result)
	}
}

func TestContamCheck_ClassII_LeadBelowScreening(t *testing.T) {
	// 二类用地，铅 100mg/kg → 筛选值800，达标
	args := mustMarshalArgsForTest(map[string]interface{}{
		"land_use": "二类用地",
		"samples": []map[string]interface{}{
			{"pollutant": "铅", "measured_value": 100},
		},
	})
	result, err := contamCheck{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "达标") && !strings.Contains(result, "未超过") {
		t.Errorf("lead 100 < class II screening 800 should show pass, got:\n%s", result)
	}
}

func TestContamCheck_EmptySamplesError(t *testing.T) {
	args := mustMarshalArgsForTest(map[string]interface{}{
		"land_use": "二类用地",
		"samples":  []map[string]interface{}{},
	})
	_, err := contamCheck{}.Execute(context.Background(), args)
	if err == nil {
		t.Fatal("expected error for empty samples, got nil")
	}
}

// mustMarshalArgsForTest serialises v to json.RawMessage, panicking on error.
func mustMarshalArgsForTest(v interface{}) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return json.RawMessage(b)
}
