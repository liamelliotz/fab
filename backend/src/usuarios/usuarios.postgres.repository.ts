/**
 * REPOSITÓRIO DE USUÁRIOS NO POSTGRESQL (modelo para B3, C7 e D7)
 * ======================================================================================
 * Mesmos métodos públicos do `UsuariosRepository` (em memória), com os mesmos parâmetros e
 * retornos. O `implements ContratoDoRepositorio<...>` faz o TypeScript conferir isso.
 *
 * Como ler este arquivo:
 *   1. `paraEntidade` e `paraLinha` (no fim) convertem entre a linha do banco e o `Usuario`.
 *   2. Cada método faz a consulta e passa o resultado por essas funções.
 *   3. As habilitações moram em outra tabela: quem grava as duas tabelas usa transação.
 *
 * Erros do banco (e-mail repetido, usuário em uso...) NÃO são tratados aqui: o filtro global
 * transforma em 409 (veja common/database/erro-do-banco.ts).
 * ======================================================================================
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, type EntityManager, type Repository } from 'typeorm';
import type { ContratoDoRepositorio } from '../common/database/index.js';
import type { NovoRegistro } from '../common/repository/index.js';
import type { Usuario } from './entities/usuario.entity.js';
import { UsuarioHabilitacaoOrm } from './orm/usuario-habilitacao.orm-entity.js';
import { UsuarioOrm } from './orm/usuario.orm-entity.js';
import type { UsuariosRepository } from './usuarios.repository.js';
import { normalizarCpf, normalizarEmail } from './usuarios.util.js';

@Injectable()
export class UsuariosPostgresRepository implements ContratoDoRepositorio<UsuariosRepository> {
  constructor(
    @InjectRepository(UsuarioOrm)
    private readonly tabela: Repository<UsuarioOrm>,
  ) {}

  /** Grava o usuário e as habilitações juntos: ou entram os dois, ou nenhum. */
  async criar(dados: NovoRegistro<Usuario>): Promise<Usuario> {
    const id = dados.id ?? randomUUID();
    return this.tabela.manager.transaction(async (m) => {
      await m.insert(UsuarioOrm, paraLinha({ ...dados, id }));
      await gravarHabilitacoes(m, id, dados.habilitacoes);
      return (await carregar(m, id))!;
    });
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    return carregar(this.tabela.manager, id);
  }

  /** Na ordem de criação, como a versão em memória. */
  async listar(): Promise<Usuario[]> {
    const linhas = await this.tabela.find({
      order: { criadoEm: 'ASC', id: 'ASC' },
    });
    return comHabilitacoes(this.tabela.manager, linhas);
  }

  /**
   * Altera só os campos informados (`undefined` não apaga nada) e devolve o usuário
   * atualizado, ou `null` se ele não existir. O `id` nunca muda.
   */
  async atualizar(
    id: string,
    dados: Partial<Omit<Usuario, 'id'>>,
  ): Promise<Usuario | null> {
    return this.tabela.manager.transaction(async (m) => {
      if (!(await m.existsBy(UsuarioOrm, { id }))) return null;

      const { habilitacoes, ...campos } = dados;
      const linha = paraLinha(campos);
      if (Object.keys(linha).length > 0) {
        await m.update(UsuarioOrm, { id }, linha);
      }
      if (habilitacoes) {
        await gravarHabilitacoes(m, id, habilitacoes);
      }
      return carregar(m, id);
    });
  }

  /** As habilitações saem junto (ON DELETE CASCADE). Usuário com empréstimos: 409. */
  async remover(id: string): Promise<boolean> {
    const resultado = await this.tabela.delete({ id });
    return (resultado.affected ?? 0) > 0;
  }

  /** O banco só guarda e-mail em minúsculas, então basta normalizar a busca. */
  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const linha = await this.tabela.findOneBy({
      email: normalizarEmail(email),
    });
    return linha
      ? (await comHabilitacoes(this.tabela.manager, [linha]))[0]
      : null;
  }

  async buscarPorCpf(cpf: string): Promise<Usuario | null> {
    const linha = await this.tabela.findOneBy({ cpf: normalizarCpf(cpf) });
    return linha
      ? (await comHabilitacoes(this.tabela.manager, [linha]))[0]
      : null;
  }
}

