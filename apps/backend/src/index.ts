/**
 * Monitor Backend Entry Point
 *
 * HTTP server + WebSocket for real-time task updates.
 * Coordinates agent execution, tool calls, and spend tracking.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { TaskManager } from './task-manager';
import { WSServer } from './ws-server';
import { FakeToolExecutor } from './tools/executor';
import { SpendLedger } from './spend-ledger';
import { PremiumExecutor } from './premium-executor';
import { AgentEngine } from './agent-engine';

// =============================================================================
// BigInt serialization helper
// =============================================================================

/**
 * Recursively converts BigInt values to strings for JSON serialization.
 */
function serializeBigInt(obj: unknown): unknown {
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = serializeBigInt(v);
    }
    return result;
  }
  return obj;
}

// =============================================================================
// Server Setup
// =============================================================================

const PORT = parseInt(process.env['PORT'] || '3001', 10);
const WS_PORT = parseInt(process.env['WS_PORT'] || '3002', 10);

const app = Fastify({
  logger: true,
});

// Enable CORS
app.register(cors, {
  origin: '*',
});

// =============================================================================
// Services
// =============================================================================

const taskManager = new TaskManager();
const spendLedger = new SpendLedger();
const premiumExecutor = new PremiumExecutor({
  spendLedger,
  treasuryAddress: process.env['TREASURY_ADDRESS'] || '0x0000000000000000000000000000000000000000',
});
const toolExecutor = new FakeToolExecutor({
  demoMode: process.env['DEMO_MODE'] === 'true',
  premiumExecutor,
});

// WebSocket server
const wsServer = new WSServer({ port: WS_PORT });

// =============================================================================
// Routes
// =============================================================================

// Health check
app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'monitor-backend',
    version: '0.1.0',
    connections: wsServer.getTotalConnections(),
  };
});

