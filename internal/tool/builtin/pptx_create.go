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

func init() { tool.RegisterBuiltin(pptxCreate{}) }

type pptxCreate struct{}

func (pptxCreate) Name() string { return "pptx_create" }

func (pptxCreate) Description() string {
	return "创建 PPT 演示文稿 (.pptx) 文件：输入幻灯片 JSON 数组，每页含标题和正文，生成兼容 PowerPoint/WPS 的演示文稿。零外部依赖。"
}

func (pptxCreate) Schema() json.RawMessage {
	return json.RawMessage(`{
"type":"object",
"properties":{
  "path":{"type":"string","description":"输出文件路径（.pptx）"},
  "slides":{"type":"array","items":{"type":"object","properties":{
    "title":{"type":"string","description":"幻灯片标题"},
    "content":{"type":"array","items":{"type":"string"},"description":"正文要点列表"},
    "layout":{"type":"string","description":"布局：title（仅标题）/ content（标题+正文，默认）"}
  }},"description":"幻灯片数组"}
},
"required":["path","slides"]
}`)
}

func (pptxCreate) ReadOnly() bool { return false }

func (pptxCreate) CompactDescription() string { return compactDesc["pptx_create"] }
func (pptxCreate) CompactSchema() json.RawMessage   { return compactSchema["pptx_create"] }

type pptxSlide struct {
	Title   string   `json:"title"`
	Content []string `json:"content,omitempty"`
	Layout  string   `json:"layout,omitempty"` // "title" 或 "content"
}

func (pptxCreate) Execute(ctx context.Context, args json.RawMessage) (string, error) {
	var p struct {
		Path   string      `json:"path"`
		Slides []pptxSlide `json:"slides"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return "", fmt.Errorf("参数无效: %w", err)
	}
	if p.Path == "" || len(p.Slides) == 0 {
		return "", fmt.Errorf("path 和 slides 不能为空")
	}
	if !strings.HasSuffix(strings.ToLower(p.Path), ".pptx") {
		return "", fmt.Errorf("path 必须以 .pptx 结尾")
	}

	buf, err := buildPPTX(p.Slides)
	if err != nil {
		return "", fmt.Errorf("生成 PPTX 失败: %w", err)
	}
	if err := os.WriteFile(p.Path, buf, 0644); err != nil {
		return "", fmt.Errorf("写入文件失败: %w", err)
	}
	return tool.WrapText(fmt.Sprintf("已创建 PPTX 文件：%s（%d 张幻灯片）", p.Path, len(p.Slides))), nil
}

// --- OOXML PPTX 构建 ---

func buildPPTX(slides []pptxSlide) ([]byte, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	// 固定内容
	writeZipEntry(zw, "[Content_Types].xml", pptxContentTypes(len(slides)))
	writeZipEntry(zw, "_rels/.rels", pptxRels)
	writeZipEntry(zw, "ppt/presentation.xml", pptxPresentation(len(slides)))
	writeZipEntry(zw, "ppt/_rels/presentation.xml.rels", pptxPresRels(len(slides)))
	writeZipEntry(zw, "ppt/slideMasters/slideMaster1.xml", pptxSlideMaster)
	writeZipEntry(zw, "ppt/slideLayouts/slideLayout1.xml", pptxSlideLayout)
	writeZipEntry(zw, "ppt/slideLayouts/slideLayout2.xml", pptxTitleLayout)
	writeZipEntry(zw, "ppt/theme/theme1.xml", pptxTheme)

	// 写每张幻灯片
	for i, slide := range slides {
		slideNum := i + 1
		layoutID := 2 // slideLayout2 = 标题布局
		if len(slide.Content) > 0 || slide.Layout == "content" {
			layoutID = 1 // slideLayout1 = 内容布局
		}
		writeZipEntry(zw, fmt.Sprintf("ppt/slides/slide%d.xml", slideNum),
			pptxSlideXML(slide, layoutID))
		writeZipEntry(zw, fmt.Sprintf("ppt/slides/_rels/slide%d.xml.rels", slideNum),
			fmt.Sprintf(pptxSlideRels, layoutID))
	}

	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("关闭 ZIP 失败: %w", err)
	}
	return buf.Bytes(), nil
}

// --- XML 模板 ---

const pptxRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`

func pptxContentTypes(n int) string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>`)
	for i := 1; i <= n; i++ {
		b.WriteString(fmt.Sprintf(`<Override PartName="/ppt/slides/slide%d.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`, i))
	}
	b.WriteString("\n</Types>")
	return b.String()
}

func pptxPresentation(n int) string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></p:sldMasterIdLst>
<p:sldIdLst>`)
	for i := 1; i <= n; i++ {
		b.WriteString(fmt.Sprintf(`<p:sldId id="%d" r:id="rId%d"/>`, 256+i, i+1))
	}
	b.WriteString(`</p:sldIdLst>
<p:sldSz cx="9144000" cy="6858000"/>
<p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`)
	return b.String()
}

func pptxPresRels(n int) string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`)
	for i := 1; i <= n; i++ {
		b.WriteString(fmt.Sprintf(`<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide%d.xml"/>`, i+1, i))
	}
	b.WriteString("\n</Relationships>")
	return b.String()
}

const pptxSlideMaster = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:cSld><p:spTree><p:nvGrpSpPr><p:nvPr/><p:cNvPr id="1" name=""/><p:nvGrpSpPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
<p:sldLayoutIdLst>
<p:sldLayoutId id="2147483649" r:id="rId2"/>
<p:sldLayoutId id="2147483650" r:id="rId3"/>
</p:sldLayoutIdLst>
</p:sldMaster>`

const pptxSlideLayout = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" type="obj">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:nvPr><p:extLst/></p:nvPr><p:cNvPr id="1" name=""/><p:nvGrpSpPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="2800" b="1"/><a:t>标题占位符</a:t></a:r><a:endParaRPr/></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="body" sz="half"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1800"/><a:t>正文占位符</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`

const pptxTitleLayout = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" type="title">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:nvPr><p:extLst/></p:nvPr><p:cNvPr id="1" name=""/><p:nvGrpSpPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="4400" b="1"/><a:t>标题</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="subTitle"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="2400"/><a:t>副标题</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`

const pptxTheme = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Default">
<a:themeElements>
<a:clrScheme name="Default"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>
<a:fontScheme name="Default"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Default"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"/></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"/></a:gs></a:gsLst></a:gradFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
</a:themeElements></a:theme>`

const pptxSlideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout%d.xml"/>
</Relationships>`

func pptxSlideXML(slide pptxSlide, layoutID int) string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:nvPr/><p:cNvPr id="1" name=""/><p:nvGrpSpPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="609600"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="2800" b="1" rtl="0"/><a:t>`)

	b.WriteString(xmlEscape(slide.Title))

	b.WriteString(`</a:t></a:r><a:endParaRPr/></a:p></p:txBody></p:sp>`)

	// 正文要点
	if len(slide.Content) > 0 {
		b.WriteString(`<p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="body" sz="half"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="990600"/><a:ext cx="8229600" cy="5430525"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle>`)
		for _, item := range slide.Content {
			b.WriteString(`<a:p><a:pPr lvl="0"><a:spcBef><a:spcPts val="200"/></a:spcBef><a:buNone/></a:pPr><a:r><a:rPr sz="1800" rtl="0"/><a:t>`)
			b.WriteString(xmlEscape(item))
			b.WriteString(`</a:t></a:r></a:p>`)
		}
		b.WriteString(`</p:txBody></p:sp>`)
	}

	b.WriteString(`</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`)
	return b.String()
}
