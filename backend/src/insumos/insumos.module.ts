import { Module } from '@nestjs/common';
import { InsumosController } from './insumos.controller.js';
import { InsumosRepository } from './insumos.repository.js';
import { InsumosService } from './insumos.service.js';
import { MovimentacoesRepository } from './movimentacoes.repository.js';

@Module({
  controllers: [InsumosController],
  providers: [InsumosService, InsumosRepository, MovimentacoesRepository],
  // Exportado para o Dashboard (insumosARepor) e os relatórios.
  exports: [InsumosService],
})
export class InsumosModule {}
