export class AcoUserError extends Error {}

export class AcoUnknownMobileExtensionError extends AcoUserError {
  constructor(extension: string, platform: string) {
    super(
      `unknown extension "${extension}" for ${platform}. ` +
        `Run \`aco mobile list --platform ${platform}\` to see what is available.`,
    );
  }
}
