// Package costdb provides a cost database for engineering project estimation.
// Data is stored in JSON files and includes cost items, labor rates, material
// prices, machine rates, and regional adjustment factors.
package costdb

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
)

// CostItem represents a single engineering cost item with decomposed
// labor/material/machine components and pricing metadata.
type CostItem struct {
	Code         string  `json:"code"`
	Name         string  `json:"name"`
	Category     string  `json:"category"`
	Unit         string  `json:"unit"`
	BasePrice    float64 `json:"base_price"`
	LaborCost    float64 `json:"labor_cost"`
	MaterialCost float64 `json:"material_cost"`
	MachineCost  float64 `json:"machine_cost"`
	OverheadRate float64 `json:"overhead_rate"`
	ProfitRate   float64 `json:"profit_rate"`
	TaxRate      float64 `json:"tax_rate"`
	WasteFactor  float64 `json:"waste_factor"`
	Source       string  `json:"source"`
	Confidence   float64 `json:"confidence"`
	Region       string  `json:"region"`
	ValidFrom    string  `json:"valid_from"`
	ValidTo      string  `json:"valid_to,omitempty"`
	Remark       string  `json:"remark,omitempty"`
}

// EstimateItem represents a single item in an estimate request.
type EstimateItem struct {
	Code     string
	Quantity float64
}

// EstimateResult represents a single line in an estimate breakdown.
type EstimateResult struct {
	Code      string
	Name      string
	Unit      string
	UnitPrice float64
	Quantity  float64
	Subtotal  float64
}

// LaborItem represents a labor rate for a specific trade type.
type LaborItem struct {
	TradeType string  `json:"trade_type"`
	Unit      string  `json:"unit"`
	Price     float64 `json:"price"`
	Region    string  `json:"region"`
	PriceDate string  `json:"price_date"`
	Source    string  `json:"source"`
}

// MaterialItem represents a material price from market sources.
type MaterialItem struct {
	Code      string  `json:"code"`
	NameSpec  string  `json:"name_spec"`
	Unit      string  `json:"unit"`
	Price     float64 `json:"price"`
	Source    string  `json:"source"`
	PriceDate string  `json:"price_date"`
	Region    string  `json:"region"`
}

// MachineItem represents a construction machine rental rate and operating costs.
type MachineItem struct {
	Code           string  `json:"code"`
	NameSpec       string  `json:"name_spec"`
	Unit           string  `json:"unit"`
	PurchasePrice  float64 `json:"purchase_price"`
	HourlyRate     float64 `json:"hourly_rate"`
	FuelRate       float64 `json:"fuel_rate"`
	OperatorLabor  float64 `json:"operator_labor"`
	Region         string  `json:"region"`
}

// RegionFactor defines a regional price adjustment multiplier.
type RegionFactor struct {
	Region           string  `json:"region"`
	AdjustmentFactor float64 `json:"adjustment_factor"`
	ValidFrom        string  `json:"valid_from"`
}

// CostDB aggregates all cost data and provides thread-safe query access.
type CostDB struct {
	Items     []CostItem     `json:"items"`
	Labor     []LaborItem    `json:"labor"`
	Materials []MaterialItem `json:"materials"`
	Machines  []MachineItem  `json:"machines"`
	Regions   []RegionFactor `json:"regions"`
	mu        sync.RWMutex

	path string // file path the DB was loaded from/saved to

	// lookup indexes (not serialized) — map[code/indexKey]sliceIndex
	itemIndex     map[string]int `json:"-"`
	laborIndex    map[string]int `json:"-"`
	materialIndex map[string]int `json:"-"`
	machineIndex  map[string]int `json:"-"`
	regionIndex   map[string]int `json:"-"`
}

// rebuildIndexes rebuilds all lookup index maps from the current slices.
// Must be called with db.mu write-locked.
func (db *CostDB) rebuildIndexes() {
	db.itemIndex = make(map[string]int, len(db.Items))
	for i, it := range db.Items {
		db.itemIndex[it.Code] = i
	}
	db.laborIndex = make(map[string]int, len(db.Labor))
	for i, l := range db.Labor {
		db.laborIndex[l.TradeType] = i
	}
	db.materialIndex = make(map[string]int, len(db.Materials))
	for i, m := range db.Materials {
		db.materialIndex[m.Code] = i
	}
	db.machineIndex = make(map[string]int, len(db.Machines))
	for i, m := range db.Machines {
		db.machineIndex[m.Code] = i
	}
	db.regionIndex = make(map[string]int, len(db.Regions))
	for i, r := range db.Regions {
		db.regionIndex[r.Region] = i
	}
}

// DirectCost returns the sum of labor, material, and machine costs.
func (c CostItem) DirectCost() float64 {
	return c.LaborCost + c.MaterialCost + c.MachineCost
}

// ComputeOverhead returns the overhead cost = DirectCost × overhead_rate/100.
func (c CostItem) ComputeOverhead() float64 {
	return c.DirectCost() * c.OverheadRate / 100
}

