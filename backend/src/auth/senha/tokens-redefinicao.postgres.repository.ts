import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, type Repository } from 'typeorm';
import type { ContratoDoRepositorio } from '../../common/database/index.js';
import type { NovoRegistro } from '../../common/repository/index.js';
import { TokenRedefinicaoOrm } from '../orm/token-redefinicao.orm-entity.js';
import type { TokenRedefinicao } from './token-redefinicao.entity.js';
import type { TokensRedefinicaoRepository } from './tokens-redefinicao.repository.js';

/** Tokens de redefinição de senha no PostgreSQL. Mesmos métodos da versão em memória. */
@Injectable()
export class TokensRedefinicaoPostgresRepository implements ContratoDoRepositorio<TokensRedefinicaoRepository> {
  constructor(
    @InjectRepository(TokenRedefinicaoOrm)
    private readonly tabela: Repository<TokenRedefinicaoOrm>,
  ) {}

  async criar(
    dados: NovoRegistro<TokenRedefinicao>,
  ): Promise<TokenRedefinicao> {
    const linha = this.tabela.create({
      id: dados.id ?? randomUUID(),
      usuarioId: dados.usuarioId,
      tokenHash: dados.tokenHash,
      expiraEm: new Date(dados.expiraEm),
      usadoEm: dados.usadoEm ? new Date(dados.usadoEm) : null,
      criadoEm: new Date(dados.criadoEm),
    });
    return paraEntidade(await this.tabela.save(linha));
  }

  async buscarPorId(id: string): Promise<TokenRedefinicao | null> {
    const linha = await this.tabela.findOneBy({ id });
    return linha ? paraEntidade(linha) : null;
  }

  async listar(): Promise<TokenRedefinicao[]> {
    return (await this.tabela.find({ order: { criadoEm: 'ASC' } })).map(
      paraEntidade,
    );
  }

  async atualizar(
    id: string,
    dados: Partial<Omit<TokenRedefinicao, 'id'>>,
  ): Promise<TokenRedefinicao | null> {
    if (dados.usadoEm)
      await this.tabela.update({ id }, { usadoEm: new Date(dados.usadoEm) });
    return this.buscarPorId(id);
  }

  async remover(id: string): Promise<boolean> {
    return ((await this.tabela.delete({ id })).affected ?? 0) > 0;
  }

  async buscarPorHash(tokenHash: string): Promise<TokenRedefinicao | null> {
    const linha = await this.tabela.findOneBy({ tokenHash });
    return linha ? paraEntidade(linha) : null;
  }

  /**
   * Usa o token num ÚNICO comando: só marca se ainda não foi usado e não venceu.
   * Dois pedidos ao mesmo tempo: o banco deixa só um passar (o outro recebe 0 linhas).
   */
  async consumir(
    tokenHash: string,
    agora: string,
  ): Promise<TokenRedefinicao | null> {
    const linhas: TokenRedefinicaoOrm[] = (
      await this.tabela
        .createQueryBuilder()
        .update(TokenRedefinicaoOrm)
        .set({ usadoEm: new Date(agora) })
        .where('token_hash = :tokenHash', { tokenHash })
        .andWhere('usado_em IS NULL')
        .andWhere('expira_em > :agora', { agora: new Date(agora) })
        .returning('*')
        .execute()
    ).raw;
    return linhas.length ? this.buscarPorHash(tokenHash) : null;
  }

  async invalidarDoUsuario(usuarioId: string, agora: string): Promise<void> {
    await this.tabela.update(
      { usuarioId, usadoEm: IsNull() },
      { usadoEm: new Date(agora) },
    );
  }
}

function paraEntidade(linha: TokenRedefinicaoOrm): TokenRedefinicao {
  return {
    id: linha.id,
    usuarioId: linha.usuarioId,
    tokenHash: linha.tokenHash,
    expiraEm: linha.expiraEm.toISOString(),
    usadoEm: linha.usadoEm?.toISOString(),
    criadoEm: linha.criadoEm.toISOString(),
  };
}
