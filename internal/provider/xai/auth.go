package xai

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// ── OIDC Discovery ────────────────────────────────────────────────

// OIDCDiscovery xAI OIDC 端点配置。
type OIDCDiscovery struct {
	Issuer                string `json:"issuer"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
}

// discoverEndpoints 通过 OIDC Discovery 获取 xAI 的授权和 token 端点。
func discoverEndpoints() (*OIDCDiscovery, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get("https://auth.x.ai/.well-known/openid-configuration")
	if err != nil {
		return nil, fmt.Errorf("OIDC Discovery 请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("OIDC Discovery 返回 HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 128*1024))
	if err != nil {
		return nil, fmt.Errorf("读取 OIDC Discovery 响应失败: %w", err)
	}

	var disc OIDCDiscovery
	if err := json.Unmarshal(body, &disc); err != nil {
		return nil, fmt.Errorf("解析 OIDC Discovery 响应失败: %w\n原始: %s", err, string(body))
	}

	if disc.AuthorizationEndpoint == "" || disc.TokenEndpoint == "" {
		return nil, fmt.Errorf("OIDC Discovery 响应缺少必要字段")
	}

	return &disc, nil
}

// ── PKCE ──────────────────────────────────────────────────────────

type pkcePair struct {
	Verifier  string
	Challenge string
}

func newPKCE() (*pkcePair, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return nil, fmt.Errorf("生成随机数失败: %w", err)
	}
	verifier := base64.RawURLEncoding.EncodeToString(b)
	h := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(h[:])
	return &pkcePair{Verifier: verifier, Challenge: challenge}, nil
}

// ── 浏览器 ────────────────────────────────────────────────────────

func openBrowser(url string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	case "linux":
		return exec.Command("xdg-open", url).Start()
	default:
		return fmt.Errorf("不支持的操作系统: %s", runtime.GOOS)
	}
}

// ── OAuth 配置 ────────────────────────────────────────────────────

// OAuthConfig XAI OAuth 客户端配置。
type OAuthConfig struct {
	ClientID   string // XAI OAuth client ID
	ListenHost string // 回调监听地址
	ListenPort string // 回调监听端口
}

// DefaultOAuthConfig 返回默认的 XAI OAuth 配置。
func DefaultOAuthConfig() OAuthConfig {
	return OAuthConfig{
		ClientID:   "b1a00492-073a-47ea-816f-4c329264a828",
		ListenHost: "127.0.0.1",
		ListenPort: "56121",
	}
}

// ── OAuth 登录流程 ────────────────────────────────────────────────

// LoginResult 登录完成后的结果。
type LoginResult struct {
	Token   *Token
	BaseURL string
}

// DoLogin 执行 OAuth PKCE loopback 登录流程：
//  1. OIDC Discovery 获取端点
//  2. 生成 PKCE code_verifier / code_challenge
//  3. 打开浏览器让用户授权
//  4. 本机 HTTP server 接收回调
//  5. 用 code 换取 token
func DoLogin(cfg OAuthConfig) (*LoginResult, error) {
	// 1. OIDC Discovery
	disc, err := discoverEndpoints()
	if err != nil {
		return nil, fmt.Errorf("获取 OIDC 端点失败: %w", err)
	}

	// 2. PKCE
	pkce, err := newPKCE()
	if err != nil {
		return nil, err
	}

	// 3. 生成随机 state（防 CSRF）+ nonce
	stateBytes := make([]byte, 16)
	if _, err := rand.Read(stateBytes); err != nil {
		return nil, fmt.Errorf("生成 state 失败: %w", err)
	}
	state := base64.RawURLEncoding.EncodeToString(stateBytes)

	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return nil, fmt.Errorf("生成 nonce 失败: %w", err)
	}
	nonce := base64.RawURLEncoding.EncodeToString(nonceBytes)

	redirectURI := fmt.Sprintf("http://%s:%s/callback", cfg.ListenHost, cfg.ListenPort)

	// 4. 启动本地回调服务器
	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		if q.Get("state") != state {
			errCh <- fmt.Errorf("state 不匹配，可能的 CSRF 攻击")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(oauthErrorHTML("State 校验失败")))
			return
		}

		if errDesc := q.Get("error_description"); errDesc != "" {
			errCh <- fmt.Errorf("授权失败: %s", errDesc)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(oauthErrorHTML(errDesc)))
			return
		}
		if errParam := q.Get("error"); errParam != "" {
			errCh <- fmt.Errorf("授权失败: %s", errParam)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(oauthErrorHTML(errParam)))
			return
		}

		code := q.Get("code")
		if code == "" {
			errCh <- fmt.Errorf("未收到授权码")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(oauthErrorHTML("未收到授权码")))
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(oauthSuccessHTML()))
		codeCh <- code
	})

	listener, err := net.Listen("tcp", net.JoinHostPort(cfg.ListenHost, cfg.ListenPort))
	if err != nil {
		return nil, fmt.Errorf("启动回调服务器失败 (端口 %s 被占用?): %w", cfg.ListenPort, err)
	}

	srv := &http.Server{Handler: mux}
	go func() {
		if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
			errCh <- fmt.Errorf("回调服务器错误: %w", err)
		}
	}()
	defer srv.Close()

	// 5. 构建授权 URL 并打开浏览器
	authURL := buildAuthURL(disc.AuthorizationEndpoint, cfg.ClientID, redirectURI, state, nonce, pkce)
	slog.Info("正在打开浏览器进行 XAI 登录...", "url", authURL)
	if err := openBrowser(authURL); err != nil {
		slog.Warn("无法自动打开浏览器，请手动访问以下 URL:", "url", authURL)
		fmt.Printf("\n请手动打开以下链接登录 XAI:\n\n%s\n\n", authURL)
	}

	// 6. 等待回调
	var code string
	select {
	case code = <-codeCh:
		// 成功
	case err := <-errCh:
		return nil, err
	case <-time.After(5 * time.Minute):
		return nil, fmt.Errorf("登录超时（5 分钟），请重试")
	}

	// 7. 用 code 换取 token
	token, err := exchangeCodeForToken(disc.TokenEndpoint, cfg.ClientID, redirectURI, code, pkce)
	if err != nil {
		return nil, err
	}

	return &LoginResult{
		Token:   token,
		BaseURL: "https://api.x.ai/v1",
	}, nil
}

func buildAuthURL(endpoint, clientID, redirectURI, state, nonce string, pkce *pkcePair) string {
	q := url.Values{
		"response_type":         {"code"},
		"client_id":             {clientID},
		"redirect_uri":          {redirectURI},
		"scope":                 {"openid profile email api:access"},
		"state":                 {state},
		"nonce":                 {nonce},
		"code_challenge":        {pkce.Challenge},
		"code_challenge_method": {"S256"},
		"plan":                  {"generic"},
		"referrer":              {"gaeaW"},
	}
	return endpoint + "?" + q.Encode()
}

func exchangeCodeForToken(tokenEndpoint, clientID, redirectURI, code string, pkce *pkcePair) (*Token, error) {
	if pkce.Verifier == "" {
		return nil, fmt.Errorf("PKCE code_verifier 为空")
	}

	payload := url.Values{
		"grant_type":    {"authorization_code"},
		"client_id":     {clientID},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"code_verifier": {pkce.Verifier},
	}

	resp, err := http.PostForm(tokenEndpoint, payload)
	if err != nil {
		return nil, fmt.Errorf("请求 token 失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 128*1024))
	if err != nil {
		return nil, fmt.Errorf("读取 token 响应失败: %w", err)
	}

	if resp.StatusCode == 403 {
		return nil, fmt.Errorf("换取 token 被拒 (HTTP 403): 此 xAI 账号可能未获 API 访问授权")
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("换取 token 失败 (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var token Token
	if err := json.Unmarshal(body, &token); err != nil {
		return nil, fmt.Errorf("解析 token 响应失败: %w\n原始响应: %s", err, string(body))
	}
	token.ObtainedAt = time.Now()
	return &token, nil
}

// RefreshAccessToken 使用 refresh_token 刷新 access token。
func RefreshAccessToken(clientID, refreshToken string) (*Token, error) {
	disc, err := discoverEndpoints()
	if err != nil {
		return nil, fmt.Errorf("获取 OIDC 端点失败: %w", err)
	}

	payload := url.Values{
		"grant_type":    {"refresh_token"},
		"client_id":     {clientID},
		"refresh_token": {refreshToken},
	}

	resp, err := http.PostForm(disc.TokenEndpoint, payload)
	if err != nil {
		return nil, fmt.Errorf("刷新 token 请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 128*1024))
	if err != nil {
		return nil, fmt.Errorf("读取刷新响应失败: %w", err)
	}

	if resp.StatusCode == 403 {
		return nil, fmt.Errorf("刷新 token 被拒 (HTTP 403): 此 xAI 账号未获 API 访问授权，可尝试设置 XAI_API_KEY 改用 API Key 模式")
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("刷新 token 失败 (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var token Token
	if err := json.Unmarshal(body, &token); err != nil {
		return nil, fmt.Errorf("解析刷新响应失败: %w", err)
	}
	token.ObtainedAt = time.Now()
	return &token, nil
}

// ── HTML 页面 ─────────────────────────────────────────────────────

func oauthSuccessHTML() string {
	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>登录成功 — gaeaW</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0d0d0d;color:#e0e0e0}div{text-align:center}h1{color:#4ade80}p{color:#9ca3af}</style></head>
<body><div><h1>✅ 登录成功</h1><p>您可以关闭此页面，回到 gaeaW 继续使用 ✨</p></div></body></html>`
}

