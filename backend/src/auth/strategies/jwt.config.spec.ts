import type { ConfigService } from '@nestjs/config';
import { obterSegredoJwt, SEGREDO_DE_EXEMPLO } from './jwt.config.js';

const config = (valores: Record<string, string | undefined>) =>
  ({ get: (chave: string) => valores[chave] }) as unknown as ConfigService;

describe('segredo do JWT', () => {
  const FORTE = 'a'.repeat(16) + 'b'.repeat(16) + 'c'.repeat(16);

  it('em produção, recusa segredo ausente, de exemplo ou curto', () => {
    for (const JWT_SECRET of [undefined, '', SEGREDO_DE_EXEMPLO, 'curto']) {
      expect(() =>
        obterSegredoJwt(config({ NODE_ENV: 'production', JWT_SECRET })),
      ).toThrow(/JWT_SECRET/);
    }
  });

  it('em produção, aceita um segredo longo', () => {
    expect(
      obterSegredoJwt(config({ NODE_ENV: 'production', JWT_SECRET: FORTE })),
    ).toBe(FORTE);
  });

  it('em desenvolvimento, sobe mesmo sem segredo (com um de desenvolvimento)', () => {
    expect(obterSegredoJwt(config({}))).toMatch(/desenvolvimento/);
    expect(obterSegredoJwt(config({ JWT_SECRET: SEGREDO_DE_EXEMPLO }))).toBe(
      SEGREDO_DE_EXEMPLO,
    );
  });
});
