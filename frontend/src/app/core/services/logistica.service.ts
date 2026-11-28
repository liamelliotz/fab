import { Injectable, computed, inject } from '@angular/core';
import { localDeGuarda, nomeLocal } from '../constants/escola-modelo.constants';
import { Emprestimo } from '../models/emprestimo.model';
import { RequisicaoInsumo } from '../models/requisicao-insumo.model';
import { UsuarioResumo } from '../models/usuario.model';
import { hojeISO, somarDias } from '../utils/date.utils';
import { EmprestimoService } from './emprestimo.service';
import { EquipamentoService } from './equipamento.service';
import { InsumoService, NOME_UNIDADE, formatarQuantidade } from './insumo.service';
import { RequisicaoInsumoService } from './requisicao-insumo.service';

/** Uma linha de material: o que é, quanto e onde fica guardado. */
export interface LinhaLogistica {
  nome: string;
  quantidadeTexto: string;
  /** Local de guarda (planta da escola). */
  localId: string;
  localNome: string;
  /** Texto do cadastro, ex.: "Armário de TI · prateleira 2". */
  localizacao: string;
  /** Equipamento que "fica na sala": entrega e devolução lá mesmo. */
  noLocal: boolean;
}

export interface TarefaLogistica {
  tipo: 'emprestimo' | 'insumo';
  id: string;
  protocolo: string;
  pessoa: UsuarioResumo;
  /** Separação: dia da retirada. Guarda: dia em que voltou ao balcão. */
  data: string;
  /** Separação: já está pronto no balcão? */
  feito: boolean;
  /** Separação: todos os itens ficam na sala (não há o que buscar). */
  soNoLocal: boolean;
  linhas: LinhaLogistica[];
}

/** Uma parada do roteiro: um local com quantos materiais buscar/guardar ali. */
export interface ParadaRoteiro {
  localId: string;
  localNome: string;
  linhas: (LinhaLogistica & { protocolo: string })[];
}

/**
 * LOGÍSTICA DO BALCÃO: o que separar antes das retiradas e o que guardar depois das devoluções,
 * juntando empréstimos e requisições de insumo, com o roteiro agrupado por sala.
 * O admin faz UMA volta pela escola em vez de buscar item por item com o professor esperando.
 */
@Injectable({ providedIn: 'root' })
export class LogisticaService {
  private readonly emprestimos = inject(EmprestimoService);
  private readonly requisicoes = inject(RequisicaoInsumoService);
  private readonly equipamentos = inject(EquipamentoService);
  private readonly insumos = inject(InsumoService);

  /** Até quando olhar para a frente na separação: hoje e amanhã (e o que ficou para trás). */
  readonly horizonte = computed(() => somarDias(hojeISO(), 1));

  /** Retiradas aprovadas, das mais próximas para as mais distantes; prontas por último. */
  readonly separacao = computed<TarefaLogistica[]>(() => {
    const lista: TarefaLogistica[] = [
      ...this.emprestimos.todas().filter((s) => s.status === 'aprovado').map((s) => this.deEmprestimo(s)),
      ...this.requisicoes.aguardandoEntrega().map((r) => this.deRequisicao(r)),
    ];
    return lista.sort((a, b) => Number(a.feito) - Number(b.feito) || a.data.localeCompare(b.data));
  });

  /** O que falta separar para hoje e amanhã (badge e roteiro). */
  readonly aSeparar = computed(() =>
    this.separacao().filter((t) => !t.feito && !t.soNoLocal && t.data <= this.horizonte()),
  );

  /** Material no balcão esperando voltar ao local de guarda. */
  readonly guarda = computed<TarefaLogistica[]>(() => {
    const lista: TarefaLogistica[] = [
      ...this.emprestimos.paraGuardar().map((s) => this.guardaDeEmprestimo(s)),
      ...this.requisicoes.paraGuardar().map((r) => this.guardaDeRequisicao(r)),
    ];
    return lista.sort((a, b) => a.data.localeCompare(b.data));
  });

  /** Roteiro da separação: por sala, o que buscar (só hoje/amanhã, ainda não separado). */
  readonly roteiroSeparacao = computed(() => this.roteiro(this.aSeparar()));
  /** Roteiro da guarda: por sala, o que levar de volta. */
  readonly roteiroGuarda = computed(() => this.roteiro(this.guarda()));

