// Package costdb provides a cost database for engineering project estimation.
// Data is stored in JSON files and includes cost items, labor rates, material
// prices, machine rates, and regional adjustment factors.
package costdb

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
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
	return db, nil
}

// loadSeed creates a CostDB from the embedded seed data.
func loadSeed() (*CostDB, error) {
	db := &CostDB{}
	if err := json.Unmarshal(seedData, db); err != nil {
		return nil, fmt.Errorf("seed parse: %w", err)
	}
	return db, nil
}

// Save writes the database to its file path atomically (write tmp + rename).
func (db *CostDB) Save() error {
	db.mu.RLock()
	defer db.mu.RUnlock()

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

	for _, rf := range db.Regions {
		if rf.Region == region {
			return rf.AdjustmentFactor
		}
	}
	return 1.0
}

// Add appends a cost item and saves the database.
func (db *CostDB) Add(item CostItem) error {
	db.mu.Lock()
	db.Items = append(db.Items, item)
	db.mu.Unlock()

	return db.Save()
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
