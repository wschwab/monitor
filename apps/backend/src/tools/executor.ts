/**
 * Fake Tool Executor
 *
 * Simulates tool execution for demo mode and testing.
 * Returns deterministic fixtures without calling real APIs.
 */

import {
  ToolCall,
  ToolResult,
  getTool,
  getToolCost,
  isPremiumTool,
} from './definitions';
import { PremiumExecutor } from '../premium-executor';

// =============================================================================
// Types
// =============================================================================

export interface ExecutorOptions {
  demoMode?: boolean;
  premiumExecutor?: PremiumExecutor;
}

export interface ExecutionContext {
  taskId: string;
  query: string;
}

// =============================================================================
// Mock Data Fixtures
// =============================================================================

interface FixtureData {
  [key: string]: string | object | object[] | undefined;
}

const EXA_FIXTURES: Record<string, FixtureData> = {
  'quantum': {
    title: 'Quantum Computing Research',
    results: [
      { title: 'Introduction to Quantum Computing', url: 'https://example.com/qc1', snippet: 'Quantum computing uses qubits...' },
      { title: 'Quantum Algorithms', url: 'https://example.com/qc2', snippet: 'Shor\'s algorithm and Grover\'s algorithm...' },
    ],
  },
  'higgs': {
    title: 'Higgs Boson Search Results',
    results: [
      { title: 'Higgs Discovery Paper', url: 'https://example.com/higgs1', snippet: 'Discovery of a boson at 125 GeV...' },
    ],
  },
  'default': {
    title: 'Search Results',
    results: [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Relevant content...' },
      { title: 'Result 2', url: 'https://example.com/2', snippet: 'More relevant content...' },
    ],
  },
};

const PERPLEXITY_FIXTURES: Record<string, string> = {
  'what is': 'This is a fundamental concept that has shaped our understanding of the field.',
  'how does': 'It works through a complex interplay of mechanisms that researchers are still studying.',
  'why is': 'This phenomenon occurs due to underlying principles discovered in recent research.',
  'default': 'Based on available research, this topic involves multiple interconnected factors.',
};

// =============================================================================
// Fake Tool Executor
// =============================================================================

export class FakeToolExecutor {
  private demoMode: boolean;
  private premiumExecutor?: PremiumExecutor;

  constructor(options: ExecutorOptions = {}) {
    this.demoMode = options.demoMode ?? true;
    this.premiumExecutor = options.premiumExecutor;
  }

  /**
   * Execute a tool call (fake implementation).
   */
  async execute(call: ToolCall, context: ExecutionContext): Promise<ToolResult> {
    const tool = getTool(call.toolId);
    if (!tool) {
      return {
        success: false,
        toolId: call.toolId,
        data: null,
        costWei: BigInt(0),
        error: 'TOOL_NOT_FOUND',
      };
    }

    const costWei = getToolCost(call.toolId);

    try {
      // Simulate execution delay
      await this.delay(100);

      switch (tool.id) {
        case 'exa':
          return this.executeExa(call, context, costWei);
        case 'perplexity':
          return this.executePerplexity(call, context, costWei);
        case 'allium':
          return this.executeAllium(call, context, costWei);
        case 'cern-temporal':
        case 'cia-declassified':
          return await this.executePremium(call, context, costWei);
        case 'llm-synthesize':
          return this.executeLLM(call, context, costWei);
        case 'cover-image':
          return this.executeCoverImage(call, context, costWei);
        case 'audio-briefing':
          return this.executeAudioBriefing(call, context, costWei);
        default:
          return {
            success: false,
            toolId: call.toolId,
            data: null,
            costWei: BigInt(0),
            error: 'UNKNOWN_TOOL',
          };
      }
    } catch (error) {
      return {
        success: false,
        toolId: call.toolId,
        data: null,
        costWei,
        error: error instanceof Error ? error.message : 'EXECUTION_ERROR',
      };
    }
  }

