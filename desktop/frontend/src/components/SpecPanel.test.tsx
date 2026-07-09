import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SpecPanel } from "./SpecPanel";
import type { SpecEntryView } from "../lib/types";

vi.mock("../lib/bridge", () => {
  const mockSearchSpecs = vi.fn<(_query: string) => Promise<SpecEntryView[]>>();
  return {
    app: { SearchSpecs: mockSearchSpecs } as const,
  };
});

const mockApp = await import("../lib/bridge").then((m) => m.app);

describe("SpecPanel", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { cleanup(); });

  it("空搜索显示提示信息", async () => {
    render(<SpecPanel />);
    expect(screen.getByText("输入关键词搜索规范")).toBeInTheDocument();
  });

  it("搜索砷返回至少一条结果", async () => {
    (mockApp.SearchSpecs as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        code: "GB 36600-2018",
        clause: "表1",
        title: "土壤环境质量标准 建设用地",
        category: "标准",
        content: "砷(As)筛选值",
        explanation: "建设用地土壤污染风险筛选值",
      },
    ]);

    render(<SpecPanel />);
    const input = screen.getByPlaceholderText("搜索规范关键词…");
    fireEvent.change(input, { target: { value: "砷" } });

    expect(await screen.findByText("GB 36600-2018")).toBeInTheDocument();
    expect(await screen.findByText("表1")).toBeInTheDocument();
  });
});
