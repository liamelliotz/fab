import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { UsuarioAutenticado } from '../auth/decorators/usuario-atual.decorator.js';
import {
  montarPagina,
  type PaginacaoDto,
  type RespostaPaginada,
} from '../common/dto/paginacao.dto.js';
import {
  Perfil,
  StatusEmprestimo,
  StatusEquipamento,
  TipoEventoEmprestimo,
} from '../common/enums/index.js';
import { gerarCodigo } from '../common/utils/codigo.util.js';
import {
  diferencaEmDias,
  ehDataIso,
  hojeIso,
  paraIso,
  somarDias,
} from '../common/utils/data.util.js';
import type { Equipamento } from '../equipamentos/entities/equipamento.entity.js';
import { EquipamentosService } from '../equipamentos/equipamentos.service.js';
import type { Usuario } from '../usuarios/entities/usuario.entity.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import {
  calcularAtraso,
  statusParaResposta,
} from './atrasos/calcular-atraso.js';
import type { FiltroEmprestimoDto } from './dto/filtro-emprestimo.dto.js';
import type { SolicitarEmprestimoDto } from './dto/solicitar-emprestimo.dto.js';
import {
  paraResposta,
  type EmprestimoResposta,
} from './emprestimo.resposta.js';
import {
  EmprestimosRepository,
  maisRecentesPrimeiro,
} from './emprestimos.repository.js';
import type { AvaliarEmprestimoDto } from './dto/avaliar-emprestimo.dto.js';
import type {
  Emprestimo,
  EventoEmprestimo,
} from './entities/emprestimo.entity.js';

