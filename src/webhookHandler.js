const { generateCode } = require('./codeGenerator');

/**
 * Collects all field values from a workflow's kickoff and completed tasks.
 * Fields from later tasks override earlier ones if api_names collide.
 */
function collectFieldValues(webhook) {
  const values = {};

  // Kickoff fields (initial form submission)
  const kickoff = webhook.workflow?.kickoff;
  if (kickoff?.output) {
    for (const field of kickoff.output) {
      if (field.api_name && field.value != null) {
        values[field.api_name] = field.value;
      }
    }
  }

  // Task output fields from all completed tasks in the workflow
  const tasks = webhook.workflow?.tasks || [];
  for (const task of tasks) {
    const fields = task.output || [];
    for (const field of fields) {
      if (field.api_name && field.value != null) {
        values[field.api_name] = field.value;
      }
    }
  }

  // Also check the top-level task in the webhook payload
  const webhookTask = webhook.task;
  if (webhookTask?.output) {
    for (const field of webhookTask.output) {
      if (field.api_name && field.value != null) {
        values[field.api_name] = field.value;
      }
    }
  }

  return values;
}

function createWebhookHandler(config, pneumaticClient) {
  const { trigger, segments, output } = config;

  return async function handleWebhook(payload) {
    const event = payload.hook?.event;
    if (event !== 'task_completed') {
      return { skipped: true, reason: `Ignoring event: ${event}` };
    }

    // Check template match
    const workflowTemplateId = payload.workflow?.template?.id
      ?? payload.workflow?.template_id;

    if (trigger.templateId != null && workflowTemplateId !== trigger.templateId) {
      return { skipped: true, reason: `Template ${workflowTemplateId} does not match ${trigger.templateId}` };
    }

    // Check task match
    const completedTaskApiName = payload.task?.api_name;
    if (trigger.taskApiName && completedTaskApiName !== trigger.taskApiName) {
      return { skipped: true, reason: `Task ${completedTaskApiName} does not match ${trigger.taskApiName}` };
    }

    // Collect all field values from the workflow
    const fieldValues = collectFieldValues(payload);
    console.log('[code-generator] Field values collected:', JSON.stringify(fieldValues, null, 2));

    // Generate the code
    const code = generateCode(segments, fieldValues);
    console.log('[code-generator] Generated code:', code);

    // Find the current (next) task to complete with the generated code
    const currentTaskId = payload.workflow?.current_task?.id;
    if (!currentTaskId) {
      throw new Error('No current task found in workflow — the workflow may have already completed');
    }

    await pneumaticClient.completeTask(currentTaskId, {
      [output.fieldApiName]: code,
    });

    return { completed: true, taskId: currentTaskId, code };
  };
}

module.exports = { createWebhookHandler, collectFieldValues };