// ----------------------------------------------------------------------------------
// Funções de apoio
// ----------------------------------------------------------------------------------

async function carregar(m: EntityManager, id: string): Promise<Usuario | null> {
  const linha = await m.findOneBy(UsuarioOrm, { id });
  return linha ? (await comHabilitacoes(m, [linha]))[0] : null;
}

/** Busca as habilitações de vários usuários numa consulta só e monta cada `Usuario`. */
async function comHabilitacoes(
  m: EntityManager,
  linhas: UsuarioOrm[],
): Promise<Usuario[]> {
  if (linhas.length === 0) return [];
  const habilitacoes = await m.find(UsuarioHabilitacaoOrm, {
    where: { usuarioId: In(linhas.map((l) => l.id)) },
    order: { concedidaEm: 'ASC', equipamentoId: 'ASC' },
  });
  return linhas.map((linha) =>
    paraEntidade(
      linha,
      habilitacoes
        .filter((h) => h.usuarioId === linha.id)
        .map((h) => h.equipamentoId),
    ),
  );
}

/**
 * Deixa na tabela exatamente as habilitações da lista: apaga as que saíram e insere as
 * novas. As que continuam não são tocadas (mantêm a data em que foram concedidas).
 */
async function gravarHabilitacoes(
  m: EntityManager,
  usuarioId: string,
  equipamentoIds: string[] = [],
): Promise<void> {
  const desejadas = [...new Set(equipamentoIds)];
  const atuais = (await m.findBy(UsuarioHabilitacaoOrm, { usuarioId })).map(
    (h) => h.equipamentoId,
  );

  const sairam = atuais.filter((id) => !desejadas.includes(id));
  const novas = desejadas.filter((id) => !atuais.includes(id));

  if (sairam.length > 0) {
    await m.delete(UsuarioHabilitacaoOrm, {
      usuarioId,
      equipamentoId: In(sairam),
    });
  }
  if (novas.length > 0) {
    await m.insert(
      UsuarioHabilitacaoOrm,
      novas.map((equipamentoId) => ({ usuarioId, equipamentoId })),
    );
  }
}

/** Linha do banco -> `Usuario`. Colunas vazias (NULL) viram campos ausentes. */
function paraEntidade(linha: UsuarioOrm, habilitacoes: string[]): Usuario {
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    senhaHash: linha.senhaHash,
    cpf: linha.cpf,
    telefone: linha.telefone ?? undefined,
    matricula: linha.matricula ?? undefined,
    departamento: linha.departamento ?? undefined,
    habilitacoes,
    perfil: linha.perfil,
    status: linha.status,
    criadoEm: linha.criadoEm.toISOString(),
    atualizadoEm: linha.atualizadoEm?.toISOString(),
  };
}

/**
 * `Usuario` (ou parte dele) -> linha do banco. Só leva os campos informados: é o que faz
 * o `atualizar` não apagar o que não foi enviado. As habilitações não entram (outra tabela).
 */
function paraLinha(
  dados: Partial<Omit<Usuario, 'habilitacoes'>>,
): Partial<UsuarioOrm> {
  const linha: Partial<UsuarioOrm> = {
    id: dados.id,
    nome: dados.nome,
    email: dados.email,
    senhaHash: dados.senhaHash,
    cpf: dados.cpf,
    telefone: dados.telefone,
    matricula: dados.matricula,
    departamento: dados.departamento,
    perfil: dados.perfil,
    status: dados.status,
    criadoEm: dados.criadoEm ? new Date(dados.criadoEm) : undefined,
    atualizadoEm: dados.atualizadoEm ? new Date(dados.atualizadoEm) : undefined,
  };
  return Object.fromEntries(
    Object.entries(linha).filter(([, valor]) => valor !== undefined),
  ) as Partial<UsuarioOrm>;
}
