package bot

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

// telegramAPIBase is the base URL for the Telegram Bot API.
const telegramAPIBase = "https://api.telegram.org/bot%s/%s"

// telegramPollInterval is the delay between long-poll updates.
const telegramPollInterval = 3 * time.Second

// telegramTimeout is the long-poll timeout in seconds.
const telegramTimeout = 30

// telegramUpdate is one Telegram update object.
type telegramUpdate struct {
	UpdateID int64              `json:"update_id"`
	Message  *telegramMessage   `json:"message,omitempty"`
}

// telegramMessage is a Telegram message object.
type telegramMessage struct {
	MessageID int64         `json:"message_id"`
	Chat      telegramChat  `json:"chat"`
	From      telegramUser  `json:"from"`
	Text      string        `json:"text"`
	Date      int64         `json:"date"`
}

type telegramChat struct {
	ID   int64  `json:"id"`
	Type string `json:"type"`
}

type telegramUser struct {
	ID       int64  `json:"id"`
	Username string `json:"username,omitempty"`
}

// telegramSendMessage sends a text message to a Telegram chat.
func telegramSendMessage(token string, chatID int64, text string) error {
	data := url.Values{}
	data.Set("chat_id", strconv.FormatInt(chatID, 10))
	data.Set("text", text)
	data.Set("parse_mode", "Markdown")

	apiURL := fmt.Sprintf(telegramAPIBase, token, "sendMessage")
	resp, err := http.PostForm(apiURL, data)
	if err != nil {
		return fmt.Errorf("telegram send: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("telegram send: HTTP %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// telegramGetUpdates fetches pending updates using long polling.
func telegramGetUpdates(token string, offset int64) ([]telegramUpdate, error) {
	apiURL := fmt.Sprintf(telegramAPIBase, token, "getUpdates")
	data := url.Values{}
	data.Set("offset", strconv.FormatInt(offset, 10))
	data.Set("timeout", strconv.Itoa(telegramTimeout))
	data.Set("allowed_updates", `["message"]`)

	resp, err := http.PostForm(apiURL, data)
	if err != nil {
		return nil, fmt.Errorf("telegram getUpdates: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("telegram getUpdates: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		OK     bool              `json:"ok"`
		Result []telegramUpdate  `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("telegram getUpdates: decode: %w", err)
	}
	if !result.OK {
		return nil, fmt.Errorf("telegram getUpdates: API returned not OK")
	}
	return result.Result, nil
}

// StartTelegram starts the Telegram bot polling loop in a background goroutine.
// It returns immediately; call StopTelegram with the returned cancel function to
// shut down.
func (b *Bot) StartTelegram(ctx context.Context) context.CancelFunc {
	ctx, cancel := context.WithCancel(ctx)

	if !b.cfg.TelegramEnabled || b.cfg.TelegramToken == "" {
		return cancel
	}

	allowed := b.cfg.AllowedUsers
	allowedSet := make(map[int64]bool, len(allowed))
	for _, uid := range allowed {
		allowedSet[uid] = true
	}

	var (
		lastUpdateID int64
		mu           sync.Mutex
	)

	go func() {
		fmt.Printf("[bot] Telegram polling started (allowed users: %d)\n", len(allowedSet))
		for {
			select {
			case <-ctx.Done():
				fmt.Printf("[bot] Telegram polling stopped\n")
				return
			default:
			}

			updates, err := telegramGetUpdates(b.cfg.TelegramToken, lastUpdateID)
			if err != nil {
				// Transient error — log and retry
				select {
				case <-ctx.Done():
					return
				case <-time.After(telegramPollInterval):
				}
				continue
			}

			for _, upd := range updates {
				if upd.UpdateID >= lastUpdateID {
					lastUpdateID = upd.UpdateID + 1
				}
				if upd.Message == nil || upd.Message.Text == "" {
					continue
				}

				msg := upd.Message
				chatID := msg.Chat.ID
				userID := msg.From.ID
				userName := msg.From.Username
				text := strings.TrimSpace(msg.Text)

				// Authorization check
				if len(allowedSet) > 0 && !allowedSet[userID] {
					fmt.Printf("[bot] Telegram: unauthorized user %d (%s)\n", userID, userName)
					_ = telegramSendMessage(b.cfg.TelegramToken, chatID,
						"❌ 未授权用户，请稍候")
					continue
				}

				// Skip empty messages
				if text == "" {
					continue
				}

				fmt.Printf("[bot] Telegram: from %d text=%q\n", userID, text)

				// Send acknowledgement
				_ = telegramSendMessage(b.cfg.TelegramToken, chatID,
					fmt.Sprintf("⏳ 正在处理您的请求…"))
				go b.handleTelegramMessage(ctx, text, chatID, &mu)
			}

			select {
			case <-ctx.Done():
				return
			default:
			}
		}
	}()

	return cancel
}

// handleTelegramMessage sends a message to the agent and returns the result.
func (b *Bot) handleTelegramMessage(ctx context.Context, input string, chatID int64, mu *sync.Mutex) {
	// Use the agent synchronously
	result, err := b.callAgentSync(ctx, input)
	if err != nil {
		_ = telegramSendMessage(b.cfg.TelegramToken, chatID,
			fmt.Sprintf("❌ 处理失败: %v", err))
		return
	}
	_ = telegramSendMessage(b.cfg.TelegramToken, chatID, result)
}

// callAgentSync sends a message to the agent and waits for the result.
// It polls the controller's history until a new assistant message appears
// or a timeout elapses.
func (b *Bot) callAgentSync(ctx context.Context, input string) (string, error) {
	if b.ctrl == nil {
		return "", fmt.Errorf("控制器未初始化")
	}

	// Record current history length to detect new assistant responses
	history := b.ctrl.History()
	startLen := len(history)

	b.ctrl.Submit(input)

	// Poll for new assistant messages with timeout
	deadline := time.After(120 * time.Second)
	tick := time.NewTicker(500 * time.Millisecond)
	defer tick.Stop()

	for {
		select {
		case <-deadline:
			return "⏱ 处理超时（120s），请查看桌面端获取完整响应", nil
		case <-ctx.Done():
			return "", ctx.Err()
		case <-tick.C:
			current := b.ctrl.History()
			if len(current) > startLen {
				// Collect all new assistant messages
				var parts []string
				for i := startLen; i < len(current); i++ {
					msg := current[i]
					if msg.Role == "assistant" && msg.Content != "" {
						// Truncate long responses to avoid Telegram's 4096 char limit
						content := msg.Content
						if len([]rune(content)) > 3500 {
							content = string([]rune(content)[:3500]) + "...\n\n[响应过长已截断，完整内容请查看桌面端]"
						}
						parts = append(parts, content)
					}
				}
				if len(parts) > 0 {
					return strings.Join(parts, "\n\n---\n\n"), nil
				}
			}
			// Check if the turn is done (no running turns means agent finished)
			if !b.ctrl.Running() && len(current) > startLen {
				return "✅ 处理完成，请查看桌面端获取完整响应", nil
			}
		}
	}
}
