import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager } from './task-manager';
import { TaskStatus } from '@monitor/shared';

describe('TaskManager', () => {
  let taskManager: TaskManager;
  const mockTaskId = 'task-test-123';
  const mockOwner = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    taskManager = new TaskManager();
  });

  // ===========================================================================
  // Task Creation
  // ===========================================================================

  describe('createTask', () => {
    it('should create a new task with CREATED status', () => {
      const task = taskManager.createTask({
        id: mockTaskId,
        prompt: 'Research quantum computing',
        budgetWei: BigInt('1000000000000000000'),
        deadline: Date.now() + 3600000,
        owner: mockOwner,
      });

      expect(task.id).toBe(mockTaskId);
      expect(task.status).toBe('CREATED');
      expect(task.prompt).toBe('Research quantum computing');
      expect(task.budgetWei).toBe(BigInt('1000000000000000000'));
    });

    it('should reject duplicate task IDs', () => {
      taskManager.createTask({
        id: mockTaskId,
        prompt: 'First task',
        budgetWei: BigInt('1000000000000000000'),
        deadline: Date.now() + 3600000,
        owner: mockOwner,
      });

      expect(() =>
        taskManager.createTask({
          id: mockTaskId,
          prompt: 'Duplicate task',
          budgetWei: BigInt('1000000000000000000'),
          deadline: Date.now() + 3600000,
          owner: mockOwner,
        })
      ).toThrow('TASK_EXISTS');
    });
  });

  // ===========================================================================
  // State Transitions
  // ===========================================================================

  describe('state transitions', () => {
    beforeEach(() => {
      taskManager.createTask({
        id: mockTaskId,
        prompt: 'Test task',
        budgetWei: BigInt('1000000000000000000'),
        deadline: Date.now() + 3600000,
        owner: mockOwner,
      });
    });

    it('should transition CREATED -> FUNDING', () => {
      taskManager.transitionStatus(mockTaskId, 'FUNDING');
      const task = taskManager.getTask(mockTaskId);
      expect(task?.status).toBe('FUNDING');
    });

    it('should transition FUNDING -> RUNNING', () => {
      taskManager.transitionStatus(mockTaskId, 'FUNDING');
      taskManager.transitionStatus(mockTaskId, 'RUNNING');
      const task = taskManager.getTask(mockTaskId);
      expect(task?.status).toBe('RUNNING');
    });

    it('should transition RUNNING -> COMPILING', () => {
      taskManager.transitionStatus(mockTaskId, 'FUNDING');
      taskManager.transitionStatus(mockTaskId, 'RUNNING');
      taskManager.transitionStatus(mockTaskId, 'COMPILING');
      const task = taskManager.getTask(mockTaskId);
      expect(task?.status).toBe('COMPILING');
    });

    it('should transition COMPILING -> ENHANCING', () => {
      taskManager.transitionStatus(mockTaskId, 'FUNDING');
      taskManager.transitionStatus(mockTaskId, 'RUNNING');
      taskManager.transitionStatus(mockTaskId, 'COMPILING');
      taskManager.transitionStatus(mockTaskId, 'ENHANCING');
      const task = taskManager.getTask(mockTaskId);
      expect(task?.status).toBe('ENHANCING');
    });

    it('should transition ENHANCING -> COMPLETE', () => {
      taskManager.transitionStatus(mockTaskId, 'FUNDING');
      taskManager.transitionStatus(mockTaskId, 'RUNNING');
      taskManager.transitionStatus(mockTaskId, 'COMPILING');
      taskManager.transitionStatus(mockTaskId, 'ENHANCING');
      taskManager.transitionStatus(mockTaskId, 'COMPLETE');
      const task = taskManager.getTask(mockTaskId);
      expect(task?.status).toBe('COMPLETE');
    });

    it('should transition to FAILED on error', () => {
      taskManager.transitionStatus(mockTaskId, 'FUNDING');
      taskManager.transitionStatus(mockTaskId, 'RUNNING');
      taskManager.transitionStatus(mockTaskId, 'FAILED');
      const task = taskManager.getTask(mockTaskId);
      expect(task?.status).toBe('FAILED');
    });

    it('should transition to STOPPED on emergency stop', () => {
      taskManager.transitionStatus(mockTaskId, 'FUNDING');
      taskManager.transitionStatus(mockTaskId, 'RUNNING');
      taskManager.stopTask(mockTaskId);
      const task = taskManager.getTask(mockTaskId);
      expect(task?.status).toBe('STOPPED');
    });

    it('should reject invalid transitions', () => {
      expect(() =>
        taskManager.transitionStatus(mockTaskId, 'COMPLETE')
      ).toThrow('INVALID_TRANSITION');
    });
  });

  // ===========================================================================
  // Feed Entries
  // ===========================================================================

  describe('feed entries', () => {
    beforeEach(() => {
      taskManager.createTask({
        id: mockTaskId,
        prompt: 'Test task',
        budgetWei: BigInt('1000000000000000000'),
        deadline: Date.now() + 3600000,
        owner: mockOwner,
      });
    });

    it('should add feed entries', () => {
      taskManager.addFeedEntry(mockTaskId, {
        type: 'status',
        message: 'Task started',
        timestamp: Date.now(),
      });

      const entries = taskManager.getFeedEntries(mockTaskId);
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('status');
      expect(entries[0].message).toBe('Task started');
    });

    it('should add spend entries to feed', () => {
      taskManager.addFeedEntry(mockTaskId, {
        type: 'spend',
        message: 'Spent $0.10 on CERN',
        timestamp: Date.now(),
        amountWei: BigInt('100000000000000000'),
        serviceId: 'cern-temporal',
      });

      const entries = taskManager.getFeedEntries(mockTaskId);
      expect(entries[0].type).toBe('spend');
      expect(entries[0].amountWei).toBe(BigInt('100000000000000000'));
    });

    it('should return entries in chronological order', () => {
      const now = Date.now();
      taskManager.addFeedEntry(mockTaskId, { type: 'status', message: 'First', timestamp: now });
      taskManager.addFeedEntry(mockTaskId, { type: 'query', message: 'Second', timestamp: now + 1000 });
      taskManager.addFeedEntry(mockTaskId, { type: 'complete', message: 'Third', timestamp: now + 2000 });

      const entries = taskManager.getFeedEntries(mockTaskId);
      expect(entries[0].message).toBe('First');
      expect(entries[1].message).toBe('Second');
      expect(entries[2].message).toBe('Third');
    });
  });

  // ===========================================================================
  // Rehydration
  // ===========================================================================

  describe('rehydrate', () => {
    beforeEach(() => {
      taskManager.createTask({
        id: mockTaskId,
        prompt: 'Test task',
        budgetWei: BigInt('1000000000000000000'),
        deadline: Date.now() + 3600000,
        owner: mockOwner,
      });
      taskManager.transitionStatus(mockTaskId, 'FUNDING');
      taskManager.transitionStatus(mockTaskId, 'RUNNING');
      taskManager.addFeedEntry(mockTaskId, {
        type: 'status',
        message: 'Running query',
        timestamp: Date.now(),
      });
    });

    it('should return full task state for rehydration', () => {
      const state = taskManager.rehydrate(mockTaskId);
      expect(state).not.toBeNull();
      expect(state!.task).toBeDefined();
      expect(state!.task.status).toBe('RUNNING');
      // 2 status transitions + 1 custom entry = 3 total
      expect(state!.feedEntries.length).toBeGreaterThanOrEqual(3);
      expect(state!.feedEntries.some(e => e.message === 'Running query')).toBe(true);
    });

    it('should return null for non-existent task', () => {
      const state = taskManager.rehydrate('non-existent');
      expect(state).toBeNull();
    });
  });

  // ===========================================================================
  // Emergency Stop
  // ===========================================================================

  describe('emergency stop', () => {
    beforeEach(() => {
      taskManager.createTask({
        id: mockTaskId,
        prompt: 'Test task',
        budgetWei: BigInt('1000000000000000000'),
        deadline: Date.now() + 3600000,
        owner: mockOwner,
      });
    });

    it('should stop task and prevent further execution', () => {
      taskManager.transitionStatus(mockTaskId, 'FUNDING');
      taskManager.transitionStatus(mockTaskId, 'RUNNING');
      
      const stopped = taskManager.stopTask(mockTaskId);
      expect(stopped).toBe(true);
      
      const task = taskManager.getTask(mockTaskId);
      expect(task?.status).toBe('STOPPED');
    });

    it('should not allow operations on stopped task', () => {
      taskManager.transitionStatus(mockTaskId, 'FUNDING');
      taskManager.transitionStatus(mockTaskId, 'RUNNING');
      taskManager.stopTask(mockTaskId);

      expect(() =>
        taskManager.transitionStatus(mockTaskId, 'COMPILING')
      ).toThrow('TASK_STOPPED');
    });
  });

  // ===========================================================================
  // List Tasks
  // ===========================================================================

  describe('listTasks', () => {
    it('should list all tasks', () => {
      taskManager.createTask({
        id: 'task-1',
        prompt: 'Task 1',
        budgetWei: BigInt('1000000000000000000'),
        deadline: Date.now() + 3600000,
        owner: mockOwner,
      });
      taskManager.createTask({
        id: 'task-2',
        prompt: 'Task 2',
        budgetWei: BigInt('2000000000000000000'),
        deadline: Date.now() + 7200000,
        owner: mockOwner,
      });

      const tasks = taskManager.listTasks();
      expect(tasks).toHaveLength(2);
    });

    it('should filter by status', () => {
      taskManager.createTask({
        id: 'task-1',
        prompt: 'Task 1',
        budgetWei: BigInt('1000000000000000000'),
        deadline: Date.now() + 3600000,
        owner: mockOwner,
      });
      taskManager.createTask({
        id: 'task-2',
        prompt: 'Task 2',
        budgetWei: BigInt('2000000000000000000'),
        deadline: Date.now() + 7200000,
        owner: mockOwner,
      });
      taskManager.transitionStatus('task-2', 'FUNDING');

      const runningTasks = taskManager.listTasks({ status: 'CREATED' });
      expect(runningTasks).toHaveLength(1);
      expect(runningTasks[0].id).toBe('task-1');
    });
  });
});