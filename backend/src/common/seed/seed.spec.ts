import {
  MOTIVOS_POR_TIPO,
  StatusEmprestimo,
  StatusEquipamento,
  TipoMovimentacao,
} from '../enums/index.js';
import { criarEmprestimosSeed } from '../../emprestimos/emprestimos.seed.js';
import { criarInsumosSeed } from '../../insumos/insumos.seed.js';
import { diferencaEmDias } from '../utils/data.util.js';
import { EQUIPAMENTOS_SEED, USUARIOS_SEED } from './index.js';

/**
 * Guarda de coerência dos dados de exemplo. Se um seed mudar e quebrar uma regra de negócio
 * (estoque, prazo, habilitação, saldo), este teste avisa antes de a demonstração mostrar um dado errado.
 */
describe('seeds coerentes entre si', () => {
  const HOJE = '2026-11-11';
  const emprestimos = criarEmprestimosSeed(HOJE);
  const equipamento = (id: string) =>
    EQUIPAMENTOS_SEED.find((e) => e.id === id);
  const usuario = (id: string) => USUARIOS_SEED.find((u) => u.id === id);

  it('ids, e-mails, CPFs, patrimônios e protocolos não se repetem', () => {
    const unico = (valores: string[]) =>
      expect(new Set(valores).size).toBe(valores.length);
    unico(USUARIOS_SEED.map((u) => u.id));
    unico(USUARIOS_SEED.map((u) => u.email.toLowerCase()));
    unico(USUARIOS_SEED.map((u) => u.cpf));
    unico(EQUIPAMENTOS_SEED.map((e) => e.id));
    unico(EQUIPAMENTOS_SEED.map((e) => e.codigoPatrimonio.toLowerCase()));
    unico(emprestimos.map((p) => p.id));
    unico(emprestimos.map((p) => p.protocolo));
    unico(
      emprestimos.flatMap((p) =>
        [p.codigoRetirada, p.codigoDevolucao].filter((c) => c !== undefined),
      ),
    );
  });

  it('todo pedido aponta para usuários e equipamentos que existem', () => {
    for (const p of emprestimos) {
      expect(usuario(p.solicitanteId), p.protocolo).toBeDefined();
      expect(usuario(p.responsavelId), p.protocolo).toBeDefined();
      for (const item of p.itens) {
        expect(equipamento(item.equipamentoId), p.protocolo).toBeDefined();
        expect(item.quantidade).toBeGreaterThan(0);
      }
      for (const evento of p.historico) {
        expect(usuario(evento.porId), p.protocolo).toBeDefined();
      }
    }
  });

  it('o estoque disponível já desconta os pedidos aprovados e em andamento', () => {
    const reservado = new Map<string, number>();
    for (const p of emprestimos) {
      if (
        p.status !== StatusEmprestimo.Aprovado &&
        p.status !== StatusEmprestimo.EmAndamento
      ) {
        continue;
      }
      for (const item of p.itens) {
        reservado.set(
          item.equipamentoId,
          (reservado.get(item.equipamentoId) ?? 0) + item.quantidade,
        );
      }
    }
    for (const e of EQUIPAMENTOS_SEED) {
      expect(e.quantidadeDisponivel, e.nome).toBeGreaterThanOrEqual(0);
      expect(e.quantidadeDisponivel, e.nome).toBeLessThanOrEqual(
        e.quantidadeTotal,
      );
      const emUso = reservado.get(e.id) ?? 0;
      if (
        e.status === StatusEquipamento.Disponivel ||
        e.status === StatusEquipamento.Emprestado
      ) {
        expect(e.quantidadeDisponivel, e.nome).toBe(e.quantidadeTotal - emUso);
      }
      // "emprestado" significa exatamente: tem unidades, mas nenhuma disponível.
      expect(e.status === StatusEquipamento.Emprestado, e.nome).toBe(
        emUso > 0 && e.quantidadeTotal - emUso === 0,
      );
    }
  });

  it('nenhum pedido passa do prazo máximo do material, e as datas estão em ordem', () => {
    for (const p of emprestimos) {
      const dias = diferencaEmDias(
        p.dataPrevistaRetirada,
        p.dataPrevistaDevolucao,
      );
      const prazo = Math.min(
        ...p.itens.map((i) => equipamento(i.equipamentoId)!.prazoMaximoDias),
      );
      expect(dias, p.protocolo).toBeGreaterThanOrEqual(0);
      expect(dias, p.protocolo).toBeLessThanOrEqual(prazo);
    }
  });

  it('quem pediu item com treinamento tem a habilitação', () => {
    for (const p of emprestimos) {
      if (
        p.status === StatusEmprestimo.Rejeitado ||
        p.status === StatusEmprestimo.Cancelado
      ) {
        continue;
      }
      for (const item of p.itens) {
        if (equipamento(item.equipamentoId)!.requerTreinamento) {
          expect(usuario(p.responsavelId)!.habilitacoes, p.protocolo).toContain(
            item.equipamentoId,
          );
        }
      }
    }
  });

  it('cada status tem os campos que o ciclo exige', () => {
    for (const p of emprestimos) {
      const s = p.status;
      // "atrasado" nunca é gravado
      expect(s, p.protocolo).not.toBe(StatusEmprestimo.Atrasado);
      expect(p.codigoRetirada !== undefined, p.protocolo).toBe(
        s === StatusEmprestimo.Aprovado,
      );
      expect(p.codigoDevolucao !== undefined, p.protocolo).toBe(
        s === StatusEmprestimo.EmAndamento,
      );
      expect(p.dataDevolucaoEfetiva !== undefined, p.protocolo).toBe(
        s === StatusEmprestimo.Devolvido,
      );
      if (s === StatusEmprestimo.Rejeitado) {
        expect(p.motivoRejeicao, p.protocolo).toBeTruthy();
      }
      expect(p.historico[0].tipo, p.protocolo).toBe('solicitado');
      const momentos = p.historico.map((e) => e.em);
      expect([...momentos].sort(), p.protocolo).toEqual(momentos);
    }
  });

  it('habilitações só apontam para equipamentos que exigem treinamento', () => {
    for (const u of USUARIOS_SEED) {
      for (const id of u.habilitacoes) {
        expect(equipamento(id)?.requerTreinamento, `${u.nome}: ${id}`).toBe(
          true,
        );
      }
    }
  });

  describe('insumos', () => {
    const { insumos, movimentacoes } = criarInsumosSeed(HOJE);

    it('o saldo de cada insumo é a soma das entradas menos as saídas, e nunca fica negativo', () => {
      for (const insumo of insumos) {
        let saldo = 0;
        const doInsumo = movimentacoes.filter((m) => m.insumoId === insumo.id);
        expect(doInsumo.length, insumo.nome).toBeGreaterThan(0);
        for (const m of doInsumo) {
          expect(m.quantidade, insumo.nome).toBeGreaterThan(0);
          saldo +=
            m.tipo === TipoMovimentacao.Entrada ? m.quantidade : -m.quantidade;
          saldo = Math.round(saldo * 1000) / 1000;
          expect(saldo, insumo.nome).toBeGreaterThanOrEqual(0);
          expect(m.saldoApos, insumo.nome).toBe(saldo);
        }
        expect(insumo.quantidadeAtual, insumo.nome).toBe(saldo);
      }
    });

    it('cada movimentação usa um motivo do seu tipo e aponta para registros que existem', () => {
      for (const m of movimentacoes) {
        expect(MOTIVOS_POR_TIPO[m.tipo], m.id).toContain(m.motivo);
        expect(
          insumos.some((i) => i.id === m.insumoId),
          m.id,
        ).toBe(true);
        expect(usuario(m.responsavelId), m.id).toBeDefined();
        if (m.destinatarioId) {
          expect(m.tipo, m.id).toBe(TipoMovimentacao.Saida);
          expect(usuario(m.destinatarioId), m.id).toBeDefined();
        }
      }
    });

    it('há itens abaixo do mínimo para a lista de reposição', () => {
      const aRepor = insumos.filter(
        (i) => i.quantidadeAtual <= i.estoqueMinimo,
      );
      expect(aRepor.map((i) => i.id).sort()).toEqual([
        'ins-filamento-pla',
        'ins-pincel-quadro',
      ]);
    });
  });
});
