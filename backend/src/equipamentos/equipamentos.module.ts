import { Module } from '@nestjs/common';
import { EquipamentosService } from './equipamentos.service.js';
import { EquipamentosController } from './equipamentos.controller.js';
import { EquipamentosRepository } from './equipamentos.repository.js';

@Module({
  controllers: [EquipamentosController],
  providers: [EquipamentosService, EquipamentosRepository],
})
export class EquipamentosModule {}