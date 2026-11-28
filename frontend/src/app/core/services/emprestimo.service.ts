import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { buscarLocal, nomeLocal } from '../constants/escola-modelo.constants';
import {
  Emprestimo,
  EventoEmprestimo,
  ItemEmprestimo,
  LocalUsoEmprestimo,
  SolicitarEmprestimoDTO,
  StatusEmprestimo,
  TipoEventoEmprestimo,
} from '../models/emprestimo.model';
import { RegistroAvariaDTO } from '../models/manutencao.model';
import { Resultado, falha, sucesso } from '../models/resultado.model';
import { UsuarioResumo } from '../models/usuario.model';
import { gravarJson, lerJson, ouvirOutrasAbas } from '../utils/armazenamento.utils';
import { normalizarCodigo } from '../utils/codigo.utils';
import {
  agoraISO,
  diferencaEmDias,
  formatarData,
  hojeISO,
  horasDepoisISO,
  somarDias,
} from '../utils/date.utils';
import { AuthService } from './auth.service';
import { EquipamentoService } from './equipamento.service';
import { ManutencaoService, NOME_GRAVIDADE, NOME_TIPO_AVARIA } from './manutencao.service';
import { RegrasEmprestimoService, nomeCategoria } from './regras-emprestimo.service';
import { CodigosService } from './codigos.service';
import { resumoDemo, UsuarioService } from './usuario.service';

/** Tamanho mínimo do motivo de cancelamento (evita "ok", "x" e afins). */
export const MINIMO_MOTIVO_CANCELAMENTO = 10;

export const NOME_STATUS_EMPRESTIMO: Record<StatusEmprestimo, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Reprovado',
  em_andamento: 'Em andamento',
  devolvido: 'Devolvido',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};

const CHAVE_EMPRESTIMOS = 'fab_demo_v9_emprestimos';
const CHAVE_AVISOS = 'fab_demo_v9_avisos';

/** Quem assina o que o próprio sistema faz (pedido expirado, suspensão automática). */
export const SISTEMA: UsuarioResumo = { id: 'sistema', nome: 'Sistema FAB', email: '', perfil: 'admin' };

/** Status que ainda prendem material ou reserva (contam no limite por categoria). */
const STATUS_ABERTOS: StatusEmprestimo[] = ['pendente', 'aprovado', 'em_andamento'];

/** Aviso mostrado à coordenação (substitui o e-mail/notificação do sistema real). */
export interface AvisoAdmin {
  id: string;
  em: string;
  texto: string;
  pedidoId: string;
  lido: boolean;
}

/** Quem pode receber uma transferência e, se não puder, por quê. */
export interface CandidatoTransferencia {
  usuario: UsuarioResumo;
  bloqueio: string | null;
}

export interface OpcoesDevolucao {
  observacoes: string;
  /** Itens que voltaram com avaria ou faltando (um registro por equipamento do pedido). */
  ocorrencias?: RegistroAvariaDTO[];
  /** Forma antiga (só uma marcação, sem detalhes). Continua aceita. */
  houveAvaria?: boolean;
}

/** O que o balcão confirma na retirada, além do código. */
export interface OpcoesRetirada {
  /** Local de uso confirmado (ou corrigido) no balcão. Sem ele, vale o informado no pedido. */
  localUso?: LocalUsoEmprestimo;
  /** O responsável leu e aceitou o termo de responsabilidade. */
  termoAceito?: boolean;
}

/** "Sala 102 · 2º módulo" (ou só o nome do local). */
export function descreverLocalUso(local: LocalUsoEmprestimo | undefined): string {
  if (!local) return 'Local não informado';
  const detalhe = local.detalhe?.trim();
  return detalhe ? `${nomeLocal(local.localId)} · ${detalhe}` : nomeLocal(local.localId);
}

/** Quantas unidades voltaram ao estoque, foram para manutenção ou ficaram como falta. */
export interface ResumoDevolucao {
  aoEstoque: number;
  emManutencao: number;
  faltando: number;
}

