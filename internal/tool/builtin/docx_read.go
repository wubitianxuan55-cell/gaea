package builtin

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"strings"

	"gaeaW/internal/tool"
)

func init() { tool.RegisterBuiltin(docxRead{}) }

type docxRead struct{}

func (docxRead) Name() string { return "docx_read" }

func (docxRead) Description() string {
	return "读取 Word (.docx) 文件文本内容。docx 本质是 ZIP 包，解析其 XML 提取正文段落文本。"
}

func (docxRead) Schema() json.RawMessage {
	return json.RawMessage(`{
"type":"object",
"properties":{
  "path":{"type":"string","description":"docx文件路径"}
},
"required":["path"]
}`)
}

func (docxRead) ReadOnly() bool { return true }

func (docxRead) CompactDescription() string { return compactDesc["docx_read"] }
func (docxRead) CompactSchema() json.RawMessage   { return compactSchema["docx_read"] }

// docx XML 结构
type docxDocument struct {
	Body docxBody `xml:"body"`
}
type docxBody struct {
	Paragraphs []docxParagraph `xml:"p"`
}
type docxParagraph struct {
	Runs []docxRun `xml:"r"`
}
type docxRun struct {
	Text string `xml:"t"`
}

func (docxRead) Execute(ctx context.Context, args json.RawMessage) (string, error) {
	var p struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return "", fmt.Errorf("参数无效: %w", err)
	}
	if p.Path == "" {
		return "", fmt.Errorf("path 不能为空")
	}

	data, err := os.ReadFile(p.Path)
	if err != nil {
		return "", fmt.Errorf("读取文件失败: %w", err)
	}

	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("不是有效的 docx 文件: %w", err)
	}

	var docXML []byte
	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			rc, err := f.Open()
			if err != nil {
				return "", fmt.Errorf("打开 document.xml 失败: %w", err)
			}
			docXML, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return "", fmt.Errorf("读取 document.xml 失败: %w", err)
			}
			break
		}
	}
	if docXML == nil {
		return "", fmt.Errorf("未找到 word/document.xml（无效的 docx 文件）")
	}

	var doc docxDocument
	if err := xml.Unmarshal(docXML, &doc); err != nil {
		return "", fmt.Errorf("解析 document.xml 失败: %w", err)
	}

	var lines []string
	for _, p := range doc.Body.Paragraphs {
		var textParts []string
		for _, r := range p.Runs {
			textParts = append(textParts, r.Text)
		}
		line := strings.Join(textParts, "")
		if strings.TrimSpace(line) != "" {
			lines = append(lines, line)
		}
	}

	return tool.WrapText(strings.Join(lines, "\n")), nil
}

func init() { tool.RegisterBuiltin(docxWrite{}) }

type docxWrite struct{}

func (docxWrite) Name() string { return "docx_write" }

func (docxWrite) Description() string {
	return "创建 Word (.docx) 文件：输入文本内容（多行），生成简单的 docx 文件（标题+段落）。"
}

func (docxWrite) Schema() json.RawMessage {
	return json.RawMessage(`{
"type":"object",
"properties":{
  "path":{"type":"string","description":"输出文件路径"},
  "title":{"type":"string","description":"文档标题"},
  "content":{"type":"string","description":"文档正文（多行文本，空行分割段落）"}
},
"required":["path","content"]
}`)
}

func (docxWrite) ReadOnly() bool { return false }

func (docxWrite) CompactDescription() string { return compactDesc["docx_write"] }
func (docxWrite) CompactSchema() json.RawMessage   { return compactSchema["docx_write"] }

func (docxWrite) Execute(ctx context.Context, args json.RawMessage) (string, error) {
	var p struct {
		Path    string `json:"path"`
		Title   string `json:"title,omitempty"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return "", fmt.Errorf("参数无效: %w", err)
	}
	if p.Path == "" || p.Content == "" {
		return "", fmt.Errorf("path 和 content 不能为空")
	}

	paragraphs := strings.Split(p.Content, "\n\n")
	var docXML bytes.Buffer
	docXML.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` + "\n")
	docXML.WriteString(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` + "\n")
	docXML.WriteString(`<w:body>` + "\n")

	if p.Title != "" {
		docXML.WriteString(fmt.Sprintf(`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>%s</w:t></w:r></w:p>`+"\n", xmlEscape(p.Title)))
	}

	for _, para := range paragraphs {
		para = strings.TrimSpace(para)
		if para == "" {
			continue
		}
		docXML.WriteString(`<w:p>`)
		// 处理简单Markdown标题
		if strings.HasPrefix(para, "## ") {
			text := strings.TrimPrefix(para, "## ")
			docXML.WriteString(fmt.Sprintf(`<w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>%s</w:t></w:r>`, xmlEscape(text)))
		} else if strings.HasPrefix(para, "# ") {
			text := strings.TrimPrefix(para, "# ")
			docXML.WriteString(fmt.Sprintf(`<w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>%s</w:t></w:r>`, xmlEscape(text)))
		} else {
			docXML.WriteString(fmt.Sprintf(`<w:r><w:t>%s</w:t></w:r>`, xmlEscape(para)))
		}
		docXML.WriteString(`</w:p>` + "\n")
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
</Types>`)

	writeZipEntry(zw, "_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)

	writeZipEntry(zw, "word/document.xml", docXML.String())

	writeZipEntry(zw, "word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="48"/><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="360"/><w:spacing w:after="120"/></w:pPr><w:rPr><w:sz w:val="32"/><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:spacing w:before="240"/></w:pPr><w:rPr><w:sz w:val="28"/><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>`)

	zw.Close()

	if err := os.WriteFile(p.Path, buf.Bytes(), 0644); err != nil {
		return "", fmt.Errorf("写入文件失败: %w", err)
	}

	return tool.WrapText(fmt.Sprintf("已创建 docx 文件：%s", p.Path)), nil
}
