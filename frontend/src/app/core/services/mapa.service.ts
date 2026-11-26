import { Injectable, computed, inject } from '@angular/core';
import { LOCAIS_ESCOLA, LocalEscola, localDeGuarda } from '../constants/escola-modelo.constants';
import { Emprestimo } from '../models/emprestimo.model';
import { UsuarioResumo } from '../models/usuario.model';
import { EmprestimoService, descreverLocalUso } from './emprestimo.service';
import { EquipamentoService } from './equipamento.service';
import { InsumoService, NOME_UNIDADE, formatarQuantidade } from './insumo.service';
import { ManutencaoService } from './manutencao.service';

/**
 * Situação de um grupo de unidades em um local:
 * - `guardado`: disponível no local de guarda;
 * - `reservado`: separado para um pedido aprovado (ainda no local de guarda);
 * - `em_uso`: retirado e em uso no local informado no pedido/balcão/transferência;
 * - `manutencao`: bloqueado por avaria (sala de manutenção ou assistência técnica);
 * - `nao_localizado`: falta (extravio) ainda aberta;
 * - `inativo`: fora de circulação por decisão da gestão;
 * - `insumo`: material de consumo guardado no local.
 */
export type SituacaoNoLocal = 'guardado' | 'reservado' | 'em_uso' | 'manutencao' | 'nao_localizado' | 'inativo' | 'insumo';

export interface ItemNoLocal {
  situacao: SituacaoNoLocal;
  /** Local da planta; null = sem local informado ou não localizado. */
  localId: string | null;
  equipamentoId?: string;
  insumoId?: string;
  nome: string;
  patrimonio?: string;
  quantidade: number;
  /** "3 unidade(s)", "2,5 litro(s)". */
  quantidadeTexto: string;
  responsavel?: UsuarioResumo;
  pedidoId?: string;
  protocolo?: string;
  ocorrenciaId?: string;
  /** Desde quando está ali (ISO). */
  desde?: string;
  /** Turma/atividade, assistência, motivo... */
  detalhe?: string;
  atrasado?: boolean;
  estoqueBaixo?: boolean;
}

export interface ResumoLocal {
  local: LocalEscola;
  itens: ItemNoLocal[];
  emUso: number;
  guardados: number;
  manutencao: number;
  insumos: number;
  atrasados: number;
}

/** Uma mudança de lugar registrada (retirada, transferência ou devolução). */
export interface MovimentoDeLocal {
  em: string;
  pedidoId: string;
  protocolo: string;
  itens: string;
  de: string;
  para: string;
  por: string;
}

/**
 * MAPA DE ITENS (modo demonstração): onde cada unidade está AGORA, calculado só a partir dos
 * registros (pedidos, balcão, transferências, manutenção e insumos). Ninguém edita o mapa à mão:
 * o local mostrado é sempre o último informado por alguém identificado.
 */
@Injectable({ providedIn: 'root' })
export class MapaService {
  private readonly equipamentos = inject(EquipamentoService);
  private readonly emprestimos = inject(EmprestimoService);
  private readonly manutencoes = inject(ManutencaoService);
  private readonly insumos = inject(InsumoService);