// Create task
app.post('/tasks', async (request: any, reply: any) => {
  const body = request.body;

  try {
    const task = taskManager.createTask({
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      prompt: body.prompt,
      budgetWei: BigInt(body.budgetWei),
      deadline: Date.now() + body.deadlineSeconds * 1000,
      owner: body.owner,
      sources: body.sources,
      enhancements: body.enhancements,
    });

    wsServer.broadcastStatusChange(task.id, 'CREATED');

    // Initialize spend ledger for the new task
    spendLedger.initTask(task.id, task.budgetWei, task.deadline, 'CREATED');

    reply.status(201);
    return serializeBigInt({ task });
  } catch (error) {
    reply.status(400);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// List tasks
app.get('/tasks', async (request: any) => {
  const { status, owner } = request.query;
  const tasks = taskManager.listTasks({
    status: status,
    owner,
  });
  return serializeBigInt({ tasks });
});

// Get task
app.get('/tasks/:id', async (request: any, reply: any) => {
  const { id } = request.params;
  const task = taskManager.getTask(id);
  
  if (!task) {
    reply.status(404);
    return { error: 'TASK_NOT_FOUND' };
  }
  
  return serializeBigInt({ task });
});

// Rehydrate task
app.get('/tasks/:id/rehydrate', async (request: any, reply: any) => {
  const { id } = request.params;
  const state = taskManager.rehydrate(id);
  
  if (!state) {
    reply.status(404);
    return { error: 'TASK_NOT_FOUND' };
  }
  
  return serializeBigInt(state);
});

// Transition task status
app.post('/tasks/:id/status', async (request: any, reply: any) => {
  const { id } = request.params;
  const body = request.body;

  try {
    const task = taskManager.transitionStatus(id, body.status);
    spendLedger.updateTaskStatus(id, body.status);
    wsServer.broadcastStatusChange(id, body.status);
    return serializeBigInt({ task });
  } catch (error) {
    reply.status(400);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Run AgentEngine for a task (full loop)
app.post('/tasks/:id/run', async (request: any, reply: any) => {
  const { id } = request.params;
  const task = taskManager.getTask(id);

  if (!task) {
    reply.status(404);
    return { error: 'TASK_NOT_FOUND' };
  }

  // Auto-transition through FUNDING → RUNNING if not already there
  try {
    if (task.status === 'CREATED') {
      taskManager.transitionStatus(id, 'FUNDING');
      spendLedger.updateTaskStatus(id, 'FUNDING');
      wsServer.broadcastStatusChange(id, 'FUNDING');
    }
    const refreshed = taskManager.getTask(id)!;
    if (refreshed.status === 'FUNDING') {
      taskManager.transitionStatus(id, 'RUNNING');
      spendLedger.updateTaskStatus(id, 'RUNNING');
      wsServer.broadcastStatusChange(id, 'RUNNING');
    }
  } catch (transitionError) {
    reply.status(400);
    return { error: `Cannot start run: ${transitionError instanceof Error ? transitionError.message : 'Unknown error'}` };
  }

  // Keep SpendLedger in RUNNING state throughout so spend calls succeed
  // (AgentEngine transitions taskManager independently)
  const engine = new AgentEngine({
    spendLedger,
    taskManager,
    demoMode: process.env['DEMO_MODE'] === 'true',
    fallbackToDemo: true,
    exaApiKey: process.env['EXA_API_KEY'],
    llmApiKey: process.env['LLM_API_KEY'],
  });

  try {
    // Patch: keep spend ledger RUNNING during COMPILING transition
    const origTransition = taskManager.transitionStatus.bind(taskManager);
    (taskManager as any).transitionStatus = (taskId: string, status: string) => {
      const result = origTransition(taskId, status as any);
      if (taskId === id && (status === 'COMPILING' || status === 'ENHANCING')) {
        spendLedger.updateTaskStatus(taskId, status as any);
      }
      wsServer.broadcastStatusChange(taskId, status);
      return result;
    };

    const result = await engine.run(id);

    // Restore original
    (taskManager as any).transitionStatus = origTransition;

    // Update taskManager spent totals
    const totals = spendLedger.getSpendTotals(id);
    taskManager.updateSpent(id, totals.totalWei);

    // Broadcast completion
    wsServer.broadcastComplete(id, serializeBigInt(result));

    return serializeBigInt({ result });
  } catch (error) {
    wsServer.broadcastError(id, error instanceof Error ? error.message : 'Unknown error');
    reply.status(500);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Stop task
app.post('/tasks/:id/stop', async (request: any, reply: any) => {
  const { id } = request.params;
  const stopped = taskManager.stopTask(id);
  
  if (!stopped) {
    reply.status(400);
    return { error: 'CANNOT_STOP_TASK' };
  }
  
  wsServer.broadcastStatusChange(id, 'STOPPED');
  return { success: true, status: 'STOPPED' };
});

// Execute tool
app.post('/tasks/:id/execute', async (request: any, reply: any) => {
  const { id } = request.params;
  const body = request.body;

  const task = taskManager.getTask(id);
  if (!task) {
    reply.status(404);
    return { error: 'TASK_NOT_FOUND' };
  }

  if (task.status === 'STOPPED' || task.status === 'COMPLETE' || task.status === 'FAILED') {
    reply.status(400);
    return { error: 'TASK_NOT_ACTIVE' };
  }

  const result = await toolExecutor.execute(
    { toolId: body.toolId, parameters: body.parameters },
    { taskId: id, query: task.prompt }
  );

  if (result.success) {
    taskManager.addFeedEntry(id, {
      type: 'query',
      message: `Executed ${body.toolId}`,
      timestamp: Date.now(),
    });
  }

  return { result };
});

// =============================================================================
// Server Start
// =============================================================================

async function main() {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Monitor backend running on port ${PORT}`);
    console.log(`WebSocket server running on port ${WS_PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

export { app, taskManager, wsServer, toolExecutor, spendLedger };