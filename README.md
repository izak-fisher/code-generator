# Yamaha Code Generator

A webhook service that automatically generates structured project codes from [Pneumatic](https://pneumatic.app) workflow data.

When a task is completed in Pneumatic, this service receives the webhook, extracts field values from the workflow, assembles a multi-segment code (e.g. `CC-PC004-UP25SY25GP50-NPD75PD25`), and writes it back to the next task in the workflow.

## Requirements

- [Bun](https://bun.sh) v1.x
- A Pneumatic account with API access

## Quick Start

```bash
# Install dependencies
bun install

# Copy and edit the environment file
cp .env.example .env

# Run the server
bun start
```

The server starts on port 3000 by default and logs the webhook path and API URL on startup.

## Configuration

The service is configured through two layers: a JSON config file and environment variables.

### Environment Variables

Set these in your `.env` file or export them directly:

| Variable | Description | Default |
|---|---|---|
| `PNEUMATIC_API_KEY` | **Required.** Your Pneumatic API key (Bearer token) | — |
| `PNEUMATIC_API_URL` | Pneumatic API base URL | `https://your-instance.pneumatic.app/api/v2` |
| `WEBHOOK_PORT` | Port the server listens on | `3000` |
| `CONFIG_PATH` | Path to a custom JSON config file | `config/default.json` |

Environment variables override the corresponding values in the JSON config file.

### JSON Config File

The main config file is at `config/default.json`. It defines the webhook behavior and code generation rules.

```jsonc
{
  "pneumatic": {
    "apiUrl": "https://your-instance.pneumatic.app/api/v2",
    "apiKey": "your-api-key-here"
  },
  "webhook": {
    "port": 3000,
    "path": "/webhook"          // URL path the server listens on
  },
  "trigger": {
    "templateId": null,          // Pneumatic template ID to match, or null for any
    "taskApiName": "task-1"      // Task api_name that triggers code generation
  },
  "output": {
    "fieldApiName": "field-generated-code"  // Field where the generated code is written
  },
  "segments": [ ... ]           // Code generation rules (see below)
}
```

**`trigger`** controls which webhook events are processed:
- `templateId` — only process workflows from this template. Set to `null` to accept any template.
- `taskApiName` — only trigger when this specific task is completed. Set to `null` to accept any task.

**`output.fieldApiName`** — the api_name of the field on the *next* task where the generated code will be written.

### Configuring Segments

The `segments` array defines how the project code is built. Each segment produces one part of the final code, and they are joined with `-`.

There are two segment types:

#### Single Segment

Extracts a code from a single field value by splitting on a delimiter.

```json
{
  "name": "purpose",
  "type": "single",
  "fieldApiName": "field-purpose-code",
  "delimiter": "-",
  "extractIndex": 0
}
```

If the field value is `"CC-Content creation"`, this splits on `-` and takes index `0`, producing `CC`.

| Property | Description |
|---|---|
| `fieldApiName` | The Pneumatic field api_name to read from |
| `delimiter` | Character to split the field value on |
| `extractIndex` | Which part to use after splitting (0-based) |

#### Composite Segment

Concatenates multiple code + percentage pairs into one segment.

```json
{
  "name": "productCategory",
  "type": "composite",
  "entries": [
    { "codeFieldApiName": "field-product-cat-1", "percentFieldApiName": "field-product-pct-1" },
    { "codeFieldApiName": "field-product-cat-2", "percentFieldApiName": "field-product-pct-2" },
    { "codeFieldApiName": "field-product-cat-3", "percentFieldApiName": "field-product-pct-3" }
  ],
  "delimiter": "-",
  "extractIndex": 0
}
```

Each entry reads a code field and a percentage field. The code is extracted using the same `delimiter`/`extractIndex` logic as single segments. Entries with null values or 0% are skipped.

Example: if the fields contain `UP-Upright Piano` (25%), `SY-SY&DE` (25%), `GP-Grand Piano` (50%), the segment produces `UP25SY25GP50`.

### Full Code Example

Given this field data from a workflow:

| Field | Value |
|---|---|
| `field-purpose-code` | `CC-Content creation` |
| `field-project-code` | `PC004-750-Advertising` |
| `field-product-cat-1` | `UP-Upright Piano` |
| `field-product-pct-1` | `25` |
| `field-product-cat-2` | `SY-SY&DE` |
| `field-product-pct-2` | `25` |
| `field-product-cat-3` | `GP-Grand Piano` |
| `field-product-pct-3` | `50` |
| `field-ad-code-1` | `NPD` |
| `field-ad-pct-1` | `75` |
| `field-ad-code-2` | `PD` |
| `field-ad-pct-2` | `25` |

The generated code is: **`CC-PC004-UP25SY25GP50-NPD75PD25`**

## Setting Up the Webhook in Pneumatic

1. In Pneumatic, go to your workflow template settings.
2. Add a webhook that points to your server: `http://your-server:3000/webhook`
3. Set it to fire on the `task_completed` event.
4. Update `config/default.json` with the correct `trigger.templateId` and `trigger.taskApiName` for the task that collects the code generation data.
5. Ensure the *next* task in the workflow has a field with the api_name matching `output.fieldApiName` (default: `field-generated-code`).

## Running with Docker

```bash
# Build and run
docker-compose up --build

# Or run detached
docker-compose up -d --build
```

The Docker setup reads your `.env` file and mounts `config/` as a read-only volume, so you can update the config without rebuilding the image.

## Testing

```bash
bun test
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check, returns `{ "status": "ok" }` |
| `POST` | `/webhook` | Pneumatic webhook receiver (configurable via `webhook.path`) |
