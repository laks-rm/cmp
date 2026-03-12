import Tokens from "csrf";

const tokens = new Tokens();

export function createCsrfSecret(): string {
  return tokens.secretSync();
}

export function createCsrfToken(secret: string): string {
  return tokens.create(secret);
}

export function verifyCsrfToken(secret: string, token: string): boolean {
  return tokens.verify(secret, token);
}