  separar(t: TarefaLogistica, separado: boolean): string | null {
    return t.tipo === 'emprestimo'
      ? this.emprestimos.marcarSeparado(t.id, separado)
      : this.requisicoes.marcarSeparada(t.id, separado);
  }

  guardar(t: TarefaLogistica): string | null {
    return t.tipo === 'emprestimo' ? this.emprestimos.marcarGuardado(t.id) : this.requisicoes.marcarGuardada(t.id);
  }

  // ---------- Montagem ----------

  private roteiro(tarefas: TarefaLogistica[]): ParadaRoteiro[] {
    const paradas = new Map<string, ParadaRoteiro>();
    for (const t of tarefas) {
      for (const l of t.linhas) {
        if (l.noLocal) continue;
        const p = paradas.get(l.localId) ?? { localId: l.localId, localNome: l.localNome, linhas: [] };
        p.linhas.push({ ...l, protocolo: t.protocolo });
        paradas.set(l.localId, p);
      }
    }
    return [...paradas.values()].sort((a, b) => a.localNome.localeCompare(b.localNome));
  }

  private linhaEquipamento(equipamentoId: string, quantidade: number): LinhaLogistica {
    const e = this.equipamentos.buscarPorId(equipamentoId);
    const local = localDeGuarda(e?.localizacao);
    return {
      nome: e?.nome ?? 'Item removido',
      quantidadeTexto: quantidade === 1 ? '1 unidade' : `${quantidade} unidades`,
      localId: local.id,
      localNome: local.nome,
      localizacao: e?.localizacao ?? local.nome,
      noLocal: !!e?.retiradaNoLocal,
    };
  }

  private linhaInsumo(r: RequisicaoInsumo, quantidade: number): LinhaLogistica {
    const i = this.insumos.buscarPorId(r.insumo.id);
    const localId = i ? this.insumos.localDeGuarda(i) : 'almox-ti';
    return {
      nome: r.insumo.nome,
      quantidadeTexto: `${formatarQuantidade(quantidade)} ${NOME_UNIDADE[r.insumo.unidadeMedida]}`,
      localId,
      localNome: nomeLocal(localId),
      localizacao: i?.localizacao ?? nomeLocal(localId),
      noLocal: false,
    };
  }

  private deEmprestimo(s: Emprestimo): TarefaLogistica {
    return {
      tipo: 'emprestimo', id: s.id, protocolo: s.protocolo, pessoa: s.responsavel,
      data: s.dataPrevistaRetirada.slice(0, 10), feito: !!s.separadoEm,
      soNoLocal: this.emprestimos.retiradaSoNoLocal(s),
      linhas: s.itens.map((i) => this.linhaEquipamento(i.equipamentoId, i.quantidade)),
    };
  }

  private deRequisicao(r: RequisicaoInsumo): TarefaLogistica {
    return {
      tipo: 'insumo', id: r.id, protocolo: r.protocolo, pessoa: r.solicitante, data: r.dataUso,
      feito: !!r.separadaEm, soNoLocal: false, linhas: [this.linhaInsumo(r, r.quantidade)],
    };
  }

  private guardaDeEmprestimo(s: Emprestimo): TarefaLogistica {
    const ultimo = s.historico.at(-1)?.em ?? s.dataDevolucaoEfetiva ?? hojeISO();
    return {
      tipo: 'emprestimo', id: s.id, protocolo: s.protocolo, pessoa: s.responsavel, data: ultimo,
      feito: false, soNoLocal: false,
      linhas: (s.aGuardar ?? []).map((i) => this.linhaEquipamento(i.equipamentoId, i.quantidade)),
    };
  }

  private guardaDeRequisicao(r: RequisicaoInsumo): TarefaLogistica {
    return {
      tipo: 'insumo', id: r.id, protocolo: r.protocolo, pessoa: r.solicitante,
      data: r.historico.at(-1)?.em ?? r.criadaEm, feito: false, soNoLocal: false,
      linhas: [this.linhaInsumo(r, r.aGuardar ?? 0)],
    };
  }
}
