import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ReportPreviewPanel } from "./ReportPreviewPanel";
import type { DirEntry, FilePreview } from "../lib/types";

vi.mock("../lib/bridge", () => {
  const mockListDir = vi.fn<(_rel: string) => Promise<DirEntry[]>>();
  const mockReadFile = vi.fn<(_rel: string) => Promise<FilePreview>>();
  const mockOpenWorkspacePath = vi.fn<(_rel: string) => Promise<void>>();
  const mockSubmit = vi.fn<(_input: string) => Promise<void>>();
  return {
    app: {
      ListDir: mockListDir,
      ReadFile: mockReadFile,
      OpenWorkspacePath: mockOpenWorkspacePath,
      Submit: mockSubmit,
    } as const,
  };
});

const mockApp = await import("../lib/bridge").then((m) => m.app);

describe("ReportPreviewPanel", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { cleanup(); });

  it("空文件列表显示空状态", async () => {
    (mockApp.ListDir as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<ReportPreviewPanel />);
    expect(await screen.findByText("尚未生成报告")).toBeInTheDocument();
  });

  it("渲染文件条目", async () => {
    (mockApp.ListDir as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: "报告.docx", isDir: false, size: 1024, modTime: "2024-01-01" },
    ]);
    render(<ReportPreviewPanel />);
    expect(await screen.findByText("报告.docx")).toBeInTheDocument();
  });

  it("渲染快捷生成按钮", async () => {
    (mockApp.ListDir as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<ReportPreviewPanel />);
    expect(await screen.findByText("场地调查")).toBeInTheDocument();
    expect(await screen.findByText("成本测算")).toBeInTheDocument();
    expect(await screen.findByText("投标方案")).toBeInTheDocument();
  });

  it("点击文件显示内联预览", async () => {
    (mockApp.ListDir as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: "报告.md", isDir: false, size: 512, modTime: "2024-01-01" },
    ]);
    (mockApp.ReadFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      path: "报告.md", body: "# 测试报告内容", size: 512, truncated: false, binary: false,
    });

    render(<ReportPreviewPanel />);
    const fileBtn = await screen.findByText("报告.md");
    fileBtn.click();

    // Preview mode shows content inside <pre>
    expect(await screen.findByText((content) => content.includes("测试报告内容"), {}, { timeout: 3000 })).toBeInTheDocument();
    // Back button exists in preview mode
    expect(screen.getByTitle("返回列表")).toBeInTheDocument();
  });

  it("二进制文件显示外部打开提示", async () => {
    (mockApp.ListDir as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: "报告.pdf", isDir: false, size: 4096, modTime: "2024-01-01" },
    ]);
    (mockApp.ReadFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      path: "报告.pdf", body: "", size: 4096, truncated: false, binary: true,
    });

    render(<ReportPreviewPanel />);
    const fileBtn = await screen.findByText("报告.pdf");
    fileBtn.click();

    expect(await screen.findByText("二进制文件，点击用外部程序打开", {}, { timeout: 3000 })).toBeInTheDocument();
  });
});
