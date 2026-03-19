/**
 * Backend Environment Configuration
 *
 * Parses and validates environment variables for the backend service.
 * Fail-fast: throws on missing required values at startup.
 */

// =============================================================================
// Types
// =============================================================================

export interface BackendConfig {
  /** Server port (default: 3001) */
  port: number;

  /** Node environment */
  nodeEnv: 'development' | 'production' | 'test';

  /** WebSocket port (default: 3002) */
  wsPort: number;

  /** Tempo/chain configuration */
  tempo: {
    chainId: bigint;
    rpcUrl: string;
  };

  /** Treasury contract address */
  treasury: {
    address: string;
  };

  /** LLM configuration */
  llm: {
    provider: 'anthropic' | 'openai' | 'mock';
    apiKey: string;
  };

  /** MPP client configuration */
  mpp: {
    baseUrl: string;
    apiKey?: string;
  };

  /** Premium providers configuration */
  premium: {
    cernApiKey?: string;
    ciaApiKey?: string;
  };

  /** Demo mode flag */
  demoMode: boolean;
}

// =============================================================================
// Environment Variable Names
// =============================================================================

export const ENV_KEYS = {
  // Server
  PORT: 'PORT',
  NODE_ENV: 'NODE_ENV',
  WS_PORT: 'WS_PORT',

  // Tempo/Chain
  TEMPO_CHAIN_ID: 'TEMPO_CHAIN_ID',
  TEMPO_RPC_URL: 'TEMPO_RPC_URL',

  // Treasury
  TREASURY_ADDRESS: 'TREASURY_ADDRESS',

  // LLM
  LLM_PROVIDER: 'LLM_PROVIDER',
  LLM_API_KEY: 'LLM_API_KEY',

  // MPP
  MPP_BASE_URL: 'MPP_BASE_URL',
  MPP_API_KEY: 'MPP_API_KEY',

  // Premium
  CERN_API_KEY: 'CERN_API_KEY',
  CIA_API_KEY: 'CIA_API_KEY',

  // Demo
  DEMO_MODE: 'DEMO_MODE',
} as const;

// =============================================================================
// Required vs Optional Environment Variables
// =============================================================================

/**
 * Environment variables that MUST be set (fail-fast if missing).
 */
export const REQUIRED_ENV_VARS: readonly string[] = [
  ENV_KEYS.TEMPO_RPC_URL,
  ENV_KEYS.TREASURY_ADDRESS,
];

/**
 * Environment variables with defaults.
 */
export const DEFAULT_VALUES = {
  [ENV_KEYS.PORT]: 3001,
  [ENV_KEYS.NODE_ENV]: 'development',
  [ENV_KEYS.WS_PORT]: 3002,
  [ENV_KEYS.TEMPO_CHAIN_ID]: 648000,
  [ENV_KEYS.LLM_PROVIDER]: 'mock',
  [ENV_KEYS.DEMO_MODE]: false,
} as const;

// =============================================================================
// Parsing Functions
// =============================================================================

/**
 * Gets an environment variable, throwing if required and missing.
 */
function getEnv(key: string, required: boolean = false): string | undefined {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Gets an environment variable with a default value.
 */
function getEnvWithDefault<T>(key: string, defaultValue: T): T {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  // Type coercion for defaults
  if (typeof defaultValue === 'number') {
    return parseInt(value, 10) as T;
  }
  if (typeof defaultValue === 'boolean') {
    return (value === 'true') as T;
  }
  return value as T;
}

/**
 * Parses and validates all environment variables.
 *
 * @throws Error if required variables are missing
 */
export function parseConfig(): BackendConfig {
  // Validate required variables
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Parse configuration
  const config: BackendConfig = {
    port: getEnvWithDefault(ENV_KEYS.PORT, DEFAULT_VALUES[ENV_KEYS.PORT] as number),
    nodeEnv: getEnvWithDefault(ENV_KEYS.NODE_ENV, DEFAULT_VALUES[ENV_KEYS.NODE_ENV] as 'development' | 'production' | 'test'),
    wsPort: getEnvWithDefault(ENV_KEYS.WS_PORT, DEFAULT_VALUES[ENV_KEYS.WS_PORT] as number),

    tempo: {
      chainId: BigInt(getEnvWithDefault(ENV_KEYS.TEMPO_CHAIN_ID, DEFAULT_VALUES[ENV_KEYS.TEMPO_CHAIN_ID] as number)),
      rpcUrl: getEnv(ENV_KEYS.TEMPO_RPC_URL, true)!,
    },

    treasury: {
      address: getEnv(ENV_KEYS.TREASURY_ADDRESS, true)!,
    },

    llm: {
      provider: getEnvWithDefault(ENV_KEYS.LLM_PROVIDER, DEFAULT_VALUES[ENV_KEYS.LLM_PROVIDER] as 'anthropic' | 'openai' | 'mock'),
      apiKey: getEnv(ENV_KEYS.LLM_API_KEY) || '',
    },

    mpp: {
      baseUrl: getEnv(ENV_KEYS.MPP_BASE_URL) || 'https://mpp.example.com',
      apiKey: getEnv(ENV_KEYS.MPP_API_KEY),
    },

    premium: {
      cernApiKey: getEnv(ENV_KEYS.CERN_API_KEY),
      ciaApiKey: getEnv(ENV_KEYS.CIA_API_KEY),
    },

    demoMode: getEnvWithDefault(ENV_KEYS.DEMO_MODE, DEFAULT_VALUES[ENV_KEYS.DEMO_MODE] as boolean),
  };

  return config;
}

/**
 * Validates that an Ethereum address is properly formatted.
 */
export function validateAddress(address: string, name: string): void {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid ${name} address: ${address} (expected 0x-prefixed 40-char hex)`);
  }
}

/**
 * Validates the configuration at startup.
 *
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: BackendConfig): void {
  validateAddress(config.treasury.address, 'treasury');

  if (config.llm.provider === 'anthropic' && !config.llm.apiKey) {
    console.warn('Warning: LLM_PROVIDER is anthropic but LLM_API_KEY is not set');
  }

  if (config.llm.provider === 'openai' && !config.llm.apiKey) {
    console.warn('Warning: LLM_PROVIDER is openai but LLM_API_KEY is not set');
  }

  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}`);
  }

  if (config.wsPort < 1 || config.wsPort > 65535) {
    throw new Error(`Invalid wsPort: ${config.wsPort}`);
  }
}

// =============================================================================
// Singleton Config Instance
// =============================================================================

let _config: BackendConfig | null = null;

/**
 * Gets the parsed configuration, parsing if needed.
 *
 * @throws Error if configuration is invalid
 */
export function getConfig(): BackendConfig {
  if (!_config) {
    _config = parseConfig();
    validateConfig(_config);
  }
  return _config;
}

/**
 * Resets the config singleton (useful for testing).
 */
export function resetConfig(): void {
  _config = null;
}