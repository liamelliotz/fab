import { Body, Controller, Post } from '@nestjs/common';
import {
  UsuarioAtual,
  type UsuarioAutenticado,
} from '../auth/decorators/usuario-atual.decorator.js';
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
}