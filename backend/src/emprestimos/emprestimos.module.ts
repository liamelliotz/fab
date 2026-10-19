import { Module } from '@nestjs/common';
import { EmprestimosService } from './emprestimos.service.js';
import { EmprestimosController } from './emprestimos.controller.js';

@Module({
  controllers: [EmprestimosController],
  providers: [EmprestimosService],
})
export class EmprestimosModule {}
