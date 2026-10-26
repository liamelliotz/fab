import { Controller, Get } from '@nestjs/common';
import { EquipamentosService } from './equipamentos.service.js';

@Controller('equipamentos')
export class EquipamentosController {
constructor(
private readonly equipamentosService: EquipamentosService,
) {}

// GET /equipamentos: solicita ao service a lista de equipamentos.
@Get()
listar() {
return this.equipamentosService.listar();
}
}