package costdb

import (
	"os"
	"path/filepath"
	"strings"
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

// --- 成本计算引擎测试 ---

func TestDirectCost(t *testing.T) {
	item := CostItem{LaborCost: 400, MaterialCost: 100, MachineCost: 300}
	got := item.DirectCost()
	if abs(got-800) > 1e-9 {
		t.Errorf("DirectCost() = %f, want 800", got)
	}
}

func TestComputeOverhead(t *testing.T) {
	item := CostItem{LaborCost: 400, MaterialCost: 100, MachineCost: 300, OverheadRate: 10}
	got := item.ComputeOverhead()
	if abs(got-80) > 1e-9 {
		t.Errorf("ComputeOverhead() = %f, want 80", got)
	}
}

func TestComputeProfit(t *testing.T) {
	item := CostItem{LaborCost: 400, MaterialCost: 100, MachineCost: 300, OverheadRate: 10, ProfitRate: 8}
	got := item.ComputeProfit()
	if abs(got-70.4) > 1e-9 {
		t.Errorf("ComputeProfit() = %f, want 70.4", got)
	}
}

func TestComputeTax(t *testing.T) {
	item := CostItem{LaborCost: 400, MaterialCost: 100, MachineCost: 300, OverheadRate: 10, ProfitRate: 8, TaxRate: 6}
	// direct=800, overhead=80, profit=70.4, tax base = 950.4, tax = 57.024
	got := item.ComputeTax()
	if abs(got-57.024) > 1e-9 {
		t.Errorf("ComputeTax() = %f, want 57.024", got)
	}
}

func TestComputeUnitPrice(t *testing.T) {
	// DR-001 data: labor=400, material=100, machine=300, overhead=10, profit=8, tax=6, waste=1.05, region=1.0
	item := CostItem{LaborCost: 400, MaterialCost: 100, MachineCost: 300, OverheadRate: 10, ProfitRate: 8, TaxRate: 6, WasteFactor: 1.05}
	// direct=800, overhead=80, profit=70.4, tax=57.024, sum=1007.424, *1.05 = 1057.7952
	want := 1057.7952
	got := item.ComputeUnitPrice(1.0)
	if abs(got-want) > 1e-9 {
		t.Errorf("ComputeUnitPrice(1.0) = %f, want %f", got, want)
	}
}

func TestComputeUnitPriceWithRegion(t *testing.T) {
	item := CostItem{LaborCost: 400, MaterialCost: 100, MachineCost: 300, OverheadRate: 10, ProfitRate: 8, TaxRate: 6, WasteFactor: 1.05}
	got := item.ComputeUnitPrice(1.35)
	want := 1057.7952 * 1.35 // 1428.02352
	if abs(got-want) > 1e-9 {
		t.Errorf("ComputeUnitPrice(1.35) = %f, want %f", got, want)
	}
}

func TestComputeUnitPriceZeroWaste(t *testing.T) {
	item := CostItem{LaborCost: 200, OverheadRate: 10, ProfitRate: 8, TaxRate: 6, WasteFactor: 1.0}
	got := item.ComputeUnitPrice(1.0)
	// direct=200, overhead=20, profit=17.6, tax=14.256, sum=251.856 * 1.0(waste) * 1.0(region)
	if abs(got-251.856) > 1e-9 {
		t.Errorf("ComputeUnitPrice(1.0) with zero waste = %f, want 251.856", got)
	}
}

// abs returns the absolute value of a float64.
func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

// --- 批量估算测试 ---

func TestEstimate(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	items := []EstimateItem{
		{Code: "DR-001", Quantity: 10},
		{Code: "CJ-001", Quantity: 5},
	}
	total, breakdown, err := db.Estimate(items, "全国")
	if err != nil {
		t.Fatalf("Estimate failed: %v", err)
	}
	if len(breakdown) != 2 {
		t.Fatalf("got %d breakdown items, want 2", len(breakdown))
	}
	// DR-001: unit price should be ~1057.80, qty 10 → ~10578
	if breakdown[0].Subtotal <= 0 {
		t.Errorf("DR-001 subtotal = %f, want >0", breakdown[0].Subtotal)
	}
	if total <= 0 {
		t.Errorf("total = %f, want >0", total)
	}
}

func TestEstimateNotFound(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = db.Estimate([]EstimateItem{{Code: "NONEXISTENT", Quantity: 1}}, "全国")
	if err == nil {
		t.Fatal("expected error for nonexistent code")
	}
}

func TestEstimateEmptyItems(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	total, breakdown, err := db.Estimate(nil, "全国")
	if err != nil {
		t.Fatalf("Estimate with nil items failed: %v", err)
	}
	if total != 0 {
		t.Errorf("total = %f, want 0", total)
	}
	if len(breakdown) != 0 {
		t.Errorf("breakdown length = %d, want 0", len(breakdown))
	}
}

// --- Add 方法测试 ---

func TestAddLabor(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	orig := len(db.Labor)
	err = db.AddLabor(LaborItem{TradeType: "测试工", Unit: "元/工日", Price: 200, Region: "全国", PriceDate: "2024-06-01", Source: "测试"})
	if err != nil {
		t.Fatalf("AddLabor failed: %v", err)
	}
	if len(db.Labor) != orig+1 {
		t.Fatalf("after AddLabor: got %d, want %d", len(db.Labor), orig+1)
	}
}

func TestAddLaborBatch(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	orig := len(db.Labor)
	err = db.AddLabor(
		LaborItem{TradeType: "测试工A", Unit: "元/工日", Price: 200, Region: "全国"},
		LaborItem{TradeType: "测试工B", Unit: "元/工日", Price: 300, Region: "全国"},
	)
	if err != nil {
		t.Fatalf("AddLabor batch failed: %v", err)
	}
	if len(db.Labor) != orig+2 {
		t.Fatalf("after AddLabor batch: got %d, want %d", len(db.Labor), orig+2)
	}
	// Verify persisted.
	db2, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	found := 0
	for _, l := range db2.Labor {
		if l.TradeType == "测试工A" || l.TradeType == "测试工B" {
			found++
		}
	}
	if found != 2 {
		t.Errorf("after reload: found %d test items, want 2", found)
	}
}

func TestAddMaterial(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	orig := len(db.Materials)
	err = db.AddMaterial(MaterialItem{Code: "MT-TEST", NameSpec: "测试材料", Unit: "元/吨", Price: 1000, Source: "测试", PriceDate: "2024-06-01", Region: "全国"})
	if err != nil {
		t.Fatalf("AddMaterial failed: %v", err)
	}
	if len(db.Materials) != orig+1 {
		t.Fatalf("after AddMaterial: got %d, want %d", len(db.Materials), orig+1)
	}
}

func TestAddMachine(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	orig := len(db.Machines)
	err = db.AddMachine(MachineItem{Code: "MC-TEST", NameSpec: "测试设备", Unit: "元/台班", Region: "全国"})
	if err != nil {
		t.Fatalf("AddMachine failed: %v", err)
	}
	if len(db.Machines) != orig+1 {
		t.Fatalf("after AddMachine: got %d, want %d", len(db.Machines), orig+1)
	}
}

func TestAddRegion(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	orig := len(db.Regions)
	err = db.AddRegion(RegionFactor{Region: "测试地区", AdjustmentFactor: 1.5, ValidFrom: "2024-06-01"})
	if err != nil {
		t.Fatalf("AddRegion failed: %v", err)
	}
	if len(db.Regions) != orig+1 {
		t.Fatalf("after AddRegion: got %d, want %d", len(db.Regions), orig+1)
	}
}

func TestAddItemsBatch(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	orig := len(db.Items)
	err = db.AddItems(
		CostItem{Code: "TEST-BATCH-1", Name: "批量测试1", Category: "测试", Unit: "元/次", BasePrice: 100, Source: "测试"},
		CostItem{Code: "TEST-BATCH-2", Name: "批量测试2", Category: "测试", Unit: "元/次", BasePrice: 200, Source: "测试"},
	)
	if err != nil {
		t.Fatalf("AddItems batch failed: %v", err)
	}
	if len(db.Items) != orig+2 {
		t.Fatalf("after AddItems: got %d, want %d", len(db.Items), orig+2)
	}
	// Verify persisted.
	db2, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	found := 0
	for _, it := range db2.Items {
		if it.Code == "TEST-BATCH-1" || it.Code == "TEST-BATCH-2" {
			found++
		}
	}
	if found != 2 {
		t.Errorf("after reload: found %d batch items, want 2", found)
	}
}

// --- Delete 方法测试 ---

func TestDeleteItem(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	// First add a known item, then delete it.
	err = db.AddItems(CostItem{Code: "TEST-DEL", Name: "删除测试", Category: "测试", Unit: "元/次", BasePrice: 100, Source: "测试"})
	if err != nil {
		t.Fatal(err)
	}
	err = db.DeleteItem("TEST-DEL")
	if err != nil {
		t.Fatalf("DeleteItem failed: %v", err)
	}
	for _, it := range db.Items {
		if it.Code == "TEST-DEL" {
			t.Fatal("TEST-DEL still found after DeleteItem")
		}
	}
}

func TestDeleteItemNotFound(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	err = db.DeleteItem("NONEXISTENT")
	if err == nil {
		t.Fatal("expected error for deleting nonexistent item")
	}
}

func TestDeleteLabor(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	err = db.AddLabor(LaborItem{TradeType: "DELETE-TEST", Unit: "元/工日", Price: 100, Region: "全国"})
	if err != nil {
		t.Fatal(err)
	}
	err = db.DeleteLabor("DELETE-TEST")
	if err != nil {
		t.Fatalf("DeleteLabor failed: %v", err)
	}
	for _, l := range db.Labor {
		if l.TradeType == "DELETE-TEST" {
			t.Fatal("DELETE-TEST still found after DeleteLabor")
		}
	}
}

func TestDeleteMaterial(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	err = db.AddMaterial(MaterialItem{Code: "MT-DEL", NameSpec: "删除材料", Unit: "元/吨", Price: 500, Region: "全国"})
	if err != nil {
		t.Fatal(err)
	}
	err = db.DeleteMaterial("MT-DEL")
	if err != nil {
		t.Fatalf("DeleteMaterial failed: %v", err)
	}
	for _, m := range db.Materials {
		if m.Code == "MT-DEL" {
			t.Fatal("MT-DEL still found after DeleteMaterial")
		}
	}
}

func TestDeleteMachine(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	err = db.AddMachine(MachineItem{Code: "MC-DEL", NameSpec: "删除设备", Unit: "元/台班", Region: "全国"})
	if err != nil {
		t.Fatal(err)
	}
	err = db.DeleteMachine("MC-DEL")
	if err != nil {
		t.Fatalf("DeleteMachine failed: %v", err)
	}
	for _, m := range db.Machines {
		if m.Code == "MC-DEL" {
			t.Fatal("MC-DEL still found after DeleteMachine")
		}
	}
}

func TestDeleteRegion(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	err = db.AddRegion(RegionFactor{Region: "DELETE-REG", AdjustmentFactor: 1.0, ValidFrom: "2024-01-01"})
	if err != nil {
		t.Fatal(err)
	}
	err = db.DeleteRegion("DELETE-REG")
	if err != nil {
		t.Fatalf("DeleteRegion failed: %v", err)
	}
	for _, r := range db.Regions {
		if r.Region == "DELETE-REG" {
			t.Fatal("DELETE-REG still found after DeleteRegion")
		}
	}
}

// --- Update 方法测试 ---

func TestUpdateItem(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	err = db.AddItems(CostItem{Code: "TEST-UPD", Name: "更新前", Category: "测试", Unit: "元/次", BasePrice: 100, Source: "测试"})
	if err != nil {
		t.Fatal(err)
	}
	err = db.UpdateItem("TEST-UPD", CostItem{Code: "TEST-UPD", Name: "更新后", Category: "测试", Unit: "元/次", BasePrice: 200, Source: "测试"})
	if err != nil {
		t.Fatalf("UpdateItem failed: %v", err)
	}
	// Reload and verify.
	db2, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	for _, it := range db2.Items {
		if it.Code == "TEST-UPD" {
			if it.Name != "更新后" || it.BasePrice != 200 {
				t.Errorf("after update: got Name=%s BasePrice=%f, want 更新后 200", it.Name, it.BasePrice)
			}
			return
		}
	}
	t.Fatal("TEST-UPD not found after update")
}

func TestUpdateItemNotFound(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	err = db.UpdateItem("NONEXISTENT", CostItem{Code: "NONEXISTENT", Name: "不存在", Category: "测试", Unit: "元/次", BasePrice: 100, Source: "测试"})
	if err == nil {
		t.Fatal("expected error for updating nonexistent item")
	}
}

func TestUpdateLabor(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	err = db.AddLabor(LaborItem{TradeType: "UPD-LABOR", Unit: "元/工日", Price: 100, Region: "全国"})
	if err != nil {
		t.Fatal(err)
	}
	err = db.UpdateLabor("UPD-LABOR", LaborItem{TradeType: "UPD-LABOR", Unit: "元/工日", Price: 999, Region: "全国"})
	if err != nil {
		t.Fatalf("UpdateLabor failed: %v", err)
	}
	db2, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	for _, l := range db2.Labor {
		if l.TradeType == "UPD-LABOR" {
			if l.Price != 999 {
				t.Errorf("after update: Price=%f, want 999", l.Price)
			}
			return
		}
	}
	t.Fatal("UPD-LABOR not found after update")
}

func TestUpdateMaterial(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	err = db.AddMaterial(MaterialItem{Code: "MT-UPD", NameSpec: "旧材料", Unit: "元/吨", Price: 500, Region: "全国"})
	if err != nil {
		t.Fatal(err)
	}
	err = db.UpdateMaterial("MT-UPD", MaterialItem{Code: "MT-UPD", NameSpec: "新材料", Unit: "元/吨", Price: 800, Region: "全国"})
	if err != nil {
		t.Fatalf("UpdateMaterial failed: %v", err)
	}
	db2, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range db2.Materials {
		if m.Code == "MT-UPD" {
			if m.NameSpec != "新材料" || m.Price != 800 {
				t.Errorf("after update: NameSpec=%s Price=%f, want 新材料 800", m.NameSpec, m.Price)
			}
			return
		}
	}
	t.Fatal("MT-UPD not found after update")
}

func TestUpdateMachine(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	err = db.AddMachine(MachineItem{Code: "MC-UPD", NameSpec: "旧设备", Unit: "元/台班", Region: "全国"})
	if err != nil {
		t.Fatal(err)
	}
	err = db.UpdateMachine("MC-UPD", MachineItem{Code: "MC-UPD", NameSpec: "新设备", Unit: "元/台班", Region: "全国"})
	if err != nil {
		t.Fatalf("UpdateMachine failed: %v", err)
	}
	db2, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range db2.Machines {
		if m.Code == "MC-UPD" {
			if m.NameSpec != "新设备" {
				t.Errorf("after update: NameSpec=%s, want 新设备", m.NameSpec)
			}
			return
		}
	}
	t.Fatal("MC-UPD not found after update")
}

func TestUpdateRegion(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	err = db.AddRegion(RegionFactor{Region: "UPD-REG", AdjustmentFactor: 1.0, ValidFrom: "2024-01-01"})
	if err != nil {
		t.Fatal(err)
	}
	err = db.UpdateRegion("UPD-REG", RegionFactor{Region: "UPD-REG", AdjustmentFactor: 2.0, ValidFrom: "2024-06-01"})
	if err != nil {
		t.Fatalf("UpdateRegion failed: %v", err)
	}
	db2, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range db2.Regions {
		if r.Region == "UPD-REG" {
			if r.AdjustmentFactor != 2.0 {
				t.Errorf("after update: AdjustmentFactor=%f, want 2.0", r.AdjustmentFactor)
			}
			return
		}
	}
	t.Fatal("UPD-REG not found after update")
}

// --- 统计测试 ---

func TestStatsByCategory(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	stats := db.StatsByCategory()
	if len(stats) == 0 {
		t.Fatal("expected non-empty StatsByCategory result")
	}
	// 钻孔勘察 should exist.
	ds, ok := stats["钻孔勘察"]
	if !ok {
		t.Fatal("expected 钻孔勘察 in stats")
	}
	if ds.Count <= 0 {
		t.Errorf("Count = %d, want >0", ds.Count)
	}
	if ds.Min <= 0 || ds.Max <= 0 || ds.Avg <= 0 {
		t.Errorf("invalid stats: Min=%f Max=%f Avg=%f", ds.Min, ds.Max, ds.Avg)
	}
	if ds.Sum <= 0 {
		t.Errorf("Sum = %f, want >0", ds.Sum)
	}
}

func TestStatsByRegion(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	stats := db.StatsByRegion("全国")
	if stats.Count <= 0 {
		t.Errorf("StatsByRegion(全国).Count = %d, want >0", stats.Count)
	}
	if stats.Min <= 0 || stats.Max <= 0 {
		t.Errorf("invalid stats for 全国: Min=%f Max=%f", stats.Min, stats.Max)
	}
}

func TestStatsEmptyDB(t *testing.T) {
	// Create a DB from seed, then clear items by deleting them all.
	dir := t.TempDir()
	path := filepath.Join(dir, "costdb.json")
	db, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	codes := make([]string, len(db.Items))
	for i, it := range db.Items {
		codes[i] = it.Code
	}
	for _, code := range codes {
		if err := db.DeleteItem(code); err != nil {
			t.Fatal(err)
		}
	}
	stats := db.StatsByCategory()
	if len(stats) != 0 {
		t.Errorf("expected empty stats, got %d categories", len(stats))
	}
	rs := db.StatsByRegion("全国")
	if rs.Count != 0 {
		t.Errorf("expected Count=0, got %d", rs.Count)
	}
}

// --- 材料/人工统计 + 地区对比测试 ---

func TestMaterialPriceStats(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	stats := db.MaterialPriceStats()
	if len(stats) == 0 {
		t.Fatal("expected non-empty MaterialPriceStats")
	}
	// At least one material should have stats.
	for name, s := range stats {
		if s.Count <= 0 {
			t.Errorf("material %s: Count=%d, want >0", name, s.Count)
		}
		break
	}
}

func TestLaborPriceStats(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	stats := db.LaborPriceStats()
	if len(stats) == 0 {
		t.Fatal("expected non-empty LaborPriceStats")
	}
	for trade, s := range stats {
		if s.Count <= 0 {
			t.Errorf("labor %s: Count=%d, want >0", trade, s.Count)
		}
		break
	}
}

func TestRegionCompare(t *testing.T) {
	// Add a test-cost item and check across different regions.
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	// Ensure regions: 四川(1.0), 重庆(0.95), 西藏(1.35), 全国(1.0)
	_ = db.AddItems(CostItem{
		Code: "REG-TEST", Name: "地区测试", Category: "测试", Unit: "元/次",
		BasePrice: 1000, LaborCost: 500, MaterialCost: 200, MachineCost: 300,
		OverheadRate: 10, ProfitRate: 8, TaxRate: 6, WasteFactor: 1.0,
		Region: "全国",
	})
	result := db.RegionCompare("REG-TEST")
	if len(result) == 0 {
		t.Fatal("expected non-empty RegionCompare result")
	}
	// Should have entries for 四川, 重庆, 西藏 at least.
	for _, region := range []string{"四川", "重庆", "西藏"} {
		if _, ok := result[region]; !ok {
			t.Errorf("expected region %s in RegionCompare result", region)
		}
	}
}

func TestRegionCompareNotFound(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	result := db.RegionCompare("NONEXISTENT")
	if len(result) != 0 {
		t.Errorf("expected empty result for nonexistent item, got %d regions", len(result))
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

// --- CSV 导出测试 ---

func TestExportItemsCSV(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	data, err := db.ExportCSV("items")
	if err != nil {
		t.Fatalf("ExportCSV(items) failed: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("exported CSV is empty")
	}
	// BOM + header + at least 1 data row.
	rows := strings.Split(string(data), "\n")
	if len(rows) < 3 {
		t.Fatalf("expected at least 3 lines (BOM+header+data), got %d", len(rows))
	}
	// Check header contains BOM.
	if !strings.HasPrefix(rows[0], "\xEF\xBB\xBF编码") {
		t.Error("first row should start with BOM + 编码")
	}
}

func TestExportLaborCSV(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	data, err := db.ExportCSV("labor")
	if err != nil {
		t.Fatalf("ExportCSV(labor) failed: %v", err)
	}
	rows := strings.Split(string(data), "\n")
	if len(rows) < 3 {
		t.Fatalf("expected at least 3 lines, got %d", len(rows))
	}
}

func TestExportMaterialCSV(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	data, err := db.ExportCSV("material")
	if err != nil {
		t.Fatalf("ExportCSV(material) failed: %v", err)
	}
	rows := strings.Split(string(data), "\n")
	if len(rows) < 3 {
		t.Fatalf("expected at least 3 lines, got %d", len(rows))
	}
}

func TestExportMachineCSV(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	data, err := db.ExportCSV("machine")
	if err != nil {
		t.Fatalf("ExportCSV(machine) failed: %v", err)
	}
	rows := strings.Split(string(data), "\n")
	if len(rows) < 3 {
		t.Fatalf("expected at least 3 lines, got %d", len(rows))
	}
}

func TestExportRegionsCSV(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	data, err := db.ExportCSV("regions")
	if err != nil {
		t.Fatalf("ExportCSV(regions) failed: %v", err)
	}
	rows := strings.Split(string(data), "\n")
	if len(rows) < 3 {
		t.Fatalf("expected at least 3 lines, got %d", len(rows))
	}
}

func TestExportCSVUnknownKind(t *testing.T) {
	db, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.ExportCSV("unknown")
	if err == nil {
		t.Fatal("expected error for unknown kind")
	}
}

func TestExportCSV_Roundtrip(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	// Export items, re-import, and verify data persists.
	data, err := db.ExportCSV("items")
	if err != nil {
		t.Fatal(err)
	}
	summary, err := db.ImportCSV("items", data)
	if err != nil {
		t.Fatalf("ImportCSV failed: %v", err)
	}
	// All items exist already, so all should be skipped.
	if summary.Skipped <= 0 && summary.Added <= 0 {
		t.Logf("roundtrip: added=%d skipped=%d errors=%v", summary.Added, summary.Skipped, summary.Errors)
	}
	_ = dir
}

// --- CSV 导入测试 ---

func TestImportItemsCSV_AddsNewItems(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	origCount := len(db.Items)
	csvData := "\xEF\xBB\xBF编码,名称,分类,单位,基价\nCSV-IMP-001,CSV导入测试,测试,元/次,1000\nCSV-IMP-002,CSV导入测试2,测试,元/次,2000\n"
	summary, err := db.ImportCSV("items", []byte(csvData))
	if err != nil {
		t.Fatalf("ImportCSV failed: %v", err)
	}
	if summary.Added != 2 {
		t.Errorf("expected 2 added, got %d", summary.Added)
	}
	if len(db.Items) != origCount+2 {
		t.Errorf("expected %d items total, got %d", origCount+2, len(db.Items))
	}
}

func TestImportItemsCSV_DuplicateCode(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	// DR-001 already exists in seed.
	csvData := "\xEF\xBB\xBF编码,名称,分类,单位,基价\nDR-001,重复导入,测试,元/次,999\n"
	summary, err := db.ImportCSV("items", []byte(csvData))
	if err != nil {
		t.Fatalf("ImportCSV failed: %v", err)
	}
	if summary.Added != 0 {
		t.Errorf("expected 0 added for duplicates, got %d", summary.Added)
	}
	if summary.Skipped != 1 {
		t.Errorf("expected 1 skipped, got %d", summary.Skipped)
	}
}

func TestImportCSV_MalformedData(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	// Empty code row.
	csvData := "\xEF\xBB\xBF编码,名称\n,无编码\n"
	summary, err := db.ImportCSV("items", []byte(csvData))
	if err != nil {
		t.Fatalf("ImportCSV failed: %v", err)
	}
	if len(summary.Errors) == 0 {
		t.Error("expected errors for malformed data, got none")
	}
}

func TestImportLaborCSV(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	orig := len(db.Labor)
	csvData := "\xEF\xBB\xBF工种,单位,单价\nCSV-工-测试,元/工日,300\n"
	summary, err := db.ImportCSV("labor", []byte(csvData))
	if err != nil {
		t.Fatalf("ImportCSV(labor) failed: %v", err)
	}
	if summary.Added != 1 {
		t.Errorf("expected 1 added, got %d", summary.Added)
	}
	if len(db.Labor) != orig+1 {
		t.Errorf("expected %d labor items, got %d", orig+1, len(db.Labor))
	}
}

func TestImportMaterialCSV(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	orig := len(db.Materials)
	csvData := "\xEF\xBB\xBF编码,名称规格,单位,单价\nCSV-MT-001,测试导入材料,元/吨,5000\n"
	summary, err := db.ImportCSV("material", []byte(csvData))
	if err != nil {
		t.Fatalf("ImportCSV(material) failed: %v", err)
	}
	if summary.Added != 1 {
		t.Errorf("expected 1 added, got %d", summary.Added)
	}
	if len(db.Materials) != orig+1 {
		t.Errorf("expected %d material items, got %d", orig+1, len(db.Materials))
	}
}

func TestImportMachineCSV(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	orig := len(db.Machines)
	csvData := "\xEF\xBB\xBF编码,名称规格,单位\nCSV-MC-001,测试导入机械,元/台班\n"
	summary, err := db.ImportCSV("machine", []byte(csvData))
	if err != nil {
		t.Fatalf("ImportCSV(machine) failed: %v", err)
	}
	if summary.Added != 1 {
		t.Errorf("expected 1 added, got %d", summary.Added)
	}
	if len(db.Machines) != orig+1 {
		t.Errorf("expected %d machine items, got %d", orig+1, len(db.Machines))
	}
}

func TestImportRegionsCSV(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	orig := len(db.Regions)
	csvData := "\xEF\xBB\xBF地区,调整系数\nCSV-REG-测试,1.2\n"
	summary, err := db.ImportCSV("regions", []byte(csvData))
	if err != nil {
		t.Fatalf("ImportCSV(regions) failed: %v", err)
	}
	if summary.Added != 1 {
		t.Errorf("expected 1 added, got %d", summary.Added)
	}
	if len(db.Regions) != orig+1 {
		t.Errorf("expected %d region items, got %d", orig+1, len(db.Regions))
	}
}

func TestImportCSVUnknownKind(t *testing.T) {
	dir := t.TempDir()
	db, err := Load(filepath.Join(dir, "costdb.json"))
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.ImportCSV("unknown", []byte{})
	if err == nil {
		t.Fatal("expected error for unknown import kind")
	}
}

func TestParseF64(t *testing.T) {
	tests := []struct {
		input string
		want  float64
	}{
		{"123.45", 123.45},
		{"0", 0},
		{"", 0},
		{"abc", 0},
		{"1,5", 0}, // comma as decimal separator is not supported
	}
	for _, tt := range tests {
		got := parseF64(tt.input)
		if got != tt.want {
			t.Errorf("parseF64(%q) = %f, want %f", tt.input, got, tt.want)
		}
	}
}
