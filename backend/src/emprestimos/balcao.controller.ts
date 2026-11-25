import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Roles,
  UsuarioAtual,
  type UsuarioAutenticado,
} from '../auth/decorators/index.js';
import { BalcaoService } from './balcao.service.js';
import { CodigoBalcaoDto, DevolucaoBalcaoDto } from './dto/balcao.dto.js';
import type { EmprestimoResposta } from './emprestimo.resposta.js';
import { EmprestimosService } from './emprestimos.service.js';

/** Rotas do balcão (só admin). Precisa vir ANTES do EmprestimosController no módulo. */
@ApiTags('balcao')
@ApiBearerAuth()
@Controller('emprestimos/balcao')
export class BalcaoController {
  constructor(
    @Inject(BalcaoService) private readonly balcao: BalcaoService,
    @Inject(EmprestimosService)
    private readonly emprestimos: EmprestimosService,
  ) {}

  @Get('consulta')
  @Roles('admin')
  @ApiOperation({ summary: 'Confere um código (retirada ou devolução)' })
  async consulta(
    @Query('codigo') codigo: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<{ tipo: string; emprestimo: EmprestimoResposta }> {
    const { tipo, emprestimo } = await this.balcao.consultar(codigo);
    return {
      tipo,
      emprestimo: await this.emprestimos.buscarPorId(emprestimo.id, usuario),
    };
  }

  @Post('retirada')
  @Roles('admin')
  @ApiOperation({ summary: 'Registrar a retirada pelo código' })
  async retirada(
    @Body() dto: CodigoBalcaoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EmprestimoResposta> {
    const pedido = await this.balcao.retirar(dto.codigo, usuario.sub);
    return this.emprestimos.buscarPorId(pedido.id, usuario);
  }

  @Post('devolucao')
  @Roles('admin')
  @ApiOperation({ summary: 'Registrar a devolução pelo código' })
  async devolucao(
    @Body() dto: DevolucaoBalcaoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<EmprestimoResposta> {
    const pedido = await this.balcao.devolver(
      dto.codigo,
      { houveAvaria: dto.houveAvaria, observacoes: dto.observacoes },
      usuario.sub,
    );
    return this.emprestimos.buscarPorId(pedido.id, usuario);
  }
}