@Injectable()
export class EmprestimosService {
  /** Avaliações e cancelamentos rodam um de cada vez (evita aprovar o mesmo pedido duas vezes). */
  private fila: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(EmprestimosRepository)
    private readonly emprestimosRepository: EmprestimosRepository,
    @Inject(UsuariosService)
    private readonly usuariosService: UsuariosService,
    @Inject(EquipamentosService)
    private readonly equipamentosService: EquipamentosService,
  ) {}

  /**
   * Solicita um empréstimo (regra 11). Fica `pendente` e NÃO reserva estoque:
   * quem reserva é a aprovação. O solicitante vem sempre do token.
   */
  async solicitar(
    dto: SolicitarEmprestimoDto,
    usuario: UsuarioAutenticado,
  ): Promise<EmprestimoResposta> {
    const hoje = hojeIso();
    const { dataPrevistaRetirada: retirada, dataPrevistaDevolucao: devolucao } =
      dto;

    // 1) Datas
    if (!ehDataIso(retirada) || !ehDataIso(devolucao)) {
      throw new BadRequestException(
        'As datas devem existir e estar no formato AAAA-MM-DD.',
      );
    }
    if (retirada < hoje) {
      throw new BadRequestException(
        'A data de retirada não pode ser anterior a hoje.',
      );
    }
    if (devolucao < retirada) {
      throw new BadRequestException(
        'A data de devolução não pode ser anterior à retirada.',
      );
    }

    // 2) Solicitante (vem do token, nunca do corpo)
    const solicitante = await this.usuariosService.buscarPorId(usuario.sub);
    if (!solicitante) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    // 3) Equipamentos: existir (404), estar disponível (409) e habilitação (409)
    const equipamentos: Equipamento[] = [];
    for (const item of dto.itens) {
      const equipamento = await this.equipamentosService.buscarPorId(
        item.equipamentoId,
      );
      if (!equipamento) {
        throw new NotFoundException(
          `Equipamento ${item.equipamentoId} não encontrado.`,
        );
      }
      if (equipamento.status !== StatusEquipamento.Disponivel) {
        throw new ConflictException(
          `${equipamento.nome} não está disponível (situação: ${equipamento.status}).`,
        );
      }
      if (
        equipamento.requerTreinamento &&
        !solicitante.habilitacoes.includes(equipamento.id)
      ) {
        throw new ConflictException(
          `Você não tem habilitação para solicitar ${equipamento.nome}.`,
        );
      }
      equipamentos.push(equipamento);
    }

    // 4) Prazo máximo: vale o menor entre os itens
    const maisRestrito = equipamentos.reduce((menor, e) =>
      e.prazoMaximoDias < menor.prazoMaximoDias ? e : menor,
    );
    const duracao = diferencaEmDias(retirada, devolucao);
    if (duracao > maisRestrito.prazoMaximoDias) {
      const limite = somarDias(retirada, maisRestrito.prazoMaximoDias);
      throw new BadRequestException(
        `${maisRestrito.nome} permite no máximo ${maisRestrito.prazoMaximoDias} dia(s). ` +
          `A data limite de devolução é ${limite}.`,
      );
    }

    // 5) Gravação (só depois de validar tudo, para não gastar número de protocolo à toa)
    const agora = new Date().toISOString();
    const gravado = await this.emprestimosRepository.criar({
      protocolo: await this.gerarProtocolo(hoje),
      solicitanteId: usuario.sub,
      responsavelId: usuario.sub,
      itens: dto.itens.map((i) => ({
        equipamentoId: i.equipamentoId,
        quantidade: i.quantidade,
        observacoes: i.observacoes,
      })),
      justificativa: dto.justificativa.trim(),
      status: StatusEmprestimo.Pendente,
      dataSolicitacao: agora,
      dataPrevistaRetirada: retirada,
      dataPrevistaDevolucao: devolucao,
      historico: [
        {
          id: randomUUID(),
          tipo: TipoEventoEmprestimo.Solicitado,
          em: agora,
          porId: usuario.sub,
        },
      ],
    });

    // 6) Resposta com objetos resumidos (o resumir() só lê id, nome, email, perfil e departamento)
    return paraResposta(
      gravado,
      { id: usuario.sub, perfil: usuario.perfil },
      {
        usuarios: new Map([[solicitante.id, solicitante as Usuario]]),
        equipamentos: new Map(equipamentos.map((e) => [e.id, e])),
      },
    );
  }

  /**
   * GET /emprestimos (admin): todos os pedidos, com filtros e paginação.
   * Mais recentes primeiro. `status=atrasado` e `atrasadosApenas` usam a regra de
   * atrasos/calcular-atraso.ts (a mesma do status da resposta).
   * As datas filtram o dia da solicitação (no fuso da escola).
   * `busca` procura no protocolo e no nome do solicitante ou do responsável.
   */
  async listarTodos(
    filtro: FiltroEmprestimoDto,
    usuario: UsuarioAutenticado,
  ): Promise<RespostaPaginada<EmprestimoResposta>> {
    if (usuario.perfil !== Perfil.Admin) {
      throw new ForbiddenException(
        'Apenas administradores podem listar todos os empréstimos.',
      );
    }

    const { dataInicio, dataFim } = filtro;
    if (
      (dataInicio !== undefined && !ehDataIso(dataInicio)) ||
      (dataFim !== undefined && !ehDataIso(dataFim))
    ) {
      throw new BadRequestException(
        'dataInicio e dataFim devem ser datas válidas no formato AAAA-MM-DD.',
      );
    }
    if (dataInicio && dataFim && dataFim < dataInicio) {
      throw new BadRequestException(
        'dataFim não pode ser anterior a dataInicio.',
      );
    }

    const agora = new Date();
    const todos = await this.emprestimosRepository.listar();

    const termo = filtro.busca?.trim().toLowerCase();
    const nomes = termo
      ? await this.nomesDosEnvolvidos(todos)
      : new Map<string, string>();

    const filtrados = todos
      .filter((e) => {
        if (filtro.status && statusParaResposta(e, agora) !== filtro.status) {
          return false;
        }
        if (filtro.solicitanteId && e.solicitanteId !== filtro.solicitanteId) {
          return false;
        }
        if (filtro.responsavelId && e.responsavelId !== filtro.responsavelId) {
          return false;
        }
        if (termo) {
          const textos = [
            e.protocolo,
            nomes.get(e.solicitanteId) ?? '',
            nomes.get(e.responsavelId) ?? '',
          ];
          if (!textos.some((t) => t.toLowerCase().includes(termo))) {
            return false;
          }
        }
        const diaDaSolicitacao = paraIso(new Date(e.dataSolicitacao));
        if (dataInicio && diaDaSolicitacao < dataInicio) return false;
        if (dataFim && diaDaSolicitacao > dataFim) return false;
        if (filtro.atrasadosApenas && !calcularAtraso(e, agora)) {
          return false;
        }
        return true;
      })
      .sort(maisRecentesPrimeiro);

    const pagina = montarPagina(filtrados, filtro);
    return {
      ...pagina,
      itens: await this.paraRespostas(pagina.itens, usuario),
    };
  }

  /** GET /emprestimos/meus: pedidos em que o usuário é solicitante, responsável ou destinatário de transferência. */
  async listarMeus(
    paginacao: PaginacaoDto,
    usuario: UsuarioAutenticado,
  ): Promise<RespostaPaginada<EmprestimoResposta>> {
    const meus = await this.emprestimosRepository.listarDoUsuario(usuario.sub);
    const pagina = montarPagina(meus, paginacao);
    return {
      ...pagina,
      itens: await this.paraRespostas(pagina.itens, usuario),
    };
  }

  /**
   * GET /emprestimos/:id: participante ou admin. Pedido inexistente dá 404;
   * pedido de outra pessoa dá 403.
   */
  async buscarPorId(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<EmprestimoResposta> {
    const emprestimo = await this.emprestimosRepository.buscarPorId(id);
    if (!emprestimo) {
      throw new NotFoundException('Empréstimo não encontrado.');
    }
    if (!this.podeVer(emprestimo, usuario)) {
      throw new ForbiddenException('Você não tem acesso a este empréstimo.');
    }
    const [resposta] = await this.paraRespostas([emprestimo], usuario);
    return resposta;
  }

  /** Admin, solicitante, responsável atual ou envolvido na transferência pendente. */
  private podeVer(
    emprestimo: Emprestimo,
    usuario: UsuarioAutenticado,
  ): boolean {
    if (usuario.perfil === Perfil.Admin) return true;
    const id = usuario.sub;
    return (
      emprestimo.solicitanteId === id ||
      emprestimo.responsavelId === id ||
      emprestimo.transferenciaPendente?.deId === id ||
      emprestimo.transferenciaPendente?.paraId === id
    );
  }

  /** Nomes (id -> nome) de quem solicitou ou está com cada pedido. Usado só na `busca`. */
  private async nomesDosEnvolvidos(
    emprestimos: Emprestimo[],
  ): Promise<Map<string, string>> {
    const ids = new Set<string>();
    for (const e of emprestimos) {
      ids.add(e.solicitanteId);
      ids.add(e.responsavelId);
    }
    const nomes = new Map<string, string>();
    await Promise.all(
      [...ids].map(async (id) => {
        const encontrado = await this.usuariosService.buscarPorId(id);
        if (encontrado) nomes.set(id, encontrado.nome);
      }),
    );
    return nomes;
  }

  /**
   * Troca os ids por objetos resumidos (regra do card C2): busca só os usuários e
   * equipamentos que aparecem nos pedidos recebidos e delega ao `paraResposta`.
   */
  private async paraRespostas(
    emprestimos: Emprestimo[],
    quemPede: UsuarioAutenticado,
  ): Promise<EmprestimoResposta[]> {
    const idsUsuarios = new Set<string>();
    const idsEquipamentos = new Set<string>();
    for (const e of emprestimos) {
      idsUsuarios.add(e.solicitanteId);
      idsUsuarios.add(e.responsavelId);
      if (e.avaliadoPorId) idsUsuarios.add(e.avaliadoPorId);
      if (e.transferenciaPendente) {
        idsUsuarios.add(e.transferenciaPendente.deId);
        idsUsuarios.add(e.transferenciaPendente.paraId);
      }
      for (const evento of e.historico) idsUsuarios.add(evento.porId);
      for (const item of e.itens) idsEquipamentos.add(item.equipamentoId);
    }

    const usuarios = new Map<string, Usuario>();
    await Promise.all(
      [...idsUsuarios].map(async (id) => {
        const encontrado = await this.usuariosService.buscarPorId(id);
        if (encontrado) usuarios.set(id, encontrado as Usuario);
      }),
    );

    const equipamentos = new Map<string, Equipamento>();
    await Promise.all(
      [...idsEquipamentos].map(async (id) => {
        const encontrado = await this.equipamentosService.buscarPorId(id);
        if (encontrado) equipamentos.set(id, encontrado);
      }),
    );

    const solicitante = { id: quemPede.sub, perfil: quemPede.perfil };
    return emprestimos.map((e) =>
      paraResposta(e, solicitante, { usuarios, equipamentos }),
    );
  }

  /**
   * Gera o protocolo EMP-AAAA-0001: sequencial e reiniciado a cada ano.
   * O ano é o da ESCOLA (APP_TIMEZONE), e cada chamada recebe um número diferente,
   * mesmo com pedidos simultâneos. Com o seed até 0045, o próximo de 2026 é 0046.
   */
  async gerarProtocolo(hoje: string = hojeIso()): Promise<string> {
    const ano = Number(hoje.slice(0, 4));
    const proximo = await this.emprestimosRepository.reservarSequencial(ano);
    return `EMP-${ano}-${String(proximo).padStart(4, '0')}`;
  }

  /** Monta a resposta da API (mesmo formato do GET /emprestimos/:id) para um pedido já gravado. */
  async responder(
    emprestimo: Emprestimo,
    usuario: UsuarioAutenticado,
  ): Promise<EmprestimoResposta> {
    const [resposta] = await this.paraRespostas([emprestimo], usuario);
    return resposta;
  }

  /** Admin aprova ou reprova um pedido pendente. Erros: 404, 409. */
  avaliar(
    id: string,
    dto: AvaliarEmprestimoDto,
    adminId: string,
  ): Promise<Emprestimo> {
    return this.serializar(async () => {
      const pedido = await this.obterOuFalhar(id);
      this.exigirPendente(pedido);
      return dto.aprovado
        ? this.aprovar(pedido, adminId)
        : this.reprovar(pedido, dto.motivo ?? '', adminId);
    });
  }

  /** O solicitante cancela o próprio pedido pendente. O 403 vem antes do 409. */
  cancelar(id: string, usuarioId: string): Promise<Emprestimo> {
    return this.serializar(async () => {
      const pedido = await this.obterOuFalhar(id);
      if (pedido.solicitanteId !== usuarioId) {
        throw new ForbiddenException(
          'Só quem solicitou o pedido pode cancelá-lo.',
        );
      }
      this.exigirPendente(pedido);
      return this.gravar(pedido.id, {
        status: StatusEmprestimo.Cancelado,
        historico: [
          ...pedido.historico,
          this.novoEvento(TipoEventoEmprestimo.Cancelado, usuarioId),
        ],
      });
    });
  }

  private async aprovar(
    pedido: Emprestimo,
    adminId: string,
  ): Promise<Emprestimo> {
    // Se faltar estoque, lança 409 aqui e nada é reservado nem alterado.
    await this.equipamentosService.reservarVarios(
      pedido.itens.map((i) => ({
        id: i.equipamentoId,
        quantidade: i.quantidade,
      })),
    );
    const codigoRetirada = gerarCodigo(await this.codigosEmUso());
    return this.gravar(pedido.id, {
      status: StatusEmprestimo.Aprovado,
      avaliadoPorId: adminId,
      codigoRetirada,
      historico: [
        ...pedido.historico,
        this.novoEvento(TipoEventoEmprestimo.Aprovado, adminId),
      ],
    });
  }

  private reprovar(
    pedido: Emprestimo,
    motivo: string,
    adminId: string,
  ): Promise<Emprestimo> {
    return this.gravar(pedido.id, {
      status: StatusEmprestimo.Rejeitado,
      avaliadoPorId: adminId,
      motivoRejeicao: motivo,
      historico: [
        ...pedido.historico,
        this.novoEvento(TipoEventoEmprestimo.Rejeitado, adminId, motivo),
      ],
    });
  }

  /** Códigos dos pedidos ativos (aprovados e em andamento). */
  private async codigosEmUso(): Promise<Set<string>> {
    const ativos = await this.emprestimosRepository.buscarComCodigoAtivo();
    const emUso = new Set<string>();
    for (const e of ativos) {
      if (e.codigoRetirada) emUso.add(e.codigoRetirada);
      if (e.codigoDevolucao) emUso.add(e.codigoDevolucao);
    }
    return emUso;
  }

  private exigirPendente(pedido: Emprestimo): void {
    if (pedido.status !== StatusEmprestimo.Pendente) {
      throw new ConflictException(
        `O pedido ${pedido.protocolo} não está pendente (situação: ${pedido.status}).`,
      );
    }
  }

  private novoEvento(
    tipo: TipoEventoEmprestimo,
    porId: string,
    detalhe?: string,
  ): EventoEmprestimo {
    return {
      id: randomUUID(),
      tipo,
      em: new Date().toISOString(),
      porId,
      ...(detalhe ? { detalhe } : {}),
    };
  }

  private async obterOuFalhar(id: string): Promise<Emprestimo> {
    const pedido = await this.emprestimosRepository.buscarPorId(id);
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    return pedido;
  }

  private async gravar(
    id: string,
    alteracoes: Partial<Emprestimo>,
  ): Promise<Emprestimo> {
    const atualizado = await this.emprestimosRepository.atualizar(
      id,
      alteracoes,
    );
    if (!atualizado) throw new NotFoundException('Pedido não encontrado.');
    return atualizado;
  }

  private serializar<T>(operacao: () => Promise<T>): Promise<T> {
    const execucao = this.fila.then(operacao);
    this.fila = execucao.catch(() => undefined);
    return execucao;
  }
}
