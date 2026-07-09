package builtin

import (
	"archive/zip"
	"bytes"
	"fmt"
	"os"
	"strings"
)

// writeDocxFile 生成一个简单的 .docx 文件，包含标题和正文。
// 正文中的 #/##/### 会被转为 Word 标题样式，空行为段落分隔。
func writeDocxFile(path, title, content string) error {
	var docXML bytes.Buffer
	docXML.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` + "\n")
	docXML.WriteString(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` + "\n")
	docXML.WriteString(`<w:body>` + "\n")

	// 标题
	if title != "" {
		docXML.WriteString(`<w:p><w:pPr><w:pStyle w:val="Title"/><w:jc w:val="center"/></w:pPr>`)
		docXML.WriteString(fmt.Sprintf(`<w:r><w:t>%s</w:t></w:r>`, xmlEscape(title)))
		docXML.WriteString(`</w:p>` + "\n")
	}

	// 正文行
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			docXML.WriteString(`<w:p/>` + "\n")
			continue
		}
		switch {
		case strings.HasPrefix(trimmed, "### "):
			text := strings.TrimPrefix(trimmed, "### ")
			docXML.WriteString(`<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>`)
			docXML.WriteString(fmt.Sprintf(`<w:r><w:t>%s</w:t></w:r>`, xmlEscape(text)))
			docXML.WriteString(`</w:p>` + "\n")
		case strings.HasPrefix(trimmed, "## "):
			text := strings.TrimPrefix(trimmed, "## ")
			docXML.WriteString(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>`)
			docXML.WriteString(fmt.Sprintf(`<w:r><w:t>%s</w:t></w:r>`, xmlEscape(text)))
			docXML.WriteString(`</w:p>` + "\n")
		case strings.HasPrefix(trimmed, "# "):
			text := strings.TrimPrefix(trimmed, "# ")
			docXML.WriteString(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>`)
			docXML.WriteString(fmt.Sprintf(`<w:r><w:t>%s</w:t></w:r>`, xmlEscape(text)))
			docXML.WriteString(`</w:p>` + "\n")
		default:
			docXML.WriteString(`<w:p>`)
			docXML.WriteString(fmt.Sprintf(`<w:r><w:t>%s</w:t></w:r>`, xmlEscape(trimmed)))
			docXML.WriteString(`</w:p>` + "\n")
		}
	}

	docXML.WriteString(`</w:body>` + "\n")
	docXML.WriteString(`</w:document>` + "\n")

	// 创建 ZIP
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	writeZipEntry(zw, "[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`)

	writeZipEntry(zw, "_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)

	writeZipEntry(zw, "word/document.xml", docXML.String())
	writeZipEntry(zw, "word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`)
	writeZipEntry(zw, "word/styles.xml", docxStyles)
	writeZipEntry(zw, "word/numbering.xml", docxNumbering)

	zw.Close()
	return os.WriteFile(path, buf.Bytes(), 0644)
}