  /** Todas as unidades e insumos com o local onde estão agora. */
  readonly itens = computed<ItemNoLocal[]>(() => {
    const lista: ItemNoLocal[] = [];
    const un = (q: number) => `${q} unidade(s)`;

    for (const e of this.equipamentos.itens()) {
      if (e.status === 'descartado' && e.quantidadeTotal === 0) continue;
      const guarda = localDeGuarda(e.localizacao).id;
      if (e.quantidadeDisponivel > 0) {
        const inativo = e.status === 'inativo';
        lista.push({
          situacao: inativo ? 'inativo' : 'guardado', localId: guarda, equipamentoId: e.id, nome: e.nome,
          patrimonio: e.codigoPatrimonio, quantidade: e.quantidadeDisponivel, quantidadeTexto: un(e.quantidadeDisponivel),
          detalhe: inativo ? 'Inativo: fora do catálogo por decisão da coordenação' : e.localizacao,
        });
      }
    }

    for (const s of this.emprestimos.ativos()) {
      for (const item of s.itens) {
        const e = this.equipamentos.buscarPorId(item.equipamentoId);
        const base = {
          equipamentoId: item.equipamentoId, nome: e?.nome ?? 'Item removido', patrimonio: e?.codigoPatrimonio,
          quantidade: item.quantidade, quantidadeTexto: un(item.quantidade), responsavel: s.responsavel,
          pedidoId: s.id, protocolo: s.protocolo,
        };
        if (s.status === 'aprovado') {
          lista.push({
            ...base, situacao: 'reservado', localId: localDeGuarda(e?.localizacao).id,
            detalhe: `Reservado para retirada · uso previsto: ${descreverLocalUso(s.localUso)}`,
            desde: this.quando(s, 'aprovado'),
          });
        } else {
          lista.push({
            ...base, situacao: 'em_uso', localId: s.localUso?.localId ?? null,
            detalhe: s.localUso?.detalhe, desde: this.quando(s, 'transferencia_aceita') ?? this.quando(s, 'retirado'),
            atrasado: this.emprestimos.estaAtrasado(s),
          });
        }
      }
    }

    for (const m of this.manutencoes.pendentes()) {
      const comum = {
        equipamentoId: m.equipamentoId, nome: m.equipamento, patrimonio: m.codigoPatrimonio, quantidade: m.quantidade,
        quantidadeTexto: un(m.quantidade), responsavel: m.responsavel, pedidoId: m.emprestimoId,
        protocolo: m.protocolo, ocorrenciaId: m.id, desde: m.dataRegistro,
      };
      if (m.tipo === 'extravio') {
        lista.push({ ...comum, situacao: 'nao_localizado', localId: null, detalhe: `Falta aberta (${m.protocolo}): não voltou na devolução` });
      } else {
        const naAssistencia = m.status === 'em_assistencia';
        lista.push({
          ...comum, situacao: 'manutencao', localId: naAssistencia ? 'assistencia' : 'sala-manutencao',
          detalhe: naAssistencia ? `Em conserto: ${m.assistencia ?? 'assistência técnica'}` : `Aguardando providência · ${m.descricao}`,
        });
      }
    }

    for (const i of this.insumos.ativos()) {
      if (i.quantidadeAtual <= 0) continue;
      lista.push({
        situacao: 'insumo', localId: this.insumos.localDeGuarda(i), insumoId: i.id, nome: i.nome,
        quantidade: i.quantidadeAtual,
        quantidadeTexto: `${formatarQuantidade(i.quantidadeAtual)} ${NOME_UNIDADE[i.unidadeMedida]}`,
        detalhe: i.localizacao, estoqueBaixo: i.quantidadeAtual <= i.estoqueMinimo,
      });
    }
    return lista;
  });

  /** Resumo de cada local da planta (inclui a assistência técnica, que fica fora da escola). */
  readonly locais = computed<ResumoLocal[]>(() => {
    const itens = this.itens();
    return LOCAIS_ESCOLA.map((local) => {
      const doLocal = itens.filter((i) => i.localId === local.id);
      const soma = (f: (i: ItemNoLocal) => boolean) => doLocal.filter(f).reduce((s, i) => s + i.quantidade, 0);
      return {
        local,
        itens: doLocal,
        emUso: soma((i) => i.situacao === 'em_uso'),
        guardados: soma((i) => i.situacao === 'guardado' || i.situacao === 'reservado' || i.situacao === 'inativo'),
        manutencao: soma((i) => i.situacao === 'manutencao'),
        insumos: doLocal.filter((i) => i.situacao === 'insumo').length,
        atrasados: doLocal.filter((i) => i.atrasado).length,
      };
    });
  });

  /** Unidades sem local na planta: falta aberta ou pedido antigo sem local informado. */
  readonly semLocal = computed(() => this.itens().filter((i) => i.localId === null));

  /** Onde estão as unidades de um equipamento (todas as situações). */
  ondeEsta(equipamentoId: string): ItemNoLocal[] {
    return this.itens().filter((i) => i.equipamentoId === equipamentoId);
  }

  /** Últimas mudanças de lugar registradas (retirada, transferência aceita e devolução). */
  readonly movimentos = computed<MovimentoDeLocal[]>(() => {
    const lista: MovimentoDeLocal[] = [];
    for (const s of this.emprestimos.todas()) {
      const itens = this.emprestimos.resumoItens(s);
      const guarda = localDeGuarda(this.equipamentos.buscarPorId(s.itens[0]?.equipamentoId ?? '')?.localizacao).nome;
      const uso = descreverLocalUso(s.localUso);
      for (const ev of s.historico) {
        const base = { em: ev.em, pedidoId: s.id, protocolo: s.protocolo, itens, por: ev.por.nome };
        if (ev.tipo === 'retirado') lista.push({ ...base, de: guarda, para: uso });
        else if (ev.tipo === 'transferencia_aceita') lista.push({ ...base, de: 'com o responsável anterior', para: `${ev.por.nome} · ${uso}` });
        else if (ev.tipo === 'devolvido') lista.push({ ...base, de: uso, para: guarda });
      }
    }
    return lista.sort((a, b) => b.em.localeCompare(a.em)).slice(0, 12);
  });

  private quando(s: Emprestimo, tipo: string): string | undefined {
    return [...s.historico].reverse().find((e) => e.tipo === tipo)?.em;
  }
}
