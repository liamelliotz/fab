import { AssistenciaTecnica } from '../models/assistencia.model';
import { AssistenciaService, formatarCnpj } from './assistencia.service';
import { Injectable, Injector, computed, effect, inject, signal } from '@angular/core';
import {
  GravidadeAvaria,
  Manutencao,
  MotivoBaixa,
  RegistroBaixa,
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

const CHAVE_MANUTENCOES = 'fab_demo_v8_manutencoes';
/** Fotos ficam numa chave separada: se o navegador ficar sem espaço, só as fotos se perdem. */
const CHAVE_FOTOS = 'fab_demo_v8_fotos';
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

export const NOME_MOTIVO_BAIXA: Record<MotivoBaixa, string> = {
  irreparavel: 'Dano irreparável',
  conserto_inviavel: 'Conserto inviável (custo maior que o valor do bem)',
  obsolescencia: 'Obsolescência ou fim da vida útil',
  extravio_definitivo: 'Extravio definitivo (não foi encontrado)',
  furto_roubo: 'Furto ou roubo',
};

/** Motivos que fazem sentido para cada tipo de ocorrência. */
export const MOTIVOS_BAIXA: Record<TipoOcorrencia, MotivoBaixa[]> = {
  avaria: ['irreparavel', 'conserto_inviavel', 'obsolescencia'],
  extravio: ['extravio_definitivo', 'furto_roubo'],
};

/** O que a coordenação informa para dar baixa (tudo fica no termo). */
export interface DadosBaixa {
  motivo?: MotivoBaixa;
  parecer: string;
  laudo?: string;
  processo?: string;
  responsavelCiente?: boolean;
  testemunha?: string;
  /** O número de patrimônio digitado de novo, como confirmação. */
  confirmacaoPatrimonio: string;
  /** Quantas unidades recebem baixa (padrão: todas da ocorrência). */
  quantidade?: number;
  /** Quais unidades (obrigatório quando não são todas). */
  identificacao?: string;
}

/** Quantas e quais unidades estão sendo resolvidas (consertadas, encontradas ou baixadas). */
export interface UnidadesResolvidas {
  quantidade?: number;
  identificacao?: string;
}

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
      registradoPor: admin, bloqueia: true, assistencia: 'Oficina Norte Ferramentas', assistenciaId: 'ast-ferramentas',
      status: 'em_assistencia',
      dataRegistro: horasDepoisISO(-10 * 24),
      historico: [
        passo(10, 'Encontrada com defeito na conferência do laboratório (2 unidades).'),
        passo(8, 'Enviada para conserto: Oficina Norte Ferramentas (assistência credenciada).'),
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
    {
      id: 'oc0', protocolo: 'OC-2026-0000', tipo: 'avaria', equipamentoId: '3',
      equipamento: 'Notebook Lenovo IdeaPad 3', codigoPatrimonio: 'PAT-0003', quantidade: 1,
      tipoAvaria: 'nao_liga', gravidade: 'grave',
      descricao: 'Não liga depois de queda da bancada. Placa-mãe danificada.',
      registradoPor: admin, bloqueia: true, assistencia: 'Tech Assistência', assistenciaId: 'ast-tech', status: 'baixa',
      dataRegistro: horasDepoisISO(-48 * 24), dataConclusao: horasDepoisISO(-40 * 24),
      historico: [
        passo(48, 'Encontrado com defeito na conferência do laboratório (1 unidade). Unidade bloqueada para empréstimo.'),
        passo(46, 'Enviada para conserto: Tech Assistência (assistência credenciada).'),
        passo(40, 'Baixa de 1 unidade(s) no acervo (TB-2026-0001) · Conserto inviável (custo maior que o valor do bem) · Laudo da assistência: placa-mãe sem reparo, troca custa mais que um notebook novo. · laudo LT-2231 · processo/BO PROC-2026/014'),
      ],
      baixa: {
        protocolo: 'TB-2026-0001', motivo: 'conserto_inviavel',
        parecer: 'Laudo da assistência: placa-mãe sem reparo, troca custa mais que um notebook novo.',
        laudo: 'LT-2231', processo: 'PROC-2026/014', valorEstimado: 2899, responsavelCiente: false,
        testemunha: 'Carlos Souza', autorizadoPor: admin, em: horasDepoisISO(-40 * 24),
      },
    },
  ];
}

@Injectable({ providedIn: 'root' })
export class ManutencaoService {
  private readonly equipamentos = inject(EquipamentoService);
  private readonly assistencias = inject(AssistenciaService);
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

  /** Assistências que podem consertar o equipamento desta ocorrência (credenciadas, em dia, da categoria). */
  assistenciasPara(m: Manutencao): AssistenciaTecnica[] {
    return this.assistencias.paraCategoria(this.equipamentos.buscarPorId(m.equipamentoId)?.categoria);
  }

