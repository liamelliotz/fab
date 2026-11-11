import { Controller, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InsumosService } from './insumos.service.js';

/** Rotas de /insumos (cards D1 a D5). Todas exigem perfil admin: veja docs/contrato-api.md. */
@ApiTags('insumos')
@ApiBearerAuth()
@Controller('insumos')
export class InsumosController {
  constructor(
    @Inject(InsumosService) private readonly insumosService: InsumosService,
  ) {}
}
