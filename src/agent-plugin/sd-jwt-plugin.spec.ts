import { subtle } from 'node:crypto';
import { digest, generateSalt } from '@sd-jwt/crypto-nodejs';
import type {
  DisclosureFrame,
  PresentationFrame,
  kbPayload,
} from '@sd-jwt/types';
import { createAgent } from '@veramo/core';
import type {
  IDIDManager,
  IKeyManager,
  IResolver,
  TAgent,
} from '@veramo/core-types';
import {
  DIDStore,
  Entities,
  KeyStore,
  PrivateKeyStore,
  migrations,
} from '@veramo/data-store';
import { DIDManager } from '@veramo/did-manager';
import {
  type JwkCreateIdentifierOptions,
  JwkDIDProvider,
  getDidJwkResolver,
} from '@veramo/did-provider-jwk';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { KeyManager } from '@veramo/key-manager';
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local';
import { type JwkDidSupportedKeyTypes, createJWK } from '@veramo/utils';
import {
  type DIDDocument,
  Resolver,
  type VerificationMethod,
} from 'did-resolver';
import { DataSource } from 'typeorm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SdJwtVcPayload } from '@sd-jwt/sd-jwt-vc';
import { decodeSdJwt } from '@sd-jwt/decode';
import type { KBJwt } from '@sd-jwt/core';
import { type ISDJwtPlugin, SDJwtPlugin } from '../index';

async function verifySignature(
  data: string,
  signature: string,
  key: JsonWebKey
) {
  let { alg, crv } = key;
  if (alg === 'ES256') alg = 'ECDSA';
  const publicKey = await subtle.importKey(
    'jwk',
    key,
    { name: alg, namedCurve: crv } as EcKeyImportParams,
    true,
    ['verify']
  );
  return Promise.resolve(
    subtle.verify(
      { name: alg as string, hash: 'SHA-256' },
      publicKey,
      Buffer.from(signature, 'base64'),
      Buffer.from(data)
    )
  );
}

type AgentType = IDIDManager & IKeyManager & IResolver & ISDJwtPlugin;

