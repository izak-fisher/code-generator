const { generateCode } = require('./codeGenerator');

const TRIGGER_TASK_NAME = 'Initiate Process';
const CODE_TASK_NAME = 'generate-code';
const CODE_FIELD_NAME = 'generated-code';

function collectFieldValues(task) {
  const values = {};
  for (const field of task?.output ?? []) {
    if (field.name && field.value != null && field.value !== '') {
      values[field.name] = field.value;
    }
  }
  return values;
}

function createWebhookHandler(config, pneumaticClient) {
  const { segments } = config;

  return async function handleWebhook(payload) {
    const event = payload.hook?.event;
    if (event !== 'task_completed') {
      return { skipped: true, reason: `Ignoring event: ${event}` };
    }

    const completedTask = payload.task;
    if (completedTask?.name !== TRIGGER_TASK_NAME) {
      return { skipped: true, reason: `Completed task "${completedTask?.name}" is not "${TRIGGER_TASK_NAME}"` };
    }

    const tasks = completedTask.workflow?.tasks ?? [];
    const codeTask = tasks.find(t =>
      t.name === CODE_TASK_NAME &&
      (t.output ?? []).some(f => f.name === CODE_FIELD_NAME)
    );
    if (!codeTask) {
      return { skipped: true, reason: `No "${CODE_TASK_NAME}" task with a "${CODE_FIELD_NAME}" field found in workflow` };
    }

    const fieldValues = collectFieldValues(completedTask);
    console.log('[code-generator] Field values collected:', JSON.stringify(fieldValues, null, 2));

    const code = generateCode(segments, fieldValues);
    console.log('[code-generator] Generated code:', code);

    const codeField = codeTask.output.find(f => f.name === CODE_FIELD_NAME);

    await pneumaticClient.completeTask(codeTask.id, {
      [codeField.api_name]: code,
    });

    return { completed: true, taskId: codeTask.id, code };
  };
}

module.exports = { createWebhookHandler, collectFieldValues };