// ---------------------------------------------------------------------------------------------
// Dados de exemplo. Todas as datas são relativas a HOJE, para a demonstração ficar coerente
// (um pedido "atrasado" continua atrasado e um "no prazo" continua no prazo, em qualquer dia).
// ---------------------------------------------------------------------------------------------
export function criarEmprestimosDemo(): Emprestimo[] {
  const hoje = hojeISO();
  const d = (n: number) => somarDias(hoje, n);
  const admin = resumoDemo('usr-admin');
  const prof = resumoDemo('usr-professor');
  const joao = resumoDemo('usr-joao');
  const maria = resumoDemo('usr-maria');
  const carlos = resumoDemo('usr-carlos');
  const ana = resumoDemo('usr-ana');

  const ev = (
    tipo: TipoEventoEmprestimo,
    por: UsuarioResumo,
    diasAtras: number,
    detalhe?: string,
    horasExtra = 0,
  ): EventoEmprestimo => ({
    id: crypto.randomUUID(),
    tipo,
    em: horasDepoisISO(-diasAtras * 24 + horasExtra),
    por,
    detalhe,
  });

  return [
    // Pendente de Carlos (Multímetro + Kit de ferramentas)
    {
      id: 'p45', localUso: { localId: 'lab-eletronica', detalhe: 'Bancada de testes' }, protocolo: 'EMP-2026-0045', solicitante: carlos, responsavel: carlos,
      itens: [{ equipamentoId: '5', quantidade: 1 }, { equipamentoId: '6', quantidade: 1 }],
      status: 'pendente', justificativa: 'Manutenção da bancada de testes do laboratório.',
      dataSolicitacao: d(-1), dataPrevistaRetirada: d(3), dataPrevistaDevolucao: d(9),
      historico: [ev('solicitado', carlos, 1)],
    },
    // APROVADO do professor: mostra o código e o QR de retirada
    {
      id: 'p44', localUso: { localId: 'lab-informatica', detalhe: 'Manutenção dos computadores' }, protocolo: 'EMP-2026-0044', solicitante: prof, responsavel: prof,
      itens: [{ equipamentoId: '6', quantidade: 1 }],
      status: 'aprovado', justificativa: 'Manutenção dos computadores do laboratório de informática.',
      dataSolicitacao: d(-1), dataPrevistaRetirada: d(0), dataPrevistaDevolucao: d(7),
      responsavelAprovacao: admin, codigoRetirada: 'H3Q8ZW',
      historico: [ev('solicitado', prof, 1), ev('aprovado', admin, 1, 'Pode retirar na coordenação.', 2)],
    },
    // Pendente de Maria
    {
      id: 'p43', localUso: { localId: 'auditorio', detalhe: 'Reunião de pais e mestres' }, protocolo: 'EMP-2026-0043', solicitante: maria, responsavel: maria,
      itens: [{ equipamentoId: '2', quantidade: 1 }],
      status: 'pendente', justificativa: 'Projeção de apresentação na reunião de pais e mestres.',
      dataSolicitacao: d(-1), dataPrevistaRetirada: d(2), dataPrevistaDevolucao: d(4),
      historico: [ev('solicitado', maria, 1)],
    },
    // Pendente de João
    {
      id: 'p42', localUso: { localId: 'sala-102', detalhe: '2º módulo · lógica de programação' }, protocolo: 'EMP-2026-0042', solicitante: joao, responsavel: joao,
      itens: [{ equipamentoId: '1', quantidade: 2 }],
      status: 'pendente', justificativa: 'Aula prática de lógica de programação com a turma do 2º módulo.',
      dataSolicitacao: d(-2), dataPrevistaRetirada: d(1), dataPrevistaDevolucao: d(6),
      historico: [ev('solicitado', joao, 2)],
    },
    // Aprovado de Ana (código para o balcão: K7M4PX)
    {
      id: 'p41', localUso: { localId: 'lab-informatica', detalhe: 'Oficina de desenvolvimento web' }, protocolo: 'EMP-2026-0041', solicitante: ana, responsavel: ana,
      itens: [{ equipamentoId: '3', quantidade: 2 }],
      status: 'aprovado', justificativa: 'Oficina de desenvolvimento web.',
      dataSolicitacao: d(-2), dataPrevistaRetirada: d(0), dataPrevistaDevolucao: d(5),
      responsavelAprovacao: admin, codigoRetirada: 'K7M4PX',
      historico: [ev('solicitado', ana, 2), ev('aprovado', admin, 2, undefined, 3)],
    },
    // Em andamento com Carlos, com transferência PENDENTE para o professor (ele aceita ou recusa)
    {
      id: 'p40', localUso: { localId: 'lab-eletronica', detalhe: 'Projeto de eletrônica analógica' }, termoAceito: true, protocolo: 'EMP-2026-0040', solicitante: carlos, responsavel: carlos,
      itens: [{ equipamentoId: '5', quantidade: 1 }],
      status: 'em_andamento', justificativa: 'Medições do projeto de eletrônica analógica.',
      dataSolicitacao: d(-3), dataPrevistaRetirada: d(-2), dataPrevistaDevolucao: d(4),
      dataRetiradaEfetiva: d(-2), responsavelAprovacao: admin, codigoDevolucao: 'C3D6FG',
      transferenciaPendente: {
        de: carlos, para: prof, solicitadaEm: horasDepoisISO(-2),
        motivo: 'Vou viajar para o curso de capacitação e o Pedro dará continuidade ao projeto.',
      },
      historico: [
        ev('solicitado', carlos, 3), ev('aprovado', admin, 3, undefined, 2), ev('retirado', admin, 2, 'Entregue a Carlos Souza · código conferido · local de uso: Lab. de Eletrônica · termo de responsabilidade aceito'),
        {
          id: crypto.randomUUID(), tipo: 'transferencia_solicitada', em: horasDepoisISO(-2), por: carlos,
          detalhe: 'Para Pedro Almeida: Vou viajar para o curso de capacitação e o Pedro dará continuidade ao projeto.',
        },
      ],
    },
    // Em andamento com o professor: Impressora 3D (exige treinamento) -> bom para testar a transferência
    {
      id: 'p39', localUso: { localId: 'lab-maker', detalhe: 'Peças do projeto integrador' }, termoAceito: true, protocolo: 'EMP-2026-0039', solicitante: prof, responsavel: prof,
      itens: [{ equipamentoId: '8', quantidade: 1 }],
      status: 'em_andamento', justificativa: 'Impressão das peças do projeto integrador.',
      dataSolicitacao: d(-3), dataPrevistaRetirada: d(-2), dataPrevistaDevolucao: d(3),
      dataRetiradaEfetiva: d(-2), responsavelAprovacao: admin, codigoDevolucao: 'W5X8YZ',
      historico: [ev('solicitado', prof, 3), ev('aprovado', admin, 3, undefined, 2), ev('retirado', admin, 2, 'Entregue a Pedro Almeida · código conferido · local de uso: Lab. Maker · termo de responsabilidade aceito')],
    },
    // Em andamento com o professor: Projetor -> transferir para qualquer professor
    {
      id: 'p38', localUso: { localId: 'sala-103', detalhe: '3º módulo · apresentação de trabalhos' }, termoAceito: true, protocolo: 'EMP-2026-0038', solicitante: prof, responsavel: prof,
      itens: [{ equipamentoId: '2', quantidade: 1 }],
      status: 'em_andamento', justificativa: 'Aulas de apresentação de trabalhos do 3º módulo.',
      dataSolicitacao: d(-3), dataPrevistaRetirada: d(-1), dataPrevistaDevolucao: d(2),
      dataRetiradaEfetiva: d(-1), responsavelAprovacao: admin, codigoDevolucao: 'P4R7ST',
      historico: [ev('solicitado', prof, 3), ev('aprovado', admin, 3, undefined, 2), ev('retirado', admin, 1, 'Entregue a Pedro Almeida · código conferido · local de uso: Sala 103 · termo de responsabilidade aceito')],
    },
    // ATRASADO (Maria, Caixa de som): não pode ser transferido
    {
      id: 'p37', localUso: { localId: 'quadra', detalhe: 'Evento de integração dos alunos' }, termoAceito: true, protocolo: 'EMP-2026-0037', solicitante: maria, responsavel: maria,
      itens: [{ equipamentoId: '4', quantidade: 1 }],
      status: 'em_andamento', justificativa: 'Som para o evento de integração dos alunos.',
      dataSolicitacao: d(-8), dataPrevistaRetirada: d(-6), dataPrevistaDevolucao: d(-3),
      dataRetiradaEfetiva: d(-6), responsavelAprovacao: admin, codigoDevolucao: 'M2N9QD',
      historico: [ev('solicitado', maria, 8), ev('aprovado', admin, 8, undefined, 2), ev('retirado', admin, 6, 'Entregue a Maria Santos · código conferido · local de uso: Quadra · termo de responsabilidade aceito')],
    },
    // Devolvido com cadeia de responsáveis: João -> Maria (exemplo completo da linha do tempo)
    {
      id: 'p36', localUso: { localId: 'sala-104', detalhe: 'Edição de documentos' }, termoAceito: true, protocolo: 'EMP-2026-0036', solicitante: joao, responsavel: maria,
      itens: [{ equipamentoId: '1', quantidade: 1 }],
      status: 'devolvido', justificativa: 'Atividade de edição de documentos com a turma.',
      dataSolicitacao: d(-14), dataPrevistaRetirada: d(-12), dataPrevistaDevolucao: d(-5),
      dataRetiradaEfetiva: d(-12), dataDevolucaoEfetiva: d(-5), responsavelAprovacao: admin,
      observacoesDevolucao: 'Tudo em ordem, com carregador.',
      historico: [
        ev('solicitado', joao, 14), ev('aprovado', admin, 13), ev('retirado', admin, 12, 'Entregue a João Silva · código conferido'),
        ev('transferencia_solicitada', joao, 9, 'Para Maria Santos: Fui realocado para outra turma e a Maria continua a atividade.'),
        ev('transferencia_aceita', maria, 9, 'Recebido de João Silva. O prazo de devolução continua o mesmo.', 2),
        ev('devolvido', admin, 5, 'Tudo em ordem, com carregador.'),
      ],
    },
    // Devolvido do professor
    {
      id: 'p35', localUso: { localId: 'auditorio', detalhe: 'Feira de ciências' }, termoAceito: true, protocolo: 'EMP-2026-0035', solicitante: prof, responsavel: prof,
      itens: [{ equipamentoId: '4', quantidade: 1 }],
      status: 'devolvido', justificativa: 'Som para a apresentação da feira de ciências.',
      dataSolicitacao: d(-25), dataPrevistaRetirada: d(-23), dataPrevistaDevolucao: d(-21),
      dataRetiradaEfetiva: d(-23), dataDevolucaoEfetiva: d(-21), responsavelAprovacao: admin,
      ocorrenciaIds: ['oc2'],
      observacoesDevolucao: 'Risco leve na lateral.',
      historico: [
        ev('solicitado', prof, 25), ev('aprovado', admin, 24), ev('retirado', admin, 23, 'Entregue a Pedro Almeida · código conferido'),
        ev('avaria_registrada', admin, 21, 'Caixa de som Bluetooth × 1 · Desgaste ou sujeira · gravidade leve: Risco leve na lateral. Funciona normalmente. · voltou ao estoque · OC-2026-0002'),
        ev('devolvido', admin, 21, 'Devolvido COM AVARIA · Risco leve na lateral. · código conferido'),
      ],
    },
    // EXPIRADO: João não retirou no prazo; o sistema cancelou e devolveu a reserva ao estoque
    {
      id: 'p33', localUso: { localId: 'lab-eletronica', detalhe: 'Aula de instrumentação' }, protocolo: 'EMP-2026-0033', solicitante: joao, responsavel: joao,
      itens: [{ equipamentoId: '10', quantidade: 1 }],
      status: 'cancelado', justificativa: 'Aula de instrumentação com o osciloscópio.',
      dataSolicitacao: d(-12), dataPrevistaRetirada: d(-10), dataPrevistaDevolucao: d(-7),
      responsavelAprovacao: admin,
      motivoCancelamento: `Expirou: não foi retirado até ${formatarData(d(-9))}. A reserva voltou ao estoque.`,
      historico: [
        ev('solicitado', joao, 12), ev('aprovado', admin, 11),
        ev('expirado', SISTEMA, 8, `Não foi retirado até ${formatarData(d(-9))}. A reserva voltou ao estoque.`),
      ],
    },
    // Reprovado do professor
    {
      id: 'p34', localUso: { localId: 'lab-maker', detalhe: 'Montagem de bancadas' }, protocolo: 'EMP-2026-0034', solicitante: prof, responsavel: prof,
      itens: [{ equipamentoId: '7', quantidade: 1 }],
      status: 'rejeitado', justificativa: 'Montagem de bancadas para o projeto integrador.',
      dataSolicitacao: d(-26), dataPrevistaRetirada: d(-24), dataPrevistaDevolucao: d(-19),
      responsavelAprovacao: admin, motivoRejeicao: 'Equipamento em manutenção no período solicitado.',
      historico: [ev('solicitado', prof, 26), ev('rejeitado', admin, 25, 'Equipamento em manutenção no período solicitado.')],
    },
  ];
}

