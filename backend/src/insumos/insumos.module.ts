import { Module } from '@nestjs/common';
import { InsumosController } from './insumos.controller.js';
import { InsumosService } from './insumos.service.js';

@Module({
  controllers: [InsumosController],
  providers: [InsumosService],
  exports: [InsumosService],
})
export class InsumosModule {}