// ComputeProfit returns the profit = (DirectCost + Overhead) × profit_rate/100.
func (c CostItem) ComputeProfit() float64 {
	return (c.DirectCost() + c.ComputeOverhead()) * c.ProfitRate / 100
}

// ComputeTax returns the tax = (DirectCost + Overhead + Profit) × tax_rate/100.
func (c CostItem) ComputeTax() float64 {
	return (c.DirectCost() + c.ComputeOverhead() + c.ComputeProfit()) * c.TaxRate / 100
}

// ComputeUnitPrice returns the complete unit price multiplied by waste factor and region factor.
// Formula: ((DirectCost + Overhead + Profit + Tax) × WasteFactor) × RegionFactor
func (c CostItem) ComputeUnitPrice(regionFactor float64) float64 {
	base := c.DirectCost() + c.ComputeOverhead() + c.ComputeProfit() + c.ComputeTax()
	return base * c.WasteFactor * regionFactor
}

// Filter defines query constraints for CostItem search.
type Filter struct {
	Category   string
	NameKeyword string
	Region     string
	CodePrefix string
}

// defaultPath returns the default costdb file path (~/.gaeaW/costdb.json).
func defaultPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("home dir: %w", err)
	}
	return filepath.Join(home, ".gaeaW", "costdb.json"), nil
}

// Load opens a cost database from the given path. If path is empty, the default
// path (~/.gaeaW/costdb.json) is used. If the file doesn't exist, the database
// is initialized from embedded seed data and saved to the path.
func Load(path string) (*CostDB, error) {
	if path == "" {
		var err error
		path, err = defaultPath()
		if err != nil {
			// Fallback: use seed directly.
			return loadSeed()
		}
	}

	db := &CostDB{path: path}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Initialize from seed and save.
			s, err := loadSeed()
			if err != nil {
				return nil, err
			}
			s.path = path
			if err := s.Save(); err != nil {
				return nil, fmt.Errorf("save seed: %w", err)
			}
			return s, nil
		}
		return nil, fmt.Errorf("read %s: %w", path, err)
	}

	if err := json.Unmarshal(data, db); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	db.rebuildIndexes()
	return db, nil
}

// loadSeed creates a CostDB from the embedded seed data.
func loadSeed() (*CostDB, error) {
	db := &CostDB{}
	if err := json.Unmarshal(seedData, db); err != nil {
		return nil, fmt.Errorf("seed parse: %w", err)
	}
	db.rebuildIndexes()
	return db, nil
}

// Save writes the database to its file path atomically (write tmp + rename).
func (db *CostDB) Save() error {
	db.mu.Lock()
	defer db.mu.Unlock()
	return db.saveLocked()
}

// SetPath sets the file path for the database (for external reconstruction).
func (db *CostDB) SetPath(path string) {
	db.path = path
}

// SetData replaces all data slices in the database.
func (db *CostDB) SetData(items []CostItem, labor []LaborItem, materials []MaterialItem, machines []MachineItem, regions []RegionFactor) {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.Items = items
	db.Labor = labor
	db.Materials = materials
	db.Machines = machines
	db.Regions = regions
	db.rebuildIndexes()
}

// QueryCost returns cost items matching the given filter. Results are sorted
// by category then by name. An empty filter returns all items.
func (db *CostDB) QueryCost(filter Filter) []CostItem {
	db.mu.RLock()
	defer db.mu.RUnlock()

	var result []CostItem
	for _, it := range db.Items {
		if filter.Category != "" && it.Category != filter.Category {
			continue
		}
		if filter.NameKeyword != "" && !strings.Contains(it.Name, filter.NameKeyword) {
			continue
		}
		if filter.Region != "" && it.Region != filter.Region && it.Region != "全国" {
			continue
		}
		if filter.CodePrefix != "" && !strings.HasPrefix(it.Code, filter.CodePrefix) {
			continue
		}
		result = append(result, it)
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].Category != result[j].Category {
			return result[i].Category < result[j].Category
		}
		return result[i].Name < result[j].Name
	})
	return result
}

// QueryLabor returns labor items matching the trade type and region.
func (db *CostDB) QueryLabor(tradeType, region string) []LaborItem {
	db.mu.RLock()
	defer db.mu.RUnlock()

	var result []LaborItem
	for _, it := range db.Labor {
		if tradeType != "" && !strings.Contains(it.TradeType, tradeType) {
			continue
		}
		if region != "" && it.Region != region && it.Region != "全国" {
			continue
		}
		result = append(result, it)
	}
	return result
}

// QueryMaterial returns material items matching keyword and region.
func (db *CostDB) QueryMaterial(nameKeyword, region string) []MaterialItem {
	db.mu.RLock()
	defer db.mu.RUnlock()

	var result []MaterialItem
	for _, it := range db.Materials {
		if nameKeyword != "" && !strings.Contains(it.NameSpec, nameKeyword) {
			continue
		}
		if region != "" && it.Region != region && it.Region != "全国" {
			continue
		}
		result = append(result, it)
	}
	return result
}

