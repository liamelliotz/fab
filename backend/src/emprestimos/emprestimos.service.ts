import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { UsuarioAutenticado } from '../auth/decorators/usuario-atual.decorator.js';
import {
  StatusEmprestimo,
  StatusEquipamento,
  TipoEventoEmprestimo,
} from '../common/enums/index.js';
import {
  diferencaEmDias,
  ehDataIso,
  hojeIso,
  somarDias,
} from '../common/utils/data.util.js';
import type { Equipamento } from '../equipamentos/entities/equipamento.entity.js';
import { EquipamentosService } from '../equipamentos/equipamentos.service.js';
import type { Usuario } from '../usuarios/entities/usuario.entity.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import type { SolicitarEmprestimoDto } from './dto/solicitar-emprestimo.dto.js';
import {
  paraResposta,
  type EmprestimoResposta,
} from './emprestimo.resposta.js';
import { EmprestimosRepository } from './emprestimos.repository.js';

@Injectable()
export class EmprestimosService {
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
   * Gera o protocolo EMP-AAAA-0001: sequencial e reiniciado a cada ano.
   * O ano é o da ESCOLA (APP_TIMEZONE), e cada chamada recebe um número diferente,
   * mesmo com pedidos simultâneos. Com o seed até 0045, o próximo de 2026 é 0046.
   */
  async gerarProtocolo(hoje: string = hojeIso()): Promise<string> {
    const ano = Number(hoje.slice(0, 4));
    const proximo = await this.emprestimosRepository.reservarSequencial(ano);
    return `EMP-${ano}-${String(proximo).padStart(4, '0')}`;
  }
}
