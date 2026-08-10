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

  /**
   * Complete a task.
   *
   * `POST /workflows/{id}/task-complete` was withdrawn and has returned 404 since
   * 2026-07-29 (it still worked on 2026-07-27; the /v2/ and /v3/ spellings of that
   * path 404 as well). `POST /v2/tasks/{id}/complete` is the supported endpoint.
   *
   * `workflowId` is no longer part of the request, but stays in the signature because
   * callers log it and it costs nothing to keep the call sites unchanged.
   */
  async completeTask(workflowId, taskId, output = {}) {
    return this.request('POST', `/v2/tasks/${taskId}/complete`, { output });
  }
}

module.exports = { PneumaticClient };
