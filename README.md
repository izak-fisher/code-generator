# Yamaha Code Generator

A webhook service that automatically generates structured project codes from [Pneumatic](https://pneumatic.app) workflow data.

When the **Initiate Process** task is completed in any Pneumatic workflow, this service receives the webhook, reads field values from that task by their user-facing names, assembles a multi-segment code (e.g. `CC-PC004-UP25SY25GP50-NPD75PD25`), and writes it back to a downstream task named `generate-code`.

## How it works

The handler is template-agnostic — it doesn't care about template IDs or `api_name` values that change between templates. Instead it looks at user-facing names:

1. A `task_completed` webhook arrives.
2. If the completed task is named **Initiate Process**, the handler proceeds.
3. It searches the workflow for a task named **generate-code** that has an output field named **generated-code**.
4. It reads field values from the completed task's output, looking them up by the field's display name (e.g. `"Purpose Code"`, `"Product Category 1"`, `"Product Category 1 %"`).
5. It assembles the code from the configured segments and writes it back to the `generated-code` field on the `generate-code` task.

Adding code generation to a new template requires no code changes: just include an `Initiate Process` task that collects the input fields and a downstream `generate-code` task with a `generated-code` field.

## Requirements

- [Bun](https://bun.sh) v1.x
- A Pneumatic account with API access

## Quick Start

```bash
bun install
cp .env.example .env
bun start
```

## Configuration

Two layers: a JSON config file and environment variables.

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PNEUMATIC_API_KEY` | **Required.** Your Pneumatic API key (Bearer token) | — |
| `PNEUMATIC_API_URL` | Pneumatic API base URL | `https://your-instance.pneumatic.app/api/v2` |
| `WEBHOOK_PORT` | Port the server listens on | `3000` |
| `CONFIG_PATH` | Path to a custom JSON config file | `config/default.json` |

Environment variables override the corresponding values in the JSON config file.

### JSON Config File

`config/default.json` defines the webhook port/path and the segment rules.

```jsonc
{
  "pneumatic": { "apiUrl": "...", "apiKey": "..." },
  "webhook":   { "port": 3000, "path": "/webhook" },
  "segments":  [ ... ]
}
```

There is no `trigger` or `output` section — detection happens entirely by task and field name (see [How it works](#how-it-works)).

### Configuring Segments

The `segments` array defines how the project code is built. Each segment produces one part of the final code, and they are joined with `-`. Segments that have no input data in the current workflow are silently skipped, so a config can include segments that only appear in some templates.

#### Single Segment

Extracts a code from a single field value by splitting on a delimiter.

```json
{
  "name": "purpose",
  "type": "single",
  "fieldName": "Purpose Code",
  "delimiter": "-",
  "extractIndex": 0
}
```

If the field value is `"CC-Content creation"`, this splits on `-` and takes index `0`, producing `CC`.

| Property | Description |
|---|---|
| `fieldName` | The user-facing field name (the `name` shown in Pneumatic, not the api_name) |
| `delimiter` | Character to split the field value on |
| `extractIndex` | Which part to use after splitting (0-based) |

#### Composite Segment

Concatenates multiple code + percentage pairs into one segment.

```json
{
  "name": "productCategory",
  "type": "composite",
  "entries": [
    { "codeFieldName": "Product Category 1", "percentFieldName": "Product Category 1 %" },
    { "codeFieldName": "Product Category 2", "percentFieldName": "Product Category 2 %" }
  ],
  "delimiter": "-",
  "extractIndex": 0
}
```

Each entry reads a code field and a percentage field. The code is extracted using the same `delimiter`/`extractIndex` logic as single segments. Entries with null values or 0% are skipped. Entries can also use `fixedCode` instead of `codeFieldName` when the code is constant (e.g. media types like `NPD`, `PD`):

```json
{ "fixedCode": "NPD", "percentFieldName": "Non Production Digital %" }
```

Example: if the fields contain `UP-Upright Piano` (25%), `SY-SY&DE` (25%), `GP-Grand Piano` (50%), the segment produces `UP25SY25GP50`.

### Full Code Example

Given this field data from a workflow:

| Field name | Value |
|---|---|
| `Purpose Code` | `CC-Content creation` |
| `Project Code and Name` | `PC004-Advertising` |
| `Product Category 1` | `UP-Upright Piano` |
| `Product Category 1 %` | `25` |
| `Product Category 2` | `SY-SY&DE` |
| `Product Category 2 %` | `25` |
| `Product Category 3` | `GP-Grand Piano` |
| `Product Category 3 %` | `50` |
| `Non Production Digital %` | `75` |
| `Production Digital %` | `25` |

The generated code is: **`CC-PC004-UP25SY25GP50-NPD75PD25`**

## Setting Up the Webhook in Pneumatic

1. In Pneumatic, go to your workflow template settings.
2. Add a webhook that points to your server: `http://your-server:3000/webhook`
3. Set it to fire on the `task_completed` event.
4. Make sure the template has:
   - A task named **Initiate Process** that collects the input fields (with display names matching your `segments` config).
   - A downstream task named **generate-code** with an output field named **generated-code**.

No template-specific configuration is required on the service side.

## Running with Docker

```bash
docker-compose up --build
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
