package costdb

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadEmptyPathUsesSeed(t *testing.T) {
	// Use a temp dir so the default path doesn't exist yet.
	dir := t.TempDir()
	t.Setenv("HOME", dir)
	t.Setenv("USERPROFILE", dir) // Windows

	db, err := Load("")
	if err != nil {
		t.Fatalf("Load(\"\") failed: %v", err)
	}
	if len(db.Items) == 0 {
		t.Fatal("expected seed items after Load(\"\")")
	}
	if len(db.Labor) == 0 {
		t.Fatal("expected seed labor entries")
	}
	if len(db.Materials) == 0 {
		t.Fatal("expected seed material entries")
	}
	if len(db.Machines) == 0 {
		t.Fatal("expected seed machine entries")
	}
}

func TestQueryCostByCategory(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	items := db.QueryCost(Filter{Category: "钻孔勘察"})
	if len(items) == 0 {
		t.Fatal("expected items for category 钻孔勘察")
	}
	for _, it := range items {
		if it.Category != "钻孔勘察" {
			t.Errorf("item %s has category %s, want 钻孔勘察", it.Code, it.Category)
		}
	}
}

func TestQueryMaterialByKeyword(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	items := db.QueryMaterial("过硫酸钠", "")
	if len(items) == 0 {
		t.Fatal("expected material 过硫酸钠")
	}
	if items[0].NameSpec != "过硫酸钠" {
		t.Errorf("got name %s, want 过硫酸钠", items[0].NameSpec)
	}
}

func TestRegionFactor(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	if f := db.RegionFactor("西藏"); f != 1.35 {
		t.Errorf("RegionFactor(西藏) = %f, want 1.35", f)
	}
	if f := db.RegionFactor("北京"); f != 1.0 {
		t.Errorf("RegionFactor(北京) = %f, want 1.0", f)
	}
}

func TestAddPersistAndReload(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "costdb.json")
	db, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	origCount := len(db.Items)

	err = db.Add(CostItem{
		Code:     "TEST-001",
		Name:     "测试条目",
		Category: "测试",
		BasePrice: 999,
		Unit:     "元/次",
		Source:   "测试",
	})
	if err != nil {
		t.Fatalf("Add failed: %v", err)
	}
	if len(db.Items) != origCount+1 {
		t.Fatalf("after Add: got %d items, want %d", len(db.Items), origCount+1)
	}

	// Reload from the same file.
	db2, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, it := range db2.Items {
		if it.Code == "TEST-001" {
			found = true
			if it.BasePrice != 999 {
				t.Errorf("BasePrice = %f, want 999", it.BasePrice)
			}
			break
		}
	}
	if !found {
		t.Fatal("TEST-001 not found after reload")
	}
}

func TestQueryCostByCodePrefix(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	items := db.QueryCost(Filter{CodePrefix: "EQ"})
	if len(items) == 0 {
		t.Fatal("expected items with code prefix EQ")
	}
}

func TestCategories(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	cats := db.Categories()
	if len(cats) == 0 {
		t.Fatal("expected non-empty categories")
	}
	// Should include at least some expected categories.
	expected := []string{"钻孔勘察", "采样检测", "药剂材料", "土方运输", "设备租赁", "人工", "效果评估"}
	for _, exp := range expected {
		found := false
		for _, c := range cats {
			if c == exp {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected category %s not found in %v", exp, cats)
		}
	}
}

func TestLoadNonExistentPath(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "nonexistent", "subdir", "costdb.json")
	db, err := Load(path)
	if err != nil {
		t.Fatalf("Load non-existent path should create from seed: %v", err)
	}
	if len(db.Items) == 0 {
		t.Fatal("expected seed data after loading non-existent path")
	}
	// File should have been created.
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Fatal("Load should have created the file")
	}
}

func TestQueryCostByNameKeyword(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	items := db.QueryCost(Filter{NameKeyword: "钻孔"})
	if len(items) == 0 {
		t.Fatal("expected items matching '钻孔'")
	}
}

func TestQueryLaborByTrade(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	items := db.QueryLabor("普工", "")
	if len(items) == 0 {
		t.Fatal("expected labor items for 普工")
	}
}

func TestQueryMachineByKeyword(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	items := db.QueryMachine("筛分", "")
	if len(items) == 0 {
		t.Fatal("expected machine items for 筛分")
	}
}

func TestSaveIdempotent(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "costdb.json")
	db, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	// Save once.
	if err := db.Save(); err != nil {
		t.Fatalf("first Save: %v", err)
	}
	// Save again (should be no error).
	if err := db.Save(); err != nil {
		t.Fatalf("second Save: %v", err)
	}
}

func TestQueryCostAll(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	// Empty filter returns all items.
	items := db.QueryCost(Filter{})
	if len(items) == 0 {
		t.Fatal("expected all items with empty filter")
	}
	// Items should be sorted by category then name.
	for i := 1; i < len(items); i++ {
		if items[i].Category < items[i-1].Category {
			t.Errorf("items not sorted by category at index %d", i)
		}
	}
}
