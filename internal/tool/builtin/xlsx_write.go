package builtin

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"gaeaW/internal/tool"
)

func init() { tool.RegisterBuiltin(xlsxWrite{}) }

type xlsxWrite struct{}

func (xlsxWrite) Name() string { return "xlsx_write" }

func (xlsxWrite) Description() string {
	return "创建 Excel (.xlsx) 文件：输入表头和数据行，输出 xlsx 文件到指定路径。生成的 xlsx 兼容 Excel 和 WPS。"
}

func (xlsxWrite) Schema() json.RawMessage {
	return json.RawMessage(`{
"type":"object",
"properties":{
  "path":{"type":"string","description":"输出文件路径（.xlsx）"},
  "sheet_name":{"type":"string","description":"工作表名称","default":"Sheet1"},
  "headers":{"type":"array","items":{"type":"string"},"description":"表头行"},
  "rows":{"type":"array","items":{"type":"array","items":{"type":"string"}},"description":"数据行"}
},
"required":["path","rows"]
}`)
}

func (xlsxWrite) ReadOnly() bool { return false }

func (xlsxWrite) CompactDescription() string { return compactDesc["xlsx_write"] }
func (xlsxWrite) CompactSchema() json.RawMessage   { return compactSchema["xlsx_write"] }

func (xlsxWrite) Execute(ctx context.Context, args json.RawMessage) (string, error) {
	var p struct {
		Path      string     `json:"path"`
		SheetName string     `json:"sheet_name,omitempty"`
		Headers   []string   `json:"headers,omitempty"`
		Rows      [][]string `json:"rows"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return "", fmt.Errorf("参数无效: %w", err)
	}
	if p.Path == "" {
		return "", fmt.Errorf("path 不能为空")
	}
	if p.SheetName == "" {
		p.SheetName = "Sheet1"
	}

	allRows := p.Rows
	if len(p.Headers) > 0 {
		allRows = append([][]string{p.Headers}, allRows...)
	}

	maxCols := 0
	for _, row := range allRows {
		if len(row) > maxCols {
			maxCols = len(row)
		}
	}
	if maxCols == 0 {
		return "", fmt.Errorf("没有数据")
	}
	// 补全短行
	for i, row := range allRows {
		for len(row) < maxCols {
			row = append(row, "")
		}
		allRows[i] = row
	}

	// 用col字母生成表头引用
	colLetters := make([]string, maxCols)
	for i := 0; i < maxCols; i++ {
		colLetters[i] = colLetter(i)
	}

	// 生成 sheet XML
	var sheetXML bytes.Buffer
	sheetXML.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` + "\n")
	sheetXML.WriteString(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` + "\n")
	sheetXML.WriteString(`<sheetData>` + "\n")

	for ri, row := range allRows {
		sheetXML.WriteString(fmt.Sprintf(`<row r="%d">`, ri+1))
		for ci, val := range row {
			ref := fmt.Sprintf("%s%d", colLetters[ci], ri+1)
			escaped := xmlEscape(val)
			if val == "" {
				sheetXML.WriteString(fmt.Sprintf(`<c r="%s" t="inlineStr"><is><t></t></is></c>`, ref))
			} else {
				sheetXML.WriteString(fmt.Sprintf(`<c r="%s" t="inlineStr"><is><t>%s</t></is></c>`, ref, escaped))
			}
		}
		sheetXML.WriteString(`</row>` + "\n")
	}
	sheetXML.WriteString(`</sheetData>` + "\n")
	sheetXML.WriteString(`</worksheet>` + "\n")

	// 生成 sharedStrings（不使用，改用 inlineStr）
	// 生成 styles
	stylesXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>`

	// 生成 workbook
	workbookXML := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheets><sheet name="%s" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets>
</workbook>`, xmlEscape(p.SheetName))

	// 生成 relationships
	relsXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

	// 生成 [Content_Types].xml
	contentTypesXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

	// 创建 ZIP 文件
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)

	writeZipEntry(w, "[Content_Types].xml", contentTypesXML)
	writeZipEntry(w, "_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`)
	writeZipEntry(w, "xl/_rels/workbook.xml.rels", relsXML)
	writeZipEntry(w, "xl/workbook.xml", workbookXML)
	writeZipEntry(w, "xl/styles.xml", stylesXML)
	writeZipEntry(w, "xl/worksheets/sheet1.xml", sheetXML.String())

	w.Close()

	if err := os.WriteFile(p.Path, buf.Bytes(), 0644); err != nil {
		return "", fmt.Errorf("写入文件失败: %w", err)
	}

	return tool.WrapText(fmt.Sprintf("已创建 xlsx 文件：%s（%d 行 %d 列）", p.Path, len(p.Rows), maxCols)), nil
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
