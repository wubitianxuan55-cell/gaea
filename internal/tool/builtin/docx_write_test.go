package builtin

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// makeDocxArgs builds a JSON RawMessage for docx_write test calls,
// properly escaping the file path for JSON (especially on Windows).
func makeDocxArgs(t *testing.T, path, title, content string) json.RawMessage {
	t.Helper()
	b, err := json.Marshal(map[string]string{
		"path":    path,
		"title":   title,
		"content": content,
	})
	if err != nil {
		t.Fatal(err)
	}
	return json.RawMessage(b)
}

func TestDocxWrite_CreatesValidZip(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "test.docx")
	args := makeDocxArgs(t, path, "测试标题", "测试正文")

	result, err := docxWrite{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result, "已创建") {
		t.Errorf("result should indicate success, got: %s", result)
	}

	// Verify it's a valid ZIP
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("cannot read generated file: %v", err)
	}
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("generated file is not a valid zip: %v", err)
	}

	// Check required files exist
	files := make(map[string]bool)
	for _, f := range zr.File {
		files[f.Name] = true
	}
	required := []string{
		"[Content_Types].xml",
		"word/document.xml",
		"_rels/.rels",
		"word/_rels/document.xml.rels",
	}
	for _, name := range required {
		if !files[name] {
			t.Errorf("missing required file %q in docx zip", name)
		}
	}
}

func TestDocxWrite_ContainsXmlContent(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "test.docx")
	args := makeDocxArgs(t, path, "测试标题", "测试正文")

	_, err := docxWrite{}.Execute(context.Background(), args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("cannot read generated file: %v", err)
	}
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("generated file is not a valid zip: %v", err)
	}

	// Read document.xml
	var docContent string
	for _, f := range zr.File {
		if f.Name == "word/document.xml" {
			rc, _ := f.Open()
			var buf strings.Builder
			b := make([]byte, 4096)
			for {
				n, err := rc.Read(b)
				if n > 0 {
					buf.Write(b[:n])
				}
				if err != nil {
					break
				}
			}
			docContent = buf.String()
			rc.Close()
			break
		}
	}
	if docContent == "" {
		t.Fatal("could not read word/document.xml")
	}
	if !strings.Contains(docContent, "测试标题") {
		t.Errorf("document.xml should contain title, got:\n%s", docContent)
	}
	if !strings.Contains(docContent, "测试正文") {
		t.Errorf("document.xml should contain content, got:\n%s", docContent)
	}
}

func TestDocxWrite_InvalidPathReturnsError(t *testing.T) {
	args := json.RawMessage(`{"path":"","title":"title","content":"content"}`)
	_, err := docxWrite{}.Execute(context.Background(), args)
	if err == nil {
		t.Fatal("expected error for empty path, got nil")
	}
}
