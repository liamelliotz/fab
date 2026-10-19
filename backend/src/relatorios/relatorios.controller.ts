import { Controller } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service.js';

@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}
}
