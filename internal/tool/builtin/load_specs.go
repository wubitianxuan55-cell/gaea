package builtin

import (
	_ "embed"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
)

//go:embed specdata/GB36600-2018.json
var gb36600Data []byte

//go:embed specdata/GB15618-2018.json
var gb15618Data []byte

//go:embed specdata/HJ25.json
var hj25Data []byte

// loadSpecs 加载规范索引数据。优先从 ~/.gaeaW/specs/ 目录加载用户自定义 JSON，
// 若目录不存在或为空则 fallback 到嵌入的二进制数据。
func loadSpecs() []specEntry {
	// 尝试从用户目录加载
	home, err := os.UserHomeDir()
	if err == nil {
		specDir := filepath.Join(home, ".gaeaW", "specs")
		if entries, err := loadSpecsDir(specDir); err == nil && len(entries) > 0 {
			return entries
		}
	}

	// Fallback 到嵌入数据
	var all []specEntry
	for name, data := range map[string][]byte{
		"GB36600-2018.json": gb36600Data,
		"GB15618-2018.json": gb15618Data,
		"HJ25.json":         hj25Data,
	} {
		var entries []specEntry
		if err := json.Unmarshal(data, &entries); err != nil {
			slog.Warn("specdata: 解析嵌入 JSON 失败", "file", name, "err", err)
			continue
		}
		all = append(all, entries...)
	}
	return all
}

// loadSpecsDir 从指定目录加载所有 .json 规范数据文件
func loadSpecsDir(dir string) ([]specEntry, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var all []specEntry
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			slog.Warn("specdata: 读取用户规范文件失败", "file", e.Name(), "err", err)
			continue
		}
		var specs []specEntry
		if err := json.Unmarshal(data, &specs); err != nil {
			slog.Warn("specdata: 解析用户规范 JSON 失败", "file", e.Name(), "err", err)
			continue
		}
		all = append(all, specs...)
	}
	return all, nil
}
