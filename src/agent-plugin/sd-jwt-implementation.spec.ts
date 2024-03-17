import { describe, it, expect, beforeAll } from 'vitest';
import type { SdJWTImplementation } from './sd-jwt-implementation';
import { digest, generateSalt } from '@sd-jwt/crypto-nodejs';
import { beforeEach } from 'node:test';
import { i } from 'vitest/dist/reporters-MmQN-57K';

describe('sd-jwt-implementation', () => {
  let implementation: SdJWTImplementation;
  beforeAll(() => {
    implementation = {
      hasher: digest,
      saltGenerator: generateSalt,
      verifySignature: async () => true,
    };
  });

  it('should generate a salt', async () => {
    console.log(implementation);
    const salt = await implementation.saltGenerator(16);
    expect(salt).toBeDefined();
  });

  it('should hash a string', async () => {
    const hash = await implementation.hasher('test', 'sha256');
    expect(hash).toBeDefined();
  });

  it('should verify a signature', async () => {
    const result = await implementation.verifySignature(
      'test',
      'signature',
      {}
    );
    expect(result).toBeTruthy();
  });
});
