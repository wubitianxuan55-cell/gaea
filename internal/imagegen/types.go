// Package imagegen 提供图片生成能力——支持 ComfyUI 本地后端和 xAI 云端后端。
// 类型定义从 wubigork 移植，接口保持 OpenAI 兼容。
package imagegen

import "context"

// ImageGenerationRequest 图片生成请求，兼容 OpenAI /v1/images/generations 格式
type ImageGenerationRequest struct {
	Model          string `json:"model"`
	Prompt         string `json:"prompt"`
	Negative       string `json:"negative,omitempty"`
	N              int    `json:"n,omitempty"`
	Size           string `json:"size,omitempty"`
	ResponseFormat string `json:"response_format,omitempty"` // "url" 或 "b64_json"
	Seed           int    `json:"seed,omitempty"`
}

// ImageData 单张图片结果
type ImageData struct {
	URL           string `json:"url,omitempty"`
	B64JSON       string `json:"b64_json,omitempty"`
	RevisedPrompt string `json:"revised_prompt,omitempty"`
}

// ImageGenerationResponse 图片生成响应
type ImageGenerationResponse struct {
	Created int64       `json:"created"`
	Data    []ImageData `json:"data"`
}

// ComfyUIStatus 描述 ComfyUI 进程运行状态
type ComfyUIStatus struct {
	Running bool   `json:"running"`
	URL     string `json:"url"`
}

// ImageBackend 图片生成后端接口 — 支持多后端切换（xAI / ComfyUI / 未来扩展）
type ImageBackend interface {
	GenerateImage(ctx context.Context, req *ImageGenerationRequest) (*ImageGenerationResponse, error)
}
