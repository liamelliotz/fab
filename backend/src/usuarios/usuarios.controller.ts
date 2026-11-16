import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/index.js';
import { MensagemResposta } from '../common/interceptors/mensagem-resposta.decorator.js';
import { CriarUsuarioDto } from './dto/criar-usuario.dto.js';
import {
  FiltroResumoUsuarioDto,
  FiltroUsuarioDto,
} from './dto/filtro-usuario.dto.js';
import { UsuariosService } from './usuarios.service.js';

/** Nenhuma rota devolve `senhaHash`: o service já entrega `UsuarioPublico`. */
@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(
    @Inject(UsuariosService)
    private readonly usuariosService: UsuariosService,
  ) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Lista usuários (admin), com filtros e paginação.' })
  listar(@Query() filtro: FiltroUsuarioDto) {
    return this.usuariosService.listarPagina(filtro);
  }

  // Precisa vir ANTES de GET /usuarios/:id, senão "resumo" seria lido como um id.
  @Get('resumo')
  @ApiOperation({
    summary:
      'Lista enxuta dos usuários ativos (qualquer logado): id, nome, departamento e habilitações.',
  })
  resumo(@Query() filtro: FiltroResumoUsuarioDto) {
    return this.usuariosService.resumo(filtro.busca);
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Detalhes de um usuário (admin).' })
  obter(@Param('id') id: string) {
    return this.usuariosService.obterPorId(id);
  }

  @Post()
  @Roles('admin')
  @MensagemResposta('Usuário cadastrado.')
  @ApiOperation({ summary: 'Cria uma conta (admin).' })
  criar(@Body() dto: CriarUsuarioDto) {
    return this.usuariosService.criar(dto);
  }
}
