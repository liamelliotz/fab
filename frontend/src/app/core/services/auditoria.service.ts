import { Injectable, computed, inject } from '@angular/core';
import { ROTULO_EVENTO } from '../constants/evento.constants';
import { nomeLocal } from '../constants/escola-modelo.constants';
import { TipoEventoEmprestimo } from '../models/emprestimo.model';
import { EmprestimoService } from './emprestimo.service';
import { InsumoService, NOME_MOTIVO_INSUMO, NOME_UNIDADE, formatarQuantidade } from './insumo.service';
import { ManutencaoService, NOME_MOTIVO_BAIXA } from './manutencao.service';
import { NOME_ACAO_REQUISICAO, RequisicaoInsumoService } from './requisicao-insumo.service';
import { RegrasEmprestimoService } from './regras-emprestimo.service';

export type ModuloAuditoria = 'emprestimos' | 'manutencao' | 'baixa' | 'insumos' | 'regras';
export type GravidadeAuditoria = 'info' | 'aviso' | 'critico';

export const NOME_MODULO_AUDITORIA: Record<ModuloAuditoria, string> = {
  emprestimos: 'Empréstimos',
  manutencao: 'Manutenção',
  baixa: 'Baixa patrimonial',
  insumos: 'Insumos',
  regras: 'Regras de empréstimo',
};

/** Uma linha da trilha de auditoria. Só leitura: vem dos históricos que nunca são editados. */
export interface RegistroAuditoria {
  id: string;
  em: string;
  modulo: ModuloAuditoria;
  gravidade: GravidadeAuditoria;
  acao: string;
  /** Protocolo, termo ou nome do insumo. */
  alvo: string;
  /** Itens envolvidos ("Projetor × 1"). */
  itens?: string;
  por: string;
  detalhe?: string;
  /** Rota de origem (pedido, manutenção, insumos). */
  link: string[];
  /** Para abrir o termo de baixa. */
  ocorrenciaId?: string;
}

/** Eventos de pedido que já aparecem pelo módulo de Manutenção (evita linha repetida). */
const VEM_DA_MANUTENCAO: TipoEventoEmprestimo[] = ['avaria_registrada', 'falta_registrada', 'manutencao_concluida', 'manutencao_baixa'];

const GRAVIDADE_EVENTO: Partial<Record<TipoEventoEmprestimo, GravidadeAuditoria>> = {
  rejeitado: 'aviso',
  cancelado: 'aviso',
  transferencia_recusada: 'aviso',
  expirado: 'aviso',
  suspensao_aplicada: 'critico',
};

/**
 * TRILHA DE AUDITORIA do patrimônio (modo demonstração): junta, em ordem de tempo, tudo o que
 * mexeu em equipamentos e insumos: pedidos e balcão, transferências, avarias, faltas,
 * consertos, baixas (com termo) e entradas e saídas de insumos.
 * Nada aqui é editável: cada linha é cópia de um registro que só cresce.
 */
