import { exemploDeErro } from './api-erros.decorator.js';

describe('exemploDeErro', () => {
  it('monta o mesmo envelope do HttpExceptionFilter', () => {
    expect(exemploDeErro(404)).toEqual({
      sucesso: false,
      mensagem: 'Recurso não encontrado.',
      dados: null,
      erros: [],
      timestamp: expect.any(String),
    });
  });

  it('no 400 mostra a lista de campos inválidos', () => {
    const exemplo = exemploDeErro(400);
    expect(exemplo.mensagem).toBe('Dados inválidos.');
    expect(exemplo.erros.length).toBeGreaterThan(0);
  });
});
