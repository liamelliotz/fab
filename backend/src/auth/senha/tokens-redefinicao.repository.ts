import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../../common/repository/index.js';
import type { TokenRedefinicao } from './token-redefinicao.entity.js';

/** Tokens de redefinição de senha em memória (somem ao reiniciar a API). */
@Injectable()
export class TokensRedefinicaoRepository extends InMemoryRepository<TokenRedefinicao> {
  buscarPorHash(tokenHash: string): Promise<TokenRedefinicao | null> {
    return this.encontrar((t) => t.tokenHash === tokenHash);
  }

  /** Tokens sendo consumidos agora (trava contra dois pedidos ao mesmo tempo). */
  private readonly emUso = new Set<string>();

  /**
   * Marca o token como usado SE ainda estiver válido (não usado e dentro da validade).
   * Devolve o token marcado, ou null se não der (inclusive se outro pedido chegou antes).
   *
   * A trava `emUso` é conferida e ligada ANTES do primeiro `await`: nesse trecho o
   * JavaScript não deixa outro pedido entrar, então só um consegue usar o token.
   */
  async consumir(
    tokenHash: string,
    agora: string,
  ): Promise<TokenRedefinicao | null> {
    if (this.emUso.has(tokenHash)) return null;
    this.emUso.add(tokenHash);
    try {
      const token = await this.buscarPorHash(tokenHash);
      if (!token || token.usadoEm || token.expiraEm <= agora) return null;
      return await this.atualizar(token.id, { usadoEm: agora });
    } finally {
      this.emUso.delete(tokenHash);
    }
  }

  /** Invalida os outros links pendentes do usuário (depois que a senha foi trocada). */
  async invalidarDoUsuario(usuarioId: string, agora: string): Promise<void> {
    const pendentes = await this.filtrar(
      (t) => t.usuarioId === usuarioId && !t.usadoEm,
    );
    for (const t of pendentes) await this.atualizar(t.id, { usadoEm: agora });
  }
}
