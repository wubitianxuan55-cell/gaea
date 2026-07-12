package main

import (
	"fmt"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"time"

	"encoding/json"

	"gaeaW/internal/config"
	"gaeaW/internal/imagegen"
)

// imageItem 单张生成图片结果
type imageItem struct {
	Image  string  `json:"image"`
	Seed   int     `json:"seed"`
	Time   float64 `json:"time"`
	Prompt string  `json:"prompt"`
	Model  string  `json:"model"`
	Size   string  `json:"size"`
}

// GenerateFreeImage 自由图片生成 — 供绘梦面板使用
// 参数: prompt, negative, size, model, seed (0=随机), n (1-4)
func (a *App) GenerateFreeImage(prompt string, negative string, size string, model string, seed int, n int) map[string]interface{} {
	if a.imgBackend == nil {
		return map[string]interface{}{"error": "图片后端未初始化，请在设置中配置 ComfyUI"}
	}

	if size == "" {
		size = "1024x1024"
	}
	if n < 1 || n > 4 {
		n = 1
	}

	images := make([]imageItem, 0, n)
	var lastErr string

	for i := 0; i < n; i++ {
		genSeed := seed
		if genSeed == 0 {
			genSeed = int(time.Now().UnixNano()%1000000) + i*777
		}

		req := &imagegen.ImageGenerationRequest{
			Model:    model,
			Prompt:   prompt,
			Negative: negative,
			N:        1,
			Size:     size,
			Seed:     genSeed,
		}

		start := time.Now()
		resp, err := a.imgBackend.GenerateImage(a.ctx, req)
		elapsed := time.Since(start).Seconds()

		if err != nil {
			slog.Warn("图片生成失败", "attempt", i+1, "error", err)
			lastErr = err.Error()
			continue
		}
		if len(resp.Data) == 0 {
			lastErr = "API 返回空结果"
			continue
		}

		imageData := resp.Data[0].URL
		if imageData == "" {
			imageData = resp.Data[0].B64JSON
		}

		images = append(images, imageItem{
			Image:  imageData,
			Seed:   genSeed,
			Time:   math.Round(elapsed*10) / 10,
			Prompt: prompt,
			Model:  model,
			Size:   size,
		})
	}

	if len(images) == 0 {
		msg := "图片生成失败"
		if lastErr != "" {
			msg = msg + "：" + lastErr
		}
		return map[string]interface{}{"error": msg}
	}

	// 持久化到历史文件（忽略保存错误，不阻断返回）
	resultsForHistory := make([]map[string]interface{}, len(images))
	for i, img := range images {
		resultsForHistory[i] = map[string]interface{}{
			"image":  img.Image,
			"seed":   img.Seed,
			"time":   img.Time,
			"prompt": img.Prompt,
			"model":  img.Model,
			"size":   img.Size,
		}
	}
	_ = a.SaveImageResults(resultsForHistory)

	return map[string]interface{}{
		"images": images,
	}
}

// StartComfyUI 启动 ComfyUI 服务
func (a *App) StartComfyUI() error {
	if a.comfyProc == nil {
		return fmt.Errorf("ComfyUI 进程管理器未初始化")
	}
	return a.comfyProc.Start()
}

// StopComfyUI 停止 ComfyUI 服务
func (a *App) StopComfyUI() error {
	if a.comfyProc == nil {
		return fmt.Errorf("ComfyUI 进程管理器未初始化")
	}
	return a.comfyProc.Stop()
}

// GetComfyUIStatus 返回 ComfyUI 运行状态
func (a *App) GetComfyUIStatus() map[string]interface{} {
	if a.comfyProc == nil {
		return map[string]interface{}{
			"running": false,
			"url":     "",
		}
	}
	status := a.comfyProc.Status()
	return map[string]interface{}{
		"running": status.Running,
		"url":     status.URL,
	}
}

// SaveComfyUIConfig 保存 ComfyUI 配置（URL + 模型 + 安装路径 + Python 路径）
func (a *App) SaveComfyUIConfig(comfyUIURL string, imageModel string, comfyUIPath string, comfyUIPythonPath string) error {
	path := config.UserConfigPath()
	if path == "" {
		return fmt.Errorf("无法解析用户配置目录")
	}
	cfg := config.LoadForEdit(path)

	if comfyUIURL != "" {
		cfg.ComfyUI.ComfyUIURL = comfyUIURL
	}
	if imageModel != "" {
		cfg.ComfyUI.ImageModel = imageModel
	}
	if comfyUIPath != "" {
		cfg.ComfyUI.ComfyUIPath = comfyUIPath
	}
	if comfyUIPythonPath != "" {
		cfg.ComfyUI.ComfyUIPythonPath = comfyUIPythonPath
	}

	// 更新缓存的进程管理器配置
	if a.comfyProc != nil {
		a.comfyProc.UpdateConfig(cfg.ComfyUI.ComfyUIPath, cfg.ComfyUI.ComfyUIPythonPath, cfg.ComfyUI.ComfyUIURL)
	}
	// 更新运行时后端
	a.imgBackend = imagegen.NewComfyUIBackend(cfg.ComfyUI.ComfyUIURL)

	return cfg.SaveTo(path)
}

// GetComfyUIConfig 获取当前 ComfyUI 完整配置
func (a *App) GetComfyUIConfig() map[string]string {
	cfg, err := config.Load()
	if err != nil {
		return map[string]string{}
	}
	return map[string]string{
		"url":        cfg.ComfyUI.ComfyUIURL,
		"model":      cfg.ComfyUI.ImageModel,
		"path":       cfg.ComfyUI.ComfyUIPath,
		"pythonPath": cfg.ComfyUI.ComfyUIPythonPath,
	}
}

// imageHistoryPath 返回图片历史持久化文件路径
func imageHistoryPath() string {
	return filepath.Join(config.MemoryUserDir(), "image_history.json")
}

// SaveImageResults 追加保存图片生成结果到历史文件
func (a *App) SaveImageResults(results []map[string]interface{}) error {
	if len(results) == 0 {
		return nil
	}

	// 加载已有历史
	existing := a.LoadImageResults()

	// 追加新结果
	allResults := append(existing, results...)

	// 限制最多保留 500 条
	if len(allResults) > 500 {
		allResults = allResults[len(allResults)-500:]
	}

	data, err := json.MarshalIndent(allResults, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化图片历史失败: %w", err)
	}

	dir := config.MemoryUserDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("创建历史目录失败: %w", err)
	}

	if err := os.WriteFile(imageHistoryPath(), data, 0o644); err != nil {
		return fmt.Errorf("写入图片历史失败: %w", err)
	}

	return nil
}

// LoadImageResults 从文件加载图片历史
func (a *App) LoadImageResults() []map[string]interface{} {
	data, err := os.ReadFile(imageHistoryPath())
	if err != nil {
		return nil
	}

	var results []map[string]interface{}
	if err := json.Unmarshal(data, &results); err != nil {
		slog.Warn("解析图片历史失败", "error", err)
		return nil
	}
	return results
}
