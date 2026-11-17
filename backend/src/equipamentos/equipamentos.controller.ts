import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Roles,
  UsuarioAtual,
  type UsuarioAutenticado,
} from '../auth/decorators/index.js';
import { MensagemResposta } from '../common/interceptors/mensagem-resposta.decorator.js';
import { AtualizarEquipamentoDto } from './dto/atualizar-equipamento.dto.js';
import { CriarEquipamentoDto } from './dto/criar-equipamento.dto.js';
import { DefinirAtivoDto } from './dto/definir-ativo.dto.js';
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

  @Post()
  @Roles('admin')
  @MensagemResposta('Equipamento cadastrado.')
  @ApiOperation({
    summary: 'Cadastra um equipamento (admin).',
    description:
      'O patrimônio é único, sem diferenciar maiúsculas nem espaços (409). Nasce disponível, com quantidadeDisponivel igual a quantidadeTotal.',
  })
  criar(@Body() dto: CriarEquipamentoDto) {
    return this.equipamentosService.criar(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @MensagemResposta('Equipamento atualizado.')
  @ApiOperation({
    summary: 'Atualiza um equipamento (admin).',
    description:
      'Não aceita codigoPatrimonio (400). Ao mudar quantidadeTotal, o disponível acompanha a diferença; se ficaria negativo, 409.',
  })
  atualizar(@Param('id') id: string, @Body() dto: AtualizarEquipamentoDto) {
    return this.equipamentosService.atualizar(id, dto);
  }

  @Patch(':id/ativo')
  @Roles('admin')
  @MensagemResposta('Situação do equipamento atualizada.')
  @ApiOperation({
    summary: 'Ativa ou inativa um equipamento (admin).',
    description:
      'ativo=false vira inativo, e só com todas as unidades em casa (409 se houver alguma emprestada). ativo=true volta a disponível.',
  })
  definirAtivo(@Param('id') id: string, @Body() dto: DefinirAtivoDto) {
    return this.equipamentosService.definirAtivo(id, dto.ativo);
  }
}