// QueryMachine returns machine items matching keyword and region.
func (db *CostDB) QueryMachine(nameKeyword, region string) []MachineItem {
	db.mu.RLock()
	defer db.mu.RUnlock()

	var result []MachineItem
	for _, it := range db.Machines {
		if nameKeyword != "" && !strings.Contains(it.NameSpec, nameKeyword) {
			continue
		}
		if region != "" && it.Region != region && it.Region != "全国" {
			continue
		}
		result = append(result, it)
	}
	return result
}

// RegionFactor returns the regional price adjustment factor for the given
// region. Returns 1.0 if no matching region is found.
func (db *CostDB) RegionFactor(region string) float64 {
	db.mu.RLock()
	defer db.mu.RUnlock()

	idx, ok := db.regionIndex[region]
	if !ok {
		return 1.0
	}
	return db.Regions[idx].AdjustmentFactor
}

// Add appends a cost item and saves the database.
func (db *CostDB) Add(item CostItem) error {
	return db.AddItems(item)
}

// AddItems appends one or more cost items and saves the database.
func (db *CostDB) AddItems(items ...CostItem) error {
	db.mu.Lock()
	start := len(db.Items)
	db.Items = append(db.Items, items...)
	for i, it := range items {
		db.itemIndex[it.Code] = start + i
	}
	db.mu.Unlock()
	return db.Save()
}

// AddLabor appends one or more labor items and saves the database.
func (db *CostDB) AddLabor(items ...LaborItem) error {
	db.mu.Lock()
	start := len(db.Labor)
	db.Labor = append(db.Labor, items...)
	for i, l := range items {
		db.laborIndex[l.TradeType] = start + i
	}
	db.mu.Unlock()
	return db.Save()
}

// AddMaterial appends one or more material items and saves the database.
func (db *CostDB) AddMaterial(items ...MaterialItem) error {
	db.mu.Lock()
	start := len(db.Materials)
	db.Materials = append(db.Materials, items...)
	for i, m := range items {
		db.materialIndex[m.Code] = start + i
	}
	db.mu.Unlock()
	return db.Save()
}

// AddMachine appends one or more machine items and saves the database.
func (db *CostDB) AddMachine(items ...MachineItem) error {
	db.mu.Lock()
	start := len(db.Machines)
	db.Machines = append(db.Machines, items...)
	for i, m := range items {
		db.machineIndex[m.Code] = start + i
	}
	db.mu.Unlock()
	return db.Save()
}

// AddRegion appends one or more region factors and saves the database.
func (db *CostDB) AddRegion(items ...RegionFactor) error {
	db.mu.Lock()
	start := len(db.Regions)
	db.Regions = append(db.Regions, items...)
	for i, r := range items {
		db.regionIndex[r.Region] = start + i
	}
	db.mu.Unlock()
	return db.Save()
}

// DeleteItem removes a cost item by its code. Returns an error if not found.
func (db *CostDB) DeleteItem(code string) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	idx, ok := db.itemIndex[code]
	if !ok {
		return fmt.Errorf("未找到成本条目: %s", code)
	}
	last := len(db.Items) - 1
	if idx != last {
		db.Items[idx] = db.Items[last]
		db.itemIndex[db.Items[idx].Code] = idx
	}
	db.Items = db.Items[:last]
	delete(db.itemIndex, code)
	return db.saveLocked()
}

// DeleteLabor removes all labor items matching the trade type.
func (db *CostDB) DeleteLabor(tradeType string) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	filtered := db.Labor[:0]
	for _, l := range db.Labor {
		if l.TradeType != tradeType {
			filtered = append(filtered, l)
		}
	}
	db.Labor = filtered
	db.rebuildIndexes() // multi-delete, rebuild is simpler
	return db.saveLocked()
}

// DeleteMaterial removes a material item by its code. Returns an error if not found.
func (db *CostDB) DeleteMaterial(code string) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	idx, ok := db.materialIndex[code]
	if !ok {
		return fmt.Errorf("未找到材料: %s", code)
	}
	last := len(db.Materials) - 1
	if idx != last {
		db.Materials[idx] = db.Materials[last]
		db.materialIndex[db.Materials[idx].Code] = idx
	}
	db.Materials = db.Materials[:last]
	delete(db.materialIndex, code)
	return db.saveLocked()
}

// DeleteMachine removes a machine item by its code. Returns an error if not found.
func (db *CostDB) DeleteMachine(code string) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	idx, ok := db.machineIndex[code]
	if !ok {
		return fmt.Errorf("未找到机械: %s", code)
	}
	last := len(db.Machines) - 1
	if idx != last {
		db.Machines[idx] = db.Machines[last]
		db.machineIndex[db.Machines[idx].Code] = idx
	}
	db.Machines = db.Machines[:last]
	delete(db.machineIndex, code)
	return db.saveLocked()
}

