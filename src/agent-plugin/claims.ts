/**
 * Describes the claims of a SD-JWT
 * @public
 */

export interface Claims {
  /**
   * Subject of the SD-JWT
   */
  sub?: string;
  cnf?: {
    jwk: JsonWebKey;
  };
  [key: string]: unknown;
}
