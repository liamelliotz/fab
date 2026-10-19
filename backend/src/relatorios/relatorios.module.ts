import { Module } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service.js';
import { RelatoriosController } from './relatorios.controller.js';

@Module({
  controllers: [RelatoriosController],
  providers: [RelatoriosService],
})
export class RelatoriosModule {}
