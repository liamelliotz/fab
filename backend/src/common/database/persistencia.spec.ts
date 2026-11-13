import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lerModoPersistencia } from './persistencia.js';

describe('modo de persistência', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'fab-env-'));
  const envCom = (conteudo: string) => {
    const arquivo = join(pasta, `${Math.random()}.env`);
    writeFileSync(arquivo, conteudo);
    return arquivo;
  };
  const SEM_ARQUIVO = join(pasta, 'nao-existe.env');

  it('sem nada configurado, usa memória', () => {
    expect(lerModoPersistencia({}, SEM_ARQUIVO)).toBe('memoria');
    expect(lerModoPersistencia({}, envCom('PORT=3000\n'))).toBe('memoria');
  });

  it('lê do arquivo .env', () => {
    expect(lerModoPersistencia({}, envCom('PERSISTENCIA=postgres\n'))).toBe(
      'postgres',
    );
  });

  it('a variável de ambiente vence o arquivo .env', () => {
    const arquivo = envCom('PERSISTENCIA=postgres\n');
    expect(lerModoPersistencia({ PERSISTENCIA: 'memoria' }, arquivo)).toBe(
      'memoria',
    );
  });

  it('aceita maiúsculas e espaços', () => {
    expect(
      lerModoPersistencia({ PERSISTENCIA: ' Postgres ' }, SEM_ARQUIVO),
    ).toBe('postgres');
  });

  it('valor desconhecido é erro, com a explicação em português', () => {
    expect(() =>
      lerModoPersistencia({ PERSISTENCIA: 'mysql' }, SEM_ARQUIVO),
    ).toThrow('PERSISTENCIA="mysql" é inválida');
  });
});
