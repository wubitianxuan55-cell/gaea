package builtin

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"gaeaW/internal/tool"
)

func init() { tool.RegisterBuiltin(xlsxWrite{}) }

type xlsxWrite struct{}

func (xlsxWrite) Name() string { return "xlsx_write" }

func (xlsxWrite) Description() string {
	return "创建 Excel (.xlsx) 文件：支持表头/数据行、多工作表、公式(=开头的单元格自动识别)、数值类型自动检测。兼容 Excel 和 WPS。"
}

func (xlsxWrite) Schema() json.RawMessage {
	return json.RawMessage(`{
"type":"object",
"properties":{
  "path":{"type":"string","description":"输出文件路径（.xlsx）"},
  "sheet_name":{"type":"string","description":"工作表名称（默认 Sheet1，仅单表时生效）"},
  "headers":{"type":"array","items":{"type":"string"},"description":"表头行"},
  "rows":{"type":"array","items":{"type":"array","items":{"type":"string"}},"description":"数据行（=开头的值自动识别为公式）"},
  "sheets":{"type":"array","items":{"type":"object","properties":{
    "name":{"type":"string","description":"工作表名称"},
    "headers":{"type":"array","items":{"type":"string"},"description":"表头行"},
    "rows":{"type":"array","items":{"type":"array","items":{"type":"string"}},"description":"数据行"}
  }},"description":"多工作表（替代单表参数）"}
},
"anyOf":[{"required":["path","rows"]},{"required":["path","sheets"]}]
}`)
}

func (xlsxWrite) ReadOnly() bool { return false }

func (xlsxWrite) CompactDescription() string { return compactDesc["xlsx_write"] }
func (xlsxWrite) CompactSchema() json.RawMessage   { return compactSchema["xlsx_write"] }

// xlsxSheet 定义单个工作表
type xlsxSheet struct {
	Name    string     `json:"name"`
	Headers []string   `json:"headers,omitempty"`
	Rows    [][]string `json:"rows"`
}

