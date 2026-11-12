import { montarPagina, montarPaginaComTotal } from './paginacao.dto.js';

describe('paginação', () => {
  const lista = Array.from({ length: 25 }, (_, i) => i + 1);

  it('recorta a página pedida e informa os totais', () => {
    const pagina = montarPagina(lista, { pagina: 2, itensPorPagina: 10 });
    expect(pagina.itens).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(pagina).toMatchObject({
      totalItens: 25,
      paginaAtual: 2,
      totalPaginas: 3,
      itensPorPagina: 10,
      temProxima: true,
      temAnterior: true,
    });
  });

  it('a última página vem menor e sem próxima', () => {
    const pagina = montarPagina(lista, { pagina: 3, itensPorPagina: 10 });
    expect(pagina.itens).toHaveLength(5);
    expect(pagina.temProxima).toBe(false);
  });

  it('lista vazia: zero páginas, sem erro', () => {
    const pagina = montarPagina([], { pagina: 1, itensPorPagina: 10 });
    expect(pagina).toMatchObject({ itens: [], totalItens: 0, totalPaginas: 0 });
    expect(pagina.temProxima).toBe(false);
    expect(pagina.temAnterior).toBe(false);
  });

  it('corrige página 0 e tamanho acima do máximo', () => {
    const pagina = montarPagina(lista, { pagina: 0, itensPorPagina: 9999 });
    expect(pagina.paginaAtual).toBe(1);
    expect(pagina.itensPorPagina).toBe(100);
  });

  it('monta a resposta quando o total vem do banco', () => {
    const pagina = montarPaginaComTotal(['a', 'b'], 12, {
      pagina: 6,
      itensPorPagina: 2,
    });
    expect(pagina).toMatchObject({ totalPaginas: 6, temProxima: false });
  });
});
