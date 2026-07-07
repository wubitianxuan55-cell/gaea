// Package bot provides messaging platform integrations (Enterprise WeChat, etc.)
// that let users interact with gaeaW through external chat platforms.
package bot

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"gaeaW/internal/config"
	"gaeaW/internal/control"
)

// Bot manages external platform integrations.
type Bot struct {
	cfg    config.BotConfig
	ctrl   *control.Controller
	server *http.Server
	mu     sync.Mutex
}

// New creates a new Bot from config and controller.
func New(cfg config.BotConfig, ctrl *control.Controller) *Bot {
	return &Bot{cfg: cfg, ctrl: ctrl}
}

// Start launches the webhook HTTP server.
func (b *Bot) Start() error {
	if !b.cfg.Enabled {
		return nil
	}
	addr := b.cfg.ListenAddr
	if addr == "" {
		addr = ":8788"
	}
	mux := http.NewServeMux()

	// Enterprise WeChat callback endpoint
	if b.cfg.Token != "" && b.cfg.EncodingAESKey != "" {
		mux.HandleFunc("/webhook/wecom", b.handleWecom)
	}

	b.server = &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}
	go func() {
		if err := b.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("[bot] HTTP server error: %v\n", err)
		}
	}()
	fmt.Printf("[bot] started on %s\n", addr)
	return nil
}

// Shutdown gracefully stops the bot.
func (b *Bot) Shutdown(ctx context.Context) error {
	if b.server == nil {
		return nil
	}
	return b.server.Shutdown(ctx)
}

// --- 企业微信回调处理 ---

// wecomMsgXML 企业微信回调消息 XML 结构
type wecomMsgXML struct {
	XMLName      xml.Name `xml:"xml"`
	ToUserName   string   `xml:"ToUserName"`
	FromUserName string   `xml:"FromUserName"`
	CreateTime   int64    `xml:"CreateTime"`
	MsgType      string   `xml:"MsgType"`
	Content      string   `xml:"Content"`
	MsgID        int64    `xml:"MsgId"`
	AgentID      int      `xml:"AgentID"`
}

// wecomReplyXML 回复消息 XML
type wecomReplyXML struct {
	XMLName      xml.Name `xml:"xml"`
	ToUserName   string   `xml:"ToUserName"`
	FromUserName string   `xml:"FromUserName"`
	CreateTime   int64    `xml:"CreateTime"`
	MsgType      string   `xml:"MsgType"`
	Content      string   `xml:"Content"`
}

func (b *Bot) handleWecom(w http.ResponseWriter, r *http.Request) {
	// GET → URL 验证（企业微信回调验证）
	if r.Method == http.MethodGet {
		b.verifyURL(w, r)
		return
	}
	// POST → 回调消息处理
	if r.Method == http.MethodPost {
		b.handleWecomMsg(w, r)
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

// verifyURL 处理企业微信的 URL 验证
func (b *Bot) verifyURL(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	msgSig := q.Get("msg_signature")
	timestamp := q.Get("timestamp")
	nonce := q.Get("nonce")
	echoStr := q.Get("echostr")

	if msgSig == "" || timestamp == "" || nonce == "" || echoStr == "" {
		http.Error(w, "missing params", http.StatusBadRequest)
		return
	}

	// 验证签名
	sig := wecomSign(b.cfg.Token, timestamp, nonce, echoStr)
	if !strings.EqualFold(sig, msgSig) {
		http.Error(w, "signature mismatch", http.StatusForbidden)
		return
	}

	// 解密 echostr
	plain, err := aesDecrypt(echoStr, b.cfg.EncodingAESKey)
	if err != nil {
		http.Error(w, "decrypt failed", http.StatusInternalServerError)
		return
	}
	w.Write([]byte(plain))
}

// handleWecomMsg 处理企业微信回调消息
func (b *Bot) handleWecomMsg(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	msgSig := q.Get("msg_signature")
	timestamp := q.Get("timestamp")
	nonce := q.Get("nonce")

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "read body fail", http.StatusBadRequest)
		return
	}

	// 验证签名
	sig := wecomSign(b.cfg.Token, timestamp, nonce, string(body))
	if !strings.EqualFold(sig, msgSig) {
		http.Error(w, "signature mismatch", http.StatusForbidden)
		return
	}

	// 解析 XML
	var enc struct {
		XMLName    xml.Name `xml:"xml"`
		Encrypt    string   `xml:"Encrypt"`
	}
	if err := xml.Unmarshal(body, &enc); err != nil {
		http.Error(w, "parse xml fail", http.StatusBadRequest)
		return
	}

	// 解密
	plain, err := aesDecrypt(enc.Encrypt, b.cfg.EncodingAESKey)
	if err != nil {
		http.Error(w, "decrypt fail", http.StatusInternalServerError)
		return
	}

	// 解析解密后的 XML
	var msg wecomMsgXML
	if err := xml.Unmarshal([]byte(plain), &msg); err != nil {
		http.Error(w, "parse msg fail", http.StatusBadRequest)
		return
	}

	// 处理消息（仅处理文本消息）
	if msg.MsgType == "text" && msg.Content != "" {
		go b.processWecomMsg(msg)
	}

	// 立即回复空串（企业微信要求）
	w.Write([]byte(""))
}