// DeleteRegion removes a region factor by its region name. Returns an error if not found.
func (db *CostDB) DeleteRegion(region string) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	idx, ok := db.regionIndex[region]
	if !ok {
		return fmt.Errorf("未找到地区系数: %s", region)
	}
	last := len(db.Regions) - 1
	if idx != last {
		db.Regions[idx] = db.Regions[last]
		db.regionIndex[db.Regions[idx].Region] = idx
	}
	db.Regions = db.Regions[:last]
	delete(db.regionIndex, region)
	return db.saveLocked()
}

// UpdateItem replaces a cost item identified by its code. Returns an error if not found.
func (db *CostDB) UpdateItem(code string, item CostItem) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	idx, ok := db.itemIndex[code]
	if !ok {
		return fmt.Errorf("未找到成本条目: %s", code)
	}
	if code != item.Code {
		delete(db.itemIndex, code)
		db.itemIndex[item.Code] = idx
	}
	db.Items[idx] = item
	return db.saveLocked()
}

// UpdateLabor replaces a labor item identified by trade type. Returns an error if not found.
func (db *CostDB) UpdateLabor(tradeType string, item LaborItem) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	idx, ok := db.laborIndex[tradeType]
	if !ok {
		return fmt.Errorf("未找到人工: %s", tradeType)
	}
	if tradeType != item.TradeType {
		delete(db.laborIndex, tradeType)
		db.laborIndex[item.TradeType] = idx
	}
	db.Labor[idx] = item
	return db.saveLocked()
}

// UpdateMaterial replaces a material item identified by its code. Returns an error if not found.
func (db *CostDB) UpdateMaterial(code string, item MaterialItem) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	idx, ok := db.materialIndex[code]
	if !ok {
		return fmt.Errorf("未找到材料: %s", code)
	}
	if code != item.Code {
		delete(db.materialIndex, code)
		db.materialIndex[item.Code] = idx
	}
	db.Materials[idx] = item
	return db.saveLocked()
}

// UpdateMachine replaces a machine item identified by its code. Returns an error if not found.
func (db *CostDB) UpdateMachine(code string, item MachineItem) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	idx, ok := db.machineIndex[code]
	if !ok {
		return fmt.Errorf("未找到机械: %s", code)
	}
	if code != item.Code {
		delete(db.machineIndex, code)
		db.machineIndex[item.Code] = idx
	}
	db.Machines[idx] = item
	return db.saveLocked()
}

// UpdateRegion replaces a region factor identified by region name. Returns an error if not found.
func (db *CostDB) UpdateRegion(region string, item RegionFactor) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	idx, ok := db.regionIndex[region]
	if !ok {
		return fmt.Errorf("未找到地区系数: %s", region)
	}
	if region != item.Region {
		delete(db.regionIndex, region)
		db.regionIndex[item.Region] = idx
	}
	db.Regions[idx] = item
	return db.saveLocked()
}

// PriceStats holds summary statistics for a set of base prices.
type PriceStats struct {
	Min    float64 `json:"min"`
	Max    float64 `json:"max"`
	Avg    float64 `json:"avg"`
	Median float64 `json:"median"`
	Count  int     `json:"count"`
	Sum    float64 `json:"sum"`
}

// computeStats computes PriceStats from a slice of prices.
func computeStats(prices []float64) PriceStats {
	if len(prices) == 0 {
		return PriceStats{}
	}
	min, max := prices[0], prices[0]
	var sum float64
	for _, p := range prices {
		if p < min {
			min = p
		}
		if p > max {
			max = p
		}
		sum += p
	}
	sorted := make([]float64, len(prices))
	copy(sorted, prices)
	sort.Float64s(sorted)
	median := sorted[len(sorted)/2]
	if len(sorted)%2 == 0 {
		median = (sorted[len(sorted)/2-1] + sorted[len(sorted)/2]) / 2
	}
	return PriceStats{
		Min:    min,
		Max:    max,
		Avg:    sum / float64(len(prices)),
		Median: median,
		Count:  len(prices),
		Sum:    sum,
	}
}

// StatsByCategory returns price statistics grouped by item category.
func (db *CostDB) StatsByCategory() map[string]PriceStats {
	db.mu.RLock()
	defer db.mu.RUnlock()

	grouped := make(map[string][]float64)
	for _, it := range db.Items {
		grouped[it.Category] = append(grouped[it.Category], it.BasePrice)
	}
	result := make(map[string]PriceStats, len(grouped))
	for cat, prices := range grouped {
		result[cat] = computeStats(prices)
	}
	return result
}

// StatsByRegion returns price statistics for items in the given region.
func (db *CostDB) StatsByRegion(region string) PriceStats {
	db.mu.RLock()
	defer db.mu.RUnlock()

	var prices []float64
	for _, it := range db.Items {
		if it.Region == region || it.Region == "全国" {
			prices = append(prices, it.BasePrice)
		}
	}
	return computeStats(prices)
}

