import { Logger, type ClassProvider } from '@nestjs/common';
import { provedorDeRepositorio } from './provedor-de-repositorio.js';

class RepoMemoria {
  listar() {
    return ['memoria'];
  }
}
class RepoPostgres {
  listar() {
    return ['postgres'];
  }
}

describe('provedorDeRepositorio', () => {
  // Estes testes provocam erros e avisos DE PROPÓSITO: o log fica mudo para não poluir a saída.
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  const escolha = (p: ReturnType<typeof provedorDeRepositorio>) =>
    p as ClassProvider;

  it('em memória, usa a classe em memória', () => {
    const p = escolha(
      provedorDeRepositorio(RepoMemoria, RepoPostgres, 'memoria'),
    );
    expect(p.provide).toBe(RepoMemoria);
    expect(p.useClass).toBe(RepoMemoria);
  });

  it('no postgres, usa a classe do banco com o MESMO token', () => {
    const p = escolha(
      provedorDeRepositorio(RepoMemoria, RepoPostgres, 'postgres'),
    );
    expect(p.provide).toBe(RepoMemoria);
    expect(p.useClass).toBe(RepoPostgres);
  });

  it('no postgres, sem versão do banco ainda, continua em memória', () => {
    const p = escolha(
      provedorDeRepositorio(RepoMemoria, undefined, 'postgres'),
    );
    expect(p.useClass).toBe(RepoMemoria);
  });
});
