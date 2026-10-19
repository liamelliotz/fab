import { Controller } from '@nestjs/common';
import { ManutencoesService } from './manutencoes.service.js';

@Controller('manutencoes')
export class ManutencoesController {
  constructor(private readonly manutencoesService: ManutencoesService) {}
}
