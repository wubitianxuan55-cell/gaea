package xai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"gaeaW/internal/provider"
)

func init() {
	provider.Register("xai", New)
}

// ── Provider 实现 ─────────────────────────────────────────────────

type xaiProvider struct {
	name    string
	baseURL string
	model   string
	tm      *tokenManager
	client  *http.Client
}

// New 创建 XAI provider。
// cfg.APIKey 可选：设置后优先使用 API Key，否则使用 OAuth。
func New(cfg provider.Config) (provider.Provider, error) {
	if cfg.BaseURL == "" {
		return nil, fmt.Errorf("xai: base_url is required for provider %q", cfg.Name)
	}
	if cfg.Model == "" {
		return nil, fmt.Errorf("xai: model is required for provider %q", cfg.Name)
	}
	name := cfg.Name
	if name == "" {
		name = "xai"
	}

	tm := newTokenManager(cfg.APIKey)
	slog.Debug("xai: provider created", "name", name, "model", cfg.Model, "hasApiKey", cfg.APIKey != "", "isLoggedIn", tm.IsLoggedIn())

	return &xaiProvider{
		name:    name,
		baseURL: normalizeBaseURL(cfg.BaseURL),
		model:   cfg.Model,
		tm:      tm,
		client:  getSharedClient(normalizeBaseURL(cfg.BaseURL)),
	}, nil
}

func (p *xaiProvider) Name() string { return p.name }

// Stream 发起流式 Chat Completions 请求（OpenAI 兼容协议）。
func (p *xaiProvider) Stream(ctx context.Context, req provider.Request) (<-chan provider.Chunk, error) {
	body, err := p.buildRequestBody(req)
	if err != nil {
		return nil, fmt.Errorf("%s: marshal request: %w", p.name, err)
	}

	resp, err := p.sendWithRetry(ctx, body)
	if err != nil {
		return nil, err
	}

	out := make(chan provider.Chunk, 16)
	go p.readStream(ctx, resp, out)
	return out, nil
}

// ── 请求构建 ──────────────────────────────────────────────────────

type chatRequest struct {
	Model           string            `json:"model"`
	Messages        []chatMessage     `json:"messages"`
	MaxTokens       int               `json:"max_tokens,omitempty"`
	Temperature     float64           `json:"temperature"`
	TopP            float64           `json:"top_p,omitempty"`
	Tools           []chatTool        `json:"tools,omitempty"`
	Stream          bool              `json:"stream"`
	StreamOptions   *streamOptions    `json:"stream_options,omitempty"`
	ReasoningEffort string            `json:"reasoning_effort,omitempty"`
}

type streamOptions struct {
	IncludeUsage bool `json:"include_usage"`
}

type chatMessage struct {
	Role             string         `json:"role"`
	Content          string         `json:"content"`
	ReasoningContent string         `json:"reasoning_content,omitempty"`
	ToolCalls        []chatToolCall `json:"tool_calls,omitempty"`
	ToolCallID       string         `json:"tool_call_id,omitempty"`
	Name             string         `json:"name,omitempty"`
}

type chatTool struct {
	Type     string       `json:"type"`
	Function chatFunction `json:"function"`
}

type chatFunction struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

type chatToolCall struct {
	Index    int    `json:"index"`
	ID       string `json:"id,omitempty"`
	Type     string `json:"type,omitempty"`
	Function struct {
		Name      string `json:"name,omitempty"`
		Arguments string `json:"arguments,omitempty"`
	} `json:"function"`
}

