/**
 * Task Manager
 *
 * Manages task lifecycle with state machine transitions.
 * In-memory storage with feed entry tracking.
 */

import { Task, TaskStatus, TaskRecord, FeedEntry } from '@monitor/shared';

// =============================================================================
// Types
// =============================================================================

export interface CreateTaskInput {
  id: string;
  prompt: string;
  budgetWei: bigint;
  deadline: number;
  owner: string;
  sources?: string[];
  enhancements?: {
    coverImage?: boolean;
    audioBriefing?: boolean;
    uploadDelivery?: boolean;
    emailDelivery?: boolean;
  };
}

export interface RehydrateResult {
  task: TaskRecord;
  feedEntries: FeedEntry[];
}

export interface ListTasksFilter {
  status?: TaskStatus;
  owner?: string;
}

// =============================================================================
// Valid State Transitions
// =============================================================================

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  CREATED: ['FUNDING', 'FAILED'],
  FUNDING: ['RUNNING', 'FAILED', 'STOPPED'],
  RUNNING: ['COMPILING', 'FAILED', 'STOPPED'],
  COMPILING: ['ENHANCING', 'COMPLETE', 'FAILED'],
  ENHANCING: ['COMPLETE', 'FAILED'],
  COMPLETE: [],
  FAILED: [],
  STOPPED: [],
};

// =============================================================================
// Task Manager
// =============================================================================

export class TaskManager {
  private tasks: Map<string, TaskRecord> = new Map();
  private feedEntries: Map<string, FeedEntry[]> = new Map();

  /**
   * Create a new task.
   */
  createTask(input: CreateTaskInput): TaskRecord {
    if (this.tasks.has(input.id)) {
      throw new Error('TASK_EXISTS');
    }

    const task: TaskRecord = {
      id: input.id,
      prompt: input.prompt,
      budgetWei: input.budgetWei,
      spentWei: BigInt(0),
      status: 'CREATED',
      createdAt: Date.now(),
      deadline: input.deadline,
      sources: input.sources || [],
      enhancements: {
        coverImage: input.enhancements?.coverImage || false,
        audioBriefing: input.enhancements?.audioBriefing || false,
        uploadDelivery: input.enhancements?.uploadDelivery || false,
        emailDelivery: input.enhancements?.emailDelivery || false,
      },
      owner: input.owner,
    };

    this.tasks.set(input.id, task);
    this.feedEntries.set(input.id, []);

    return task;
  }

  /**
   * Get a task by ID.
   */
  getTask(id: string): TaskRecord | undefined {
    return this.tasks.get(id);
  }

  /**
   * Transition task status with validation.
   */
  transitionStatus(id: string, newStatus: TaskStatus): TaskRecord {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error('TASK_NOT_FOUND');
    }

    if (task.status === 'STOPPED') {
      throw new Error('TASK_STOPPED');
    }

    const validNextStatuses = VALID_TRANSITIONS[task.status];
    if (!validNextStatuses.includes(newStatus)) {
      throw new Error(`INVALID_TRANSITION: Cannot transition from ${task.status} to ${newStatus}`);
    }

    task.status = newStatus;

    // Add status change to feed
    this.addFeedEntry(id, {
      type: 'status',
      message: `Status changed to ${newStatus}`,
      timestamp: Date.now(),
    });

    return task;
  }

  /**
   * Add a feed entry for a task.
   */
  addFeedEntry(id: string, entry: Omit<FeedEntry, 'id'>): FeedEntry {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error('TASK_NOT_FOUND');
    }

    const fullEntry: FeedEntry = {
      id: `feed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...entry,
    };

    const entries = this.feedEntries.get(id) || [];
    entries.push(fullEntry);
    this.feedEntries.set(id, entries);

    return fullEntry;
  }

  /**
   * Get feed entries for a task.
   */
  getFeedEntries(id: string): FeedEntry[] {
    return this.feedEntries.get(id) || [];
  }

  /**
   * Stop a task (emergency stop).
   */
  stopTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) {
      return false;
    }

    // Can only stop active tasks
    const stoppableStatuses: TaskStatus[] = ['CREATED', 'FUNDING', 'RUNNING', 'COMPILING', 'ENHANCING'];
    if (!stoppableStatuses.includes(task.status)) {
      return false;
    }

    task.status = 'STOPPED';

    this.addFeedEntry(id, {
      type: 'status',
      message: 'Task stopped by user',
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Rehydrate task state (for page refresh during run).
   */
  rehydrate(id: string): RehydrateResult | null {
    const task = this.tasks.get(id);
    if (!task) {
      return null;
    }

    const entries = this.feedEntries.get(id) || [];

    return {
      task,
      feedEntries: [...entries],
    };
  }

  /**
   * List all tasks with optional filtering.
   */
  listTasks(filter?: ListTasksFilter): TaskRecord[] {
    let tasks = Array.from(this.tasks.values());

    if (filter?.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }

    if (filter?.owner) {
      tasks = tasks.filter(t => t.owner === filter.owner);
    }

    return tasks;
  }

  /**
   * Update task spent amount.
   */
  updateSpent(id: string, amountWei: bigint): void {
    const task = this.tasks.get(id);
    if (task) {
      task.spentWei += amountWei;
    }
  }

  /**
   * Delete a task (cleanup).
   */
  deleteTask(id: string): boolean {
    this.feedEntries.delete(id);
    return this.tasks.delete(id);
  }

  /**
   * Get task count.
   */
  getTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * Get active task count.
   */
  getActiveTaskCount(): number {
    const activeStatuses: TaskStatus[] = ['CREATED', 'FUNDING', 'RUNNING', 'COMPILING', 'ENHANCING'];
    return Array.from(this.tasks.values()).filter(t =>
      activeStatuses.includes(t.status)
    ).length;
  }
}