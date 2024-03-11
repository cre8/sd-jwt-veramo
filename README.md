# SD-JWT-VC plugin for Veramo

[![CI](https://github.com/cre8/sd-jwt-veramo/actions/workflows/cicd.yml/badge.svg)](https://github.com/cre8/sd-jwt-veramo/actions/workflows/cicd.yml)

[![codecov](https://codecov.io/gh/cre8/sd-jwt-veramo/graph/badge.svg?token=qLMSDFL0gV)](https://codecov.io/gh/cre8/sd-jwt-veramo)

[![npm version](https://badge.fury.io/js/@bcrl%2Fveramo-sd-jwt.svg)](https://badge.fury.io/js/@bcrl%2Fveramo-sd-jwt)

A Veramo plugin to issue, present and verify [SD-JWT-VCs](https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/) and is using [SD-JWT-JS](https://github.com/openwallet-foundation-labs/sd-jwt-js) library.


## Installation

```shell
npm install @bcrl/veramo-sd-jwt
```

## Usage

Detailed examples can be found in the [test file](./src/agent-plugin/sd-jwt-plugin.spec.ts).

```typescript
const agent = createAgent<ISDJwtPlugin>({
  plugins: [
    new SDJwtPlugin({
        // calculate the digest of the JWT
        hasher: digest,
        // generate a random salt
        saltGenerator: generateSalt,
        // verify the JWT
        verifySignature,
    }),
});
```

Instead of implementing the hasher and saltGenerator on your own, you can use the default implementations for each environment:
```typescript
// Node.js
import { digest, generateSalt } from '@sd-jwt/crypto-nodejs';

// Browser
import { digest, generateSalt } from '@sd-jwt/crypto-browser';
```

### Issue a credential

```typescript

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

const credentialPayload: SdJwtVcPayload = {
    ...claims,
    // a did url that is used for the issuance. You need to pass the reference to the key that is used to sign the JWT
    iss: 'did:example:123#key-1',
    iat: new Date().getTime() / 1000,
    // type of the credential
    vct: 'ID-Card',
    // required to perform holder binding.
    cnf: {
        // the public key of the holder encoded as Json Web Key
        jwk,
    },

};
const credential = await agent.createSdJwtVc({
    credentialPayload,
    disclosureFrame,
});
```

### Verify a credential
The verify function will validate the signature of the SD-JWT-VC, it will not validate a referenced status list.

```typescript
const verified = await agent.verifySdJwtVc({
    credential: credential.credential,
});
```

### Create a presentation
Creates a presentation of a credential. The presentation will only contain the claims that are specified in the presentationKeys. If you want to present all claims, you can pass an empty object.

To perform a holder binding, The included key in the `cnf` claim must be used. Right now it only supports the `cnf.jwk` approach so you need to pass a JWK during the issuance and not a did url.

```typescript
const presentationKeys: PresentationFrame<typeof claims> = {
    given_name: true,
};

const presentation = await agent.createSdJwtVcPresentation({
    presentation: credential.credential,
    presentationKeys,
    kb: {
        payload: {
            aud: '1',
            iat: 1,
            nonce: '342',
        },
    },
});
```

### Verify a presentation
Verifies a given presentation. It will validate the signature of the issuer, if all claims are present and optional if the key binding is correct.

```typescript
const result = await agent.verifySdJwtVcPresentation({
    // encoded presentation
    presentation: presentation.presentation,
    // list of required claims
    requiredClaimKeys: ['given_name'],
    // if set to true, the kb will be verified
    kb: true,
});
```

## Build
Packages are managed via `pnpm`.
```shell
pnpm run build
```

## Test
Test are written with `vitest`;

```shell
pnpm run test
```

To get the coverage report, run:
```shell
pnpm run format
```

## Format
The code is formatted with `biome`, passing the format and lint check is required to pass the CI. To format the code locally, run
```shell
pnpm run format
```