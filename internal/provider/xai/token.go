// Package xai implements the XAI / Grok OAuth provider.
// Two authentication methods are supported:
//  1. OAuth PKCE login (default) — opens the browser on first use
//  2. API Key — set the XAI_API_KEY environment variable
//
// OAuth tokens are cached at ~/.gaeaW/xai_token.json and refreshed automatically when expired.
package xai

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

// Token represents an XAI OAuth token pair.
type Token struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	ExpiresIn    int       `json:"expires_in"`
	Scope        string    `json:"scope"`
	ObtainedAt   time.Time `json:"obtained_at"`
}

// Validate checks whether the token is valid.
func (t *Token) Validate() error {
	if t == nil {
		return fmt.Errorf("token 为空")
	}
	if t.AccessToken == "" {
		return fmt.Errorf("access_token 为空")
	}
	return nil
}

// IsExpired 判断 access token 是否已过期。
// 提前 1 小时刷新（xAI access token 约 6 小时有效）。
func (t *Token) IsExpired() bool {
	if t == nil || t.AccessToken == "" {
		return true
	}
	if t.ExpiresIn <= 0 {
		return false // 没有过期信息则假设未过期
	}
	expiryTime := t.ObtainedAt.Add(time.Duration(t.ExpiresIn) * time.Second)
	return time.Now().Add(1 * time.Hour).After(expiryTime)
}

// TokenStore 提供线程安全的 token 文件持久化。
type TokenStore struct {
	mu   sync.RWMutex
	path string
}

// NewTokenStore 创建 token 存储。
func NewTokenStore(path string) *TokenStore {
	return &TokenStore{path: path}
}

// Save 保存 token 到文件（权限 0600）。
func (s *TokenStore) Save(token *Token) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(token, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化 token 失败: %w", err)
	}
	if err := os.WriteFile(s.path, data, 0600); err != nil {
		return fmt.Errorf("写入 token 文件失败: %w", err)
	}
	return nil
}

// Load 从文件加载 token。文件不存在时返回 nil, nil。
func (s *TokenStore) Load() (*Token, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("读取 token 文件失败: %w", err)
	}
	var token Token
	if err := json.Unmarshal(data, &token); err != nil {
		return nil, fmt.Errorf("解析 token 文件失败: %w", err)
	}
	return &token, nil
}

// Delete 删除 token 文件（登出）。
func (s *TokenStore) Delete() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.Remove(s.path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("删除 token 文件失败: %w", err)
	}
	return nil
}