function criarAvisosDemo(): AvisoAdmin[] {
  return [
    {
      id: 'av1', em: horasDepoisISO(-2), pedidoId: 'p40', lido: false,
      texto: 'Carlos Souza pediu para transferir o pedido EMP-2026-0040 a Pedro Almeida.',
    },
    {
      id: 'av2', em: horasDepoisISO(-5), pedidoId: 'p45', lido: false,
      texto: 'Nova solicitação EMP-2026-0045 de Carlos Souza.',
    },
    {
      id: 'av3', em: horasDepoisISO(-9 * 24 + 2), pedidoId: 'p36', lido: true,
      texto: 'Maria Santos aceitou a transferência do pedido EMP-2026-0036 (de João Silva). Prazo mantido.',
    },
  ];
}

@Injectable({ providedIn: 'root' })
export class EmprestimoService {
  private readonly equipamentos = inject(EquipamentoService);
  private readonly usuarios = inject(UsuarioService);
  private readonly auth = inject(AuthService);
  private readonly manutencoes = inject(ManutencaoService);
  private readonly regras = inject(RegrasEmprestimoService);
  private readonly codigos = inject(CodigosService);

  readonly todas = signal<Emprestimo[]>(
    lerJson<Emprestimo[]>(CHAVE_EMPRESTIMOS) ?? criarEmprestimosDemo(),
  );

  /** Avisos para a coordenação (novas solicitações, transferências...). Os mais novos primeiro. */
  readonly avisos = signal<AvisoAdmin[]>(lerJson<AvisoAdmin[]>(CHAVE_AVISOS) ?? criarAvisosDemo());

  readonly pendentes = computed(() => this.todas().filter((s) => s.status === 'pendente'));

  readonly ativos = computed(() =>
    this.todas().filter((s) => s.status === 'aprovado' || s.status === 'em_andamento'),
  );

  readonly emAndamento = computed(() => this.todas().filter((s) => s.status === 'em_andamento'));

  readonly avisosNaoLidos = computed(() => this.avisos().filter((a) => !a.lido).length);

  constructor() {
    // Grava a cada mudança: a demonstração continua de onde parou depois de recarregar a página.
    effect(() => gravarJson(CHAVE_EMPRESTIMOS, this.todas()));
    effect(() => gravarJson(CHAVE_AVISOS, this.avisos()));
    // Duas abas abertas (professor e coordenação): uma vê na hora o que a outra fez.
    ouvirOutrasAbas<Emprestimo[]>(CHAVE_EMPRESTIMOS, (v) => v && this.todas.set(v));
    ouvirOutrasAbas<AvisoAdmin[]>(CHAVE_AVISOS, (v) => v && this.avisos.set(v));
    this.codigos.registrar(() => this.todas().flatMap((s) => [s.codigoRetirada, s.codigoDevolucao]));

    // Pedido aprovado e não retirado no prazo expira: ao abrir e a cada minuto (só no navegador).
    if (typeof window !== 'undefined') {
      this.expirarNaoRetirados();
      setInterval(() => this.expirarNaoRetirados(), 60_000);
    }
  }

  // ===========================================================================================
  // Consultas
  // ===========================================================================================

  buscarPorId(id: string): Emprestimo | undefined {
    return this.todas().find((s) => s.id === id);
  }

  /** Ex.: "Notebook Dell Inspiron 15 × 2, Projetor Epson PowerLite × 1" */
  resumoItens(s: Emprestimo): string {
    return s.itens
      .map(
        (i) =>
          `${this.equipamentos.buscarPorId(i.equipamentoId)?.nome ?? 'Item removido'} × ${i.quantidade}`,
      )
      .join(', ');
  }

  totalUnidades(s: Emprestimo): number {
    return s.itens.reduce((soma, i) => soma + i.quantidade, 0);
  }

  /** Aprovado/em andamento com a data de devolução já vencida. */
  estaAtrasado(s: Emprestimo): boolean {
    return (
      (s.status === 'aprovado' || s.status === 'em_andamento') &&
      s.dataPrevistaDevolucao < hojeISO()
    );
  }

  /** Dias até a devolução prevista (negativo = já passou). */
  diasRestantes(s: Emprestimo): number {
    return diferencaEmDias(hojeISO(), s.dataPrevistaDevolucao);
  }

  /** Pedidos em que a pessoa é a solicitante original OU a responsável atual. */
  meusPedidos(usuarioId: string): Emprestimo[] {
    return this.todas().filter((s) => s.solicitante.id === usuarioId || s.responsavel.id === usuarioId);
  }

  /** Transferências que outra pessoa quer fazer para esta e que aguardam resposta. */
  transferenciasRecebidas(usuarioId: string): Emprestimo[] {
    return this.todas().filter((s) => s.transferenciaPendente?.para.id === usuarioId);
  }