@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly emprestimos = inject(EmprestimoService);
  private readonly manutencoes = inject(ManutencaoService);
  private readonly insumos = inject(InsumoService);
  private readonly requisicoes = inject(RequisicaoInsumoService);
  private readonly regras = inject(RegrasEmprestimoService);

  readonly registros = computed<RegistroAuditoria[]>(() => {
    const lista: RegistroAuditoria[] = [];

    for (const s of this.emprestimos.todas()) {
      const itens = this.emprestimos.resumoItens(s);
      for (const ev of s.historico) {
        if (VEM_DA_MANUTENCAO.includes(ev.tipo)) continue;
        lista.push({
          id: `emp-${ev.id}`, em: ev.em, modulo: 'emprestimos', gravidade: GRAVIDADE_EVENTO[ev.tipo] ?? 'info',
          acao: ROTULO_EVENTO[ev.tipo], alvo: s.protocolo, itens, por: ev.por.nome, detalhe: ev.detalhe,
          link: ['/pedidos', s.id],
        });
      }
    }

    for (const m of this.manutencoes.todas()) {
      const itens = `${m.equipamento} × ${m.quantidade}`;
      m.historico.forEach((p, i) => {
        const ehBaixa = m.status === 'baixa' && i === m.historico.length - 1 && !!m.baixa;
        const aberta = i === 0;
        lista.push({
          id: `man-${m.id}-${i}`, em: p.em, modulo: ehBaixa ? 'baixa' : 'manutencao',
          gravidade: ehBaixa || (aberta && m.tipo === 'extravio') ? 'critico' : aberta && m.bloqueia ? 'aviso' : 'info',
          acao: ehBaixa
            ? `Termo de baixa ${m.baixa!.protocolo}`
            : aberta
              ? m.tipo === 'extravio' ? 'Falta registrada' : 'Avaria registrada'
              : /consertad|encontrad/i.test(p.texto) ? 'Unidade de volta ao estoque' : 'Andamento da ocorrência',
          alvo: m.protocolo, itens, por: p.por.nome,
          detalhe: ehBaixa ? `${NOME_MOTIVO_BAIXA[m.baixa!.motivo]} · ${m.baixa!.parecer}` : p.texto,
          link: ['/admin/manutencao'], ocorrenciaId: ehBaixa ? m.id : undefined,
        });
      });
    }

    for (const mv of this.insumos.movimentacoes()) {
      const unidade = NOME_UNIDADE[mv.insumo.unidadeMedida];
      const perda = mv.motivo === 'perda' || mv.motivo === 'vencimento' || mv.motivo === 'ajuste_negativo';
      lista.push({
        id: `ins-${mv.id}`, em: mv.ocorridaEm, modulo: 'insumos', gravidade: perda ? 'aviso' : 'info',
        acao: `${mv.tipo === 'entrada' ? 'Entrada' : 'Saída'}: ${NOME_MOTIVO_INSUMO[mv.motivo]}`,
        alvo: mv.insumo.nome,
        itens: `${mv.tipo === 'entrada' ? '+' : '−'}${formatarQuantidade(mv.quantidade)} ${unidade} · saldo ${formatarQuantidade(mv.saldoApos)}`,
        por: mv.responsavel.nome,
        detalhe: [
          mv.destinatario ? `para ${mv.destinatario.nome}` : '',
          mv.localId ? `em ${nomeLocal(mv.localId)}` : '',
          mv.observacao ?? '',
          mv.documento ? `doc. ${mv.documento}` : '',
        ].filter(Boolean).join(' · '),
        link: ['/admin/inventario/insumos'],
      });
    }

    // Requisições de insumo: pedido, aprovação, recusa e cancelamento. Entrega e sobra já
    // aparecem acima como saída e entrada no estoque (sem linha repetida).
    for (const r of this.requisicoes.requisicoes()) {
      r.historico.forEach((ev, i) => {
        if (ev.acao === 'entregue' || ev.acao === 'sobra_devolvida') return;
        lista.push({
          id: `req-${r.id}-${i}`, em: ev.em, modulo: 'insumos',
          gravidade: ev.acao === 'recusada' || ev.acao === 'cancelada' ? 'aviso' : 'info',
          acao: NOME_ACAO_REQUISICAO[ev.acao],
          alvo: r.protocolo,
          itens: `${r.insumo.nome} · ${this.requisicoes.qtd(r.quantidade, r.insumo.unidadeMedida)}`,
          por: ev.por.nome,
          detalhe: [ev.detalhe ?? '', ev.acao === 'solicitada' ? r.finalidade : ''].filter(Boolean).join(' · '),
          link: ['/admin/inventario/insumos'],
        });
      });
    }

    // Regras de empréstimo: cada alteração e cada suspensão encerrada antes do prazo.
    for (const a of this.regras.alteracoes()) {
      lista.push({
        id: `reg-${a.id}`, em: a.em, modulo: 'regras', gravidade: 'aviso',
        acao: a.mudancas.length === 1 && a.mudancas[0].startsWith('Suspensão de') ? 'Suspensão encerrada' : 'Regras alteradas',
        alvo: 'Regras de empréstimo', por: a.por.nome, detalhe: a.mudancas.join(' · '),
        link: ['/configuracoes'],
      });
    }

    return lista.sort((a, b) => b.em.localeCompare(a.em));
  });

  /** Valor total das baixas com valor informado (para a prestação de contas). */
  readonly valorBaixado = computed(() =>
    this.manutencoes.baixas().reduce((s, m) => s + (m.baixa?.valorEstimado ?? 0), 0),
  );
}

/** Gera o CSV (separado por ponto e vírgula, para abrir direto no Excel em português). */
export function registrosParaCsv(registros: RegistroAuditoria[]): string {
  const celula = (v: string | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const cabecalho = ['Data e hora', 'Módulo', 'Ação', 'Protocolo/Item', 'Itens', 'Quem', 'Detalhe'];
  const linhas = registros.map((r) =>
    [
      new Date(r.em).toLocaleString('pt-BR'),
      NOME_MODULO_AUDITORIA[r.modulo],
      r.acao,
      r.alvo,
      r.itens,
      r.por,
      r.detalhe,
    ].map(celula).join(';'),
  );
  return '﻿' + [cabecalho.map(celula).join(';'), ...linhas].join('\r\n');
}
