import { Module } from '@nestjs/common';
import { EmprestimosController } from './emprestimos.controller.js';
import { EmprestimosRepository } from './emprestimos.repository.js';
import { EmprestimosService } from './emprestimos.service.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { EquipamentosModule } from '../equipamentos/equipamentos.module.js';

@Module({
  imports: [UsuariosModule, EquipamentosModule],
  controllers: [EmprestimosController],
  providers: [EmprestimosService, EmprestimosRepository],
  exports: [EmprestimosService, EmprestimosRepository],
})
export class EmprestimosModule {}