  /** Quem já foi responsável pelo pedido, em ordem: o solicitante e cada pessoa que aceitou uma transferência. */
  cadeiaResponsaveis(s: Emprestimo): UsuarioResumo[] {
    const cadeia: UsuarioResumo[] = [s.solicitante];
    for (const e of s.historico) {
      if (e.tipo === 'transferencia_aceita') cadeia.push(e.por);
    }
    return cadeia;
  }

  // ===========================================================================================
  // Prazo máximo por material
  // ===========================================================================================

  /** Menor prazo máximo (em dias) entre os itens do pedido. Item desconhecido não limita. */
  prazoMaximoDoPedido(itens: { equipamentoId: string }[]): number {
    const prazos = itens
      .map((i) => this.equipamentos.buscarPorId(i.equipamentoId)?.prazoMaximoDias)
      .filter((p): p is number => typeof p === 'number');
    return prazos.length > 0 ? Math.min(...prazos) : Number.MAX_SAFE_INTEGER;
  }

  /** Última data de devolução permitida para um material retirado em `retirada`. */
  dataLimiteDevolucao(retirada: string, equipamentoId: string): string | null {
    const prazo = this.equipamentos.buscarPorId(equipamentoId)?.prazoMaximoDias;
    return prazo && /^\d{4}-\d{2}-\d{2}/.test(retirada) ? somarDias(retirada, prazo) : null;
  }

  // ===========================================================================================
  // Regras de empréstimo (prazo para retirar, limite por categoria e política de atraso)
  // ===========================================================================================

  /** Último dia para retirar um pedido aprovado (depois disso ele expira). */
  prazoRetirada(s: Emprestimo): string {
    return this.regras.prazoRetirada(s.dataPrevistaRetirada);
  }

  /**
   * Por que esta pessoa não pode fazer pedidos novos agora (suspensão ou material atrasado,
   * conforme a política de atraso), ou null se pode.
   */
  impedimentoParaPedir(usuarioId: string): string | null {
    const suspensao = this.usuarios.suspensao(usuarioId);
    if (suspensao) {
      return `Você está suspenso(a) até ${formatarData(suspensao.ate)} (${suspensao.motivo}). Pedidos novos ficam bloqueados até lá; se houver engano, fale com a coordenação.`;
    }
    if (this.regras.atrasoBloqueia()) {
      const atrasado = this.todas().find((s) => s.responsavel.id === usuarioId && this.estaAtrasado(s));
      if (atrasado) {
        return `Devolva o ${atrasado.protocolo} (${this.resumoItens(atrasado)}), que está atrasado, antes de fazer um pedido novo.`;
      }
    }
    return null;
  }

  /** Unidades em pedidos abertos (pendente, aprovado ou em andamento) por categoria, de quem responde por elas. */
  unidadesAbertasPorCategoria(usuarioId: string, ignorarPedidoId?: string): Map<string, number> {
    const mapa = new Map<string, number>();
    for (const s of this.todas()) {
      if (s.id === ignorarPedidoId || s.responsavel.id !== usuarioId || !STATUS_ABERTOS.includes(s.status)) continue;
      for (const i of s.itens) {
        const cat = this.equipamentos.buscarPorId(i.equipamentoId)?.categoria;
        if (cat) mapa.set(cat, (mapa.get(cat) ?? 0) + i.quantidade);
      }
    }
    return mapa;
  }

  /** Confere o limite por categoria somando os pedidos abertos da pessoa com os itens novos. */
  excessoDeLimite(usuarioId: string, itens: { equipamentoId: string; quantidade: number }[], ignorarPedidoId?: string): string | null {
    const abertos = this.unidadesAbertasPorCategoria(usuarioId, ignorarPedidoId);
    const novos = new Map<string, number>();
    for (const i of itens) {
      const cat = this.equipamentos.buscarPorId(i.equipamentoId)?.categoria;
      if (cat) novos.set(cat, (novos.get(cat) ?? 0) + i.quantidade);
    }
    for (const [cat, qtd] of novos) {
      const limite = this.regras.limite(cat as never);
      if (limite === null) continue;
      const ja = abertos.get(cat) ?? 0;
      if (ja + qtd > limite) {
        const unid = (n: number) => (n === 1 ? '1 unidade' : `${n} unidades`);
        return ja > 0
          ? `O limite de ${nomeCategoria(cat as never)} é de ${unid(limite)} por pessoa ao mesmo tempo, e você já tem ${unid(ja)} em pedidos abertos. Escolha no máximo ${unid(Math.max(0, limite - ja))}.`
          : `O limite de ${nomeCategoria(cat as never)} é de ${unid(limite)} por pessoa ao mesmo tempo.`;
      }
    }
    return null;
  }

  /**
   * Expira os pedidos aprovados que passaram do prazo para retirar: a reserva volta ao estoque
   * e o pedido fica cancelado, com o motivo e o evento na linha do tempo. Devolve quantos expiraram.
   */
  expirarNaoRetirados(): number {
    const hoje = hojeISO();
    const vencidos = this.todas().filter((s) => s.status === 'aprovado' && this.prazoRetirada(s) < hoje);
    for (const s of vencidos) this.expirar(s);
    return vencidos.length;
  }

  private expirar(s: Emprestimo): void {
    const prazo = formatarData(this.prazoRetirada(s));
    const texto = `Não foi retirado até ${prazo}. A reserva voltou ao estoque.`;
    s.itens.forEach((i) => this.equipamentos.liberar(i.equipamentoId, i.quantidade));
    this.atualizarPedido(s.id, (p) => ({
      ...p,
      status: 'cancelado',
      codigoRetirada: undefined,
      motivoCancelamento: `Expirou: ${texto.charAt(0).toLowerCase()}${texto.slice(1)}`,
      historico: [...p.historico, this.evento('expirado', SISTEMA, texto)],
    }));
    this.avisar(`${s.protocolo} de ${s.responsavel.nome} expirou: não foi retirado até ${prazo}.`, s.id);
  }

  // ===========================================================================================
  // Solicitar, avaliar e cancelar
  // ===========================================================================================

  /** Confere as regras de um pedido novo. Devolve a mensagem do 1º problema, ou null se está tudo certo. */
  validarSolicitacao(dto: SolicitarEmprestimoDTO, usuarioId: string): string | null {
    const impedimento = this.impedimentoParaPedir(usuarioId);
    if (impedimento) return impedimento;
    if (dto.itens.length === 0) return 'Escolha ao menos um material.';

    for (const item of dto.itens) {
      const eq = this.equipamentos.buscarPorId(item.equipamentoId);
      if (!eq || eq.status !== 'disponivel') return 'Este material não está mais disponível.';
      if (item.quantidade < 1) return 'A quantidade deve ser no mínimo 1.';
      if (item.quantidade > eq.quantidadeDisponivel) {
        return `Só há ${eq.quantidadeDisponivel} unidade(s) disponível(is).`;
      }
      if (eq.requerTreinamento && !this.usuarios.habilitado(usuarioId, eq.id)) {
        return `Você ainda não tem habilitação para "${eq.nome}". Procure a coordenação para fazer o treinamento.`;
      }
    }

    if (dto.localUso && !buscarLocal(dto.localUso.localId)) return 'Escolha onde o material será usado.';
    if (dto.dataPrevistaRetirada < hojeISO()) return 'A data de retirada não pode ser anterior a hoje.';
    if (dto.dataPrevistaDevolucao < dto.dataPrevistaRetirada) {
      return 'A devolução deve ser na mesma data da retirada ou depois dela.';
    }

    const prazo = this.prazoMaximoDoPedido(dto.itens);
    const dias = diferencaEmDias(dto.dataPrevistaRetirada, dto.dataPrevistaDevolucao);
    if (dias > prazo) {
      const limite = formatarData(somarDias(dto.dataPrevistaRetirada, prazo));
      return `O prazo máximo deste material é de ${prazo} dia(s). Escolha a devolução até ${limite}.`;
    }
    return this.excessoDeLimite(usuarioId, dto.itens);
  }

