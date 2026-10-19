import { Module } from '@nestjs/common';
import { ManutencoesService } from './manutencoes.service.js';
import { ManutencoesController } from './manutencoes.controller.js';

@Module({
  controllers: [ManutencoesController],
  providers: [ManutencoesService],
})
export class ManutencoesModule {}
