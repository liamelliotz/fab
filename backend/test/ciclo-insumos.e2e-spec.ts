import { abrirCiclo, dados, hoje } from './apoio/ciclo.js';

interface Insumo {
  id: string;
  quantidadeAtual: number;
  estoqueBaixo: boolean;
}
interface Movimentacao {
  id: string;
  tipo: string;
  quantidade: number;
  saldoApos: number;
}
interface Resultado {
  insumo: Insumo;
  movimentacao: Movimentacao;
  alertaEstoqueBaixo: boolean;
}

describe('E5 - ciclo completo de insumos', () => {
  it('cadastra, movimenta até o mínimo, recusa saldo negativo e confere reposição, histórico e consumo', async () => {
    const c = await abrirCiclo();
    try {
      const { http, admin, sufixo } = c;
      const auth = { Authorization: `Bearer ${admin}` };
      const criar = async (nome: string) =>
        dados<Insumo>(
          http
            .post('/api/insumos')
            .set(auth)
            .send({
              nome: `${nome} ${sufixo}`,
              categoria: 'papelaria',
              unidadeMedida: 'un',
              estoqueMinimo: 2,
              quantidadeInicial: 10,
            }),
          201,
        );
      const insumo = await criar('Insumo alvo E5');
      await c.persistido('insumos', insumo.id);
      const controle = await criar('Insumo controle E5'); // verifica se o filtro não mistura registros
      expect(insumo.quantidadeAtual).toBe(10);
      const movimentar = (tipo: string, quantidade: number, motivo: string) =>
        dados<Resultado>(
          http
            .post(`/api/insumos/${insumo.id}/movimentacoes`)
            .set(auth)
            .send({
              tipo,
              quantidade,
              motivo,
              observacao: `Ciclo E5 ${sufixo}`,
            }),
          201,
        );
      const entrada = await movimentar('entrada', 5, 'compra');
      expect(entrada.insumo.quantidadeAtual).toBe(15);
      await c.persistido('movimentacoes_insumo', entrada.movimentacao.id);
      const saida = await movimentar('saida', 13, 'uso_em_aula');
      expect(saida.insumo.quantidadeAtual).toBe(2);
      expect(saida.insumo.estoqueBaixo).toBe(true);
      expect(saida.alertaEstoqueBaixo).toBe(true);
      await c.persistido('movimentacoes_insumo', saida.movimentacao.id);
      const recusada = await http
        .post(`/api/insumos/${insumo.id}/movimentacoes`)
        .set(auth)
        .send({ tipo: 'saida', quantidade: 3, motivo: 'uso_em_aula' });
      expect(recusada.status).toBe(409);
      expect(recusada.body.sucesso).toBe(false);
      expect(recusada.body.mensagem).toContain('Saldo insuficiente');
      const depois = await dados<Insumo>(
        http.get(`/api/insumos/${insumo.id}`).set(auth),
      );
      expect(depois.quantidadeAtual).toBe(2);
      await c.persistido('insumos', insumo.id, { quantidade_atual: 2 });
      const repor = await dados<(Insumo & { faltaParaOMinimo: number })[]>(
        http.get('/api/insumos/a-repor').set(auth),
      );
      expect(repor.find((i) => i.id === insumo.id)).toMatchObject({
        quantidadeAtual: 2,
        faltaParaOMinimo: 0,
      });
      expect(repor.some((i) => i.id === controle.id)).toBe(false);
      const data = hoje();
      const historico = await dados<{
        itens: Movimentacao[];
        totalItens: number;
      }>(
        http.get('/api/insumos/movimentacoes').set(auth).query({
          insumoId: insumo.id,
          dataInicio: data,
          dataFim: data,
          categoria: 'papelaria',
          itensPorPagina: 100,
        }),
      );
      expect(historico.totalItens).toBe(3); // entrada inicial + compra + saída; a saída recusada não grava nada
      expect(historico.itens.map((m) => m.id)).toEqual(
        expect.arrayContaining([
          entrada.movimentacao.id,
          saida.movimentacao.id,
        ]),
      );
      const saidas = await dados<{ itens: Movimentacao[]; totalItens: number }>(
        http
          .get('/api/insumos/movimentacoes')
          .set(auth)
          .query({ insumoId: insumo.id, tipo: 'saida', itensPorPagina: 100 }),
      );
      expect(saidas.totalItens).toBe(1);
      expect(saidas.itens[0]).toMatchObject({
        id: saida.movimentacao.id,
        quantidade: 13,
        saldoApos: 2,
      });
      const consumo = await dados<{
        dias: number;
        itens: {
          insumo: { id: string };
          totalEntradas: number;
          totalConsumido: number;
          mediaDiaria: number;
          quantidadeAtual: number;
          diasRestantes: number | null;
          estoqueBaixo: boolean;
        }[];
      }>(
        http
          .get('/api/insumos/relatorios/consumo')
          .set(auth)
          .query({ dataInicio: data, dataFim: data, categoria: 'papelaria' }),
      );
      expect(consumo.dias).toBe(1);
      expect(
        consumo.itens.find((i) => i.insumo.id === insumo.id),
      ).toMatchObject({
        totalEntradas: 15,
        totalConsumido: 13,
        mediaDiaria: 13,
        quantidadeAtual: 2,
        diasRestantes: 0,
        estoqueBaixo: true,
      });
      expect(
        consumo.itens.find((i) => i.insumo.id === controle.id),
      ).toMatchObject({ totalConsumido: 0, diasRestantes: null });
    } finally {
      await c.fechar();
    }
  }, 120_000);
});