// MaterialPriceStats returns price statistics grouped by material code.
func (db *CostDB) MaterialPriceStats() map[string]PriceStats {
	db.mu.RLock()
	defer db.mu.RUnlock()

	grouped := make(map[string][]float64)
	for _, m := range db.Materials {
		grouped[m.Code] = append(grouped[m.Code], m.Price)
	}
	result := make(map[string]PriceStats, len(grouped))
	for code, prices := range grouped {
		result[code] = computeStats(prices)
	}
	return result
}

// LaborPriceStats returns price statistics grouped by trade type.
func (db *CostDB) LaborPriceStats() map[string]PriceStats {
	db.mu.RLock()
	defer db.mu.RUnlock()

	grouped := make(map[string][]float64)
	for _, l := range db.Labor {
		grouped[l.TradeType] = append(grouped[l.TradeType], l.Price)
	}
	result := make(map[string]PriceStats, len(grouped))
	for trade, prices := range grouped {
		result[trade] = computeStats(prices)
	}
	return result
}

// RegionCompare returns the adjusted unit price for a cost item across all available regions.
func (db *CostDB) RegionCompare(itemCode string) map[string]float64 {
	db.mu.RLock()
	defer db.mu.RUnlock()

	idx, ok := db.itemIndex[itemCode]
	if !ok {
		return nil
	}
	item := &db.Items[idx]

	result := make(map[string]float64, len(db.Regions))
	for _, rf := range db.Regions {
		result[rf.Region] = item.ComputeUnitPrice(rf.AdjustmentFactor)
	}
	return result
}

// saveLocked saves the database to disk. Must be called with db.mu write-locked.
func (db *CostDB) saveLocked() error {
	data, err := json.MarshalIndent(db, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	dir := filepath.Dir(db.path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}
	tmpPath := db.path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("write tmp: %w", err)
	}
	if err := os.Rename(tmpPath, db.path); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("rename: %w", err)
	}
	return nil
}

// Estimate computes a batch cost estimate for the given items in the specified
// region. Each item's code must match an existing CostItem. Returns the total
// cost and a detailed breakdown line per item.
func (db *CostDB) Estimate(items []EstimateItem, region string) (float64, []EstimateResult, error) {
	if len(items) == 0 {
		return 0, nil, nil
	}

	db.mu.RLock()
	regionFactor := 1.0
	if idx, ok := db.regionIndex[region]; ok {
		regionFactor = db.Regions[idx].AdjustmentFactor
	}

	// Build a lookup map using the existing itemIndex (O(1) per item).
	lookup := make(map[string]*CostItem, len(items))
	for _, it := range items {
		if idx, ok := db.itemIndex[it.Code]; ok {
			lookup[it.Code] = &db.Items[idx]
		}
	}
	db.mu.RUnlock()

	var total float64
	breakdown := make([]EstimateResult, 0, len(items))

	for _, it := range items {
		item, ok := lookup[it.Code]
		if !ok {
			return 0, nil, fmt.Errorf("成本条目未找到: %s", it.Code)
		}
		up := item.ComputeUnitPrice(regionFactor)
		subtotal := up * it.Quantity
		total += subtotal
		breakdown = append(breakdown, EstimateResult{
			Code:      item.Code,
			Name:      item.Name,
			Unit:      item.Unit,
			UnitPrice: up,
			Quantity:  it.Quantity,
			Subtotal:  subtotal,
		})
	}

	return total, breakdown, nil
}

// Categories returns a sorted list of unique category names.
func (db *CostDB) Categories() []string {
	db.mu.RLock()
	defer db.mu.RUnlock()

	seen := make(map[string]bool)
	for _, it := range db.Items {
		seen[it.Category] = true
	}
	var cats []string
	for c := range seen {
		cats = append(cats, c)
	}
	sort.Strings(cats)
	return cats
}

// ── CSV 导出 ──────────────────────────────────────────────────────────────

// ExportCSV exports a cost database table as CSV (UTF-8 BOM). kind is one of:
// "items", "labor", "material", "machine", "regions".
func (db *CostDB) ExportCSV(kind string) ([]byte, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	switch kind {
	case "items":
		return exportItemsCSV(db.Items)
	case "labor":
		return exportLaborCSV(db.Labor)
	case "material":
		return exportMaterialCSV(db.Materials)
	case "machine":
		return exportMachineCSV(db.Machines)
	case "regions":
		return exportRegionsCSV(db.Regions)
	default:
		return nil, fmt.Errorf("未知导出类型: %s", kind)
	}
}

func exportItemsCSV(items []CostItem) ([]byte, error) {
	var buf bytes.Buffer
	buf.Write([]byte{0xEF, 0xBB, 0xBF}) // UTF-8 BOM
	w := csv.NewWriter(&buf)
	w.Write([]string{"编码", "名称", "分类", "单位", "基价", "人工费", "材料费", "机械费", "间接费率%", "利润率%", "税率%", "损耗系数", "来源", "置信度", "地区", "生效日期", "失效日期", "备注"})
	for _, it := range items {
		w.Write([]string{
			it.Code, it.Name, it.Category, it.Unit,
			f64s(it.BasePrice), f64s(it.LaborCost), f64s(it.MaterialCost), f64s(it.MachineCost),
			f64s(it.OverheadRate), f64s(it.ProfitRate), f64s(it.TaxRate), f64s(it.WasteFactor),
			it.Source, f64s(it.Confidence), it.Region, it.ValidFrom, it.ValidTo, it.Remark,
		})
	}
	w.Flush()
	return buf.Bytes(), w.Error()
}

