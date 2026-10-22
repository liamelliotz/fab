import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../common/repository/index.js';
import { USUARIOS_SEED } from '../common/seed/index.js';
import type { Usuario } from './entities/usuario.entity.js';
import { gerarHash, normalizarCpf, normalizarEmail } from './usuarios.util.js';

@Injectable()
export class UsuariosRepository extends InMemoryRepository<Usuario> {
  /**
   * Seed dos usuários (common/seed/usuarios.seed.ts). As senhas do seed estão em texto;
   * aqui cada uma vira hash bcrypt antes de ir para o repositório. Dentro do repositório
   * nunca existe senha em texto.
   */
  protected override async dadosIniciais(): Promise<Usuario[]> {
    return Promise.all(
      USUARIOS_SEED.map(async ({ senha, ...dados }) => ({
        ...dados,
        senhaHash: await gerarHash(senha),
      })),
    );
  }

  /** Busca ignorando maiúsculas e espaços nas pontas do e-mail. */
  buscarPorEmail(email: string): Promise<Usuario | null> {
    const alvo = normalizarEmail(email);
    return this.encontrar((usuario) => normalizarEmail(usuario.email) === alvo);
  }

  /** Busca pelo CPF (com ou sem pontuação). */
  buscarPorCpf(cpf: string): Promise<Usuario | null> {
    const alvo = normalizarCpf(cpf);
    return this.encontrar((usuario) => normalizarCpf(usuario.cpf) === alvo);
  }
}
