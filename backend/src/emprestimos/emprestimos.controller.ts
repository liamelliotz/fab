import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  UsuarioAtual,
  type UsuarioAutenticado,
} from '../auth/decorators/usuario-atual.decorator.js';
import {
  PaginacaoDto,
  type RespostaPaginada,
} from '../common/dto/paginacao.dto.js';
import { FiltroEmprestimoDto } from './dto/filtro-emprestimo.dto.js';
import { SolicitarEmprestimoDto } from './dto/solicitar-emprestimo.dto.js';
import type { EmprestimoResposta } from './emprestimo.resposta.js';
import { EmprestimosService } from './emprestimos.service.js';

@Controller('emprestimos')
export class EmprestimosController {
  constructor(private readonly emprestimosService: EmprestimosService) {}

  /** POST /emprestimos: o solicitante vem do token, nunca do corpo. */
  @Post()
  solicitar(
    @Body() dto: SolicitarEmprestimoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EmprestimoResposta> {
    return this.emprestimosService.solicitar(dto, usuario);
  }

  /** GET /emprestimos (admin): todos os pedidos, com filtros e paginação. */
  @Get()
  listarTodos(
    @Query() filtro: FiltroEmprestimoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<RespostaPaginada<EmprestimoResposta>> {
    return this.emprestimosService.listarTodos(filtro, usuario);
  }

  /**
   * GET /emprestimos/meus. Precisa ficar ANTES do `GET /emprestimos/:id`,
   * senão "meus" seria lido como um id.
   */
  @Get('meus')
  listarMeus(
    @Query() paginacao: PaginacaoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<RespostaPaginada<EmprestimoResposta>> {
    return this.emprestimosService.listarMeus(paginacao, usuario);
  }

  /** GET /emprestimos/:id: participante ou admin (outro professor recebe 403). */
  @Get(':id')
  buscarPorId(
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EmprestimoResposta> {
    return this.emprestimosService.buscarPorId(id, usuario);
  }
}