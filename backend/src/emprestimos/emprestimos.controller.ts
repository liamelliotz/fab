
import { Body, Controller, Inject, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Roles,
  UsuarioAtual,
  type UsuarioAutenticado,
} from '../auth/decorators/index.js';
import { AvaliarEmprestimoDto } from './dto/avaliar-emprestimo.dto.js';
import { EmprestimosService } from './emprestimos.service.js';

@ApiTags('emprestimos')
@ApiBearerAuth()
@Controller('emprestimos')
export class EmprestimosController {
  constructor(
    @Inject(EmprestimosService)
    private readonly emprestimosService: EmprestimosService,
  ) {}

  @Patch(':id/avaliar')
  @Roles('admin')
  @ApiOperation({ summary: 'Aprovar ou rejeitar um pedido de empréstimo' })
  avaliar(
    @Param('id') id: string,
    @Body() dto: AvaliarEmprestimoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.emprestimosService.avaliar(id, dto, usuario.sub);
  }

  @Patch(':id/cancelar')
  @ApiOperation({ summary: 'Cancelar um pedido de empréstimo pendente' })
  cancelar(
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.emprestimosService.cancelar(id, usuario.sub);
  }
}
