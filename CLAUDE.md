# CLAUDE.md — yamaha-code-generator

## What this project does

Webhook-based service that generates formatted project codes from Pneumatic workflow task data. Listens for `task_completed` webhook events, extracts field values from kickoff forms and task outputs, and assembles multi-segment codes like `CC-PC004-UP25SY25GP50-NPD75PD25`.

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

- **Segments:** Code is built from ordered segments joined by `-`. Two types:
  - `single` — extracts a code from one field value using a delimiter + index
  - `composite` — concatenates code+percentage pairs from multiple fields
- **Field collection:** Merges kickoff form fields + all task output fields; later tasks override earlier ones.
- **Config precedence:** Env vars (`PNEUMATIC_API_KEY`, `PNEUMATIC_API_URL`, `WEBHOOK_PORT`) override values in `config/default.json`. `CONFIG_PATH` env var overrides the config file path itself.

## Conventions

- camelCase for JS variables and functions
- kebab-case for Pneumatic field `api_name` values (e.g. `field-purpose-code`)
- Tests live next to source files as `*.test.js`
- No dev dependencies — keep the dependency footprint minimal