describe('Agent plugin', () => {
  let agent: TAgent<AgentType>;

  let issuer: string;

  let holder: string;

  // Issuer define the claims object with the user's information
  const claims = {
    given_name: 'John',
    family_name: 'Deo',
    email: 'johndeo@example.com',
    phone: '+1-202-555-0101',
    address: {
      street_address: '123 Main St',
      locality: 'Anytown',
      region: 'Anystate',
      country: 'US',
    },
    birthdate: '1940-01-01',
  };

  // Issuer Define the disclosure frame to specify which claims can be disclosed
  const disclosureFrame: DisclosureFrame<typeof claims> = {
    _sd: [
      'given_name',
      'family_name',
      'email',
      'phone',
      'address',
      'birthdate',
    ],
  };

  beforeAll(async () => {
    const KMS_SECRET_KEY = '000102030405060708090a0b0c0d0e0f';
    const dbConnection = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: Entities,
      migrations,
      synchronize: true,
      logging: false,
    }).initialize();
    agent = createAgent<AgentType>({
      plugins: [
        new SDJwtPlugin({
          hasher: digest,
          saltGenerator: generateSalt,
          verifySignature,
        }),
        new KeyManager({
          store: new KeyStore(dbConnection),
          kms: {
            local: new KeyManagementSystem(
              new PrivateKeyStore(dbConnection, new SecretBox(KMS_SECRET_KEY))
            ),
          },
        }),
        new DIDResolverPlugin({
          resolver: new Resolver({
            ...getDidJwkResolver(),
          }),
        }),
        new DIDManager({
          store: new DIDStore(dbConnection),
          defaultProvider: 'did:jwk',
          providers: {
            'did:jwk': new JwkDIDProvider({
              defaultKms: 'local',
            }),
          },
        }),
      ],
    });
    issuer = await agent
      .didManagerCreate({
        kms: 'local',
        provider: 'did:jwk',
        alias: 'issuer',
        //we use this curve since nodejs does not support ES256k which is the default one.
        options: { keyType: 'Secp256r1' } as JwkCreateIdentifierOptions,
      })
      .then((did) => {
        // we add a key reference
        return `${did.did}#0`;
      });
    holder = await agent
      .didManagerCreate({
        kms: 'local',
        provider: 'did:jwk',
        alias: 'holder',
        //we use this curve since nodejs does not support ES256k which is the default one.
        options: { keyType: 'Secp256r1' } as JwkCreateIdentifierOptions,
      })
      .then((did) => `${did.did}#0`);
    // claims.sub = holder;
  });

  it('create a sd-jwt', async () => {
    const credentialPayload: SdJwtVcPayload = {
      ...claims,
      iss: issuer,
      iat: new Date().getTime() / 1000,
      vct: '',
    };
    const credential = await agent.createSdJwtVc({
      credentialPayload,
      disclosureFrame,
    });
    expect(credential).toBeDefined();
  });

  it('create sd without an issuer', async () => {
    const credentialPayload = {
      ...claims,
      iat: new Date().getTime() / 1000,
      vct: '',
    };
    expect(
      agent.createSdJwtVc({
        credentialPayload: credentialPayload as unknown as SdJwtVcPayload,
        disclosureFrame,
      })
    ).rejects.toThrow('credential.issuer must not be empty');
  });

  it('creat sd without the issuers key reference', async () => {
    const credentialPayload: SdJwtVcPayload = {
      ...claims,
      iss: 'did:web:issuer',
      iat: new Date().getTime() / 1000,
      vct: '',
    };
    expect(
      agent.createSdJwtVc({
        credentialPayload,
        disclosureFrame,
      })
    ).rejects.toThrow('credential.issuer must reference a key');
  });

  it('verify a sd-jwt', async () => {
    const credentialPayload: SdJwtVcPayload = {
      ...claims,
      iss: issuer,
      iat: new Date().getTime() / 1000,
      vct: '',
    };
    const credential = await agent.createSdJwtVc({
      credentialPayload,
      disclosureFrame: disclosureFrame,
    });
    const verified = await agent.verifySdJwtVc({
      credential: credential.credential,
    });
  }, 5000);

  it('create a presentation', async () => {
    const credentialPayload: SdJwtVcPayload = {
      ...claims,
      sub: holder,
      iss: issuer,
      iat: new Date().getTime() / 1000,
      vct: '',
    };
    const credential = await agent.createSdJwtVc({
      credentialPayload,
      disclosureFrame,
    });

    const presentationFrame: PresentationFrame<typeof claims> = {
      given_name: true,
    };

    const presentation = await agent.createSdJwtVcPresentation<typeof claims>({
      presentation: credential.credential,
      presentationFrame,
      kb: {
        payload: {
          aud: '1',
          iat: 1,
          nonce: '342',
        },
      },
    });
    expect(presentation).toBeDefined();
    const decoded = await decodeSdJwt(presentation.presentation, digest);
    expect(decoded.kbJwt).toBeDefined();
    expect(((decoded.kbJwt as KBJwt).payload as kbPayload).aud).toBe('1');
  });

  it('create presentation with cnf', async () => {
    const did = await agent
      .didManagerFind({ alias: 'holder' })
      .then((dids) => dids[0]);
    const jwk = createJWK(
      did.keys[0].type as JwkDidSupportedKeyTypes,
      did.keys[0].publicKeyHex
    ) as JsonWebKey;
    const credentialPayload: SdJwtVcPayload = {
      ...claims,
      cnf: {
        jwk,
      },
      iss: issuer,
      iat: new Date().getTime() / 1000,
      vct: '',
    };
    const credential = await agent.createSdJwtVc({
      credentialPayload,
      disclosureFrame,
    });

    const presentationFrame: PresentationFrame<typeof claims> = {
      given_name: true,
      address: {
        country: true,
      },
    };

    const presentation = await agent.createSdJwtVcPresentation<typeof claims>({
      presentation: credential.credential,
      presentationFrame,
      kb: {
        payload: {
          aud: '1',
          iat: 1,
          nonce: '342',
        },
      },
    });
    expect(presentation).toBeDefined();
    const decoded = await decodeSdJwt(presentation.presentation, digest);
    expect(decoded.kbJwt).toBeDefined();
    expect(((decoded.kbJwt as KBJwt).payload as kbPayload).aud).toBe('1');
  });

  it('includes no holder reference', async () => {
    const newClaims = JSON.parse(JSON.stringify(claims));
    newClaims.sub = undefined;
    const credentialPayload: SdJwtVcPayload = {
      ...newClaims,
      iss: issuer,
      iat: new Date().getTime() / 1000,
      vct: '',
    };
    const credential = await agent.createSdJwtVc({
      credentialPayload,
      disclosureFrame,
    });
    const presentationFrame: PresentationFrame<typeof claims> = {
      given_name: true,
    };
    const presentation = agent.createSdJwtVcPresentation<
      PresentationFrame<typeof claims>
    >({
      presentation: credential.credential,
      presentationFrame,
      kb: {
        payload: {
          aud: '1',
          iat: 1,
          nonce: '342',
        },
      },
    });
    expect(presentation).rejects.toThrow(
      'credential does not include a holder reference'
    );
  });

  it('verify a presentation', async () => {
    const holderDId = await agent.resolveDid({ didUrl: holder });
    const jwk: JsonWebKey = (
      (holderDId.didDocument as DIDDocument)
        .verificationMethod as VerificationMethod[]
    )[0].publicKeyJwk as JsonWebKey;
    const credentialPayload: SdJwtVcPayload = {
      ...claims,
      iss: issuer,
      iat: new Date().getTime() / 1000,
      vct: '',
      cnf: {
        jwk,
      },
    };
    const credential = await agent.createSdJwtVc({
      credentialPayload,
      disclosureFrame,
    });

    const presentationFrame: PresentationFrame<typeof claims> = {
      given_name: true,
    };

    const presentation = await agent.createSdJwtVcPresentation<typeof claims>({
      presentation: credential.credential,
      presentationFrame,
      kb: {
        payload: {
          aud: '1',
          iat: 1,
          nonce: '342',
        },
      },
    });
    const result = await agent.verifySdJwtVcPresentation({
      presentation: presentation.presentation,
      requiredClaimKeys: ['given_name'],
      // we are not able to verify the kb yet since we have no reference to the public key of the holder.
      kb: true,
    });
    expect(result).toBeDefined();
    expect((result.verifiedPayloads.payload as typeof claims).given_name).toBe(
      'John'
    );
  });

  it('verify a presentation with sub set', async () => {
    const credentialPayload: SdJwtVcPayload = {
      ...claims,
      iss: issuer,
      sub: holder,
      iat: new Date().getTime() / 1000,
      vct: '',
    };
    const credential = await agent.createSdJwtVc({
      credentialPayload,
      disclosureFrame,
    });

    const presentationFrame: PresentationFrame<typeof claims> = {
      given_name: true,
    };

    const presentation = await agent.createSdJwtVcPresentation<typeof claims>({
      presentation: credential.credential,
      presentationFrame,
      kb: {
        payload: {
          aud: '1',
          iat: 1,
          nonce: '342',
        },
      },
    });

    const result = await agent.verifySdJwtVcPresentation({
      presentation: presentation.presentation,
      requiredClaimKeys: ['given_name'],
      // we are not able to verify the kb yet since we have no reference to the public key of the holder.
      kb: true,
    });
    expect(result).toBeDefined();
    expect((result.verifiedPayloads.payload as typeof claims).given_name).toBe(
      'John'
    );
  });
});
