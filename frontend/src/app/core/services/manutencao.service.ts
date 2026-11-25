import { Injectable, Injector, computed, effect, inject, signal } from '@angular/core';
import {
  GravidadeAvaria,
  Manutencao,
  PassoManutencao,
  StatusManutencao,
  TipoAvaria,
  TipoOcorrencia,
} from '../models/manutencao.model';
import { TipoEventoEmprestimo } from '../models/emprestimo.model';
import { UsuarioResumo } from '../models/usuario.model';
import { gravarJson, lerJson, ouvirOutrasAbas } from '../utils/armazenamento.utils';
import { agoraISO, horasDepoisISO } from '../utils/date.utils';
import { AuthService } from './auth.service';
import { EquipamentoService } from './equipamento.service';
import { resumoDemo } from './usuario.service';
import { EmprestimoService } from './emprestimo.service';

const CHAVE_MANUTENCOES = 'fab_demo_v6_manutencoes';
/** Fotos ficam numa chave separada: se o navegador ficar sem espaço, só as fotos se perdem. */
const CHAVE_FOTOS = 'fab_demo_v6_fotos';
/** A demonstração guarda no máximo estas fotos (as mais novas). */
const MAX_FOTOS = 12;

export const NOME_TIPO_AVARIA: Record<TipoAvaria, string> = {
  tela_carcaca: 'Tela ou carcaça danificada',
  nao_liga: 'Não liga ou falha ao funcionar',
  peca_faltando: 'Peça ou acessório faltando',
  desgaste: 'Desgaste ou sujeira',
  outro: 'Outro problema',
};

export const NOME_GRAVIDADE: Record<GravidadeAvaria, string> = {
  leve: 'Leve',
  moderada: 'Moderada',
  grave: 'Grave',
};

/** O que cada gravidade faz com a unidade (texto mostrado ao escolher). */
export const EFEITO_GRAVIDADE: Record<GravidadeAvaria, string> = {
  leve: 'Só registra: a unidade volta ao estoque e pode ser emprestada.',
  moderada: 'Vai para manutenção: a unidade fica bloqueada até ser consertada.',
  grave: 'Vai para manutenção: a unidade fica bloqueada até ser consertada ou ter baixa.',
};

export const NOME_STATUS_MANUTENCAO: Record<StatusManutencao, string> = {
  registrada: 'Só registro',
  aberta: 'Aberta',
  em_assistencia: 'Em conserto',
  concluida: 'Resolvida',
  baixa: 'Baixa',
};

/** Dados para abrir uma ocorrência. */
export interface NovaOcorrencia {
  tipo: TipoOcorrencia;
  equipamentoId: string;
  quantidade: number;
  tipoAvaria?: TipoAvaria;
  gravidade?: GravidadeAvaria;
  descricao: string;
  foto?: string;
  /** Pedido de onde veio (devolução no balcão). */
  pedido?: { id: string; protocolo: string; responsavel: UsuarioResumo };
  /** 'emprestimo': as unidades estavam emprestadas; 'estoque': estavam no laboratório. */
  origem: 'emprestimo' | 'estoque';
}

function criarManutencoesDemo(): Manutencao[] {
  const admin = resumoDemo('usr-admin');
  const prof = resumoDemo('usr-professor');
  const passo = (diasAtras: number, texto: string, por = admin): PassoManutencao => ({
    em: horasDepoisISO(-diasAtras * 24),
    por,
    texto,
  });
  return [
    {
      id: 'oc1', protocolo: 'OC-2026-0001', tipo: 'avaria', equipamentoId: '7',
      equipamento: 'Parafusadeira Bosch 12 V', codigoPatrimonio: 'PAT-0007', quantidade: 2,
      tipoAvaria: 'nao_liga', gravidade: 'grave',
      descricao: 'As duas baterias não seguram carga e a parafusadeira não liga.',
      registradoPor: admin, bloqueia: true, assistencia: 'Tech Assistência', status: 'em_assistencia',
      dataRegistro: horasDepoisISO(-10 * 24),
      historico: [
        passo(10, 'Encontrada com defeito na conferência do laboratório (2 unidades).'),
        passo(8, 'Enviada para conserto: Tech Assistência.'),
      ],
    },
    {
      id: 'oc2', protocolo: 'OC-2026-0002', tipo: 'avaria', equipamentoId: '4',
      equipamento: 'Caixa de som Bluetooth', codigoPatrimonio: 'PAT-0004', quantidade: 1,
      tipoAvaria: 'desgaste', gravidade: 'leve',
      descricao: 'Risco leve na lateral. Funciona normalmente.',
      emprestimoId: 'p35', protocoloEmprestimo: 'EMP-2026-0035', responsavel: prof,
      registradoPor: admin, bloqueia: false, status: 'registrada',
      dataRegistro: horasDepoisISO(-21 * 24),
      historico: [passo(21, 'Avaria leve registrada na devolução. A unidade voltou ao estoque.')],
    },
  ];
}

