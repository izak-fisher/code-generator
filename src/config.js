const fs = require('fs');
const path = require('path');

function loadConfig() {
  const configPath = process.env.CONFIG_PATH
    || path.join(__dirname, '..', 'config', 'default.json');

  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);

  // Allow env overrides for sensitive values
  if (process.env.PNEUMATIC_API_URL) {
    config.pneumatic.apiUrl = process.env.PNEUMATIC_API_URL;
  }
  if (process.env.PNEUMATIC_API_KEY) {
    config.pneumatic.apiKey = process.env.PNEUMATIC_API_KEY;
  }
  if (process.env.WEBHOOK_PORT) {
    config.webhook.port = parseInt(process.env.WEBHOOK_PORT, 10);
  }

  return config;
}

module.exports = { loadConfig };
