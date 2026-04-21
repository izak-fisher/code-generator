const BASE_HEADERS = { 'Content-Type': 'application/json' };

class PneumaticClient {
  constructor(apiUrl, apiKey) {
    this.apiUrl = apiUrl.replace(/\/+$/, '');
    this.headers = { ...BASE_HEADERS, Authorization: `Bearer ${apiKey}` };
  }

  async request(method, path, body) {
    const url = `${this.apiUrl}${path}`;
    const opts = { method, headers: this.headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pneumatic API ${method} ${path} returned ${res.status}: ${text}`);
    }

    const contentType = res.headers.get('content-type') || '';
    return contentType.includes('application/json') ? res.json() : null;
  }

  async getTask(taskId) {
    return this.request('GET', `/v2/tasks/${taskId}`);
  }

  async getWorkflow(workflowId) {
    return this.request('GET', `/workflows/${workflowId}`);
  }

  async completeTask(workflowId, taskId, output = {}) {
    return this.request('POST', `/workflows/${workflowId}/task-complete`, {
      task_id: taskId,
      output,
    });
  }
}

module.exports = { PneumaticClient };