@Injectable({ providedIn: 'root' })
export class ManutencaoService {
  private readonly equipamentos = inject(EquipamentoService);
  private readonly auth = inject(AuthService);
  /** EmprestimoService também usa este serviço: buscamos ele só na hora (evita dependência circular). */
  private readonly injector = inject(Injector);

  readonly todas = signal<Manutencao[]>(
    lerJson<Manutencao[]>(CHAVE_MANUTENCOES) ?? criarManutencoesDemo(),
  );
  private readonly fotos = signal<Record<string, string>>(lerJson<Record<string, string>>(CHAVE_FOTOS) ?? {});

  /** Ocorrências que ainda prendem unidades fora do estoque. */
  readonly pendentes = computed(() =>
    this.todas().filter((m) => m.status === 'aberta' || m.status === 'em_assistencia'),
  );

  constructor() {
    effect(() => gravarJson(CHAVE_MANUTENCOES, this.todas()));
    effect(() => gravarJson(CHAVE_FOTOS, this.fotos()));
    ouvirOutrasAbas<Manutencao[]>(CHAVE_MANUTENCOES, (v) => v && this.todas.set(v));
    ouvirOutrasAbas<Record<string, string>>(CHAVE_FOTOS, (v) => v && this.fotos.set(v));
  }

  // ---------- Consultas ----------

  buscarPorId(id: string): Manutencao | undefined {
    return this.todas().find((m) => m.id === id);
  }

  foto(id: string): string | undefined {
    return this.fotos()[id];
  }

  doEquipamento(equipamentoId: string): Manutencao[] {
    return this.todas().filter((m) => m.equipamentoId === equipamentoId);
  }

  doPedido(pedidoId: string): Manutencao[] {
    return this.todas().filter((m) => m.emprestimoId === pedidoId);
  }

  /** Avaria leve não bloqueia; moderada, grave e extravio tiram a unidade do estoque. */
  bloqueia(tipo: TipoOcorrencia, gravidade?: GravidadeAvaria): boolean {
    return tipo === 'extravio' || gravidade !== 'leve';
  }

  /** Confere os dados de uma ocorrência. Devolve a mensagem do 1º problema, ou null. */
  validar(dados: Pick<NovaOcorrencia, 'tipo' | 'quantidade' | 'tipoAvaria' | 'gravidade' | 'descricao'>, nomeItem: string): string | null {
    if (!Number.isInteger(dados.quantidade) || dados.quantidade < 1) {
      return `Informe quantas unidades de "${nomeItem}".`;
    }
    if (dados.tipo === 'avaria') {
      if (!dados.tipoAvaria) return `Escolha o tipo de avaria de "${nomeItem}".`;
      if (!dados.gravidade) return `Escolha a gravidade da avaria de "${nomeItem}".`;
      if (dados.descricao.trim().length < 5) {
        return `Descreva a avaria de "${nomeItem}" (mínimo 5 caracteres).`;
      }
    }
    return null;
  }

  // ---------- Registrar ----------

  /** Abre uma ocorrência e, se for o caso, tira as unidades do estoque. */
  registrar(dados: NovaOcorrencia): Manutencao {
    const eq = this.equipamentos.buscarPorId(dados.equipamentoId);
    const eu = this.ator();
    const bloqueia = this.bloqueia(dados.tipo, dados.gravidade);
    const id = crypto.randomUUID();

    if (bloqueia) this.equipamentos.enviarParaManutencao(dados.equipamentoId, dados.quantidade, dados.origem);

    const origem = dados.pedido ? `na devolução do ${dados.pedido.protocolo}` : 'pela coordenação';
    const unidades = `${dados.quantidade} unidade(s)`;
    const texto =
      dados.tipo === 'extravio'
        ? `Falta registrada ${origem}: ${unidades} não voltaram. Fora do estoque até ser encontrada ou ter baixa.`
        : bloqueia
          ? `Avaria ${NOME_GRAVIDADE[dados.gravidade!].toLowerCase()} registrada ${origem} (${unidades}). Unidade bloqueada para empréstimo.`
          : `Avaria leve registrada ${origem} (${unidades}). A unidade voltou ao estoque.`;

    const nova: Manutencao = {
      id,
      protocolo: this.proximoProtocolo(),
      tipo: dados.tipo,
      equipamentoId: dados.equipamentoId,
      equipamento: eq?.nome ?? 'Equipamento removido',
      codigoPatrimonio: eq?.codigoPatrimonio ?? '',
      quantidade: dados.quantidade,
      tipoAvaria: dados.tipo === 'avaria' ? dados.tipoAvaria : undefined,
      gravidade: dados.tipo === 'avaria' ? dados.gravidade : undefined,
      descricao: dados.descricao.trim() || (dados.tipo === 'extravio' ? 'Unidade não devolvida.' : ''),
      temFoto: !!dados.foto,
      emprestimoId: dados.pedido?.id,
      protocoloEmprestimo: dados.pedido?.protocolo,
      responsavel: dados.pedido?.responsavel,
      registradoPor: eu,
      bloqueia,
      status: bloqueia ? 'aberta' : 'registrada',
      dataRegistro: agoraISO(),
      historico: [{ em: agoraISO(), por: eu, texto }],
    };
    this.todas.update((lista) => [nova, ...lista]);
    if (dados.foto) this.guardarFoto(id, dados.foto);
    return nova;
  }

