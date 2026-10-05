const { generateCode } = require('./codeGenerator');

const TRIGGER_TASK_NAME = 'Initiate Process';
const CODE_TASK_NAME = 'generate-code';
const CODE_FIELD_NAME = 'generated-code';

const EVENT_TASK_COMPLETED = 'task_completed';
const EVENT_TASK_RETURNED = 'task_returned';

// WorkflowEventType.TASK_REVERT. A revert carries a mandatory comment, which is
// stored as this event's `text`; the task_returned payload does not include it.
const REVERT_EVENT_TYPE = 4;

// How far back in the (newest-first) event log to look for the revert reason.
// The revert that triggered this webhook is at the very top of the log; a wider
// window risks attributing an older revert's comment to this one.
const REASON_LOOKBACK = 5;

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

function activeTasks(workflow) {
  return (workflow?.tasks ?? []).filter(t => t.status === 'active');
}

/**
 * Recover the reason text of the revert that just happened.
 *
 * `revert` (the performer "send back" action) requires a comment and stores it
 * as a TASK_REVERT event. `return-to` (owner picks a step) has no comment field
 * at all, so this legitimately returns null for that path.
 */
async function findRevertReason(pneumaticClient, workflowId) {
  const data = await pneumaticClient.getEvents(workflowId, REASON_LOOKBACK);
  const events = Array.isArray(data) ? data : (data?.results ?? []);
  const revert = events
    .slice(0, REASON_LOOKBACK)
    .find(e => e.type === REVERT_EVENT_TYPE && (e.text ?? '').trim());
  return revert ? revert.text.trim() : null;
}

/**
 * `generate-code` is an automatic step: nothing but this service completes it,
 * so a workflow returned onto it stops dead. Send it one step further back, to
 * `Initiate Process`, where someone can actually act — and when they re-submit,
 * the normal task_completed trigger regenerates the code.
 */
async function handleTaskReturned(pneumaticClient, payload) {
  const workflow = payload.task?.workflow;
  if (!workflow?.id) {
    console.log('[code-generator] SKIP: task_returned payload carries no workflow');
    return { skipped: true, reason: 'No workflow in payload' };
  }

  // Cheap pre-check off the payload, which already reflects post-return state.
  const payloadActive = activeTasks(workflow).map(t => t.name);
  console.log('[code-generator] task_returned; active tasks in payload:', payloadActive);
  if (!payloadActive.includes(CODE_TASK_NAME)) {
    return {
      skipped: true,
      reason: `Workflow is not sitting on "${CODE_TASK_NAME}"`,
    };
  }

  // Re-read before acting: returning out of parallel branches fires one webhook
  // per returned-from task, so several can race on the same workflow.
  const fresh = await pneumaticClient.getWorkflow(workflow.id);
  const freshActive = activeTasks(fresh);
  if (!freshActive.some(t => t.name === CODE_TASK_NAME)) {
    console.log('[code-generator] SKIP: workflow already moved on (lost the race)');
    return { skipped: true, reason: 'Workflow no longer on the code step' };
  }

  const target = (fresh.tasks ?? []).find(t => t.name === TRIGGER_TASK_NAME);
  if (!target) {
    console.log(`[code-generator] SKIP: no "${TRIGGER_TASK_NAME}" task to return to`);
    return { skipped: true, reason: `No "${TRIGGER_TASK_NAME}" task in workflow` };
  }

  const reason = await findRevertReason(pneumaticClient, workflow.id);
  console.log('[code-generator] revert reason:', reason ?? '(none - return-to has no comment)');

  await pneumaticClient.returnTo(workflow.id, target.id);
  console.log(`[code-generator] returned workflow ${workflow.id} to "${TRIGGER_TASK_NAME}" (task ${target.id})`);

  // Posted after the return so it attaches to the now-active Initiate Process.
  const note = reason
    ? `Returned past the automatic "${CODE_TASK_NAME}" step to "${TRIGGER_TASK_NAME}". Original reason: ${reason}`
    : `Returned past the automatic "${CODE_TASK_NAME}" step to "${TRIGGER_TASK_NAME}", which cannot be completed by hand.`;
  await pneumaticClient.addComment(workflow.id, note);

  return {
    returned: true,
    workflowId: workflow.id,
    toTaskId: target.id,
    reason: reason ?? null,
  };
}

function createWebhookHandler(config, pneumaticClient) {
  const { segments } = config;

  return async function handleWebhook(payload) {
    const event = payload.hook?.event;
    console.log('[code-generator] --- webhook received ---');
    console.log('[code-generator] event:', event);

    if (event === EVENT_TASK_RETURNED) {
      return handleTaskReturned(pneumaticClient, payload);
    }

    if (event !== EVENT_TASK_COMPLETED) {
      console.log(`[code-generator] SKIP: event "${event}" is not "${EVENT_TASK_COMPLETED}"`);
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

module.exports = { createWebhookHandler, collectFieldValues, findRevertReason, handleTaskReturned };