  /** Só vai para uma assistência CREDENCIADA, em dia e que conserta a categoria do equipamento. */
  enviarParaAssistencia(id: string, assistenciaId: string): string | null {
    const m = this.buscarPorId(id);
    if (!m || m.status !== 'aberta' || m.tipo !== 'avaria') return 'Esta ocorrência não pode ir para conserto agora.';
    const a = this.assistencias.buscarPorId(assistenciaId);
    const categoria = this.equipamentos.buscarPorId(m.equipamentoId)?.categoria;
    const impedimento = this.assistencias.impedimento(a, categoria);
    if (impedimento) return impedimento;
    this.alterar(
      id,
      { status: 'em_assistencia', assistencia: a!.nomeFantasia, assistenciaId: a!.id },
      `Enviada para conserto: ${a!.nomeFantasia} (assistência credenciada, CNPJ ${formatarCnpj(a!.cnpj)}).`,
    );
    return null;
  }

  /** Valor da baixa: valor unitário do cadastro × unidades. undefined se o item não tem valor. */
  valorDaBaixa(m: Manutencao, quantidade = m.quantidade): number | undefined {
    const v = this.equipamentos.buscarPorId(m.equipamentoId)?.valorUnitario;
    return v === undefined ? undefined : Math.round(v * quantidade * 100) / 100;
  }

  /**
   * Confere quantas e quais unidades serão resolvidas. Todas: a identificação é opcional.
   * Só parte delas: é preciso dizer quais (etiqueta, nº de série...), para saber qual continua.
   */
  validarUnidades(m: Manutencao, u: UnidadesResolvidas): string | null {
    const q = u.quantidade ?? m.quantidade;
    if (!Number.isInteger(q) || q < 1 || q > m.quantidade) {
      return `Escolha de 1 a ${m.quantidade} unidade(s).`;
    }
    if (q < m.quantidade && (u.identificacao ?? '').trim().length < 2) {
      return `Diga ${q === 1 ? 'qual unidade' : `quais são as ${q} unidades`} (etiqueta ou nº de série), para saber qual continua em manutenção.`;
    }
    if ((u.identificacao ?? '').trim().length > 120) return 'A identificação das unidades pode ter até 120 caracteres.';
    return null;
  }

  /** Consertada (avaria) ou encontrada (extravio): as unidades voltam ao estoque. Pode ser só parte delas. */
  concluir(id: string, observacao: string, unidades: UnidadesResolvidas = {}): string | null {
    const m = this.buscarPorId(id);
    if (!m || (m.status !== 'aberta' && m.status !== 'em_assistencia')) return 'Esta ocorrência já foi resolvida.';
    const erro = this.validarUnidades(m, unidades);
    if (erro) return erro;
    const q = unidades.quantidade ?? m.quantidade;
    const quais = this.quais(unidades.identificacao);

    this.equipamentos.voltarDaManutencao(m.equipamentoId, q);
    const feito = m.tipo === 'extravio' ? 'Encontrada(s)' : 'Consertada(s)';
    const obs = observacao.trim() ? ' ' + observacao.trim() : '';
    const texto = `${feito}: ${q} unidade(s)${quais} de volta ao estoque.${obs}`;
    const alvo = this.separar(m, q, unidades.identificacao, `${feito.toLowerCase()} e de volta ao estoque`);
    this.alterar(alvo.id, { status: 'concluida', dataConclusao: agoraISO() }, texto);
    this.anotarNoPedido(m, 'manutencao_concluida', `${alvo.protocolo} · ${m.equipamento}: ${texto}`);
    return null;
  }

  /** Confere os dados da baixa. Devolve a mensagem do 1º problema, ou null. */
  validarBaixa(m: Manutencao, dados: DadosBaixa): string | null {
    const unidades = this.validarUnidades(m, dados);
    if (unidades) return unidades;
    if (!dados.motivo) return 'Escolha o motivo da baixa.';
    if (!MOTIVOS_BAIXA[m.tipo].includes(dados.motivo)) return 'Este motivo não vale para este tipo de ocorrência.';
    if (dados.parecer.trim().length < 20) {
      return 'Escreva o parecer técnico ou o relato do ocorrido (mínimo 20 caracteres).';
    }
    if (dados.motivo === 'furto_roubo' && !dados.processo?.trim()) {
      return 'Furto ou roubo exige o número do boletim de ocorrência.';
    }
    if (m.responsavel && !dados.responsavelCiente) {
      return `Confirme que ${m.responsavel.nome}, que estava com o item, foi informado(a) da baixa.`;
    }
    const digitado = dados.confirmacaoPatrimonio.trim().toUpperCase();
    if (!m.codigoPatrimonio || digitado !== m.codigoPatrimonio.toUpperCase()) {
      return `Digite o patrimônio ${m.codigoPatrimonio} para confirmar a baixa.`;
    }
    return null;
  }