  /** Cria uma nova solicitação pendente. */
  solicitar(dto: SolicitarEmprestimoDTO, solicitante: UsuarioResumo): Resultado<Emprestimo> {
    const erro = this.validarSolicitacao(dto, solicitante.id);
    if (erro) return falha(erro);

    const dono = this.usuarios.resumo(solicitante.id) ?? solicitante;
    const novo: Emprestimo = {
      id: crypto.randomUUID(),
      protocolo: this.proximoProtocolo(),
      solicitante: dono,
      responsavel: dono,
      itens: dto.itens.map((i): ItemEmprestimo => ({
        equipamentoId: i.equipamentoId,
        quantidade: i.quantidade,
        observacoes: i.observacoes,
      })),
      status: 'pendente',
      justificativa: dto.justificativa,
      dataSolicitacao: hojeISO(),
      dataPrevistaRetirada: dto.dataPrevistaRetirada,
      dataPrevistaDevolucao: dto.dataPrevistaDevolucao,
      localUso: dto.localUso ? { localId: dto.localUso.localId, detalhe: dto.localUso.detalhe?.trim() || undefined } : undefined,
      historico: [
        this.evento('solicitado', dono, dto.localUso ? `Uso previsto: ${descreverLocalUso(dto.localUso)}` : undefined),
      ],
    };
    this.todas.update((lista) => [novo, ...lista]);
    this.avisar(`Nova solicitação ${novo.protocolo} de ${dono.nome}.`, novo.id);
    return sucesso(novo);
  }

  /**
   * Aprova ou reprova. Ao aprovar, reserva o estoque e gera o código de retirada.
   * Devolve uma mensagem de erro, ou null se deu certo.
   */
  avaliar(id: string, aprovado: boolean, texto: string): string | null {
    const alvo = this.buscarPorId(id);
    if (!alvo || alvo.status !== 'pendente') {
      return 'Esta solicitação não está mais pendente.';
    }
    const admin = this.ator();
    const observacao = texto.trim() || undefined;

    if (aprovado) {
      const suspensao = this.usuarios.suspensao(alvo.responsavel.id);
      if (suspensao) {
        return `${alvo.responsavel.nome} está suspenso(a) até ${formatarData(suspensao.ate)} (${suspensao.motivo}). Reprove o pedido ou encerre a suspensão em Usuários.`;
      }
      for (const item of alvo.itens) {
        const eq = this.equipamentos.buscarPorId(item.equipamentoId);
        if (!eq || eq.status !== 'disponivel' || eq.quantidadeDisponivel < item.quantidade) {
          return `Estoque insuficiente para "${eq?.nome ?? 'um dos itens'}".`;
        }
      }
      alvo.itens.forEach((i) => this.equipamentos.reservar(i.equipamentoId, i.quantidade));
    }

    this.atualizarPedido(id, (s) => ({
      ...s,
      status: aprovado ? 'aprovado' : 'rejeitado',
      motivoRejeicao: aprovado ? undefined : texto.trim(),
      responsavelAprovacao: admin,
      codigoRetirada: aprovado ? this.novoCodigo() : undefined,
      historico: [...s.historico, this.evento(aprovado ? 'aprovado' : 'rejeitado', admin, observacao)],
    }));
    return null;
  }

  /**
   * Cancela um pedido que ainda não foi retirado (pendente ou aprovado). Aprovado devolve o estoque.
   * O motivo é obrigatório: fica no pedido e na linha do tempo, para a auditoria.
   */
  cancelar(id: string, motivo: string): string | null {
    const alvo = this.buscarPorId(id);
    if (!alvo) return 'Pedido não encontrado.';
    const justificativa = (motivo ?? '').trim();
    if (justificativa.length < MINIMO_MOTIVO_CANCELAMENTO) {
      return `Explique o motivo do cancelamento (mínimo de ${MINIMO_MOTIVO_CANCELAMENTO} caracteres).`;
    }
    if (alvo.status !== 'pendente' && alvo.status !== 'aprovado') {
      return 'Este pedido não pode mais ser cancelado.';
    }
    const eu = this.ator();
    const podeCancelar =
      eu.perfil === 'admin' || alvo.solicitante.id === eu.id || alvo.responsavel.id === eu.id;
    if (!podeCancelar) return 'Você não pode cancelar este pedido.';

    if (alvo.status === 'aprovado') {
      alvo.itens.forEach((i) => this.equipamentos.liberar(i.equipamentoId, i.quantidade));
    }
    this.atualizarPedido(id, (s) => ({
      ...s,
      status: 'cancelado',
      codigoRetirada: undefined,
      motivoCancelamento: justificativa,
      historico: [...s.historico, this.evento('cancelado', eu, `Motivo: ${justificativa}`)],
    }));
    this.avisar(`${eu.nome} cancelou o pedido ${alvo.protocolo}. Motivo: ${justificativa}`, id);
    return null;
  }

  // ===========================================================================================
  // Balcão: retirada e devolução (sempre com o código)
  // ===========================================================================================

  /** Pedido aprovado que tem este código de retirada (sem alterar nada). Aceita texto digitado ou conteúdo do QR. */
  buscarPorCodigoRetirada(codigoDigitado: string): Emprestimo | undefined {
    const codigo = normalizarCodigo(codigoDigitado);
    return codigo ? this.todas().find((s) => s.status === 'aprovado' && s.codigoRetirada === codigo) : undefined;
  }

  /** Pedido em andamento que tem este código de devolução (sem alterar nada). */
  buscarPorCodigoDevolucao(codigoDigitado: string): Emprestimo | undefined {
    const codigo = normalizarCodigo(codigoDigitado);
    return codigo
      ? this.todas().find((s) => s.status === 'em_andamento' && s.codigoDevolucao === codigo)
      : undefined;
  }

  /** Mensagem para quando o código digitado não é de nenhum pedido, com dica se for o código do outro tipo. */
  erroCodigo(codigoDigitado: string, tipo: 'retirada' | 'devolucao'): string {
    const codigo = normalizarCodigo(codigoDigitado);
    if (!codigo) return `Digite ou escaneie o código de ${tipo === 'retirada' ? 'retirada' : 'devolução'}.`;
    if (tipo === 'retirada' && this.todas().some((s) => s.codigoDevolucao === codigo)) {
      return 'Este é um código de DEVOLUÇÃO. Use a aba Devolução.';
    }
    if (tipo === 'devolucao' && this.todas().some((s) => s.codigoRetirada === codigo)) {
      return 'Este é um código de RETIRADA. Use a aba Retirada.';
    }
    return tipo === 'retirada'
      ? 'Código não encontrado. Confira se o pedido foi aprovado e se o código é o de retirada.'
      : 'Código não encontrado. Confira se o material foi retirado e se o código é o de devolução.';
  }

