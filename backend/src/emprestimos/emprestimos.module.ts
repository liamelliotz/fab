import { Module } from '@nestjs/common';
import { EmprestimosController } from './emprestimos.controller.js';
import { EmprestimosRepository } from './emprestimos.repository.js';
import { EmprestimosService } from './emprestimos.service.js';

@Module({
  controllers: [EmprestimosController],
  providers: [EmprestimosService, EmprestimosRepository],
  exports: [EmprestimosService, EmprestimosRepository],
})
export class EmprestimosModule {}