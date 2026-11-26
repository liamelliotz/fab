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
import type { RespostaPaginada } from '../common/dto/index.js';
import { MensagemResposta } from '../common/interceptors/mensagem-resposta.decorator.js';
import { ApiErros } from '../common/swagger/api-erros.decorator.js';
import { AlterarAtivoInsumoDto } from './dto/alterar-ativo-insumo.dto.js';
import { AtualizarInsumoDto } from './dto/atualizar-insumo.dto.js';
import { CriarInsumoDto } from './dto/criar-insumo.dto.js';
import { FiltroInsumoDto } from './dto/filtro-insumo.dto.js';
import type { InsumoResposta } from './insumo.resposta.js';
import { InsumosService } from './insumos.service.js';

/**
 * Rotas de /insumos (cards D1 a D5). TODAS exigem perfil admin: o @Roles no controller vale
 * para qualquer rota nova, então o professor recebe 403 em tudo aqui. Veja docs/contrato-api.md.
 *
 * ATENÇÃO à ordem: rotas fixas dos próximos cards (`a-repor`, `movimentacoes`,
 * `relatorios/consumo`) precisam ficar ANTES do `GET :id`, senão o Nest lê "a-repor" como um id.
 */
@ApiTags('insumos')
@ApiBearerAuth()
@Roles('admin')
@Controller('insumos')
export class InsumosController {
  constructor(
    @Inject(InsumosService) private readonly insumosService: InsumosService,
  ) {}

  @Get()
  @ApiErros(400, 401, 403)
  @ApiOperation({
    summary:
      'Lista insumos (admin), com filtros e paginação, em ordem alfabética.',
  })
  listar(
    @Query() filtro: FiltroInsumoDto,
  ): Promise<RespostaPaginada<InsumoResposta>> {
    return this.insumosService.listar(filtro);
  }

  @Get(':id')
  @ApiErros(401, 403, 404)
  @ApiOperation({ summary: 'Detalhes de um insumo (admin).' })
  obter(@Param('id') id: string): Promise<InsumoResposta> {
    return this.insumosService.obterPorId(id);
  }

  @Post()
  @MensagemResposta('Insumo cadastrado.')
  @ApiErros(400, 401, 403, 409)
  @ApiOperation({
    summary:
      'Cadastra um insumo (admin). quantidadeInicial maior que zero vira uma entrada ajuste_positivo.',
  })
  criar(
    @Body() dto: CriarInsumoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<InsumoResposta> {
    return this.insumosService.criar(dto, usuario.sub);
  }

  /** `PATCH /insumos/:id/ativo` tem 2 segmentos a mais, então não conflita com `PATCH :id`. */
  @Patch(':id/ativo')
  @MensagemResposta('Situação do insumo alterada.')
  @ApiErros(400, 401, 403, 404)
  @ApiOperation({ summary: 'Ativa ou desativa um insumo (admin).' })
  alterarAtivo(
    @Param('id') id: string,
    @Body() dto: AlterarAtivoInsumoDto,
  ): Promise<InsumoResposta> {
    return this.insumosService.alterarAtivo(id, dto.ativo);
  }

  @Patch(':id')
  @MensagemResposta('Insumo atualizado.')
  @ApiErros(400, 401, 403, 404, 409)
  @ApiOperation({
    summary:
      'Edita os dados do insumo (admin). Não aceita quantidade: o saldo só muda por movimentação.',
  })
  atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarInsumoDto,
  ): Promise<InsumoResposta> {
    return this.insumosService.atualizar(id, dto);
  }
}