  /** Retirada pelo código (digitado, ditado ou lido do QR). */
  confirmarRetirada(codigoDigitado: string, opcoes?: OpcoesRetirada): Resultado<Emprestimo> {
    const codigo = normalizarCodigo(codigoDigitado);
    if (!codigo) return falha('Digite ou escaneie o código de retirada.');
    const alvo = this.todas().find((s) => s.status === 'aprovado' && s.codigoRetirada === codigo);
    if (!alvo) {
      const ehDevolucao = this.todas().some((s) => s.codigoDevolucao === codigo);
      return falha(
        ehDevolucao
          ? 'Este é um código de DEVOLUÇÃO. Use a aba Devolução.'
          : 'Código não encontrado. Confira se o pedido foi aprovado e se o código é o de retirada.',
      );
    }
    return this.registrarRetirada(alvo.id, opcoes);
  }

  /** Registra a saída do material. Privado de propósito: só se chega aqui depois de conferir o código. */
  private registrarRetirada(id: string, opcoes?: OpcoesRetirada): Resultado<Emprestimo> {
    const alvo = this.buscarPorId(id);
    if (!alvo || alvo.status !== 'aprovado') return falha('Este pedido não está aguardando retirada.');
    if (this.prazoRetirada(alvo) < hojeISO()) {
      this.expirar(alvo);
      return falha(`Este pedido expirou: o prazo para retirar era ${formatarData(this.prazoRetirada(alvo))}. A reserva voltou ao estoque; peça de novo.`);
    }
    if (alvo.dataPrevistaDevolucao < hojeISO()) {
      return falha('O prazo de devolução deste pedido já passou. Cancele o pedido e peça um novo.');
    }
    if (opcoes && opcoes.termoAceito !== true) {
      return falha('O responsável precisa aceitar o termo de responsabilidade antes da entrega.');
    }
    const local = opcoes?.localUso ?? alvo.localUso;
    if (local && !buscarLocal(local.localId)) return falha('Escolha um local de uso válido.');
    const admin = this.ator();
    const mudouLocal = !!alvo.localUso && !!local && alvo.localUso.localId !== local.localId;
    const detalhe = [
      `Entregue a ${alvo.responsavel.nome}`,
      'código conferido',
      local ? `local de uso: ${descreverLocalUso(local)}` : '',
      mudouLocal ? `(no pedido: ${nomeLocal(alvo.localUso!.localId)})` : '',
      opcoes?.termoAceito ? 'termo de responsabilidade aceito' : '',
    ].filter(Boolean).join(' · ');
    const atualizado: Emprestimo = {
      ...alvo,
      localUso: local ? { localId: local.localId, detalhe: local.detalhe?.trim() || undefined } : undefined,
      termoAceito: opcoes?.termoAceito ?? alvo.termoAceito,
      status: 'em_andamento',
      dataRetiradaEfetiva: hojeISO(),
      codigoRetirada: undefined,
      codigoDevolucao: this.novoCodigo(),
      historico: [...alvo.historico, this.evento('retirado', admin, detalhe)],
    };
    this.substituir(atualizado);
    return sucesso(atualizado);
  }

  /** Devolução pelo código. */
  confirmarDevolucao(codigoDigitado: string, opcoes: OpcoesDevolucao): Resultado<Emprestimo> {
    const codigo = normalizarCodigo(codigoDigitado);
    if (!codigo) return falha('Digite ou escaneie o código de devolução.');
    const alvo = this.todas().find((s) => s.status === 'em_andamento' && s.codigoDevolucao === codigo);
    if (!alvo) {
      const ehRetirada = this.todas().some((s) => s.codigoRetirada === codigo);
      return falha(
        ehRetirada
          ? 'Este é um código de RETIRADA. Use a aba Retirada.'
          : 'Código não encontrado. Confira se o material foi retirado e se o código é o de devolução.',
      );
    }
    return this.registrarDevolucao(alvo.id, opcoes);
  }

  /**
   * Confere as avarias e faltas informadas na devolução. Devolve a mensagem do 1º problema, ou null.
   * Regras: o item precisa ser do pedido, a soma (faltando + avariadas) não passa do que foi
   * emprestado e cada avaria tem tipo, gravidade e descrição.
   */
  validarDevolucao(s: Emprestimo, opcoes: OpcoesDevolucao): string | null {
    for (const oc of opcoes.ocorrencias ?? []) {
      const item = s.itens.find((i) => i.equipamentoId === oc.equipamentoId);
      const nome = this.equipamentos.buscarPorId(oc.equipamentoId)?.nome ?? 'item';
      if (!item) return `"${nome}" não faz parte deste pedido.`;
      if (oc.faltando < 0 || oc.avariadas < 0) return `Quantidade inválida em "${nome}".`;
      if (oc.faltando + oc.avariadas > item.quantidade) {
        return `"${nome}": foram emprestadas ${item.quantidade} unidade(s); avariadas + faltando não pode passar disso.`;
      }
      if (oc.avariadas > 0) {
        const erro = this.manutencoes.validar(
          { tipo: 'avaria', quantidade: oc.avariadas, tipoAvaria: oc.tipoAvaria, gravidade: oc.gravidade, descricao: oc.descricao ?? '' },
          nome,
        );
        if (erro) return erro;
      }
    }
    return null;
  }

  /** O que vai acontecer com cada unidade nesta devolução (para mostrar antes de confirmar). */
  resumoDevolucao(s: Emprestimo, opcoes: OpcoesDevolucao): ResumoDevolucao {
    let emManutencao = 0;
    let faltando = 0;
    for (const oc of opcoes.ocorrencias ?? []) {
      faltando += oc.faltando;
      if (oc.avariadas > 0 && this.manutencoes.bloqueia('avaria', oc.gravidade)) emManutencao += oc.avariadas;
    }
    return { aoEstoque: this.totalUnidades(s) - emManutencao - faltando, emManutencao, faltando };
  }

