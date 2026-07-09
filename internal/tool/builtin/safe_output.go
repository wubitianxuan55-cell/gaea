package builtin

import (
	"fmt"
	"path/filepath"
	"strings"
)

// safeOutputPath 验证并清理输出路径。拒绝 ../ 目录穿越。
func safeOutputPath(path string) (string, error) {
	clean := filepath.Clean(path)
	if strings.HasPrefix(clean, "..") {
		return "", fmt.Errorf("不安全的路径: 不支持目录穿越 %q", path)
	}
	if strings.Contains(clean, "../") || strings.Contains(clean, "..\\") {
		return "", fmt.Errorf("不安全的路径: 不支持目录穿越 %q", path)
	}
	return clean, nil
}