type streamResponse struct {
	Choices []struct {
		Delta struct {
			Content          string         `json:"content"`
			ReasoningContent string         `json:"reasoning_content"`
			ToolCalls        []chatToolCall `json:"tool_calls"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
	Usage *wireUsage `json:"usage"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type wireUsage struct {
	PromptTokens          int `json:"prompt_tokens"`
	CompletionTokens      int `json:"completion_tokens"`
	TotalTokens           int `json:"total_tokens"`
	PromptCacheHitTokens  int `json:"prompt_cache_hit_tokens"`
	PromptCacheMissTokens int `json:"prompt_cache_miss_tokens"`
	PromptTokensDetails   *struct {
		CachedTokens int `json:"cached_tokens"`
	} `json:"prompt_tokens_details"`
	CompletionTokensDetails *struct {
		ReasoningTokens int `json:"reasoning_tokens"`
	} `json:"completion_tokens_details"`
}

func (p *xaiProvider) buildRequestBody(req provider.Request) ([]byte, error) {
	messages := make([]chatMessage, len(req.Messages))
	for i, m := range req.Messages {
		toolCalls := make([]chatToolCall, len(m.ToolCalls))
		for j, tc := range m.ToolCalls {
			toolCalls[j] = chatToolCall{
				ID:   tc.ID,
				Type: "function",
				Function: struct {
					Name      string `json:"name,omitempty"`
					Arguments string `json:"arguments,omitempty"`
				}{Name: tc.Name, Arguments: tc.Arguments},
			}
		}
		messages[i] = chatMessage{
			Role:             string(m.Role),
			Content:          m.Content,
			ReasoningContent: m.ReasoningContent,
			ToolCalls:        toolCalls,
			ToolCallID:       m.ToolCallID,
			Name:             m.Name,
		}
	}

	tools := make([]chatTool, len(req.Tools))
	for i, t := range req.Tools {
		tools[i] = chatTool{
			Type: "function",
			Function: chatFunction{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Parameters,
			},
		}
	}

	cr := chatRequest{
		Model:         p.model,
		Messages:      messages,
		Stream:        true,
		StreamOptions: &streamOptions{IncludeUsage: true},
		Tools:         tools,
	}
	if req.Temperature > 0 {
		cr.Temperature = req.Temperature
	}
	if req.MaxTokens > 0 {
		cr.MaxTokens = req.MaxTokens
	}

	return json.Marshal(cr)
}

// ── HTTP 通信 ─────────────────────────────────────────────────────

func (p *xaiProvider) sendWithRetry(ctx context.Context, body []byte) (*http.Response, error) {
	const maxRetries = 5
	const retryBase = 2 * time.Second
	var lastErr error
	rateLimitCount := 0

	for attempt := 1; attempt <= maxRetries; attempt++ {
		if attempt > 1 {
			delay := retryBase * time.Duration(1<<(attempt-2))
			if rateLimitCount >= 2 {
				delay = retryBase * time.Duration(1<<(rateLimitCount+1))
			}
			slog.Debug("xai: retrying", "attempt", attempt, "delay", delay)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}

		// 每次请求前重新获取 token
		accessToken, err := p.tm.getAccessToken(ctx)
		if err != nil {
			slog.Error("xai: token acquisition failed", "provider", p.name, "err", err)
			return nil, &provider.AuthError{Provider: p.name, KeyEnv: "XAI_API_KEY (or OAuth login)", Status: 401}
		}

		endpoint := strings.TrimSuffix(p.baseURL, "/") + "/chat/completions"
		httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(body))
		if err != nil {
			return nil, fmt.Errorf("%s: build request: %w", p.name, err)
		}
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+accessToken)

		resp, err := p.client.Do(httpReq)
		if err != nil {
			lastErr = fmt.Errorf("%s: request failed: %w", p.name, err)
			continue
		}

		if resp.StatusCode < 400 {
			return resp, nil
		}

		msg, readErr := io.ReadAll(io.LimitReader(resp.Body, 4096))
		resp.Body.Close()
		if readErr != nil {
			msg = []byte(fmt.Sprintf("(could not read error body: %v)", readErr))
		}

		if resp.StatusCode == 401 || resp.StatusCode == 403 {
			slog.Error("xai: auth rejected", "status", resp.StatusCode, "body", strings.TrimSpace(string(msg)))
			keyEnv := "XAI_API_KEY"
			if p.tm.apiKey == "" {
				keyEnv = "XAI OAuth token (try re-login via `gaeaW login xai`, or set XAI_API_KEY)"
			}
			return nil, &provider.AuthError{Provider: p.name, KeyEnv: keyEnv, Status: resp.StatusCode}
		}

		statusErr := &httpStatusError{name: p.name, code: resp.StatusCode, body: strings.TrimSpace(string(msg))}
		if resp.StatusCode == 429 {
			rateLimitCount++
			lastErr = statusErr
			if rateLimitCount >= 3 {
				return nil, fmt.Errorf("%s: rate limited after %d attempts", p.name, rateLimitCount)
			}
			continue
		}
		if resp.StatusCode >= 500 {
			lastErr = statusErr
			continue
		}
		return nil, statusErr
	}

	return nil, lastErr
}

type httpStatusError struct {
	name string
	code int
	body string
}

func (e *httpStatusError) Error() string {
	return fmt.Sprintf("%s: HTTP %d: %s", e.name, e.code, e.body)
}

// ── SSE 流读取 ────────────────────────────────────────────────────

func (p *xaiProvider) readStream(ctx context.Context, resp *http.Response, out chan<- provider.Chunk) {
	defer close(out)
	defer resp.Body.Close()

	const idleNoticeTimeout = 60 * time.Second
	const idleHardTimeout = 120 * time.Second

	reader := bufio.NewReader(resp.Body)
	var keepaliveSent bool
	lastRead := time.Now()

	for {
		// 空闲超时检测
		if time.Since(lastRead) > idleHardTimeout {
			out <- provider.Chunk{Type: provider.ChunkError, Err: fmt.Errorf("%s: stream idle timeout after %v", p.name, idleHardTimeout)}
			return
		}
		if time.Since(lastRead) > idleNoticeTimeout && !keepaliveSent {
			slog.Debug("xai: stream idle, waiting for reasoning...", "elapsed", time.Since(lastRead))
			keepaliveSent = true
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			if errors.Is(err, io.EOF) {
				return
			}
			out <- provider.Chunk{Type: provider.ChunkError, Err: fmt.Errorf("%s: read stream: %w", p.name, err)}
			return
		}
		lastRead = time.Now()
		keepaliveSent = false

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			return
		}

		var sr streamResponse
		if err := json.Unmarshal([]byte(data), &sr); err != nil {
			out <- provider.Chunk{Type: provider.ChunkError, Err: fmt.Errorf("%s: decode stream: %w", p.name, err)}
			return
		}
		if sr.Error != nil {
			out <- provider.Chunk{Type: provider.ChunkError, Err: fmt.Errorf("%s: %s", p.name, sr.Error.Message)}
			return
		}

		// Usage
		if sr.Usage != nil {
			out <- provider.Chunk{Type: provider.ChunkUsage, Usage: normalizeUsage(sr.Usage)}
		}

		// Choices
		for _, choice := range sr.Choices {
			delta := choice.Delta

			// 推理内容（Grok 的 thinking）
			if delta.ReasoningContent != "" {
				out <- provider.Chunk{
					Type: provider.ChunkReasoning,
					Text: delta.ReasoningContent,
				}
			}

			// 文本内容
			if delta.Content != "" {
				out <- provider.Chunk{
					Type: provider.ChunkText,
					Text: delta.Content,
				}
			}

			// 工具调用
			for _, tc := range delta.ToolCalls {
				if tc.ID != "" {
					out <- provider.Chunk{
						Type: provider.ChunkToolCallStart,
						ToolCall: &provider.ToolCall{
							ID:   tc.ID,
							Name: tc.Function.Name,
						},
					}
				}
				if tc.Function.Arguments != "" {
					out <- provider.Chunk{
						Type: provider.ChunkToolCall,
						ToolCall: &provider.ToolCall{
							ID:        tc.ID,
							Name:      tc.Function.Name,
							Arguments: tc.Function.Arguments,
						},
					}
				}
			}

			// 结束原因
			if choice.FinishReason != nil && *choice.FinishReason != "" {
				if *choice.FinishReason == "stop" || *choice.FinishReason == "tool_calls" || *choice.FinishReason == "length" {
					out <- provider.Chunk{Type: provider.ChunkDone}
				}
			}
		}
	}
}