  /** Registra a volta do material e devolve as unidades ao estoque. Privado: só depois de conferir o código. */
  private registrarDevolucao(id: string, opcoes: OpcoesDevolucao): Resultado<Emprestimo> {
    const alvo = this.buscarPorId(id);
    if (!alvo || alvo.status !== 'em_andamento') return falha('Este pedido não está em andamento.');
    const erro = this.validarDevolucao(alvo, opcoes);
    if (erro) return falha(erro);

    const admin = this.ator();
    const ocorrencias = (opcoes.ocorrencias ?? []).filter((o) => o.faltando > 0 || o.avariadas > 0);
    const historico = [...alvo.historico];
    if (alvo.transferenciaPendente) {
      historico.push(this.evento('transferencia_cancelada', admin, 'Cancelada automaticamente: o material foi devolvido.'));
    }

    // 1) Avarias e faltas viram ocorrências (com quem estava com o item) e eventos na linha do tempo.
    const ocorrenciaIds: string[] = [];
    const pedido = { id: alvo.id, protocolo: alvo.protocolo, responsavel: alvo.responsavel };
    const foraDoEstoque = new Map<string, number>();
    for (const oc of ocorrencias) {
      const nome = this.equipamentos.buscarPorId(oc.equipamentoId)?.nome ?? 'Item';
      if (oc.avariadas > 0) {
        const m = this.manutencoes.registrar({
          tipo: 'avaria', equipamentoId: oc.equipamentoId, quantidade: oc.avariadas, tipoAvaria: oc.tipoAvaria,
          gravidade: oc.gravidade, descricao: oc.descricao ?? '', foto: oc.foto, pedido, origem: 'emprestimo',
        });
        ocorrenciaIds.push(m.id);
        if (m.bloqueia) foraDoEstoque.set(oc.equipamentoId, (foraDoEstoque.get(oc.equipamentoId) ?? 0) + oc.avariadas);
        historico.push(this.evento('avaria_registrada', admin, [
          `${nome} × ${oc.avariadas}`,
          NOME_TIPO_AVARIA[oc.tipoAvaria!],
          `gravidade ${NOME_GRAVIDADE[oc.gravidade!].toLowerCase()}: ${oc.descricao?.trim()}`,
          m.bloqueia ? 'unidade bloqueada para manutenção' : 'voltou ao estoque',
          oc.foto ? 'com foto' : '',
          m.protocolo,
        ].filter(Boolean).join(' · ')));
      }
      if (oc.faltando > 0) {
        const m = this.manutencoes.registrar({
          tipo: 'extravio', equipamentoId: oc.equipamentoId, quantidade: oc.faltando,
          descricao: oc.avariadas > 0 ? '' : (oc.descricao ?? ''), pedido, origem: 'emprestimo',
        });
        ocorrenciaIds.push(m.id);
        foraDoEstoque.set(oc.equipamentoId, (foraDoEstoque.get(oc.equipamentoId) ?? 0) + oc.faltando);
        historico.push(this.evento('falta_registrada', admin,
          `${nome} × ${oc.faltando} não voltou · responsável: ${alvo.responsavel.nome} · ${m.protocolo}`));
      }
    }

    // 2) Evento da devolução (sempre o último).
    const diasAtraso = Math.max(0, diferencaEmDias(alvo.dataPrevistaDevolucao, hojeISO()));
    const temAvaria = opcoes.houveAvaria || ocorrencias.some((o) => o.avariadas > 0);
    const temFalta = ocorrencias.some((o) => o.faltando > 0);
    const situacao =
      temAvaria && temFalta ? 'Devolvido COM AVARIA E FALTA'
        : temAvaria ? 'Devolvido COM AVARIA'
          : temFalta ? 'Devolvido COM FALTA'
            : 'Devolvido em ordem';
    const partes = [
      situacao,
      diasAtraso > 0 ? `${diasAtraso} dia(s) de atraso` : '',
      opcoes.observacoes.trim(),
      'código conferido',
    ].filter(Boolean);
    historico.push(this.evento('devolvido', admin, partes.join(' · ')));

    // 2b) Política de atraso: suspensão automática de quem estava com o material.
    const diasSuspensao = this.regras.diasDeSuspensao(diasAtraso);
    let suspensoAte: string | undefined;
    if (diasSuspensao > 0) {
      suspensoAte = somarDias(hojeISO(), diasSuspensao - 1);
      const motivo = `${diasAtraso} dia(s) de atraso na devolução do ${alvo.protocolo}`;
      this.usuarios.suspender(alvo.responsavel.id, suspensoAte, motivo);
      historico.push(this.evento('suspensao_aplicada', SISTEMA,
        `${alvo.responsavel.nome} suspenso(a) até ${formatarData(suspensoAte)}: ${diasAtraso} dia(s) de atraso × ${this.regras.regras().fatorSuspensao} = ${diasSuspensao} dia(s) sem pedidos novos.`));
    }

    // 3) Estoque: só volta o que voltou em condições de uso.
    alvo.itens.forEach((i) =>
      this.equipamentos.liberar(i.equipamentoId, i.quantidade - (foraDoEstoque.get(i.equipamentoId) ?? 0)),
    );
    const atualizado: Emprestimo = {
      ...alvo,
      status: 'devolvido',
      dataDevolucaoEfetiva: hojeISO(),
      observacoesDevolucao: opcoes.observacoes.trim() || undefined,
      codigoDevolucao: undefined,
      transferenciaPendente: undefined,
      ocorrenciaIds: ocorrenciaIds.length ? ocorrenciaIds : undefined,
      historico,
    };
    this.substituir(atualizado);
    if (ocorrenciaIds.length) {
      this.avisar(`${alvo.protocolo} devolvido com avaria ou falta: veja Manutenção.`, alvo.id);
    }
    if (suspensoAte) {
      this.avisar(`${alvo.responsavel.nome} suspenso(a) até ${formatarData(suspensoAte)} pelo atraso no ${alvo.protocolo}.`, alvo.id);
    }
    return sucesso(atualizado);
  }

  /**
   * Acrescenta um acontecimento na linha do tempo de um pedido já fechado
   * (ex.: a unidade avariada foi consertada). A linha do tempo nunca é editada, só cresce.
   */
  anotar(pedidoId: string, tipo: TipoEventoEmprestimo, detalhe: string): void {
    this.atualizarPedido(pedidoId, (s) => ({
      ...s,
      historico: [...s.historico, this.evento(tipo, this.ator(), detalhe)],
    }));
  }

  // ===========================================================================================
  // Transferência (realocação) entre professores
  // ===========================================================================================

  /**
   * Por que este pedido NÃO pode ser transferido por esta pessoa agora (null = pode).
   * Regras: só em andamento, só o responsável atual, nada de atrasado e uma transferência por vez.
   */
  erroTransferencia(s: Emprestimo, usuarioId: string): string | null {
    if (s.status !== 'em_andamento') {
      return 'Só é possível transferir um pedido que já foi retirado e está em andamento.';
    }
    if (s.responsavel.id !== usuarioId) return 'Só o responsável atual pode transferir este pedido.';
    if (this.estaAtrasado(s)) {
      return 'Pedido com devolução atrasada não pode ser transferido. Devolva o material ao laboratório.';
    }
    if (s.transferenciaPendente) {
      return `Já existe uma transferência aguardando a resposta de ${s.transferenciaPendente.para.nome}.`;
    }
    return null;
  }

  /** Professores ativos que podem (ou não) receber o pedido, com o motivo do bloqueio quando não podem. */
  candidatosTransferencia(s: Emprestimo): CandidatoTransferencia[] {
    return this.usuarios
      .ativos()
      .filter((u) => u.perfil === 'usuario' && u.id !== s.responsavel.id)
      .map((u) => ({
        usuario: this.usuarios.resumo(u.id) as UsuarioResumo,
        bloqueio: this.bloqueioRecebedor(s, u.id),
      }));
  }

