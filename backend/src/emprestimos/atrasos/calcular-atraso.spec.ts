import { StatusEmprestimo as S } from '../../common/enums/index.js';
import { calcularAtraso, statusParaResposta } from './calcular-atraso.js';

describe('atraso de empréstimo', () => {
  const HOJE = '2026-11-11';
  const pedido = (status: S, dataPrevistaDevolucao: string) =>
    ({ status, dataPrevistaDevolucao }) as Parameters<typeof calcularAtraso>[0];

  it('atrasa quando o prazo venceu e o material ainda não voltou', () => {
    expect(calcularAtraso(pedido(S.EmAndamento, '2026-11-10'), HOJE)).toBe(
      true,
    );
    expect(calcularAtraso(pedido(S.Aprovado, '2026-11-10'), HOJE)).toBe(true);
  });

  it('o dia do vencimento ainda está no prazo', () => {
    expect(calcularAtraso(pedido(S.EmAndamento, '2026-11-11'), HOJE)).toBe(
      false,
    );
    expect(calcularAtraso(pedido(S.EmAndamento, '2026-11-12'), HOJE)).toBe(
      false,
    );
  });

  it.each([S.Pendente, S.Rejeitado, S.Devolvido, S.Cancelado])(
    'status %s nunca conta como atrasado',
    (status) => {
      expect(calcularAtraso(pedido(status, '2020-01-01'), HOJE)).toBe(false);
    },
  );

  it('aceita Date e usa o dia da escola', () => {
    // 01:00 UTC do dia 12 ainda é dia 11 em Macapá: vencendo no dia 11, não atrasou.
    const agora = new Date('2026-11-12T01:00:00.000Z');
    expect(calcularAtraso(pedido(S.EmAndamento, '2026-11-11'), agora)).toBe(
      false,
    );
  });

  it('a resposta mostra "atrasado" sem mudar o status gravado', () => {
    const vencido = pedido(S.EmAndamento, '2026-11-01');
    expect(statusParaResposta(vencido, HOJE)).toBe(S.Atrasado);
    expect(vencido.status).toBe(S.EmAndamento);
    expect(statusParaResposta(pedido(S.Devolvido, '2026-11-01'), HOJE)).toBe(
      S.Devolvido,
    );
  });
});