  /**
   * Execute multiple tools in sequence.
   */
  async executeBatch(calls: ToolCall[], context: ExecutionContext): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const call of calls) {
      const result = await this.execute(call, context);
      results.push(result);
      // Small delay between calls
      await this.delay(50);
    }
    return results;
  }

  // =============================================================================
  // Individual Tool Executors
  // =============================================================================

  private executeExa(call: ToolCall, context: ExecutionContext, costWei: bigint): ToolResult {
    const query = (call.parameters.query as string) || context.query;
    const normalizedQuery = query.toLowerCase();

    let data = EXA_FIXTURES.default;
    for (const [key, fixture] of Object.entries(EXA_FIXTURES)) {
      if (normalizedQuery.includes(key)) {
        data = fixture;
        break;
      }
    }

    return {
      success: true,
      toolId: 'exa',
      data: {
        ...data,
        query,
        timestamp: new Date().toISOString(),
      },
      costWei,
    };
  }

  private executePerplexity(call: ToolCall, context: ExecutionContext, costWei: bigint): ToolResult {
    const question = (call.parameters.question as string) || context.query;
    const normalizedQuestion = question.toLowerCase();

    let answer = PERPLEXITY_FIXTURES.default;
    for (const [key, response] of Object.entries(PERPLEXITY_FIXTURES)) {
      if (normalizedQuestion.startsWith(key)) {
        answer = response;
        break;
      }
    }

    return {
      success: true,
      toolId: 'perplexity',
      data: {
        answer,
        question,
        citations: ['https://example.com/source1', 'https://example.com/source2'],
        timestamp: new Date().toISOString(),
      },
      costWei,
    };
  }

  private executeAllium(call: ToolCall, context: ExecutionContext, costWei: bigint): ToolResult {
    return {
      success: true,
      toolId: 'allium',
      data: {
        query: call.parameters.query,
        result: 'Blockchain data query result (mock)',
        timestamp: new Date().toISOString(),
      },
      costWei,
    };
  }

  private async executePremium(call: ToolCall, context: ExecutionContext, costWei: bigint): Promise<ToolResult> {
    if (!this.premiumExecutor) {
      return {
        success: false,
        toolId: call.toolId,
        data: null,
        costWei: BigInt(0),
        error: 'PREMIUM_EXECUTOR_NOT_CONFIGURED',
      };
    }

    const result = await this.premiumExecutor.fetchPremiumData({
      taskId: context.taskId,
      provider: call.toolId as 'cern-temporal' | 'cia-declassified',
      query: (call.parameters.query as string) || context.query,
    });

    return {
      success: result.success,
      toolId: call.toolId,
      data: result.data,
      costWei: result.spendEntry?.amountWei || costWei,
      error: result.error,
    };
  }

  private executeLLM(call: ToolCall, context: ExecutionContext, costWei: bigint): ToolResult {
    const data = call.parameters.data;
    const prompt = call.parameters.prompt as string;

    // Generate a fake synthesis
    const synthesis = this.generateFakeSynthesis(prompt, data);

    return {
      success: true,
      toolId: 'llm-synthesize',
      data: {
        report: synthesis,
        sources: ['Exa search results', 'Premium provider data'],
        generatedAt: new Date().toISOString(),
      },
      costWei,
    };
  }

  private executeCoverImage(call: ToolCall, context: ExecutionContext, costWei: bigint): ToolResult {
    return {
      success: true,
      toolId: 'cover-image',
      data: {
        imageUrl: 'https://example.com/mock-cover-image.png',
        title: call.parameters.title,
        generatedAt: new Date().toISOString(),
      },
      costWei,
    };
  }

  private executeAudioBriefing(call: ToolCall, context: ExecutionContext, costWei: bigint): ToolResult {
    return {
      success: true,
      toolId: 'audio-briefing',
      data: {
        audioUrl: 'https://example.com/mock-audio.mp3',
        duration: 120, // seconds
        generatedAt: new Date().toISOString(),
      },
      costWei,
    };
  }

  // =============================================================================
  // Helpers
  // =============================================================================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateFakeSynthesis(prompt: string, data: unknown): string {
    return `# Research Report: ${prompt}\n\n` +
      `## Executive Summary\n\n` +
      `Based on our comprehensive analysis of multiple data sources, we have gathered ` +
      `significant insights regarding ${prompt}. The research involved queries to ` +
      `premium data providers and extensive web searches.\n\n` +
      `## Key Findings\n\n` +
      `1. **Primary Discovery**: The data reveals important patterns related to the topic.\n` +
      `2. **Secondary Insights**: Additional context provides deeper understanding.\n` +
      `3. **Implications**: These findings suggest several potential applications.\n\n` +
      `## Data Sources\n\n` +
      `- CERN Open Data Portal\n` +
      `- Exa Search Results\n` +
      `- Academic Databases\n\n` +
      `## Conclusion\n\n` +
      `The research demonstrates significant potential in this area. Further investigation ` +
      `may yield additional valuable insights.\n\n` +
      `*Generated by Monitor AI Research Agent*\n` +
      `*Timestamp: ${new Date().toISOString()}*`;
  }
}