package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gaeaW/internal/config"
)

// The desktop is a GUI app: launched from Finder or `open`, it starts with the
// working directory set to "/" (read-only), so anything cwd-relative — config,
// .env writes, memory/skill discovery — fails or lands nowhere useful. We keep a
// real working folder instead: remember the last one the user picked and chdir
// into it at startup, falling back to the home directory when there's none and
// cwd isn't writable.

// workspaceStatePath is where the last working folder is remembered (under the
// user config dir, shared with the rest of Tianxuan's state).
func workspaceStatePath() string {
	dir := config.MemoryUserDir() // …/gaeaW
	if dir == "" {
		return ""
	}
	return filepath.Join(dir, "desktop-workspace")
}

func workspaceListPath() string {
	dir := config.MemoryUserDir()
	if dir == "" {
		return ""
	}
	return filepath.Join(dir, "desktop-workspaces.json")
}

// saveWorkspace records dir as the last working folder.
func saveWorkspace(dir string) {
	p := workspaceStatePath()
	if p == "" || dir == "" {
		return
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return
	}
	_ = os.WriteFile(p, []byte(dir), 0o644)
	rememberWorkspace(dir)
}

// loadWorkspace returns the remembered working folder, or "" if none.
func loadWorkspace() string {
	p := workspaceStatePath()
	if p == "" {
		return ""
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

func loadWorkspaces() []string {
	p := workspaceListPath()
	if p == "" {
		return nil
	}
	var paths []string
	b, err := os.ReadFile(p)
	if err != nil || json.Unmarshal(b, &paths) != nil {
		return nil
	}
	out := make([]string, 0, len(paths))
	seen := map[string]bool{}
	for _, path := range paths {
		path = strings.TrimSpace(path)
		if path == "" || seen[path] {
			continue
		}
		seen[path] = true
		out = append(out, path)
	}
	return out
}

func rememberWorkspace(dir string) {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return
	}
	if abs, err := filepath.Abs(dir); err == nil {
		dir = abs
	}
	paths := []string{dir}
	for _, path := range loadWorkspaces() {
		if path != dir {
			paths = append(paths, path)
		}
		if len(paths) >= 12 {
			break
		}
	}
	p := workspaceListPath()
	if p == "" {
		return
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return
	}
	if b, err := json.MarshalIndent(paths, "", "  "); err == nil {
		_ = os.WriteFile(p, b, 0o644)
	}
}

// ensureWorkspace establishes a writable working directory at startup:
//  1. 优先恢复上次关闭时保存的工作空间
//  2.  回退：向上搜索 gaeaW.toml（双击 exe 启动时找到项目根目录）
//  3.  cwd 可写则用 cwd
//  4.  最后回退到 home
func ensureWorkspace() {
	// 1. 优先恢复上次关闭时的工作空间
	if ws := loadWorkspace(); ws != "" {
		if info, err := os.Stat(ws); err == nil && info.IsDir() && os.Chdir(ws) == nil {
			return
		}
	}
	// 2. 回退：向上搜索 gaeaW.toml（双击 exe 启动时能找到项目根目录）
	if dir, err := searchUpForConfig(); err == nil {
		_ = dir // searchUpForConfig 内部已 chdir
		return
	}
	// 3. cwd 可写就用 cwd
	if cwdWritable() {
		return
	}
	// 4. 最后回退到 home
	if home, err := os.UserHomeDir(); err == nil {
		_ = os.Chdir(home)
	} else {
		fmt.Fprintf(os.Stderr, "gaeaW: 无法确定工作目录（cwd 不可写，%s），尝试以 / 运行\n", err)
	}
}

// cwdWritable reports whether the current directory accepts a file write — the
// reliable test for the read-only "/" a GUI launch lands in.

// searchUpForConfig walks up from cwd looking for gaeaW.toml. When the desktop
// exe is double-clicked from a build subdirectory (e.g. desktop/build/bin/),
// the cwd is that subdirectory and config.Load() finds nothing. Walking up to
// the project root ensures plugins and providers are always discovered.
func searchUpForConfig() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := cwd
	for {
		if _, err := os.Stat(filepath.Join(dir, "gaeaW.toml")); err == nil {
			return dir, os.Chdir(dir)
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break // reached filesystem root
		}
		dir = parent
	}
	return "", fmt.Errorf("gaeaW.toml not found from %s", cwd)
}
func cwdWritable() bool {
	cwd, err := os.Getwd()
	if err != nil {
		return false
	}
	f, err := os.CreateTemp(cwd, ".gaeaW-wtest-*")
	if err != nil {
		return false
	}
	name := f.Name()
	_ = f.Close()
	_ = os.Remove(name)
	return true
}
