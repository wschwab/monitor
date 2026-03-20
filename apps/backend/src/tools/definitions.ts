/**
 * Tool Definitions
 *
 * Defines all available tools for the agent executor.
 */

import { PremiumProvider } from '../premium-executor';

// =============================================================================
// Tool Types
// =============================================================================

export type ToolType = 'direct_mpp' | 'premium' | 'llm' | 'enhancement';

export interface Tool {
  id: string;
  name: string;
  description: string;
  type: ToolType;
  costEstimate: string;
  parameters: ToolParameter[];
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
}

export interface ToolCall {
  toolId: string;
  parameters: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  toolId: string;
  data: unknown;
  costWei: bigint;
  error?: string;
}

// =============================================================================
// Tool Registry
// =============================================================================

export const TOOLS: Tool[] = [
  // Direct MPP Providers
  {
    id: 'exa',
    name: 'Exa Search',
    description: 'Web search and content extraction using Exa API',
    type: 'direct_mpp',
    costEstimate: '0.01 USDC per query',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Search query' },
      { name: 'numResults', type: 'number', required: false, description: 'Number of results' },
    ],
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    description: 'Question answering using Perplexity API',
    type: 'direct_mpp',
    costEstimate: '0.05 USDC per query',
    parameters: [
      { name: 'question', type: 'string', required: true, description: 'Question to answer' },
    ],
  },
  {
    id: 'allium',
    name: 'Allium Data',
    description: 'Blockchain data queries using Allium API',
    type: 'direct_mpp',
    costEstimate: '0.02 USDC per query',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Blockchain query' },
    ],
  },
  // Premium Providers (Treasury-backed)
  {
    id: 'cern-temporal',
    name: 'CERN Temporal',
    description: 'Scientific data from CERN Open Data portal',
    type: 'premium',
    costEstimate: '0.10 USDC per query',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Scientific query' },
    ],
  },
  {
    id: 'cia-declassified',
    name: 'CIA Declassified',
    description: 'Historical documents from CIA FOIA Reading Room',
    type: 'premium',
    costEstimate: '0.10 USDC per query',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Document search query' },
    ],
  },
  // LLM
  {
    id: 'llm-synthesize',
    name: 'LLM Synthesis',
    description: 'Synthesize research report from gathered data',
    type: 'llm',
    costEstimate: '0.50 USDC per report',
    parameters: [
      { name: 'data', type: 'string', required: true, description: 'JSON data to synthesize' },
      { name: 'prompt', type: 'string', required: true, description: 'Original user prompt' },
    ],
  },
  // Enhancements
  {
    id: 'cover-image',
    name: 'Cover Image',
    description: 'Generate cover image for report',
    type: 'enhancement',
    costEstimate: '0.20 USDC per image',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Report title' },
    ],
  },
  {
    id: 'audio-briefing',
    name: 'Audio Briefing',
    description: 'Generate audio summary of report',
    type: 'enhancement',
    costEstimate: '0.15 USDC per audio',
    parameters: [
      { name: 'text', type: 'string', required: true, description: 'Report text to narrate' },
    ],
  },
];

// =============================================================================
// Tool Lookup
// =============================================================================

export function getTool(toolId: string): Tool | undefined {
  return TOOLS.find(t => t.id === toolId);
}

export function getToolsByType(type: ToolType): Tool[] {
  return TOOLS.filter(t => t.type === type);
}

export function isPremiumTool(toolId: string): boolean {
  const tool = getTool(toolId);
  return tool?.type === 'premium';
}

export function isDirectMPP(toolId: string): boolean {
  const tool = getTool(toolId);
  return tool?.type === 'direct_mpp';
}

// =============================================================================
// Tool Costs (in wei)
// =============================================================================

export const TOOL_COSTS: Record<string, bigint> = {
  'exa': BigInt('10000000000000000'),          // 0.01 USDC
  'perplexity': BigInt('50000000000000000'),   // 0.05 USDC
  'allium': BigInt('20000000000000000'),       // 0.02 USDC
  'cern-temporal': BigInt('100000000000000000'), // 0.10 USDC
  'cia-declassified': BigInt('100000000000000000'), // 0.10 USDC
  'llm-synthesize': BigInt('500000000000000000'), // 0.50 USDC
  'cover-image': BigInt('200000000000000000'), // 0.20 USDC
  'audio-briefing': BigInt('150000000000000000'), // 0.15 USDC
};

export function getToolCost(toolId: string): bigint {
  return TOOL_COSTS[toolId] || BigInt(0);
}