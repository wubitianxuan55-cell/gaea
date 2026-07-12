package imagegen

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// ComfyUIProcess 管理 ComfyUI Python 子进程的启停和健康检查
type ComfyUIProcess struct {
	comfyUIPath       string
	comfyUIPythonPath string
	comfyUIURL        string
	cancel            context.CancelFunc
}

// NewComfyUIProcess 创建一个 ComfyUI 进程管理器
func NewComfyUIProcess(comfyUIPath, comfyUIPythonPath, comfyUIURL string) *ComfyUIProcess {
	return &ComfyUIProcess{
		comfyUIPath:       comfyUIPath,
		comfyUIPythonPath: comfyUIPythonPath,
		comfyUIURL:        comfyUIURL,
	}
}

// UpdateConfig 更新运行时的路径和 URL 配置
func (p *ComfyUIProcess) UpdateConfig(comfyUIPath, comfyUIPythonPath, comfyUIURL string) {
	p.comfyUIPath = comfyUIPath
	p.comfyUIPythonPath = comfyUIPythonPath
	p.comfyUIURL = comfyUIURL
}

// Start 启动 ComfyUI 服务
func (p *ComfyUIProcess) Start() error {
	if p.comfyUIPath == "" {
		return fmt.Errorf("请先在设置中配置 ComfyUI 安装路径")
	}
	if p.IsRunning() {
		return fmt.Errorf("ComfyUI 已在运行")
	}

	mainPy := filepath.Join(p.comfyUIPath, "main.py")
	if _, err := os.Stat(mainPy); os.IsNotExist(err) {
		return fmt.Errorf("在 %s 中未找到 main.py，请确认 ComfyUI 安装路径正确", p.comfyUIPath)
	}

	pythonExe := p.findPython()
	if pythonExe == "" {
		return fmt.Errorf("未找到 Python，请确认 Python 已安装。可在设置中指定 Python 解释器路径")
	}

	ctx, cancel := context.WithCancel(context.Background())
	p.cancel = cancel

	cmd := exec.CommandContext(ctx, pythonExe, "main.py",
		"--listen", "127.0.0.1",
		"--port", p.extractPort(),
		"--lowvram",
	)
	cmd.Env = append(os.Environ(), "PYTHONIOENCODING=utf-8")
	cmd.Dir = p.comfyUIPath
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Start(); err != nil {
		cancel()
		p.cancel = nil
		errMsg := stderr.String()
		if len(errMsg) > 300 {
			errMsg = errMsg[:300] + "..."
		}
		if errMsg != "" {
			return fmt.Errorf("启动 ComfyUI 失败: %w\n%s", err, errMsg)
		}
		return fmt.Errorf("启动 ComfyUI 失败: %w（Python=%s, Dir=%s）", err, pythonExe, p.comfyUIPath)
	}

	slog.Info("ComfyUI 已启动", "python", pythonExe, "dir", p.comfyUIPath, "pid", cmd.Process.Pid)

	go func() {
		if err := cmd.Wait(); err != nil {
			slog.Warn("ComfyUI 进程退出", "error", err)
		}
		p.cancel = nil
	}()

	return nil
}

// Stop 停止 ComfyUI 服务（优先 context 取消，兜底 taskkill 杀进程树）
func (p *ComfyUIProcess) Stop() error {
	// 本会话启动的 — context 取消
	if p.cancel != nil {
		p.cancel()
		p.cancel = nil
		slog.Info("ComfyUI 已停止")
		return nil
	}

	// 非本会话启动 — 通过端口找到 PID，taskkill /F /T 杀进程树
	pid := p.findPIDByPort()
	if pid == 0 {
		return fmt.Errorf("ComfyUI 未在运行")
	}

	killCmd := exec.Command("taskkill", "/F", "/T", "/PID", strconv.Itoa(pid))
	if err := killCmd.Run(); err != nil {
		return fmt.Errorf("停止 ComfyUI 失败: %w", err)
	}
	slog.Info("ComfyUI 已停止（taskkill）", "pid", pid)
	return nil
}

// Shutdown gaeaW 退出时调用的清理
func (p *ComfyUIProcess) Shutdown() {
	if p.cancel != nil {
		p.cancel()
		p.cancel = nil
	}
}

// IsRunning 通过 HTTP 健康检查判断 ComfyUI 是否可连通
func (p *ComfyUIProcess) IsRunning() bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(strings.TrimSuffix(p.comfyUIURL, "/") + "/system_stats")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

// Status 返回 ComfyUI 运行状态（纯 HTTP 检查）
func (p *ComfyUIProcess) Status() ComfyUIStatus {
	return ComfyUIStatus{
		Running: p.IsRunning(),
		URL:     p.comfyUIURL,
	}
}

// findPIDByPort 通过 netstat 查找监听端口的 PID
func (p *ComfyUIProcess) findPIDByPort() int {
	port := p.extractPort()
	out, err := exec.Command("cmd", "/c",
		fmt.Sprintf("netstat -ano | findstr :%s", port)).Output()
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(out), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 5 && strings.Contains(line, "LISTENING") {
			if pid, err := strconv.Atoi(fields[len(fields)-1]); err == nil && pid > 0 {
				return pid
			}
		}
	}
	return 0
}

// findPython 查找可用的 Python 解释器
func (p *ComfyUIProcess) findPython() string {
	if p.comfyUIPythonPath != "" {
		if _, err := os.Stat(p.comfyUIPythonPath); err == nil {
			return p.comfyUIPythonPath
		}
		slog.Warn("配置的 Python 路径不存在，尝试自动查找", "path", p.comfyUIPythonPath)
	}

	if p.comfyUIPath != "" {
		candidates := []string{
			filepath.Join(p.comfyUIPath, "python_embeded", "python.exe"),
			filepath.Join(p.comfyUIPath, "venv", "Scripts", "python.exe"),
			filepath.Join(p.comfyUIPath, ".venv", "Scripts", "python.exe"),
		}
		for _, path := range candidates {
			if _, err := os.Stat(path); err == nil {
				return path
			}
		}
	}

	if _, err := exec.LookPath("py"); err == nil {
		return "py"
	}
	for _, name := range []string{"python", "python3"} {
		if _, err := exec.LookPath(name); err == nil {
			return name
		}
	}
	return ""
}

// extractPort 从 URL 提取端口号
func (p *ComfyUIProcess) extractPort() string {
	parts := strings.Split(p.comfyUIURL, ":")
	if len(parts) >= 3 {
		return parts[2]
	}
	return "8188"
}