func oauthErrorHTML(msg string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>登录失败 — gaeaW</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0d0d0d;color:#e0e0e0}div{text-align:center}h1{color:#f87171}p{color:#9ca3af}</style></head>
<body><div><h1>❌ 登录失败</h1><p>%s</p></div></body></html>`, msg)
}

// TokenStorePath 返回 XAI token 的默认存储路径（~/.gaeaW/xai_token.json）。
func TokenStorePath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "xai_token.json"
	}
	// 确保 .gaeaW 目录存在
	gaeaWDir := home + "/.gaeaW"
	os.MkdirAll(gaeaWDir, 0700)
	return gaeaWDir + "/xai_token.json"
}

// normalizeBaseURL 安全校验 base URL（防 credential leak）。
func normalizeBaseURL(rawURL string) string {
	candidate := strings.TrimRight(strings.TrimSpace(rawURL), "/")
	if candidate == "" {
		return "https://api.x.ai/v1"
	}
	parsed, err := url.Parse(candidate)
	if err != nil || parsed.Scheme == "" {
		slog.Warn("忽略无效的 base URL，使用默认值", "url", candidate)
		return "https://api.x.ai/v1"
	}
	if parsed.Scheme != "https" {
		slog.Warn("拒绝非 HTTPS 的 base URL（会泄露 token），使用默认值", "url", candidate)
		return "https://api.x.ai/v1"
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "x.ai" && !strings.HasSuffix(host, ".x.ai") {
		slog.Warn("拒绝非 xAI 域的 base URL（会泄露 token），使用默认值", "url", candidate, "host", host)
		return "https://api.x.ai/v1"
	}
	return candidate
}

// ── Token acquisition (unified entry) ─────────────────────────────

// tokenManager manages the lifecycle of XAI authentication tokens.
type tokenManager struct {
	store  *TokenStore
	cfg    OAuthConfig
	token  *Token
	apiKey string // When XAI_API_KEY is set, it takes precedence
}

func newTokenManager(apiKey string) *tokenManager {
	tm := &tokenManager{
		store:  NewTokenStore(TokenStorePath()),
		cfg:    DefaultOAuthConfig(),
		apiKey: apiKey,
	}
	// Try to load cached token
	if stored, err := tm.store.Load(); err == nil && stored != nil {
		tm.token = stored
		slog.Debug("xai: loaded cached token", "path", TokenStorePath(), "expires_in", stored.ExpiresIn)
	} else if err != nil {
		slog.Warn("xai: failed to load cached token", "path", TokenStorePath(), "err", err)
	} else {
		slog.Debug("xai: no cached token found", "path", TokenStorePath())
	}
	return tm
}

// getAccessToken returns a valid access token.
// Priority: API Key > cached token > OAuth login.
func (tm *tokenManager) getAccessToken(ctx context.Context) (string, error) {
	// 1. API Key first
	if tm.apiKey != "" {
		slog.Debug("xai: using API key", "prefix", tm.apiKey[:min(8, len(tm.apiKey))]+"...")
		return tm.apiKey, nil
	}

	// 2. Cached token still valid
	if tm.token != nil && !tm.token.IsExpired() {
		slog.Debug("xai: using cached token", "expires_in", tm.token.ExpiresIn)
		return tm.token.AccessToken, nil
	}

	if tm.token != nil {
		slog.Warn("xai: cached token expired", "expires_in", tm.token.ExpiresIn, "obtained_at", tm.token.ObtainedAt)
	}

	// 3. Try refresh
	if tm.token != nil && tm.token.RefreshToken != "" {
		slog.Info("xai: attempting token refresh")
		newToken, err := RefreshAccessToken(tm.cfg.ClientID, tm.token.RefreshToken)
		if err != nil {
			slog.Warn("XAI token 刷新失败，尝试重新登录", "error", err)
		} else {
			tm.token = newToken
			if err := tm.store.Save(newToken); err != nil {
				slog.Error("保存刷新后的 token 失败", "error", err)
			}
			slog.Info("xai: token refreshed successfully")
			return newToken.AccessToken, nil
		}
	}

	// 4. Need re-login
	slog.Error("xai: no valid token available — please login via Settings panel")
	return "", fmt.Errorf("XAI 未登录：请运行 `gaeaW login xai` 在浏览器中登录，或设置 XAI_API_KEY 环境变量")
}

// IsLoggedIn returns whether the user is logged in (or has configured an API Key).
func (tm *tokenManager) IsLoggedIn() bool {
	if tm.apiKey != "" {
		return true
	}
	return tm.token != nil && !tm.token.IsExpired()
}

// Login triggers the OAuth login flow.
func (tm *tokenManager) Login() error {
	result, err := DoLogin(tm.cfg)
	if err != nil {
		return err
	}
	tm.token = result.Token
	return tm.store.Save(result.Token)
}

// Logout deletes the cached token.
func (tm *tokenManager) Logout() error {
	tm.token = nil
	return tm.store.Delete()
}
