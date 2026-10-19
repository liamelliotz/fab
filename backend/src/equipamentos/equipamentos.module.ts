import { Module } from '@nestjs/common';
import { EquipamentosService } from './equipamentos.service.js';
import { EquipamentosController } from './equipamentos.controller.js';

@Module({
  controllers: [EquipamentosController],
  providers: [EquipamentosService],
})
export class EquipamentosModule {}
