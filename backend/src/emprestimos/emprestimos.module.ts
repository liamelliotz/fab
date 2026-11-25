import { Module } from '@nestjs/common';
import { BalcaoController } from './balcao.controller.js';
import { BalcaoService } from './balcao.service.js';
import { EmprestimosController } from './emprestimos.controller.js';
import { EmprestimosRepository } from './emprestimos.repository.js';
import { EmprestimosService } from './emprestimos.service.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { EquipamentosModule } from '../equipamentos/equipamentos.module.js';
import { ManutencoesModule } from '../manutencoes/manutencoes.module.js';

@Module({
  imports: [UsuariosModule, EquipamentosModule, ManutencoesModule],
  // O balcão vem ANTES do controller principal: "emprestimos/balcao" não pode
  // ser engolido por uma rota com parâmetro (ex.: "emprestimos/:id").
  controllers: [BalcaoController, EmprestimosController],
  providers: [EmprestimosService, EmprestimosRepository, BalcaoService],
  exports: [EmprestimosService, EmprestimosRepository],
})
export class EmprestimosModule {}