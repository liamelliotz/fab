import { Controller } from '@nestjs/common';
import { EquipamentosService } from './equipamentos.service.js';

@Controller('equipamentos')
export class EquipamentosController {
  constructor(private readonly equipamentosService: EquipamentosService) {}
}
