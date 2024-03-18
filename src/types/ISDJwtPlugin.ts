import type { KBOptions, PresentationFrame } from '@sd-jwt/types';
import type { SdJwtVcPayload } from '@sd-jwt/sd-jwt-vc';
import type {
  IAgentContext,
  IDIDManager,
  IKeyManager,
  IPluginMethodMap,
  IResolver,
} from '@veramo/core-types';

/**
 * My Agent Plugin description.
 *
 * This is the interface that describes what your plugin can do.
 * The methods listed here, will be directly available to the veramo agent where your plugin is going to be used.
 * Depending on the agent configuration, other agent plugins, as well as the application where the agent is used
 * will be able to call these methods.
 *
 * To build a schema for your plugin using standard tools, you must link to this file in your package.json.
 * Example:
 * ```
 * "veramo": {
 *    "pluginInterfaces": {
 *      "IMyAgentPlugin": "./src/types/IMyAgentPlugin.ts"
 *    }
 *  },
 * ```
 *
 * @beta
 */
export interface ISDJwtPlugin extends IPluginMethodMap {
  /**
   * Your plugin method description
   *
   * @param args - Input parameters for this method
   * @param context - The required context where this method can run.
   *   Declaring a context type here lets other developers know which other plugins
   *   need to also be installed for this method to work.
   */
  /**
   * Create a signed SD-JWT credential.
   * @param args - Arguments necessary for the creation of a SD-JWT credential.
   * @param context - This reserved param is automatically added and handled by the framework, *do not override*
   */
  createSdJwtVc(
    args: ICreateSdJwtVcArgs,
    context: IRequiredContext
  ): Promise<ICreateSdJwtVcResult>;

  /**
   * Create a signed SD-JWT presentation.
   * @param args - Arguments necessary for the creation of a SD-JWT presentation.
   * @param context - This reserved param is automatically added and handled by the framework, *do not override*
   */
  createSdJwtVcPresentation<T extends Extensible = Extensible>(
    args: ICreateSdJwtVcPresentationArgs<T>,
    context: IRequiredContext
  ): Promise<ICreateSdJwtVcPresentationResult>;

  /**
   * Verify a signed SD-JWT credential.
   * @param args - Arguments necessary for the verification of a SD-JWT credential.
   * @param context - This reserved param is automatically added and handled by the framework, *do not override*
   */
  verifySdJwtVc(
    args: IVerifySdJwtVcArgs,
    context: IRequiredContext
  ): Promise<IVerifySdJwtVcResult>;

  /**
   * Verify a signed SD-JWT presentation.
   * @param args - Arguments necessary for the verification of a SD-JWT presentation.
   * @param context - This reserved param is automatically added and handled by the framework, *do not override*
   */
  verifySdJwtVcPresentation(
    args: IVerifySdJwtVcPresentationArgs,
    context: IRequiredContext
  ): Promise<IVerifySdJwtVcPresentationResult>;
}

/**
 * ICreateSdJwtVcArgs
 *
 * @beta
 */
export interface ICreateSdJwtVcArgs {
  credentialPayload: SdJwtVcPayload;

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  disclosureFrame?: any;
}

/**
 * ICreateSdJwtVcResult
 *
 * @beta
 */
export interface ICreateSdJwtVcResult {
  /**
   * the encoded sd-jwt credential
   */
  credential: string;
}

interface Extensible {
  [x: string]: boolean | undefined;
}

/**
 *
 * @beta
 */
export interface ICreateSdJwtVcPresentationArgs<T extends Extensible> {
  /**
   * Encoded SD-JWT credential
   */
  presentation: string;

  /**
   * @hidden
   * The keys to use for selective disclosure for presentation
   * if not provided, all keys will be disclosed
   * if empty array, no keys will be disclosed
   */
  presentationFrame?: PresentationFrame<T>;

  /**
   * Information to include to add key binding.
   */
  kb?: KBOptions;
}

/**
 * Created presentation
 * @beta
 */
export interface ICreateSdJwtVcPresentationResult {
  /**
   * Encoded presentation.
   */
  presentation: string;
}

/**
 * @beta
 */
export interface IVerifySdJwtVcArgs {
  credential: string;
}

/**
 * @beta
 */
export type IVerifySdJwtVcResult = {
  verifiedPayloads: unknown;
};

/**
 * @beta
 */
export interface IVerifySdJwtVcPresentationArgs {
  presentation: string;

  requiredClaimKeys?: string[];

  kb?: boolean;
}

/**
 * @beta
 */
export type IVerifySdJwtVcPresentationResult = {
  verifiedPayloads: Record<string, unknown>;
};

/**
 * This context describes the requirements of this plugin.
 * For this plugin to function properly, the agent needs to also have other plugins installed that implement the
 * interfaces declared here.
 * You can also define requirements on a more granular level, for each plugin method or event handler of your plugin.
 *
 * @beta
 */
export type IRequiredContext = IAgentContext<
  IDIDManager & IResolver & IKeyManager
>;
