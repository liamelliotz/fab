import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UsuarioAtual,
  type UsuarioAutenticado,
} from '../auth/decorators/index.js';
import { FiltroEquipamentoDto } from './dto/filtro-equipamento.dto.js';
import { EquipamentosService } from './equipamentos.service.js';

@ApiTags('equipamentos')
@ApiBearerAuth()
@Controller('equipamentos')
export class EquipamentosController {
  constructor(
    @Inject(EquipamentosService)
    private readonly equipamentosService: EquipamentosService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista equipamentos, com filtros e paginação.' })
  listar(
    @Query() filtro: FiltroEquipamentoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.equipamentosService.listar(filtro, usuario.perfil);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de um equipamento.' })
  obter(@Param('id') id: string, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.equipamentosService.obterPorId(id, usuario.perfil);
  }
}
