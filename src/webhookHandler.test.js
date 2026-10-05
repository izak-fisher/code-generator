const { describe, it, expect } = require('bun:test');
const { createWebhookHandler } = require('./webhookHandler');

const CONFIG = { segments: [] };

// Minimal stub of PneumaticClient recording every call.
function stubClient(overrides = {}) {
  const calls = [];
  const client = {
    calls,
    async getWorkflow(id) {
      calls.push(['getWorkflow', id]);
      return overrides.workflow ?? workflow({ codeStatus: 'active' });
    },
    async getEvents(id, limit) {
      calls.push(['getEvents', id, limit]);
      return overrides.events ?? { results: [] };
    },
    async returnTo(wfId, taskId) {
      calls.push(['returnTo', wfId, taskId]);
      return null;
    },
    async addComment(wfId, text) {
      calls.push(['addComment', wfId, text]);
      return {};
    },
    async getTask(id) {
      calls.push(['getTask', id]);
      return { output: [] };
    },
    async completeTask(wfId, taskId, output) {
      calls.push(['completeTask', wfId, taskId, output]);
      return {};
    },
  };
  return client;
}

function workflow({ codeStatus = 'active', withInitiate = true } = {}) {
  const tasks = [];
  if (withInitiate) {
    tasks.push({ id: 11, number: 1, name: 'Initiate Process', status: 'completed' });
  }
  tasks.push({ id: 22, number: 2, name: 'generate-code', status: codeStatus });
  tasks.push({ id: 33, number: 3, name: 'Approval', status: 'pending' });
  return { id: 999, tasks };
}

function returnedPayload(wf) {
  return { hook: { event: 'task_returned' }, task: { id: 33, name: 'Approval', workflow: wf } };
}

describe('task_returned handling', () => {
  it('returns the workflow to Initiate Process when it is stuck on generate-code', async () => {
    const client = stubClient({
      events: { results: [
        { type: 2, text: '' },
        { type: 4, text: 'please fix the purpose code' },
      ] },
    });
    const handle = createWebhookHandler(CONFIG, client);

    const result = await handle(returnedPayload(workflow({ codeStatus: 'active' })));

    expect(result.returned).toBe(true);
    expect(result.workflowId).toBe(999);
    expect(result.toTaskId).toBe(11);
    expect(result.reason).toBe('please fix the purpose code');

    const names = client.calls.map(c => c[0]);
    expect(names).toContain('returnTo');
    expect(client.calls.find(c => c[0] === 'returnTo')).toEqual(['returnTo', 999, 11]);

    // The comment must be posted AFTER the return, so it lands on Initiate Process.
    expect(names.indexOf('addComment')).toBeGreaterThan(names.indexOf('returnTo'));
    const comment = client.calls.find(c => c[0] === 'addComment')[2];
    expect(comment).toContain('please fix the purpose code');
  });

  it('still returns the workflow when there is no comment (the return-to path)', async () => {
    const client = stubClient({ events: { results: [{ type: 2, text: '' }] } });
    const handle = createWebhookHandler(CONFIG, client);

    const result = await handle(returnedPayload(workflow({ codeStatus: 'active' })));

    expect(result.returned).toBe(true);
    expect(result.reason).toBeNull();
    const comment = client.calls.find(c => c[0] === 'addComment')[2];
    expect(comment).toContain('cannot be completed by hand');
  });

  it('does nothing when the workflow was returned to some other step', async () => {
    const client = stubClient();
    const handle = createWebhookHandler(CONFIG, client);

    const wf = workflow({ codeStatus: 'pending' });
    wf.tasks[0].status = 'active'; // returned to Initiate Process instead
    const result = await handle(returnedPayload(wf));

    expect(result.skipped).toBe(true);
    expect(client.calls.map(c => c[0])).not.toContain('returnTo');
  });

  it('does not act twice when two webhooks race on the same workflow', async () => {
    // Payload still says generate-code is active, but the workflow has already
    // been moved on by the first webhook.
    const client = stubClient({ workflow: workflow({ codeStatus: 'pending' }) });
    const handle = createWebhookHandler(CONFIG, client);

    const result = await handle(returnedPayload(workflow({ codeStatus: 'active' })));

    expect(result.skipped).toBe(true);
    expect(client.calls.map(c => c[0])).toContain('getWorkflow');
    expect(client.calls.map(c => c[0])).not.toContain('returnTo');
  });

  it('skips when the workflow has no Initiate Process task', async () => {
    const client = stubClient({
      workflow: workflow({ codeStatus: 'active', withInitiate: false }),
    });
    const handle = createWebhookHandler(CONFIG, client);

    const result = await handle(returnedPayload(workflow({ codeStatus: 'active' })));

    expect(result.skipped).toBe(true);
    expect(client.calls.map(c => c[0])).not.toContain('returnTo');
  });

  it('ignores an older revert comment outside the lookback window', async () => {
    const client = stubClient({
      events: { results: [
        { type: 2, text: '' }, { type: 2, text: '' }, { type: 3, text: '' },
        { type: 2, text: '' }, { type: 2, text: '' },
        { type: 4, text: 'a much older revert' },
      ] },
    });
    const handle = createWebhookHandler(CONFIG, client);

    const result = await handle(returnedPayload(workflow({ codeStatus: 'active' })));

    expect(result.returned).toBe(true);
    expect(result.reason).toBeNull();
  });
});

describe('other events', () => {
  it('still ignores events that are neither task_completed nor task_returned', async () => {
    const client = stubClient();
    const handle = createWebhookHandler(CONFIG, client);
    const result = await handle({ hook: { event: 'workflow_started' }, task: {} });
    expect(result.skipped).toBe(true);
    expect(client.calls).toHaveLength(0);
  });
});