  /**
   * Sem conserto ou perdida de vez: as unidades saem do acervo.
   * Gera o termo de baixa (auditoria): motivo, parecer, documentos, quem autorizou e quem estava com o item.
   */
  darBaixa(id: string, dados: DadosBaixa): string | null {
    const m = this.buscarPorId(id);
    if (!m || (m.status !== 'aberta' && m.status !== 'em_assistencia')) return 'Esta ocorrência já foi resolvida.';
    const erro = this.validarBaixa(m, dados);
    if (erro) return erro;

    const q = dados.quantidade ?? m.quantidade;
    const baixa: RegistroBaixa = {
      protocolo: this.proximoTermo(),
      motivo: dados.motivo!,
      parecer: dados.parecer.trim(),
      laudo: dados.laudo?.trim() || undefined,
      processo: dados.processo?.trim() || undefined,
      valorEstimado: this.valorDaBaixa(m, q),
      responsavelCiente: !!dados.responsavelCiente,
      testemunha: dados.testemunha?.trim() || undefined,
      autorizadoPor: this.ator(),
      em: agoraISO(),
    };
    this.equipamentos.baixar(m.equipamentoId, q);
    const texto = [
      `Baixa de ${q} unidade(s)${this.quais(dados.identificacao)} no acervo (${baixa.protocolo})`,
      NOME_MOTIVO_BAIXA[baixa.motivo],
      baixa.parecer,
      baixa.laudo ? `laudo ${baixa.laudo}` : '',
      baixa.processo ? `processo/BO ${baixa.processo}` : '',
    ].filter(Boolean).join(' · ');
    const alvo = this.separar(m, q, dados.identificacao, `baixa no termo ${baixa.protocolo}`);
    this.alterar(alvo.id, { status: 'baixa', dataConclusao: baixa.em, baixa }, texto);
    this.anotarNoPedido(m, 'manutencao_baixa', `${alvo.protocolo} · ${m.equipamento}: ${texto}`);
    return null;
  }

  /** Termos de baixa emitidos, do mais novo para o mais antigo. */
  readonly baixas = computed(() =>
    this.todas()
      .filter((m) => !!m.baixa)
      .sort((a, b) => b.baixa!.em.localeCompare(a.baixa!.em)),
  );

  /** Volta ao estado inicial da demonstração. */
  reiniciar(): void {
    this.todas.set(criarManutencoesDemo());
    this.fotos.set({});
  }

  // ---------- Internos ----------

  private quais(identificacao?: string): string {
    const t = identificacao?.trim();
    return t ? ` (${t})` : '';
  }

  /**
   * Resolução parcial: tira `q` unidades da ocorrência `m` e cria uma ocorrência nova só com elas
   * (protocolo próprio, mesmo histórico, apontando para a origem). A original segue aberta com o resto.
   * Se `q` cobre todas as unidades, devolve a própria ocorrência (só grava a identificação).
   */
  private separar(m: Manutencao, q: number, identificacao: string | undefined, destino: string): Manutencao {
    const quais = identificacao?.trim() || undefined;
    if (q >= m.quantidade) {
      if (quais) this.todas.update((l) => l.map((x) => (x.id === m.id ? { ...x, identificacao: quais } : x)));
      return m;
    }
    const eu = this.ator();
    const nova: Manutencao = {
      ...m,
      id: crypto.randomUUID(),
      protocolo: this.proximoProtocolo(),
      quantidade: q,
      identificacao: quais,
      origemProtocolo: m.protocolo,
      historico: [
        ...m.historico,
        { em: agoraISO(), por: eu, texto: `Separada de ${m.protocolo}: ${q} de ${m.quantidade} unidade(s)${this.quais(quais)}.` },
      ],
    };
    const foto = m.temFoto ? this.foto(m.id) : undefined;
    const resto = m.quantidade - q;
    const passo: PassoManutencao = {
      em: agoraISO(),
      por: eu,
      texto: `${q} unidade(s)${this.quais(quais)} ${destino} (${nova.protocolo}). ${resto} continua(m) nesta ocorrência.`,
    };
    this.todas.update((lista) => [
      nova,
      ...lista.map((x) => (x.id === m.id ? { ...x, quantidade: resto, historico: [...x.historico, passo] } : x)),
    ]);
    if (foto) this.guardarFoto(nova.id, foto);
    return nova;
  }

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

  private proximoTermo(): string {
    const maior = this.todas().reduce((n, m) => Math.max(n, Number(m.baixa?.protocolo.slice(-4)) || 0), 0);
    return `TB-${new Date().getFullYear()}-${String(maior + 1).padStart(4, '0')}`;
  }

  private proximoProtocolo(): string {
    const maior = this.todas().reduce((n, m) => Math.max(n, Number(m.protocolo.slice(-4)) || 0), 0);
    return `OC-${new Date().getFullYear()}-${String(maior + 1).padStart(4, '0')}`;
  }
}