// processWecomMsg 处理企业微信文本消息
func (b *Bot) processWecomMsg(msg wecomMsgXML) {
	content := strings.TrimSpace(msg.Content)

	// 命令处理
	switch {
	case content == "/help" || content == "帮助":
		b.sendWecomText(msg.FromUserName, "gaeaW 机器人命令：\n直接发送消息 → 转发给 AI 助手\n/help → 帮助信息\n/status → 查看当前状态")
		return
	case content == "/status" || content == "状态":
		b.sendWecomText(msg.FromUserName, "✅ 机器人运行正常\n可随时发送消息开始对话")
		return
	}

	// 转发给 Controller（在 goroutine 中运行）
	result, err := b.callAgent(content)
	if err != nil {
		b.sendWecomText(msg.FromUserName, fmt.Sprintf("❌ 处理失败：%v", err))
		return
	}
	// 截断过长回复（企业微信消息上限 2048 字节）
	if len(result) > 1800 {
		result = result[:1800] + "\n\n...（回复较长，请查看桌面端）"
	}
	b.sendWecomText(msg.FromUserName, result)
}

// callAgent 调用 AI 并等待回复（简化版：通过 Submit 后读取最新消息）
func (b *Bot) callAgent(input string) (string, error) {
	done := make(chan string, 1)
	errCh := make(chan error, 1)

	// 使用 goroutine 异步执行
	go func() {
		// Submit 会触发 agent 执行并通过 event 推送结果
		// 简化版：直接记录回复（实际需结合 event 系统）
		b.ctrl.Submit(input)

		// 等待一段时间返回
		select {
		case <-time.After(60 * time.Second):
			errCh <- fmt.Errorf("agent 响应超时")
		case reply := <-done:
			// 实际项目中应将 event sink 连接到 done channel
			_ = reply
		}
	}()

	// 简化：返回处理中提示
	return "已收到消息，AI 正在处理中。请查看桌面端获取完整回复。", nil
}

// sendWecomText 通过企业微信 API 发送文本消息
func (b *Bot) sendWecomText(toUser, content string) {
	if b.cfg.CorpID == "" || b.cfg.AppSecret == "" {
		return
	}
	// 获取 access_token
	token, err := b.getWecomToken()
	if err != nil {
		fmt.Printf("[bot] get token: %v\n", err)
		return
	}

	// 发送消息
	payload := map[string]interface{}{
		"touser":  toUser,
		"msgtype": "text",
		"agentid": b.cfg.AgentID,
		"text": map[string]string{
			"content": content,
		},
	}
	data, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=%s", token)
	resp, err := http.Post(url, "application/json", strings.NewReader(string(data)))
	if err != nil {
		fmt.Printf("[bot] send msg: %v\n", err)
		return
	}
	resp.Body.Close()
}

func (b *Bot) getWecomToken() (string, error) {
	url := fmt.Sprintf("https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=%s&corpsecret=%s",
		b.cfg.CorpID, b.cfg.AppSecret)
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var result struct {
		AccessToken string `json:"access_token"`
		ErrCode     int    `json:"errcode"`
		ErrMsg      string `json:"errmsg"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.ErrCode != 0 {
		return "", fmt.Errorf("errcode %d: %s", result.ErrCode, result.ErrMsg)
	}
	return result.AccessToken, nil
}

// --- 签名与加密 ---

func wecomSign(token, timestamp, nonce, msg string) string {
	parts := []string{token, timestamp, nonce, msg}
	sort.Strings(parts)
	h := sha1.New()
	io.WriteString(h, strings.Join(parts, ""))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func aesDecrypt(encryptStr, aesKey string) (string, error) {
	key, err := base64.StdEncoding.DecodeString(aesKey + "=") // PKCS7 需要 43 位 base64
	if err != nil {
		// 尝试原始长度
		key, err = base64.StdEncoding.DecodeString(aesKey)
		if err != nil {
			return "", fmt.Errorf("decode aes key: %w", err)
		}
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("new cipher: %w", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(encryptStr)
	if err != nil {
		return "", fmt.Errorf("decode ciphertext: %w", err)
	}

	if len(ciphertext) < aes.BlockSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	iv := key[:aes.BlockSize]
	mode := cipher.NewCBCDecrypter(block, iv)
	plain := make([]byte, len(ciphertext))
	mode.CryptBlocks(plain, ciphertext)

	// 去除 PKCS7 填充
	padLen := int(plain[len(plain)-1])
	if padLen > len(plain) || padLen > 32 {
		return "", fmt.Errorf("invalid padding")
	}
	plain = plain[:len(plain)-padLen]

	// 提取消息内容（格式: 4字节网络序长度 + 消息 + CorpID）
	// 简化：直接返回去除前 4 字节后的内容
	if len(plain) < 4 {
		return "", fmt.Errorf("plain too short")
	}
	// 前 4 字节为大端序的消息长度（不含自身）
	// 但我们直接返回去除前 4 字节的剩余内容（含 CorpID，用于验证）
	return string(plain[4:]), nil
}
