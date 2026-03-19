import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseConfig, validateConfig, validateAddress, getConfig, resetConfig, ENV_KEYS, REQUIRED_ENV_VARS } from './config';

describe('config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetConfig();
    // Set required env vars for each test
    process.env[ENV_KEYS.TEMPO_RPC_URL] = 'https://rpc.tempo.network';
    process.env[ENV_KEYS.TREASURY_ADDRESS] = '0x1234567890123456789012345678901234567890';
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
    resetConfig();
  });

  describe('parseConfig', () => {
    it('should parse valid configuration', () => {
      const config = parseConfig();
      expect(config.tempo.rpcUrl).toBe('https://rpc.tempo.network');
      expect(config.treasury.address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should use default values for optional vars', () => {
      const config = parseConfig();
      expect(config.port).toBe(3001);
      // NODE_ENV may be 'test' in vitest environment
      expect(['development', 'test']).toContain(config.nodeEnv);
      expect(config.wsPort).toBe(3002);
      expect(config.llm.provider).toBe('mock');
      expect(config.demoMode).toBe(false);
    });

    it('should throw on missing required env vars', () => {
      delete process.env[ENV_KEYS.TEMPO_RPC_URL];
      delete process.env[ENV_KEYS.TREASURY_ADDRESS];

      expect(() => parseConfig()).toThrow(/Missing required environment variables/);
    });

    it('should parse custom port from env', () => {
      process.env[ENV_KEYS.PORT] = '8080';
      const config = parseConfig();
      expect(config.port).toBe(8080);
    });

    it('should parse chain ID as bigint', () => {
      process.env[ENV_KEYS.TEMPO_CHAIN_ID] = '648000';
      const config = parseConfig();
      expect(config.tempo.chainId).toBe(648000n);
    });

    it('should parse demo mode from env', () => {
      process.env[ENV_KEYS.DEMO_MODE] = 'true';
      const config = parseConfig();
      expect(config.demoMode).toBe(true);
    });
  });

  describe('validateAddress', () => {
    it('should accept valid 0x-prefixed addresses', () => {
      expect(() => validateAddress('0x1234567890123456789012345678901234567890', 'test')).not.toThrow();
    });

    it('should reject addresses without 0x prefix', () => {
      expect(() => validateAddress('1234567890123456789012345678901234567890', 'test')).toThrow(/Invalid test address/);
    });

    it('should reject addresses with wrong length', () => {
      expect(() => validateAddress('0x1234', 'test')).toThrow(/Invalid test address/);
    });

    it('should reject addresses with invalid characters', () => {
      expect(() => validateAddress('0xZZZZ5678901234567890123456789012345678', 'test')).toThrow(/Invalid test address/);
    });
  });

  describe('validateConfig', () => {
    it('should accept valid configuration', () => {
      const config = parseConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should warn on missing LLM API key for non-mock provider', () => {
      const warnSpy = vi.spyOn(console, 'warn');
      process.env[ENV_KEYS.LLM_PROVIDER] = 'anthropic';
      // Don't set LLM_API_KEY
      const config = parseConfig();
      validateConfig(config);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should reject invalid port', () => {
      process.env[ENV_KEYS.PORT] = '99999';
      expect(() => {
        const config = parseConfig();
        validateConfig(config);
      }).toThrow(/Invalid port/);
    });
  });

  describe('getConfig', () => {
    it('should return cached configuration', () => {
      const config1 = getConfig();
      const config2 = getConfig();
      expect(config1).toBe(config2);
    });

    it('should reset and reparse after resetConfig', () => {
      const config1 = getConfig();
      resetConfig();
      process.env[ENV_KEYS.PORT] = '9999';
      const config2 = getConfig();
      expect(config2.port).toBe(9999);
    });
  });

  describe('REQUIRED_ENV_VARS', () => {
    it('should include TEMPO_RPC_URL', () => {
      expect(REQUIRED_ENV_VARS).toContain(ENV_KEYS.TEMPO_RPC_URL);
    });

    it('should include TREASURY_ADDRESS', () => {
      expect(REQUIRED_ENV_VARS).toContain(ENV_KEYS.TREASURY_ADDRESS);
    });
  });
});

// Need to import vi for mocking
import { vi } from 'vitest';