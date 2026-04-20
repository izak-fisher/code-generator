# CLAUDE.md — yamaha-code-generator

## What this project does

Webhook-based service that generates formatted project codes from Pneumatic workflow task data. Listens for `task_completed` webhook events on any template, and when the completed task is named `Initiate Process` and the workflow contains a downstream task named `generate-code` with an output field named `generated-code`, it assembles a multi-segment code like `CC-PC004-UP25SY25GP50-NPD75PD25` and writes it back to that field.

The handler is template-agnostic: detection happens by display name (`task.name`, `field.name`), not template-specific `api_name` values, so the same service works across multiple templates without code or config changes per template.

## Tech stack

- **Runtime:** Bun (Alpine in Docker)
- **Framework:** Express.js
- **Module system:** CommonJS (`require` / `module.exports`)
- **Package manager:** bun
- **Tests:** Bun built-in test runner (`bun:test`)
- **Container:** Docker + Docker Compose

## Commands

| Task | Command |
|------|---------|
| Install deps | `bun install` |
| Run (dev) | `bun run dev` |
| Run (prod) | `bun start` |
| Test | `bun test` |
| Docker build & run | `docker-compose up --build` |

No linter or formatter is configured.

## Project structure

```
src/
  index.js            # Express server, webhook endpoint, health check
  config.js           # Loads config/default.json with env overrides
  codeGenerator.js    # Core code generation (single + composite segments)
  webhookHandler.js   # Webhook filtering, field collection, orchestration
  pneumaticClient.js  # Pneumatic API client (task completion)
  codeGenerator.test.js  # Tests for code generation logic
config/
  default.json        # Segment definitions, field mappings, API settings
```

## Key concepts

- **Trigger:** Hardcoded in `webhookHandler.js`. Fires when `payload.task.name === 'Initiate Process'` and the workflow contains a task named `generate-code` with a field named `generated-code`. No `templateId` or `taskApiName` filter in config.
- **Segments:** Code is built from ordered segments joined by `-`. Two types:
  - `single` — extracts a code from one field value using a delimiter + index
  - `composite` — concatenates code+percentage pairs from multiple fields (each entry can use `codeFieldName` or a `fixedCode`)
- **Field lookup:** Segments reference fields by their user-facing `name` (e.g. `"Purpose Code"`), not by `api_name`. Values are read from the completed `Initiate Process` task's `output` array.
- **Missing segments are skipped:** If a segment's fields aren't present in the workflow (e.g. a template without media-type fields), `generateCode` silently omits it from the output rather than throwing. This is what allows one config to serve multiple templates.
- **Writing back:** The api_name of the `generated-code` field is looked up at runtime on the matching `generate-code` task, so it can differ between templates.
- **Config precedence:** Env vars (`PNEUMATIC_API_KEY`, `PNEUMATIC_API_URL`, `WEBHOOK_PORT`) override values in `config/default.json`. `CONFIG_PATH` env var overrides the config file path itself.

## Conventions

- camelCase for JS variables and functions
- Pneumatic field display names in segment config (e.g. `"Product Category 1 %"`) — never api_names
- Tests live next to source files as `*.test.js`
- No dev dependencies — keep the dependency footprint minimal
