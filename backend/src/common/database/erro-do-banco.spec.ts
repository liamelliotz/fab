import { ConflictException } from '@nestjs/common';
import { erroDoBancoParaHttp } from './erro-do-banco.js';

const mensagem = (erro: unknown) => erroDoBancoParaHttp(erro)?.message;

describe('erroDoBancoParaHttp', () => {
  it('índice único conhecido: 409 com a mensagem da restrição', () => {
    const erro = erroDoBancoParaHttp({
      code: '23505',
      constraint: 'usuarios_email_unico',
    });
    expect(erro).toBeInstanceOf(ConflictException);
    expect(erro?.getStatus()).toBe(409);
    expect(erro?.message).toBe('Já existe um usuário com este e-mail.');
  });

  it('lê o erro embrulhado pelo TypeORM (driverError)', () => {
    expect(
      mensagem({
        message: 'duplicate key',
        driverError: { code: '23505', constraint: 'usuarios_cpf_unico' },
      }),
    ).toBe('Já existe um usuário com este CPF.');
  });

  it('restrição desconhecida: mensagem padrão de cada código', () => {
    expect(mensagem({ code: '23505', constraint: 'x' })).toBe(
      'Já existe um registro com estes dados.',
    );
    expect(mensagem({ code: '23514' })).toBe(
      'Os dados não respeitam uma regra do cadastro.',
    );
    expect(
      mensagem({
        code: '23503',
        detail: 'Key (id)=(a) is still referenced from table "emprestimos".',
      }),
    ).toBe('O registro está em uso por outros dados e não pode ser removido.');
    expect(
      mensagem({
        code: '23503',
        detail: 'Key (x)=(y) is not present in table "z".',
      }),
    ).toBe('Os dados apontam para um registro que não existe.');
  });

  it('outros erros não são traduzidos (seguem como 500)', () => {
    expect(erroDoBancoParaHttp(new Error('falhou'))).toBeNull();
    expect(erroDoBancoParaHttp({ code: '42P01' })).toBeNull();
    expect(erroDoBancoParaHttp(null)).toBeNull();
  });
});
