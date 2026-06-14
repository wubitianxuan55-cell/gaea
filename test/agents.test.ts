import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { makeApp, JWT_SECRET, COOKIE_OPTS, LLM_GETTERS } from './helpers';
import { mountAuthRoutes } from '../server/routes/auth';
import { mountAgentRoutes } from '../server/routes/agent_routes';

let url: string;
let cleanup: () => void;
let token: string;
let agentId: string;

describe('Agent CRUD', () => {
  beforeAll(async () => {
    const app = await makeApp();
    url = app.url;
    cleanup = app.cleanup;
    mountAuthRoutes(app.apiRouter, JWT_SECRET, COOKIE_OPTS);
    mountAgentRoutes(app.apiRouter, JWT_SECRET, LLM_GETTERS);

    // Register + login
    await fetch(`${url}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'agent_tester', password: 'pass123', phone: '13800002222' }),
    });
    const login = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'agent_tester', password: 'pass123', phone: '13800002222' }),
    });
    token = (await login.json()).token;
  });

  afterAll(() => cleanup?.());

  function headers() {
    return {
      'Content-Type': 'application/json',
      'Cookie': `token=${token}`,
    };
  }

  it('creates an agent', async () => {
    const res = await fetch(`${url}/api/agents`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name: 'Test Agent', category: 'assistant', personalityId: 'gaea', memoryScope: 'shared', autonomyLevel: 'reactive' }),
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Test Agent');
    agentId = body.id;
  });

  it('lists agents', async () => {
    const res = await fetch(`${url}/api/agents`, { headers: headers(), signal: AbortSignal.timeout(5000) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.find((a: any) => a.id === agentId)).toBeDefined();
  });

  it('updates an agent', async () => {
    const res = await fetch(`${url}/api/agents/${agentId}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ name: 'Updated Agent', autonomyLevel: 'full', skillTags: ['coding'] }),
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.name).toBe('Updated Agent');
    expect(body.autonomyLevel).toBe('full');
  });

  it('rejects update of non-existent agent', async () => {
    const res = await fetch(`${url}/api/agents/nope-123`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ name: 'Nope' }),
      signal: AbortSignal.timeout(5000),
    });
    expect(res.status).toBe(404);
  });

  it('deletes the agent', async () => {
    const res = await fetch(`${url}/api/agents/${agentId}`, {
      method: 'DELETE',
      headers: headers(),
      signal: AbortSignal.timeout(5000),
    });
    expect(res.status).toBe(200);

    const list = await fetch(`${url}/api/agents`, { headers: headers(), signal: AbortSignal.timeout(5000) });
    const listBody = await list.json();
    expect(listBody.find((a: any) => a.id === agentId)).toBeUndefined();
  });

  it('rejects unauthenticated access', async () => {
    const res = await fetch(`${url}/api/agents`, { signal: AbortSignal.timeout(5000) });
    expect(res.status).toBe(401);
  });
});
