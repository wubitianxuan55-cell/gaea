# gaea v0.17.0 发布记录

## 构建信息
- **版本号**: 0.17.0
- **构建时间**: 2026-07-12
- **产物**: `desktop/build/bin/gaeaW-desktop.exe`
- **大小**: 17.9 MB (17,946,112 bytes)
- **SHA256**: `297DE5AC476CFCE8A1C8A3DFC3DA0AF804887D5C26D30004F9DFD88059DC37B7`
- **平台**: windows/amd64

## 核心改动 — 绘梦文生图功能

### ComfyUI 本地后端
- 纯 ComfyUI 后端（去 xAI），默认 `http://127.0.0.1:8188`
- `comfyui_path` 配置：main.py 所在目录（如 `D:\ComfyUI`）
- `comfyui_python_path` 配置：Python 解释器（留空自动查找 `python_embeded\python.exe` > `venv` > `py` > PATH）
- 进程管理：Start → context 取消；Stop → cancel 优先 + `taskkill /F /T /PID` 兜底杀进程树
- 启动后 2s 快速轮询直到 ComfyUI HTTP 就绪，自动切换"已连接"状态

### 绘梦弹窗面板（wubigork 三栏布局）
- 居中弹窗 `max-w-5xl h-[90vh]`
- 三栏：左 w-52（模板/种子/负向/尺寸/模型/数量）| 中 flex-1（ResultGallery + PromptBar）| 右 w-44（历史缩略图）
- PromptBar：紫色渐变边框卡片 + 8 个快捷风格标签 + 大 textarea + Enter 生成 + 字符计数 + 渐变生成按钮
- ResultGallery：耗时角标 + 底部操作栏（预览/下载/复用/删除）+ aspectRatio 自适应
- 预设模板系统 + 自定义模板 CRUD
- Lightbox 图片预览
- 启动中/已连接/未连接 三态显示

### 设置面板
- 安装路径 / Python 路径 / URL / 模型 四项配置
- onBlur 自动保存，底部统一保存按钮
- 纯配置保存，启停操作在绘梦面板中进行

### 历史持久化
- `{MemoryUserDir}/image_history.json` 保存生成历史（最多 500 条）
- 重启后自动恢复历史缩略图
- `history`（持久化）与 `results`（当前批次）分离

### 崩溃防线
- `desktop/main.go` 添加 `defer crash.Handle()`
- panic 时自动捕获堆栈写入 `~/.gaeaW/crashes/`

### 后端
- `internal/config/render.go` 补 `[comfyui]` TOML 段渲染
- `app_image.go` — `SaveComfyUIConfig`/`GetComfyUIConfig`/`SaveImageResults`/`LoadImageResults`
- `app.go` — 无条件初始化 imgBackend，退出时 `Shutdown()` 清理

## 已知问题
- ComfyUI 启动后需等待 Python 进程完全就绪（10-30s），轮询会自动处理
- 跨会话残留 ComfyUI 需手动在绘梦面板点停止（taskkill 兜底）

## 文件变更统计
- Go 后端: `desktop/main.go`, `desktop/app.go`, `desktop/app_image.go`, `internal/config/config.go`, `internal/config/render.go`, `internal/imagegen/process.go`
- 前端: `ImageGenPanel.tsx`(重写), `SettingsComfyUI.tsx`(重写), `ResultGallery.tsx`(重写), `PromptBar.tsx`(新建), `bridge.ts`, `image.ts`, `types.ts`, `mock.ts`, `Sidebar.tsx`, `zh-TW.ts`
- 构建产物: `desktop/build/bin/gaeaW-desktop.exe`