func normalizeUsage(w *wireUsage) *provider.Usage {
	if w == nil {
		return nil
	}
	cacheHit := w.PromptCacheHitTokens
	if cacheHit == 0 && w.PromptTokensDetails != nil {
		cacheHit = w.PromptTokensDetails.CachedTokens
	}
	reasoningTokens := 0
	if w.CompletionTokensDetails != nil {
		reasoningTokens = w.CompletionTokensDetails.ReasoningTokens
	}
	return &provider.Usage{
		PromptTokens:     w.PromptTokens,
		CompletionTokens: w.CompletionTokens,
		TotalTokens:      w.TotalTokens,
		CacheHitTokens:   cacheHit,
		CacheMissTokens:  max(0, w.PromptTokens-cacheHit),
		ReasoningTokens:  reasoningTokens,
	}
}

// ── HTTP 连接池 ──────────────────────────────────────────────────

var (
	clientPool   = make(map[string]*http.Client)
	clientPoolMu sync.Mutex
)

func getSharedClient(baseURL string) *http.Client {
	clientPoolMu.Lock()
	defer clientPoolMu.Unlock()
	if c, ok := clientPool[baseURL]; ok {
		return c
	}
	c := &http.Client{
		Transport: &http.Transport{
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			TLSHandshakeTimeout:   15 * time.Second,
			ResponseHeaderTimeout: 120 * time.Second,
			MaxIdleConns:          100,
			MaxIdleConnsPerHost:   10,
			IdleConnTimeout:       90 * time.Second,
		},
	}
	clientPool[baseURL] = c
	return c
}

// ── 公开 API ──────────────────────────────────────────────────────

// EnsureLogin 确保已登录或已配置 API Key。
// 返回 nil 表示可以直接使用；返回 error 表示需要先登录。
func EnsureLogin() error {
	tm := newTokenManager("")
	if tm.IsLoggedIn() {
		return nil
	}
	return fmt.Errorf("XAI 未登录：请运行 `gaeaW login xai` 在浏览器中登录，或设置 XAI_API_KEY 环境变量")
}

// Login 触发 XAI OAuth 登录。
func Login() error {
	tm := newTokenManager("")
	return tm.Login()
}

// Logout 登出 XAI（删除缓存 token，不影响 API Key 模式）。
func Logout() error {
	tm := newTokenManager("")
	return tm.Logout()
}

// IsLoggedIn 返回是否已认证（OAuth 或 API Key）。
func IsLoggedIn() bool {
	tm := newTokenManager("")
	return tm.IsLoggedIn()
}
