import { Module } from '@nestjs/common';
import {
  entidadesDoBanco,
  provedorDeRepositorio,
} from '../common/database/index.js';
import { EquipamentosModule } from '../equipamentos/equipamentos.module.js';
import { UsuarioHabilitacaoOrm } from './orm/usuario-habilitacao.orm-entity.js';
import { UsuarioOrm } from './orm/usuario.orm-entity.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosPostgresRepository } from './usuarios.postgres.repository.js';
import { UsuariosRepository } from './usuarios.repository.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  // As tabelas só são registradas com PERSISTENCIA=postgres (em memória não há banco).
  imports: [
    // Para conferir as habilitações (só equipamentos que exigem treinamento).
    EquipamentosModule,
    ...entidadesDoBanco([UsuarioOrm, UsuarioHabilitacaoOrm]),
  ],
  controllers: [UsuariosController],
  providers: [
    UsuariosService,
    // Memória ou banco, conforme PERSISTENCIA. O service não muda: pede UsuariosRepository.
    provedorDeRepositorio(UsuariosRepository, UsuariosPostgresRepository),
  ],
  // Só o service sai do módulo: o repositório (com o senhaHash) fica privado.
  exports: [UsuariosService],
})
export class UsuariosModule {}