func (xlsxWrite) Execute(ctx context.Context, args json.RawMessage) (string, error) {
	var p struct {
		Path      string      `json:"path"`
		SheetName string      `json:"sheet_name,omitempty"`
		Headers   []string    `json:"headers,omitempty"`
		Rows      [][]string  `json:"rows,omitempty"`
		Sheets    []xlsxSheet `json:"sheets,omitempty"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return "", fmt.Errorf("参数无效: %w", err)
	}
	if p.Path == "" {
		return "", fmt.Errorf("path 不能为空")
	}
	if !strings.HasSuffix(strings.ToLower(p.Path), ".xlsx") {
		return "", fmt.Errorf("path 必须以 .xlsx 结尾")
	}

	// 构建 sheets 列表
	var sheets []xlsxSheet
	if len(p.Sheets) > 0 {
		sheets = p.Sheets
		for i := range sheets {
			if sheets[i].Name == "" {
				sheets[i].Name = fmt.Sprintf("Sheet%d", i+1)
			}
		}
	} else if len(p.Rows) > 0 {
		name := p.SheetName
		if name == "" {
			name = "Sheet1"
		}
		sheets = []xlsxSheet{{Name: name, Headers: p.Headers, Rows: p.Rows}}
	} else {
		return "", fmt.Errorf("必须提供 rows 或 sheets 参数")
	}

	// 生成 ZIP
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)

	n := len(sheets)

	// [Content_Types].xml
	var ct strings.Builder
	ct.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`)
	for i := 0; i < n; i++ {
		ct.WriteString(fmt.Sprintf(`<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`, i+1))
	}
	ct.WriteString(`<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`)
	writeZipEntry(w, "[Content_Types].xml", ct.String())

	// _rels/.rels
	writeZipEntry(w, "_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`)

	// xl/_rels/workbook.xml.rels
	var rels strings.Builder
	rels.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`)
	for i := 0; i < n; i++ {
		rels.WriteString(fmt.Sprintf(`<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet%d.xml"/>`, i*2+1, i+1))
	}
	rels.WriteString(fmt.Sprintf(`<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`, n*2+1))
	rels.WriteString("\n</Relationships>")
	writeZipEntry(w, "xl/_rels/workbook.xml.rels", rels.String())

	// xl/workbook.xml
	var wb strings.Builder
	wb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>`)
	for i, s := range sheets {
		wb.WriteString(fmt.Sprintf(`<sheet name="%s" sheetId="%d" r:id="rId%d"/>`, xmlEscape(s.Name), i+1, i*2+1))
	}
	wb.WriteString("</sheets>\n</workbook>")
	writeZipEntry(w, "xl/workbook.xml", wb.String())

	// xl/styles.xml
	writeZipEntry(w, "xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
</styleSheet>`)

	// 写入每个工作表
	maxColsAll := 0
	for si, sheet := range sheets {
		allRows := sheet.Rows
		if len(sheet.Headers) > 0 {
			allRows = append([][]string{sheet.Headers}, allRows...)
		}

		maxCols := 0
		for _, row := range allRows {
			if len(row) > maxCols {
				maxCols = len(row)
			}
		}
		if maxCols == 0 {
			continue
		}
		if maxCols > maxColsAll {
			maxColsAll = maxCols
		}

		// 补全短行
		for i, row := range allRows {
			for len(row) < maxCols {
				row = append(row, "")
			}
			allRows[i] = row
		}

		// 生成 sheet XML
		var sx strings.Builder
		sx.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` + "\n")
		sx.WriteString(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` + "\n")

		// 列宽
		sx.WriteString("<cols>\n")
		for ci := 0; ci < maxCols; ci++ {
			col := colLetter(ci)
			sx.WriteString(fmt.Sprintf(`<col min="%d" max="%d" width="%d" customWidth="1"/>`, ci+1, ci+1, 12))
			_ = col
		}
		sx.WriteString("</cols>\n")

		sx.WriteString("<sheetData>\n")
		for ri, row := range allRows {
			sx.WriteString(fmt.Sprintf(`<row r="%d">`, ri+1))
			for ci, val := range row {
				ref := fmt.Sprintf("%s%d", colLetter(ci), ri+1)
				val = strings.TrimSpace(val)
				if val == "" {
					sx.WriteString(fmt.Sprintf(`<c r="%s" t="inlineStr"><is><t></t></is></c>`, ref))
				} else if strings.HasPrefix(val, "=") {
					// 公式
					formula := val[1:]
					sx.WriteString(fmt.Sprintf(`<c r="%s"><f>%s</f></c>`, ref, xmlEscape(formula)))
				} else if isNumeric(val) {
					// 数值
					sx.WriteString(fmt.Sprintf(`<c r="%s" s="1"><v>%s</v></c>`, ref, val))
				} else {
					// 文本
					sx.WriteString(fmt.Sprintf(`<c r="%s" t="inlineStr"><is><t>%s</t></is></c>`, ref, xmlEscape(val)))
				}
			}
			sx.WriteString("</row>\n")
		}
		sx.WriteString("</sheetData>\n")
		sx.WriteString("</worksheet>\n")

		writeZipEntry(w, fmt.Sprintf("xl/worksheets/sheet%d.xml", si+1), sx.String())
	}

	w.Close()

	if err := os.WriteFile(p.Path, buf.Bytes(), 0644); err != nil {
		return "", fmt.Errorf("写入文件失败: %w", err)
	}

	sheetLabel := fmt.Sprintf("%d 个工作表", n)
	return tool.WrapText(fmt.Sprintf("已创建 xlsx 文件：%s（%s）", p.Path, sheetLabel)), nil
}

// isNumeric 判断字符串是否为数值
func isNumeric(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return false
	}
	// 去除千分位逗号
	s = strings.ReplaceAll(s, ",", "")
	_, err := strconv.ParseFloat(s, 64)
	return err == nil
}

func colLetter(i int) string {
	letters := "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	if i < 26 {
		return string(letters[i])
	}
	return colLetter(i/26-1) + string(letters[i%26])
}

func xmlEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	return s
}

func writeZipEntry(w *zip.Writer, name, content string) {
	f, _ := w.Create(name)
	f.Write([]byte(content))
}
