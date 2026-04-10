const { generateCode } = require('./codeGenerator');

/**
 * Collects all field values from a workflow's kickoff and completed tasks.
 * Fields from later tasks override earlier ones if api_names collide.
 */
function collectFieldValues(payload) {
  const values = {};
  const workflow = payload.task?.workflow;

  // Kickoff fields (initial form submission)
  const kickoff = workflow?.kickoff;
  if (kickoff?.output) {
    for (const field of kickoff.output) {
      if (field.api_name && field.value != null && field.value !== '') {
        values[field.api_name] = field.value;
      }
    }
  }

  // Task output fields from all completed tasks in the workflow
  const tasks = workflow?.tasks || [];
  for (const task of tasks) {
    const fields = task.output || [];
    for (const field of fields) {
      if (field.api_name && field.value != null && field.value !== '') {
        values[field.api_name] = field.value;
      }
    }
  }

  // Also check the top-level task in the webhook payload
  const webhookTask = payload.task;
  if (webhookTask?.output) {
    for (const field of webhookTask.output) {
      if (field.api_name && field.value != null && field.value !== '') {
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

    // Check template match — workflow is nested under task
    const workflow = payload.task?.workflow;
    const workflowTemplateId = workflow?.template?.id
      ?? workflow?.template_id;

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

    // Find the "Generate Code" task to complete with the generated code
    const tasks = workflow?.tasks || [];
    const codeTask = tasks.find(t => t.api_name === output.taskApiName);
    const codeTaskId = codeTask?.id;
    if (!codeTaskId) {
      throw new Error(`Task "${output.taskApiName}" not found in workflow tasks`);
    }

    await pneumaticClient.completeTask(codeTaskId, {
      [output.fieldApiName]: code,
    });

    return { completed: true, taskId: codeTaskId, code };
  };
}

module.exports = { createWebhookHandler, collectFieldValues };
