import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosRepository } from './usuarios.repository.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosRepository, UsuariosService],
  // Só o service sai do módulo: o repositório (com o senhaHash) fica privado.
  exports: [UsuariosService],
})
export class UsuariosModule {}