func exportLaborCSV(labor []LaborItem) ([]byte, error) {
	var buf bytes.Buffer
	buf.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(&buf)
	w.Write([]string{"工种", "单位", "单价", "地区", "日期", "来源"})
	for _, l := range labor {
		w.Write([]string{l.TradeType, l.Unit, f64s(l.Price), l.Region, l.PriceDate, l.Source})
	}
	w.Flush()
	return buf.Bytes(), w.Error()
}

func exportMaterialCSV(materials []MaterialItem) ([]byte, error) {
	var buf bytes.Buffer
	buf.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(&buf)
	w.Write([]string{"编码", "名称规格", "单位", "单价", "来源", "日期", "地区"})
	for _, m := range materials {
		w.Write([]string{m.Code, m.NameSpec, m.Unit, f64s(m.Price), m.Source, m.PriceDate, m.Region})
	}
	w.Flush()
	return buf.Bytes(), w.Error()
}

func exportMachineCSV(machines []MachineItem) ([]byte, error) {
	var buf bytes.Buffer
	buf.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(&buf)
	w.Write([]string{"编码", "名称规格", "单位", "购置价", "小时费率", "燃油费", "人工费", "地区"})
	for _, m := range machines {
		w.Write([]string{m.Code, m.NameSpec, m.Unit, f64s(m.PurchasePrice), f64s(m.HourlyRate), f64s(m.FuelRate), f64s(m.OperatorLabor), m.Region})
	}
	w.Flush()
	return buf.Bytes(), w.Error()
}

func exportRegionsCSV(regions []RegionFactor) ([]byte, error) {
	var buf bytes.Buffer
	buf.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(&buf)
	w.Write([]string{"地区", "调整系数", "生效日期"})
	for _, r := range regions {
		w.Write([]string{r.Region, f64s(r.AdjustmentFactor), r.ValidFrom})
	}
	w.Flush()
	return buf.Bytes(), w.Error()
}

// f64s formats a float64 as a string (always uses a dot, not a comma).
func f64s(v float64) string {
	return strconv.FormatFloat(v, 'f', -1, 64)
}

// ── CSV 导入 ──────────────────────────────────────────────────────────────