  /** O responsável pede para passar o pedido a outro professor. Devolve o erro, ou null se enviou. */
  solicitarTransferencia(id: string, paraId: string, motivo: string, localUso?: LocalUsoEmprestimo): string | null {
    const alvo = this.buscarPorId(id);
    if (!alvo) return 'Pedido não encontrado.';
    const eu = this.ator();

    const erro = this.erroTransferencia(alvo, eu.id);
    if (erro) return erro;

    const texto = motivo.trim();
    if (texto.length < 5) return 'Explique o motivo da transferência (mínimo 5 caracteres).';

    const destino = this.usuarios.buscarPorId(paraId);
    if (!destino || destino.status !== 'ativo') return 'Escolha um professor com conta ativa.';
    if (destino.perfil !== 'usuario') return 'A transferência só pode ser feita para professores.';
    if (destino.id === alvo.responsavel.id) return 'Escolha outra pessoa para receber o material.';

    const bloqueio = this.bloqueioRecebedor(alvo, destino.id);
    if (bloqueio) return bloqueio;
    if (localUso && !buscarLocal(localUso.localId)) return 'Escolha um local de uso válido.';

    const de = this.usuarios.resumo(eu.id) ?? eu;
    const novoLocal = localUso && localUso.localId !== alvo.localUso?.localId
      ? { localId: localUso.localId, detalhe: localUso.detalhe?.trim() || undefined }
      : undefined;
    const para = this.usuarios.resumo(destino.id) as UsuarioResumo;
    this.atualizarPedido(id, (s) => ({
      ...s,
      transferenciaPendente: { de, para, motivo: texto, solicitadaEm: agoraISO(), localUso: novoLocal },
      historico: [
        ...s.historico,
        this.evento(
          'transferencia_solicitada',
          de,
          `Para ${para.nome}: ${texto}${novoLocal ? ` · novo local: ${descreverLocalUso(novoLocal)}` : ''}`,
        ),
      ],
    }));
    this.avisar(`${de.nome} pediu para transferir o pedido ${alvo.protocolo} a ${para.nome}.`, id);
    return null;
  }

  /** O destinatário aceita ou recusa. Aceitar troca o responsável e MANTÉM o prazo de devolução. */
  responderTransferencia(id: string, aceitar: boolean, motivoRecusa = ''): string | null {
    const alvo = this.buscarPorId(id);
    const t = alvo?.transferenciaPendente;
    if (!alvo || !t) return 'Esta transferência não está mais pendente.';
    const eu = this.ator();
    if (t.para.id !== eu.id) return 'Esta transferência não é para você.';

    if (!aceitar) {
      this.atualizarPedido(id, (s) => ({
        ...s,
        transferenciaPendente: undefined,
        historico: [
          ...s.historico,
          this.evento('transferencia_recusada', t.para, motivoRecusa.trim() || 'Sem motivo informado.'),
        ],
      }));
      this.avisar(`${t.para.nome} recusou a transferência do pedido ${alvo.protocolo}.`, id);
      return null;
    }

    if (alvo.status !== 'em_andamento') return 'O pedido não está mais em andamento.';
    if (this.estaAtrasado(alvo)) {
      return 'O prazo de devolução venceu: o pedido não pode mais ser transferido. Recuse e peça a devolução.';
    }
    const bloqueio = this.bloqueioHabilitacao(alvo, eu.id);
    if (bloqueio) return bloqueio;

    const novo = this.usuarios.resumo(eu.id) ?? t.para;
    const prazo = formatarData(alvo.dataPrevistaDevolucao);
    const localTexto = t.localUso ? ` Agora em: ${descreverLocalUso(t.localUso)}.` : '';
    this.atualizarPedido(id, (s) => ({
      ...s,
      responsavel: novo,
      localUso: t.localUso ?? s.localUso,
      transferenciaPendente: undefined,
      // Código novo: quem passou o material adiante não deve mais conseguir "devolver" por ele.
      codigoDevolucao: this.novoCodigo(),
      historico: [
        ...s.historico,
        this.evento('transferencia_aceita', novo, `Recebido de ${t.de.nome}. O prazo de devolução continua ${prazo}.${localTexto}`),
      ],
    }));
    this.avisar(
      `${novo.nome} aceitou a transferência do pedido ${alvo.protocolo} (de ${t.de.nome}). Prazo mantido: ${prazo}.`,
      id,
    );
    return null;
  }

  /** Quem pediu a transferência (ou a coordenação) desiste antes de haver resposta. */
  cancelarTransferencia(id: string): string | null {
    const alvo = this.buscarPorId(id);
    const t = alvo?.transferenciaPendente;
    if (!alvo || !t) return 'Esta transferência não está mais pendente.';
    const eu = this.ator();
    if (eu.perfil !== 'admin' && t.de.id !== eu.id) return 'Só quem pediu a transferência pode cancelá-la.';

    this.atualizarPedido(id, (s) => ({
      ...s,
      transferenciaPendente: undefined,
      historico: [...s.historico, this.evento('transferencia_cancelada', eu, `Era para ${t.para.nome}.`)],
    }));
    return null;
  }

  // ===========================================================================================
  // Avisos e demonstração
  // ===========================================================================================

  marcarAvisosLidos(): void {
    this.avisos.update((lista) => lista.map((a) => (a.lido ? a : { ...a, lido: true })));
  }

  /** Volta os pedidos e avisos ao estado inicial da demonstração. */
  reiniciar(): void {
    this.todas.set(criarEmprestimosDemo());
    this.avisos.set(criarAvisosDemo());
  }

  // ===========================================================================================
  // Internos
  // ===========================================================================================

  private ator(): UsuarioResumo {
    return this.auth.usuarioAtual();
  }

  private evento(tipo: TipoEventoEmprestimo, por: UsuarioResumo, detalhe?: string): EventoEmprestimo {
    return { id: crypto.randomUUID(), tipo, em: agoraISO(), por, detalhe };
  }

  private avisar(texto: string, pedidoId: string): void {
    const aviso: AvisoAdmin = { id: crypto.randomUUID(), em: agoraISO(), texto, pedidoId, lido: false };
    this.avisos.update((lista) => [aviso, ...lista].slice(0, 50));
  }

  /** Quem não pode receber o pedido numa transferência: sem habilitação, suspenso ou acima do limite. */
  private bloqueioRecebedor(s: Emprestimo, usuarioId: string): string | null {
    const habilitacao = this.bloqueioHabilitacao(s, usuarioId);
    if (habilitacao) return habilitacao;
    const suspensao = this.usuarios.suspensao(usuarioId);
    if (suspensao) return `Suspenso(a) até ${formatarData(suspensao.ate)}.`;
    const limite = this.excessoDeLimite(usuarioId, s.itens);
    return limite ? limite.replace('você já tem', 'a pessoa já tem').replace(/ Escolha no máximo.*$/, '') : null;
  }

  /** Impede equipamento que exige treinamento de ir para quem não tem habilitação. */
  private bloqueioHabilitacao(s: Emprestimo, usuarioId: string): string | null {
    for (const item of s.itens) {
      const eq = this.equipamentos.buscarPorId(item.equipamentoId);
      if (eq?.requerTreinamento && !this.usuarios.habilitado(usuarioId, eq.id)) {
        return `Sem habilitação para "${eq.nome}", que exige treinamento.`;
      }
    }
    return null;
  }

  private atualizarPedido(id: string, fn: (s: Emprestimo) => Emprestimo): void {
    this.todas.update((lista) => lista.map((s) => (s.id === id ? fn(s) : s)));
  }

  private substituir(novo: Emprestimo): void {
    this.atualizarPedido(novo.id, () => novo);
  }

  /** Código novo, diferente de todos os do balcão (empréstimos e requisições de insumo). */
  private novoCodigo(): string {
    return this.codigos.novo();
  }

  private proximoProtocolo(): string {
    const maior = this.todas().reduce(
      (m, s) => Math.max(m, Number(s.protocolo.slice(-4)) || 0),
      0,
    );
    return `EMP-${new Date().getFullYear()}-${String(maior + 1).padStart(4, '0')}`;
  }
}
