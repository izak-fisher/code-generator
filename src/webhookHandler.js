const { generateCode } = require('./codeGenerator');

const TRIGGER_TASK_NAME = 'Initiate Process';
const CODE_TASK_NAME = 'generate-code';
const CODE_FIELD_NAME = 'generated-code';

function collectFieldValues(task) {
  const values = {};
  const addField = (field) => {
    if (field?.name && field.value != null && field.value !== '') {
      values[field.name] = field.value;
    }
  };
  for (const field of task?.output ?? []) addField(field);
  for (const fieldset of task?.fieldsets ?? []) {
    for (const field of fieldset.fields ?? []) addField(field);
  }
  return values;
}

function describeTask(t) {
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    api_name: t.api_name,
    outputFieldNames: (t.output ?? []).map(f => f.name),
  };
}

function createWebhookHandler(config, pneumaticClient) {
  const { segments } = config;

  return async function handleWebhook(payload) {
    const event = payload.hook?.event;
    console.log('[code-generator] --- webhook received ---');
    console.log('[code-generator] event:', event);

    if (event !== 'task_completed') {
      console.log(`[code-generator] SKIP: event "${event}" is not "task_completed"`);
      return { skipped: true, reason: `Ignoring event: ${event}` };
    }

    const completedTask = payload.task;
    console.log('[code-generator] completed task:', JSON.stringify(describeTask(completedTask)));
    console.log(`[code-generator] expected completed-task name: "${TRIGGER_TASK_NAME}"`);

    if (completedTask?.name !== TRIGGER_TASK_NAME) {
      console.log(`[code-generator] SKIP: completed task name "${completedTask?.name}" !== "${TRIGGER_TASK_NAME}"`);
      return { skipped: true, reason: `Completed task "${completedTask?.name}" is not "${TRIGGER_TASK_NAME}"` };
    }

    const workflow = completedTask.workflow;
    console.log('[code-generator] workflow top-level keys:', workflow ? Object.keys(workflow) : null);

    const tasks = workflow?.tasks ?? [];
    const currentTask = workflow?.current_task;

    console.log('[code-generator] workflow.tasks names:', tasks.map(t => t.name));
    console.log('[code-generator] workflow.current_task:', JSON.stringify(describeTask(currentTask)));
    console.log(`[code-generator] looking for task name "${CODE_TASK_NAME}" with field name "${CODE_FIELD_NAME}"`);

    const codeTask = tasks.find(t => t.name === CODE_TASK_NAME);

    if (!codeTask) {
      console.log(`[code-generator] SKIP: no task named "${CODE_TASK_NAME}" found in workflow.tasks`);
      console.log('[code-generator] available task names:', tasks.map(t => t.name));
      return { skipped: true, reason: `No "${CODE_TASK_NAME}" task found in workflow` };
    }

    console.log('[code-generator] matched code task (from webhook):', JSON.stringify(describeTask(codeTask)));

    // The webhook payload doesn't include each task's output field metadata,
    // so fetch the code task to find the api_name of the "generated-code" field.
    const codeTaskDetails = await pneumaticClient.getTask(codeTask.id);
    console.log('[code-generator] fetched code task output field names:',
      (codeTaskDetails.output ?? []).map(f => f.name));

    const codeField = (codeTaskDetails.output ?? []).find(f => f.name === CODE_FIELD_NAME);
    if (!codeField) {
      console.log(`[code-generator] SKIP: code task ${codeTask.id} has no field named "${CODE_FIELD_NAME}"`);
      return { skipped: true, reason: `Code task has no "${CODE_FIELD_NAME}" field` };
    }

    // The webhook payload only includes top-level output fields, not fieldset values.
    // Fetch the task via the API to get both output[] and fieldsets[].fields[].
    const triggerTaskDetails = await pneumaticClient.getTask(completedTask.id);
    console.log('[code-generator] fetched trigger task fieldset names:',
      (triggerTaskDetails.fieldsets ?? []).map(fs => fs.name));

    const fieldValues = collectFieldValues(triggerTaskDetails);
    console.log('[code-generator] field values collected:', JSON.stringify(fieldValues, null, 2));

    const code = generateCode(segments, fieldValues);
    console.log('[code-generator] generated code:', code);

    await pneumaticClient.completeTask(workflow.id, codeTask.id, {
      [codeField.api_name]: code,
    });

    return { completed: true, workflowId: workflow.id, taskId: codeTask.id, code };
  };
}

module.exports = { createWebhookHandler, collectFieldValues };