  // ---------- Andamento ----------

  enviarParaAssistencia(id: string, assistencia: string): string | null {
    const m = this.buscarPorId(id);
    if (!m || m.status !== 'aberta' || m.tipo !== 'avaria') return 'Esta ocorrência não pode ir para conserto agora.';
    const nome = assistencia.trim() || 'assistência técnica';
    this.alterar(id, { status: 'em_assistencia', assistencia: nome }, `Enviada para conserto: ${nome}.`);
    return null;
  }

  /** Consertada (avaria) ou encontrada (extravio): as unidades voltam ao estoque. */
  concluir(id: string, observacao: string): string | null {
    const m = this.buscarPorId(id);
    if (!m || (m.status !== 'aberta' && m.status !== 'em_assistencia')) return 'Esta ocorrência já foi resolvida.';
    this.equipamentos.voltarDaManutencao(m.equipamentoId, m.quantidade);
    const feito = m.tipo === 'extravio' ? 'Unidade encontrada' : 'Unidade consertada';
    const texto = `${feito}: ${m.quantidade} de volta ao estoque.${observacao.trim() ? ' ' + observacao.trim() : ''}`;
    this.alterar(id, { status: 'concluida', dataConclusao: agoraISO() }, texto);
    this.anotarNoPedido(m, 'manutencao_concluida', `${m.protocolo} · ${m.equipamento}: ${texto}`);
    return null;
  }

  /** Sem conserto ou perdida de vez: as unidades saem do acervo. */
  darBaixa(id: string, motivo: string): string | null {
    const m = this.buscarPorId(id);
    if (!m || (m.status !== 'aberta' && m.status !== 'em_assistencia')) return 'Esta ocorrência já foi resolvida.';
    if (motivo.trim().length < 5) return 'Explique o motivo da baixa (mínimo 5 caracteres).';
    this.equipamentos.baixar(m.equipamentoId, m.quantidade);
    const texto = `Baixa de ${m.quantidade} unidade(s) no acervo: ${motivo.trim()}`;
    this.alterar(id, { status: 'baixa', dataConclusao: agoraISO() }, texto);
    this.anotarNoPedido(m, 'manutencao_baixa', `${m.protocolo} · ${m.equipamento}: ${texto}`);
    return null;
  }

  /** Volta ao estado inicial da demonstração. */
  reiniciar(): void {
    this.todas.set(criarManutencoesDemo());
    this.fotos.set({});
  }

  // ---------- Internos ----------

  private alterar(id: string, mudanca: Partial<Manutencao>, texto: string): void {
    const passo: PassoManutencao = { em: agoraISO(), por: this.ator(), texto };
    this.todas.update((lista) =>
      lista.map((m) => (m.id === id ? { ...m, ...mudanca, historico: [...m.historico, passo] } : m)),
    );
  }

  /** Registra o desfecho também na linha do tempo do pedido de origem. */
  private anotarNoPedido(m: Manutencao, tipo: TipoEventoEmprestimo, detalhe: string): void {
    if (!m.emprestimoId) return;
    this.injector.get(EmprestimoService).anotar(m.emprestimoId, tipo, detalhe);
  }

  private guardarFoto(id: string, foto: string): void {
    this.fotos.update((atual) => {
      const ids = Object.keys(atual).slice(-(MAX_FOTOS - 1));
      const mantidas = Object.fromEntries(ids.map((k) => [k, atual[k]]));
      return { ...mantidas, [id]: foto };
    });
  }

  private ator(): UsuarioResumo {
    return this.auth.usuarioAtual();
  }

  private proximoProtocolo(): string {
    const maior = this.todas().reduce((n, m) => Math.max(n, Number(m.protocolo.slice(-4)) || 0), 0);
    return `OC-${new Date().getFullYear()}-${String(maior + 1).padStart(4, '0')}`;
  }
}
