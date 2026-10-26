const express = require('express');
const { loadConfig } = require('./config');
const { PneumaticClient } = require('./pneumaticClient');
const { createWebhookHandler } = require('./webhookHandler');

const config = loadConfig();
const client = new PneumaticClient(config.pneumatic.apiUrl, config.pneumatic.apiKey);
const handleWebhook = createWebhookHandler(config, client);

const app = express();
// Pneumatic posts the whole task + workflow; on the 54-step Credit Note templates that
// exceeds body-parser's 100kb default and the webhook is rejected with 413 before the
// handler ever runs (prod wf 1174, 2026-10-22: PayloadTooLargeError, step stalled 4 days).
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Pneumatic webhook endpoint
app.post(config.webhook.path, async (req, res) => {
  try {
    console.log('[code-generator] Webhook received:', req.body.hook?.event, '- task:', req.body.task?.api_name);
    const result = await handleWebhook(req.body);
    console.log('[code-generator] Result:', JSON.stringify(result));
    res.json(result);
  } catch (err) {
    console.error('[code-generator] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const port = config.webhook.port;
app.listen(port, () => {
  console.log(`[code-generator] Listening on port ${port}`);
  console.log(`[code-generator] Webhook path: ${config.webhook.path}`);
  console.log(`[code-generator] Pneumatic API: ${config.pneumatic.apiUrl}`);
});