// ImportSummary describes the result of a CSV import operation.
type ImportSummary struct {
	Added   int      `json:"added"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}

// ImportCSV imports data from CSV bytes into the database. kind is one of:
// "items", "labor", "material", "machine", "regions". Returns the import summary.
func (db *CostDB) ImportCSV(kind string, data []byte) (*ImportSummary, error) {
	switch kind {
	case "items":
		return db.importItemsCSV(data)
	case "labor":
		return db.importLaborCSV(data)
	case "material":
		return db.importMaterialCSV(data)
	case "machine":
		return db.importMachineCSV(data)
	case "regions":
		return db.importRegionsCSV(data)
	default:
		return nil, fmt.Errorf("未知导入类型: %s", kind)
	}
}

func (db *CostDB) importItemsCSV(data []byte) (*ImportSummary, error) {
	rows, err := parseCSV(data)
	if err != nil {
		return nil, err
	}
	if len(rows) < 2 {
		return &ImportSummary{}, nil // header only
	}

	summary := &ImportSummary{}
	var added []CostItem

	db.mu.RLock()
	for i, row := range rows[1:] { // skip header
		if len(row) < 2 {
			summary.Errors = append(summary.Errors, fmt.Sprintf("第%d行: 列数不足", i+2))
			continue
		}
		code := strings.TrimSpace(row[0])
		if code == "" {
			summary.Errors = append(summary.Errors, fmt.Sprintf("第%d行: 编码为空", i+2))
			continue
		}
		if db.findItemByCode(code) != nil {
			summary.Skipped++
			continue
		}
		item := CostItem{
			Code: code,
			Name: strings.TrimSpace(row[1]),
		}
		if len(row) > 2 {
			item.Category = strings.TrimSpace(row[2])
		}
		if len(row) > 3 {
			item.Unit = strings.TrimSpace(row[3])
		}
		if len(row) > 4 {
			item.BasePrice = parseF64(row[4])
		}
		if len(row) > 5 {
			item.LaborCost = parseF64(row[5])
		}
		if len(row) > 6 {
			item.MaterialCost = parseF64(row[6])
		}
		if len(row) > 7 {
			item.MachineCost = parseF64(row[7])
		}
		if len(row) > 8 {
			item.OverheadRate = parseF64(row[8])
		}
		if len(row) > 9 {
			item.ProfitRate = parseF64(row[9])
		}
		if len(row) > 10 {
			item.TaxRate = parseF64(row[10])
		}
		if len(row) > 11 {
			item.WasteFactor = parseF64(row[11])
		}
		if len(row) > 12 {
			item.Source = strings.TrimSpace(row[12])
		}
		if len(row) > 13 {
			item.Confidence = parseF64(row[13])
		}
		if len(row) > 14 {
			item.Region = strings.TrimSpace(row[14])
		}
		if len(row) > 15 {
			item.ValidFrom = strings.TrimSpace(row[15])
		}
		if len(row) > 16 {
			item.ValidTo = strings.TrimSpace(row[16])
		}
		if len(row) > 17 {
			item.Remark = strings.TrimSpace(row[17])
		}
		added = append(added, item)
	}
	db.mu.RUnlock()

	if len(added) > 0 {
		db.mu.Lock()
		start := len(db.Items)
		db.Items = append(db.Items, added...)
		for j, it := range added {
			db.itemIndex[it.Code] = start + j
		}
		db.mu.Unlock()
		if err := db.Save(); err != nil {
			return nil, fmt.Errorf("保存失败: %w", err)
		}
	}
	summary.Added = len(added)
	return summary, nil
}

func (db *CostDB) importLaborCSV(data []byte) (*ImportSummary, error) {
	rows, err := parseCSV(data)
	if err != nil {
		return nil, err
	}
	if len(rows) < 2 {
		return &ImportSummary{}, nil
	}

	summary := &ImportSummary{}
	var added []LaborItem

	db.mu.RLock()
	for i, row := range rows[1:] {
		if len(row) < 3 {
			summary.Errors = append(summary.Errors, fmt.Sprintf("第%d行: 列数不足", i+2))
			continue
		}
		trade := strings.TrimSpace(row[0])
		if trade == "" {
			summary.Errors = append(summary.Errors, fmt.Sprintf("第%d行: 工种为空", i+2))
			continue
		}
		if db.findLaborByTrade(trade) != nil {
			summary.Skipped++
			continue
		}
		item := LaborItem{
			TradeType: trade,
			Unit:      strings.TrimSpace(row[1]),
			Price:     parseF64(row[2]),
		}
		if len(row) > 3 {
			item.Region = strings.TrimSpace(row[3])
		}
		if len(row) > 4 {
			item.PriceDate = strings.TrimSpace(row[4])
		}
		if len(row) > 5 {
			item.Source = strings.TrimSpace(row[5])
		}
		added = append(added, item)
	}
	db.mu.RUnlock()

	if len(added) > 0 {
		db.mu.Lock()
		start := len(db.Labor)
		db.Labor = append(db.Labor, added...)
		for j, l := range added {
			db.laborIndex[l.TradeType] = start + j
		}
		db.mu.Unlock()
		if err := db.Save(); err != nil {
			return nil, fmt.Errorf("保存失败: %w", err)
		}
	}
	summary.Added = len(added)
	return summary, nil
}

func (db *CostDB) importMaterialCSV(data []byte) (*ImportSummary, error) {
	rows, err := parseCSV(data)
	if err != nil {
		return nil, err
	}
	if len(rows) < 2 {
		return &ImportSummary{}, nil
	}

	summary := &ImportSummary{}
	var added []MaterialItem

	db.mu.RLock()
	for i, row := range rows[1:] {
		if len(row) < 4 {
			summary.Errors = append(summary.Errors, fmt.Sprintf("第%d行: 列数不足", i+2))
			continue
		}
		code := strings.TrimSpace(row[0])
		if code == "" {
			summary.Errors = append(summary.Errors, fmt.Sprintf("第%d行: 编码为空", i+2))
			continue
		}
		if db.findMaterialByCode(code) != nil {
			summary.Skipped++
			continue
		}
		item := MaterialItem{
			Code:     code,
			NameSpec: strings.TrimSpace(row[1]),
			Unit:     strings.TrimSpace(row[2]),
			Price:    parseF64(row[3]),
		}
		if len(row) > 4 {
			item.Source = strings.TrimSpace(row[4])
		}
		if len(row) > 5 {
			item.PriceDate = strings.TrimSpace(row[5])
		}
		if len(row) > 6 {
			item.Region = strings.TrimSpace(row[6])
		}
		added = append(added, item)
	}
	db.mu.RUnlock()

	if len(added) > 0 {
		db.mu.Lock()
		start := len(db.Materials)
		db.Materials = append(db.Materials, added...)
		for j, m := range added {
			db.materialIndex[m.Code] = start + j
		}
		db.mu.Unlock()
		if err := db.Save(); err != nil {
			return nil, fmt.Errorf("保存失败: %w", err)
		}
	}
	summary.Added = len(added)
	return summary, nil
}

func (db *CostDB) importMachineCSV(data []byte) (*ImportSummary, error) {
	rows, err := parseCSV(data)
	if err != nil {
		return nil, err
	}
	if len(rows) < 2 {
		return &ImportSummary{}, nil
	}

	summary := &ImportSummary{}
	var added []MachineItem

	db.mu.RLock()
	for i, row := range rows[1:] {
		if len(row) < 2 {
			summary.Errors = append(summary.Errors, fmt.Sprintf("第%d行: 列数不足", i+2))
			continue
		}
		code := strings.TrimSpace(row[0])
		if code == "" {
			summary.Errors = append(summary.Errors, fmt.Sprintf("第%d行: 编码为空", i+2))
			continue
		}
		if db.findMachineByCode(code) != nil {
			summary.Skipped++
			continue
		}
		item := MachineItem{
			Code:     code,
			NameSpec: strings.TrimSpace(row[1]),
			Unit:     strings.TrimSpace(row[2]),
		}
		if len(row) > 3 {
			item.PurchasePrice = parseF64(row[3])
		}
		if len(row) > 4 {
			item.HourlyRate = parseF64(row[4])
		}
		if len(row) > 5 {
			item.FuelRate = parseF64(row[5])
		}
		if len(row) > 6 {
			item.OperatorLabor = parseF64(row[6])
		}
		if len(row) > 7 {
			item.Region = strings.TrimSpace(row[7])
		}
		added = append(added, item)
	}
	db.mu.RUnlock()

	if len(added) > 0 {
		db.mu.Lock()
		start := len(db.Machines)
		db.Machines = append(db.Machines, added...)
		for j, m := range added {
			db.machineIndex[m.Code] = start + j
		}
		db.mu.Unlock()
		if err := db.Save(); err != nil {
			return nil, fmt.Errorf("保存失败: %w", err)
		}
	}
	summary.Added = len(added)
	return summary, nil
}

func (db *CostDB) importRegionsCSV(data []byte) (*ImportSummary, error) {
	rows, err := parseCSV(data)
	if err != nil {
		return nil, err
	}
	if len(rows) < 2 {
		return &ImportSummary{}, nil
	}

	summary := &ImportSummary{}
	var added []RegionFactor

	db.mu.RLock()
	for i, row := range rows[1:] {
		if len(row) < 2 {
			summary.Errors = append(summary.Errors, fmt.Sprintf("第%d行: 列数不足", i+2))
			continue
		}
		region := strings.TrimSpace(row[0])
		if region == "" {
			summary.Errors = append(summary.Errors, fmt.Sprintf("第%d行: 地区为空", i+2))
			continue
		}
		if db.findRegionByName(region) != nil {
			summary.Skipped++
			continue
		}
		item := RegionFactor{
			Region:           region,
			AdjustmentFactor: parseF64(row[1]),
		}
		if len(row) > 2 {
			item.ValidFrom = strings.TrimSpace(row[2])
		}
		added = append(added, item)
	}
	db.mu.RUnlock()

	if len(added) > 0 {
		db.mu.Lock()
		start := len(db.Regions)
		db.Regions = append(db.Regions, added...)
		for j, r := range added {
			db.regionIndex[r.Region] = start + j
		}
		db.mu.Unlock()
		if err := db.Save(); err != nil {
			return nil, fmt.Errorf("保存失败: %w", err)
		}
	}
	summary.Added = len(added)
	return summary, nil
}

// parseCSV parses CSV bytes, stripping the UTF-8 BOM if present.
func parseCSV(data []byte) ([][]string, error) {
	if len(data) >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
		data = data[3:]
	}
	r := csv.NewReader(bytes.NewReader(data))
	r.LazyQuotes = true
	r.FieldsPerRecord = -1 // allow variable number of fields
	rows, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("CSV解析失败: %w", err)
	}
	return rows, nil
}

// parseF64 parses a float64 from a string. Returns 0 on failure.
func parseF64(s string) float64 {
	v, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0
	}
	return v
}

// findItemByCode returns the existing cost item by code, or nil.
func (db *CostDB) findItemByCode(code string) *CostItem {
	idx, ok := db.itemIndex[code]
	if !ok {
		return nil
	}
	return &db.Items[idx]
}

// findLaborByTrade returns the existing labor item by trade type, or nil.
func (db *CostDB) findLaborByTrade(trade string) *LaborItem {
	idx, ok := db.laborIndex[trade]
	if !ok {
		return nil
	}
	return &db.Labor[idx]
}

// findMaterialByCode returns the existing material item by code, or nil.
func (db *CostDB) findMaterialByCode(code string) *MaterialItem {
	idx, ok := db.materialIndex[code]
	if !ok {
		return nil
	}
	return &db.Materials[idx]
}

// findMachineByCode returns the existing machine item by code, or nil.
func (db *CostDB) findMachineByCode(code string) *MachineItem {
	idx, ok := db.machineIndex[code]
	if !ok {
		return nil
	}
	return &db.Machines[idx]
}

// findRegionByName returns the existing region factor by name, or nil.
func (db *CostDB) findRegionByName(region string) *RegionFactor {
	idx, ok := db.regionIndex[region]
	if !ok {
		return nil
	}
	return &db.Regions[idx]
}
