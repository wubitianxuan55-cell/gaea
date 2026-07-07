package builtin

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"

	"gaeaW/internal/tool"
)

func init() { tool.RegisterBuiltin(csvParse{}) }

// csvParse parses a CSV file and returns structured JSON with headers, rows, and basic statistics.
type csvParse struct{}

func (csvParse) Name() string { return "csv_parse" }

func (csvParse) Description() string {
	return "解析CSV文件，返回结构化JSON（表头+行数据+列统计）。支持自定义分隔符和表头选项。"
}

func (csvParse) Schema() json.RawMessage {
	return json.RawMessage(`{
"type":"object",
"properties":{
  "path":{"type":"string","description":"CSV文件路径"},
  "delimiter":{"type":"string","description":"列分隔符，默认逗号(,)"},
  "has_header":{"type":"boolean","description":"文件第一行是否为表头（默认true）"}
},
"required":["path"]
}`)
}

func (csvParse) ReadOnly() bool { return true }

func (csvParse) CompactDescription() string { return compactDesc["csv_parse"] }
func (csvParse) CompactSchema() json.RawMessage   { return compactSchema["csv_parse"] }

type csvResult struct {
	Headers  []string           `json:"headers,omitempty"`
	Rows     [][]string         `json:"rows"`
	RowCount int                `json:"row_count"`
	ColCount int                `json:"col_count"`
	Stats    map[string]colStat `json:"stats,omitempty"`
}

type colStat struct {
	Type    string   `json:"type"`
	Count   int      `json:"count"`
	NonNull int      `json:"non_null"`
	Min     *float64 `json:"min,omitempty"`
	Max     *float64 `json:"max,omitempty"`
	Mean    *float64 `json:"mean,omitempty"`
	StdDev  *float64 `json:"std_dev,omitempty"`
}

func (csvParse) Execute(ctx context.Context, args json.RawMessage) (string, error) {
	var p struct {
		Path      string `json:"path"`
		Delimiter string `json:"delimiter,omitempty"`
		HasHeader *bool  `json:"has_header,omitempty"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return "", fmt.Errorf("invalid args: %w", err)
	}
	if p.Path == "" {
		return "", fmt.Errorf("path is required")
	}

	delim := ','
	if p.Delimiter != "" {
		runes := []rune(p.Delimiter)
		if len(runes) != 1 {
			return "", fmt.Errorf("delimiter must be a single character")
		}
		delim = runes[0]
	}

	hasHeader := true
	if p.HasHeader != nil {
		hasHeader = *p.HasHeader
	}

	f, err := os.Open(p.Path)
	if err != nil {
		return "", fmt.Errorf("open %s: %w", p.Path, err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.Comma = delim
	r.LazyQuotes = true
	r.FieldsPerRecord = -1 // allow variable number of fields

	allRows, err := r.ReadAll()
	if err != nil {
		return "", fmt.Errorf("read csv %s: %w", p.Path, err)
	}
	if len(allRows) == 0 {
		return `{"rows":[],"row_count":0,"col_count":0}`, nil
	}

	var headers []string
	var dataRows [][]string
	if hasHeader {
		headers = allRows[0]
		dataRows = allRows[1:]
	} else {
		dataRows = allRows
	}

	colCount := 0
	for _, row := range dataRows {
		if len(row) > colCount {
			colCount = len(row)
		}
	}

	// Compute per-column statistics
	stats := make(map[string]colStat)
	if colCount > 0 {
		for ci := 0; ci < colCount; ci++ {
			colName := fmt.Sprintf("col_%d", ci)
			if ci < len(headers) {
				colName = headers[ci]
			}
			cs := colStat{Count: len(dataRows)}
			var nums []float64
			for _, row := range dataRows {
				if ci < len(row) {
					val := strings.TrimSpace(row[ci])
					if val != "" {
						cs.NonNull++
						if n, err := strconv.ParseFloat(val, 64); err == nil {
							nums = append(nums, n)
						}
					}
				}
			}
			if len(nums) > 0 {
				cs.Type = "numeric"
				min, max := nums[0], nums[0]
				sum := 0.0
				for _, n := range nums {
					if n < min {
						min = n
					}
					if n > max {
						max = n
					}
					sum += n
				}
				mean := sum / float64(len(nums))
				cs.Min = &min
				cs.Max = &max
				cs.Mean = &mean
				if len(nums) > 1 {
					var sqSum float64
					for _, n := range nums {
						d := n - mean
						sqSum += d * d
					}
					std := math.Sqrt(sqSum / float64(len(nums)))
					cs.StdDev = &std
				}
			} else {
				cs.Type = "string"
			}
			stats[colName] = cs
		}
	}

	res := csvResult{
		Headers:  headers,
		Rows:     dataRows,
		RowCount: len(dataRows),
		ColCount: colCount,
		Stats:    stats,
	}

	out, err := json.MarshalIndent(res, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshal result: %w", err)
	}
	return string(out), nil
}
