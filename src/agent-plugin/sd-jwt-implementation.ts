import type { Hasher, SaltGenerator } from '@sd-jwt/types';

/**
 * Describes the implementation of the SD-JWT plugin
 * @public
 */
export interface SdJWTImplementation {
  saltGenerator: SaltGenerator;
  hasher: Hasher;
  verifySignature: (
    data: string,
    signature: string,
    publicKey: JsonWebKey
  ) => Promise<boolean>;
}
