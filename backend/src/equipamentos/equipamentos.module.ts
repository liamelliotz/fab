import { Module } from '@nestjs/common';
import { EquipamentosController } from './equipamentos.controller.js';
import { EquipamentosRepository } from './equipamentos.repository.js';
import { EquipamentosService } from './equipamentos.service.js';

@Module({
  controllers: [EquipamentosController],
  providers: [EquipamentosService, EquipamentosRepository],
  // Exportado para Empréstimos (reservar e liberar estoque), Manutenções, Dashboard e Relatórios.
  exports: [EquipamentosService],
})
export class EquipamentosModule {}
