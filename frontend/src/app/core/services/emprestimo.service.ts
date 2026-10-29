import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  Emprestimo,
  EventoEmprestimo,
  ItemEmprestimo,
  SolicitarEmprestimoDTO,
  StatusEmprestimo,
  TipoEventoEmprestimo,
} from '../models/emprestimo.model';
import { Resultado, falha, sucesso } from '../models/resultado.model';
import { UsuarioResumo } from '../models/usuario.model';
import { gravarJson, lerJson } from '../utils/armazenamento.utils';
import { gerarCodigo, normalizarCodigo } from '../utils/codigo.utils';
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
import { resumoDemo, UsuarioService } from './usuario.service';

export const NOME_STATUS_EMPRESTIMO: Record<StatusEmprestimo, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Reprovado',
  em_andamento: 'Em andamento',
  devolvido: 'Devolvido',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};

const CHAVE_EMPRESTIMOS = 'fab_demo_v3_emprestimos';
const CHAVE_AVISOS = 'fab_demo_v3_avisos';

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
  houveAvaria: boolean;
  observacoes: string;
}

// ---------------------------------------------------------------------------------------------
// Dados de exemplo. Todas as datas são relativas a HOJE, para a demonstração ficar coerente
// (um pedido "atrasado" continua atrasado e um "no prazo" continua no prazo, em qualquer dia).
// ---------------------------------------------------------------------------------------------
export function criarEmprestimosDemo(): Emprestimo[] {
  const hoje = hojeISO();
  const d = (n: number) => somarDias(hoje, n);
  const admin = resumoDemo('demo-admin');
  const prof = resumoDemo('demo-professor');
  const joao = resumoDemo('u1');
  const maria = resumoDemo('u2');
  const carlos = resumoDemo('u3');
  const ana = resumoDemo('u4');

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
      id: 'p45', protocolo: 'EMP-2026-0045', solicitante: carlos, responsavel: carlos,
      itens: [{ equipamentoId: '5', quantidade: 1 }, { equipamentoId: '6', quantidade: 1 }],
      status: 'pendente', justificativa: 'Manutenção da bancada de testes do laboratório.',
      dataSolicitacao: d(-1), dataPrevistaRetirada: d(3), dataPrevistaDevolucao: d(9),
      historico: [ev('solicitado', carlos, 1)],
    },
    // APROVADO do professor: mostra o código e o QR de retirada
    {
      id: 'p44', protocolo: 'EMP-2026-0044', solicitante: prof, responsavel: prof,
      itens: [{ equipamentoId: '6', quantidade: 1 }],
      status: 'aprovado', justificativa: 'Manutenção dos computadores do laboratório de informática.',
      dataSolicitacao: d(-1), dataPrevistaRetirada: d(0), dataPrevistaDevolucao: d(7),
      responsavelAprovacao: admin, codigoRetirada: 'H3Q8ZW',
      historico: [ev('solicitado', prof, 1), ev('aprovado', admin, 1, 'Pode retirar na coordenação.', 2)],
    },
    // Pendente de Maria
    {
      id: 'p43', protocolo: 'EMP-2026-0043', solicitante: maria, responsavel: maria,
      itens: [{ equipamentoId: '2', quantidade: 1 }],
      status: 'pendente', justificativa: 'Projeção de apresentação na reunião de pais e mestres.',
      dataSolicitacao: d(-1), dataPrevistaRetirada: d(2), dataPrevistaDevolucao: d(4),
      historico: [ev('solicitado', maria, 1)],
    },
    // Pendente de João
    {
      id: 'p42', protocolo: 'EMP-2026-0042', solicitante: joao, responsavel: joao,
      itens: [{ equipamentoId: '1', quantidade: 2 }],
      status: 'pendente', justificativa: 'Aula prática de lógica de programação com a turma do 2º módulo.',
      dataSolicitacao: d(-2), dataPrevistaRetirada: d(1), dataPrevistaDevolucao: d(6),
      historico: [ev('solicitado', joao, 2)],
    },
    // Aprovado de Ana (código para o balcão: K7M4PX)
    {
      id: 'p41', protocolo: 'EMP-2026-0041', solicitante: ana, responsavel: ana,
      itens: [{ equipamentoId: '3', quantidade: 2 }],
      status: 'aprovado', justificativa: 'Oficina de desenvolvimento web.',
      dataSolicitacao: d(-2), dataPrevistaRetirada: d(0), dataPrevistaDevolucao: d(5),
      responsavelAprovacao: admin, codigoRetirada: 'K7M4PX',
      historico: [ev('solicitado', ana, 2), ev('aprovado', admin, 2, undefined, 3)],
    },
    // Em andamento com Carlos, com transferência PENDENTE para o professor (ele aceita ou recusa)
    {
      id: 'p40', protocolo: 'EMP-2026-0040', solicitante: carlos, responsavel: carlos,
      itens: [{ equipamentoId: '5', quantidade: 1 }],
      status: 'em_andamento', justificativa: 'Medições do projeto de eletrônica analógica.',
      dataSolicitacao: d(-3), dataPrevistaRetirada: d(-2), dataPrevistaDevolucao: d(4),
      dataRetiradaEfetiva: d(-2), responsavelAprovacao: admin, codigoDevolucao: 'C3D6FG',
      transferenciaPendente: {
        de: carlos, para: prof, solicitadaEm: horasDepoisISO(-2),
        motivo: 'Vou viajar para o curso de capacitação e o Professor Demonstração dará continuidade ao projeto.',
      },
      historico: [
        ev('solicitado', carlos, 3), ev('aprovado', admin, 3, undefined, 2), ev('retirado', admin, 2, 'Entregue a Carlos Souza · código conferido'),
        {
          id: crypto.randomUUID(), tipo: 'transferencia_solicitada', em: horasDepoisISO(-2), por: carlos,
          detalhe: 'Para Professor Demonstração: Vou viajar para o curso de capacitação e o Professor Demonstração dará continuidade ao projeto.',
        },
      ],
    },
    // Em andamento com o professor: Impressora 3D (exige treinamento) -> bom para testar a transferência
    {
      id: 'p39', protocolo: 'EMP-2026-0039', solicitante: prof, responsavel: prof,
      itens: [{ equipamentoId: '8', quantidade: 1 }],
      status: 'em_andamento', justificativa: 'Impressão das peças do projeto integrador.',
      dataSolicitacao: d(-3), dataPrevistaRetirada: d(-2), dataPrevistaDevolucao: d(3),
      dataRetiradaEfetiva: d(-2), responsavelAprovacao: admin, codigoDevolucao: 'W5X8YZ',
      historico: [ev('solicitado', prof, 3), ev('aprovado', admin, 3, undefined, 2), ev('retirado', admin, 2, 'Entregue a Professor Demonstração · código conferido')],
    },
    // Em andamento com o professor: Projetor -> transferir para qualquer professor
    {
      id: 'p38', protocolo: 'EMP-2026-0038', solicitante: prof, responsavel: prof,
      itens: [{ equipamentoId: '2', quantidade: 1 }],
      status: 'em_andamento', justificativa: 'Aulas de apresentação de trabalhos do 3º módulo.',
      dataSolicitacao: d(-3), dataPrevistaRetirada: d(-1), dataPrevistaDevolucao: d(2),
      dataRetiradaEfetiva: d(-1), responsavelAprovacao: admin, codigoDevolucao: 'P4R7ST',
      historico: [ev('solicitado', prof, 3), ev('aprovado', admin, 3, undefined, 2), ev('retirado', admin, 1, 'Entregue a Professor Demonstração · código conferido')],
    },
    // ATRASADO (Maria, Caixa de som): não pode ser transferido
    {
      id: 'p37', protocolo: 'EMP-2026-0037', solicitante: maria, responsavel: maria,
      itens: [{ equipamentoId: '4', quantidade: 1 }],
      status: 'em_andamento', justificativa: 'Som para o evento de integração dos alunos.',
      dataSolicitacao: d(-8), dataPrevistaRetirada: d(-6), dataPrevistaDevolucao: d(-3),
      dataRetiradaEfetiva: d(-6), responsavelAprovacao: admin, codigoDevolucao: 'M2N9QD',
      historico: [ev('solicitado', maria, 8), ev('aprovado', admin, 8, undefined, 2), ev('retirado', admin, 6, 'Entregue a Maria Santos · código conferido')],
    },
    // Devolvido com cadeia de responsáveis: João -> Maria (exemplo completo da linha do tempo)
    {
      id: 'p36', protocolo: 'EMP-2026-0036', solicitante: joao, responsavel: maria,
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
      id: 'p35', protocolo: 'EMP-2026-0035', solicitante: prof, responsavel: prof,
      itens: [{ equipamentoId: '4', quantidade: 1 }],
      status: 'devolvido', justificativa: 'Som para a apresentação da feira de ciências.',
      dataSolicitacao: d(-25), dataPrevistaRetirada: d(-23), dataPrevistaDevolucao: d(-21),
      dataRetiradaEfetiva: d(-23), dataDevolucaoEfetiva: d(-21), responsavelAprovacao: admin,
      historico: [ev('solicitado', prof, 25), ev('aprovado', admin, 24), ev('retirado', admin, 23, 'Entregue a Professor Demonstração · código conferido'), ev('devolvido', admin, 21)],
    },
    // Reprovado do professor
    {
      id: 'p34', protocolo: 'EMP-2026-0034', solicitante: prof, responsavel: prof,
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
      texto: 'Carlos Souza pediu para transferir o pedido EMP-2026-0040 a Professor Demonstração.',
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
  // Solicitar, avaliar e cancelar
  // ===========================================================================================

  /** Confere as regras de um pedido novo. Devolve a mensagem do 1º problema, ou null se está tudo certo. */
  validarSolicitacao(dto: SolicitarEmprestimoDTO, usuarioId: string): string | null {
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
    return null;
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
      historico: [this.evento('solicitado', dono)],
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

  /** Cancela um pedido que ainda não foi retirado (pendente ou aprovado). Aprovado devolve o estoque. */
  cancelar(id: string): string | null {
    const alvo = this.buscarPorId(id);
    if (!alvo) return 'Pedido não encontrado.';
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
      historico: [...s.historico, this.evento('cancelado', eu)],
    }));
    this.avisar(`${eu.nome} cancelou o pedido ${alvo.protocolo}.`, id);
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
  confirmarRetirada(codigoDigitado: string): Resultado<Emprestimo> {
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
    return this.registrarRetirada(alvo.id);
  }

  /** Registra a saída do material. Privado de propósito: só se chega aqui depois de conferir o código. */
  private registrarRetirada(id: string): Resultado<Emprestimo> {
    const alvo = this.buscarPorId(id);
    if (!alvo || alvo.status !== 'aprovado') return falha('Este pedido não está aguardando retirada.');
    if (alvo.dataPrevistaDevolucao < hojeISO()) {
      return falha('O prazo de devolução deste pedido já passou. Cancele o pedido e peça um novo.');
    }
    const admin = this.ator();
    const detalhe = `Entregue a ${alvo.responsavel.nome} · código conferido`;
    const atualizado: Emprestimo = {
      ...alvo,
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

  /** Registra a volta do material e devolve as unidades ao estoque. Privado: só depois de conferir o código. */
  private registrarDevolucao(id: string, opcoes: OpcoesDevolucao): Resultado<Emprestimo> {
    const alvo = this.buscarPorId(id);
    if (!alvo || alvo.status !== 'em_andamento') return falha('Este pedido não está em andamento.');

    const admin = this.ator();
    const diasAtraso = Math.max(0, diferencaEmDias(alvo.dataPrevistaDevolucao, hojeISO()));
    const partes = [
      opcoes.houveAvaria ? 'Devolvido COM AVARIA' : 'Devolvido em ordem',
      diasAtraso > 0 ? `${diasAtraso} dia(s) de atraso` : '',
      opcoes.observacoes.trim(),
      'código conferido',
    ].filter(Boolean);

    const historico = [...alvo.historico];
    if (alvo.transferenciaPendente) {
      historico.push(this.evento('transferencia_cancelada', admin, 'Cancelada automaticamente: o material foi devolvido.'));
    }
    historico.push(this.evento('devolvido', admin, partes.join(' · ')));

    alvo.itens.forEach((i) => this.equipamentos.liberar(i.equipamentoId, i.quantidade));
    const atualizado: Emprestimo = {
      ...alvo,
      status: 'devolvido',
      dataDevolucaoEfetiva: hojeISO(),
      observacoesDevolucao: opcoes.observacoes.trim() || undefined,
      codigoDevolucao: undefined,
      transferenciaPendente: undefined,
      historico,
    };
    this.substituir(atualizado);
    return sucesso(atualizado);
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
        bloqueio: this.bloqueioHabilitacao(s, u.id),
      }));
  }

  /** O responsável pede para passar o pedido a outro professor. Devolve o erro, ou null se enviou. */
  solicitarTransferencia(id: string, paraId: string, motivo: string): string | null {
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

    const bloqueio = this.bloqueioHabilitacao(alvo, destino.id);
    if (bloqueio) return bloqueio;

    const de = this.usuarios.resumo(eu.id) ?? eu;
    const para = this.usuarios.resumo(destino.id) as UsuarioResumo;
    this.atualizarPedido(id, (s) => ({
      ...s,
      transferenciaPendente: { de, para, motivo: texto, solicitadaEm: agoraISO() },
      historico: [...s.historico, this.evento('transferencia_solicitada', de, `Para ${para.nome}: ${texto}`)],
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
    this.atualizarPedido(id, (s) => ({
      ...s,
      responsavel: novo,
      transferenciaPendente: undefined,
      // Código novo: quem passou o material adiante não deve mais conseguir "devolver" por ele.
      codigoDevolucao: this.novoCodigo(),
      historico: [
        ...s.historico,
        this.evento('transferencia_aceita', novo, `Recebido de ${t.de.nome}. O prazo de devolução continua ${prazo}.`),
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

  private novoCodigo(): string {
    const emUso = new Set<string>();
    for (const s of this.todas()) {
      if (s.codigoRetirada) emUso.add(s.codigoRetirada);
      if (s.codigoDevolucao) emUso.add(s.codigoDevolucao);
    }
    return gerarCodigo(6, emUso);
  }

  private proximoProtocolo(): string {
    const maior = this.todas().reduce(
      (m, s) => Math.max(m, Number(s.protocolo.slice(-4)) || 0),
      0,
    );
    return `EMP-${new Date().getFullYear()}-${String(maior + 1).padStart(4, '0')}`;
  }
}
