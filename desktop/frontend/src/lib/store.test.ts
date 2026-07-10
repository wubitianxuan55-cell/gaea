import { describe, it, expect } from "vitest";
import type { WireEvent } from "./types";
import type { ControllerState, Item } from "./store";
import { applyEvent, flushPendingUser } from "./store";

function baseState(overrides?: Partial<ControllerState>): ControllerState {
  return {
    items: [], running: false, turnActive: false,
    approval: undefined, ask: undefined, usage: undefined,
    context: { used: 0, window: 0, plannerUsed: 0, plannerWindow: 0 },
    meta: undefined, balance: undefined, tcca: undefined,
    jobs: [], currentAssistant: undefined, pendingUser: undefined,
    discardTurn: false, lastAssistantIdx: -1,
    turnStartAt: 0, turnTokens: 0, seq: 0, sessionTotal: 0,
    sessionNonce: 0, perTurnUsage: null, turnSteps: [],
    perTurnPlannerUsage: undefined, perTurnExecutorUsage: undefined,
    perTurnSubUsage: undefined,
    _dispatch: () => {},
    ...overrides,
  };
}

describe("flushPendingUser", () => {
  it("returns unchanged when pendingUser is undefined", () => {
    const s = baseState();
    expect(flushPendingUser(s)).toBe(s);
  });

  it("deduplicates when last item matches pendingUser", () => {
    const s = baseState({
      pendingUser: "hello",
      items: [{ kind: "user", id: "u0", text: "hello" } as Item],
    });
    const next = flushPendingUser(s);
    expect(next.pendingUser).toBeUndefined();
    expect(next.items.length).toBe(1);
  });

  it("adds new user item when no duplicate", () => {
    const s = baseState({ pendingUser: "world", seq: 5 });
    const next = flushPendingUser(s);
    expect(next.pendingUser).toBeUndefined();
    expect(next.items.length).toBe(1);
    expect(next.items[0]).toMatchObject({ kind: "user", id: "u5", text: "world" });
    expect(next.seq).toBe(6);
  });
});

describe("applyEvent — turn_started", () => {
  it("resets turn state", () => {
    const s = baseState({ running: true, turnActive: true, currentAssistant: "a0", lastAssistantIdx: 0, turnTokens: 100, perTurnUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cacheHitTokens: 8, cacheMissTokens: 2, sessionCacheHitTokens: 0, sessionCacheMissTokens: 0, costUsd: 0.001 } });
    const e: WireEvent = { kind: "turn_started" };
    const next = applyEvent(s, e);
    expect(next.running).toBe(true);
    expect(next.turnActive).toBe(true);
    expect(next.currentAssistant).toBeUndefined();
    expect(next.lastAssistantIdx).toBe(-1);
    expect(next.turnTokens).toBe(0);
    expect(next.perTurnUsage).toBeNull();
    expect(next.turnSteps).toEqual([]);
  });
});

describe("applyEvent — text/reasoning streaming", () => {
  it("appends text to an existing streaming assistant", () => {
    const s = baseState({
      items: [{ kind: "assistant", id: "a0", text: "Hel", reasoning: "", streaming: true } as Item],
      lastAssistantIdx: 0,
      turnActive: true,
    });
    const e: WireEvent = { kind: "text", text: "lo" };
    const next = applyEvent(s, e);
    const a = next.items[0];
    expect(a.kind).toBe("assistant");
    if (a.kind === "assistant") {
      expect(a.text).toBe("Hello");
      expect(a.streaming).toBe(true);
    }
  });

  it("creates new assistant when none exists", () => {
    const s = baseState({ seq: 3, turnActive: true, lastAssistantIdx: -1 });
    const e: WireEvent = { kind: "text", text: "Hi" };
    const next = applyEvent(s, e);
    const a = next.items[next.items.length - 1];
    expect(a.kind).toBe("assistant");
    if (a.kind === "assistant") {
      expect(a.text).toBe("Hi");
    }
    expect(next.seq).toBe(4);
  });
});

describe("applyEvent — tool_dispatch", () => {
  it("adds a new tool item", () => {
    const s = baseState({ seq: 2 });
    const e: WireEvent = { kind: "tool_dispatch", tool: { id: "t0", name: "bash", args: "ls", readOnly: false } };
    const next = applyEvent(s, e);
    expect(next.items.length).toBe(1);
    expect(next.items[0]).toMatchObject({ kind: "tool", id: "t0", name: "bash", args: "ls", status: "running" });
  });

  it("merges args into existing tool", () => {
    const s = baseState({
      seq: 2,
      items: [{ kind: "tool", id: "t0", name: "", args: "", readOnly: false, status: "running" } as Item],
    });
    const e: WireEvent = { kind: "tool_dispatch", tool: { id: "t0", name: "read_file", args: "foo.txt", readOnly: true } };
    const next = applyEvent(s, e);
    expect(next.items.length).toBe(1);
    const t = next.items[0];
    if (t.kind === "tool") {
      expect(t.name).toBe("read_file");
      expect(t.args).toBe("foo.txt");
    }
  });
});

describe("applyEvent — turn_done", () => {
  it("ends the turn and finalises items", () => {
    const s = baseState({
      turnActive: true, running: true, currentAssistant: "a0",
      items: [{ kind: "assistant", id: "a0", text: "done", reasoning: "", streaming: true } as Item],
      lastAssistantIdx: 0,
    });
    const e: WireEvent = { kind: "turn_done" };
    const next = applyEvent(s, e);
    expect(next.running).toBe(false);
    expect(next.turnActive).toBe(false);
    expect(next.currentAssistant).toBeUndefined();
    const a = next.items[0];
    if (a.kind === "assistant") {
      expect(a.streaming).toBe(false);
    }
  });
});

describe("applyEvent — discardTurn", () => {
  it("ignores events until turn_done", () => {
    const s = baseState({ discardTurn: true, currentAssistant: "a0", items: [{ kind: "assistant", id: "a0", text: "old", reasoning: "", streaming: true } as Item] });
    // text event during discard
    const e1: WireEvent = { kind: "text", text: "should be ignored" };
    const mid = applyEvent(s, e1);
    expect(mid.items.length).toBe(1); // no new item added

    // turn_done ends the discard
    const e2: WireEvent = { kind: "turn_done" };
    const next = applyEvent(mid, e2);
    expect(next.discardTurn).toBe(false);
    expect(next.running).toBe(false);
  });
});
