const { describe, it, expect, beforeEach, afterEach } = require('bun:test');
const { PneumaticClient } = require('./pneumaticClient');

const BASE = 'https://example.pneumatic.app:8001';

let calls;
let realFetch;

function stubFetch(response = { ok: true, status: 200, json: {} }) {
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null,
                 headers: opts.headers });
    return {
      ok: response.ok,
      status: response.status,
      headers: { get: () => 'application/json' },
      json: async () => response.json,
      text: async () => JSON.stringify(response.json),
    };
  };
}

beforeEach(() => {
  calls = [];
  realFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('completeTask', () => {
  // Regression guard. The service originally posted to
  // `/workflows/{id}/task-complete`, which was withdrawn and has returned 404 since
  // 2026-07-29. Nothing surfaced the breakage: the webhook was still received and the
  // code still generated correctly, so the only symptom was a generate-code step that
  // silently never completed. Pin the path and the body shape.
  it('posts to /v2/tasks/{taskId}/complete', async () => {
    stubFetch();
    const client = new PneumaticClient(BASE, 'key123');
    await client.completeTask(555, 42, { 'field-abc': 'CC-PC004' });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${BASE}/v2/tasks/42/complete`);
  });

  it('sends only the output payload, and no task_id', async () => {
    stubFetch();
    const client = new PneumaticClient(BASE, 'key123');
    await client.completeTask(555, 42, { 'field-abc': 'CC-PC004' });

    expect(calls[0].body).toEqual({ output: { 'field-abc': 'CC-PC004' } });
    expect(calls[0].body.task_id).toBeUndefined();
  });

  it('does not reference the workflow id in the URL', async () => {
    stubFetch();
    const client = new PneumaticClient(BASE, 'key123');
    await client.completeTask(555, 42, {});

    expect(calls[0].url).not.toContain('/workflows/');
    expect(calls[0].url).not.toContain('task-complete');
  });

  it('sends the API key as a Bearer token', async () => {
    stubFetch();
    const client = new PneumaticClient(BASE, 'key123');
    await client.completeTask(555, 42, {});

    expect(calls[0].headers.Authorization).toBe('Bearer key123');
  });

  it('throws with the status and body when the API rejects the call', async () => {
    stubFetch({ ok: false, status: 404, json: { detail: 'Not found' } });
    const client = new PneumaticClient(BASE, 'key123');

    await expect(client.completeTask(555, 42, {})).rejects.toThrow(/404/);
  });
});

describe('getTask', () => {
  it('reads from /v2/tasks/{taskId}', async () => {
    stubFetch();
    const client = new PneumaticClient(BASE, 'key123');
    await client.getTask(42);

    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe(`${BASE}/v2/tasks/42`);
  });
});

describe('base URL handling', () => {
  // A URL ending in /api/v2 (as the old .env.example suggested) would produce
  // /api/v2/v2/tasks/... Trailing slashes are stripped; the version is not added here.
  it('strips trailing slashes without adding a version prefix', async () => {
    stubFetch();
    const client = new PneumaticClient(`${BASE}///`, 'key123');
    await client.getTask(7);

    expect(calls[0].url).toBe(`${BASE}/v2/tasks/7`);
  });
});
