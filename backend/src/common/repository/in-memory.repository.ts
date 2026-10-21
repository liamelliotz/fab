/**
 * REPOSITÓRIO EM MEMÓRIA + PADRÃO DE SEED
 * ======================================================================================
 * Base de todos os repositórios do backend nesta etapa (usuários, equipamentos, empréstimos,
 * manutenções). Os dados vivem só na memória do processo: ao reiniciar a API, tudo é recriado
 * a partir do seed.
 *
 * COMO CRIAR O REPOSITÓRIO DE UM MÓDULO
 *
 *   @Injectable()
 *   export class EquipamentosRepository extends InMemoryRepository<Equipamento> {
 *     // 1) Informe os dados iniciais (seed). Este método roda sozinho no onModuleInit.
 *     protected override dadosIniciais(): Equipamento[] {
 *       return EQUIPAMENTOS_SEED;
 *     }
 *
 *     // 2) Consultas específicas do módulo usam os auxiliares `encontrar` e `filtrar`.
 *     buscarPorPatrimonio(patrimonio: string): Promise<Equipamento | null> {
 *       const alvo = patrimonio.trim().toLowerCase();
 *       return this.encontrar((e) => e.patrimonio.trim().toLowerCase() === alvo);
 *     }
 *   }
 *
 * REGRAS DO SEED (existem para um módulo nunca depender do merge de outro)
 *   - Cada módulo tem o PRÓPRIO arquivo `<modulo>.seed.ts` e só ele carrega os seus dados.
 *   - O seed NÃO importa nem consulta outro módulo. Para apontar para registros de outros módulos
 *     (ex.: o solicitante de um empréstimo), use os ids fixos de `common/seed/ids.ts`.
 *   - Todo item do seed traz o seu `id` (vindo de ids.ts), para os dados serem iguais a cada reinício.
 *   - Datas do seed: prefira valores relativos a hoje (ex.: hoje + 7 dias), senão os status
 *     "atrasado" e "no prazo" ficam errados com o passar do tempo.
 *
 * OUTROS PONTOS
 *   - O repositório devolve CÓPIAS dos registros, como um banco de verdade faria. Alterar o objeto
 *     recebido não muda o que está guardado: é preciso chamar `atualizar()`.
 *   - Não lance exceções HTTP aqui (NotFoundException etc.): isso é papel do service.
 * ======================================================================================
 */
import { Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { IRepository, NovoRegistro } from './repository.interface.js';

export abstract class InMemoryRepository<T extends { id: string }>
  implements IRepository<T>, OnModuleInit
{
  protected readonly logger = new Logger(this.constructor.name);
  private readonly registros = new Map<string, T>();

  /** O Nest chama este método ao iniciar o módulo: é aqui que o seed é carregado. */
  async onModuleInit(): Promise<void> {
    await this.semear();
  }

  /**
   * Dados iniciais do módulo. Sobrescreva nos repositórios que têm seed.
   * Pode ser assíncrono (por exemplo, para gerar o hash das senhas dos usuários).
   */
  protected dadosIniciais(): T[] | Promise<T[]> {
    return [];
  }

  async criar(dados: NovoRegistro<T>): Promise<T> {
    const id = dados.id ?? randomUUID();
    if (this.registros.has(id)) {
      throw new Error(
        `${this.constructor.name}: já existe um registro com o id "${id}"`,
      );
    }
    const registro = { ...dados, id } as T;
    this.registros.set(id, structuredClone(registro));
    return structuredClone(registro);
  }

  async buscarPorId(id: string): Promise<T | null> {
    const registro = this.registros.get(id);
    return registro ? structuredClone(registro) : null;
  }

  async listar(): Promise<T[]> {
    return [...this.registros.values()].map((registro) =>
      structuredClone(registro),
    );
  }

  async atualizar(
    id: string,
    dados: Partial<Omit<T, 'id'>>,
  ): Promise<T | null> {
    const atual = this.registros.get(id);
    if (!atual) {
      return null;
    }
    // Campos `undefined` são ignorados (não apagam o valor guardado) e o id nunca muda.
    const alteracoes = Object.fromEntries(
      Object.entries(dados).filter(
        ([chave, valor]) => valor !== undefined && chave !== 'id',
      ),
    );
    const atualizado = { ...atual, ...alteracoes, id } as T;
    this.registros.set(id, structuredClone(atualizado));
    return structuredClone(atualizado);
  }

  async remover(id: string): Promise<boolean> {
    return this.registros.delete(id);
  }

  /** Quantidade de registros guardados. */
  async contar(): Promise<number> {
    return this.registros.size;
  }

  /** Primeiro registro que atende ao critério, ou `null`. Use nas consultas do módulo (ex.: buscarPorEmail). */
  protected async encontrar(
    criterio: (registro: T) => boolean,
  ): Promise<T | null> {
    for (const registro of this.registros.values()) {
      if (criterio(registro)) {
        return structuredClone(registro);
      }
    }
    return null;
  }

  /** Todos os registros que atendem ao critério. */
  protected async filtrar(criterio: (registro: T) => boolean): Promise<T[]> {
    return [...this.registros.values()]
      .filter((registro) => criterio(registro))
      .map((registro) => structuredClone(registro));
  }

  /** Apaga tudo e recarrega o seed. Útil nos testes para voltar ao estado inicial. */
  async redefinir(): Promise<void> {
    this.registros.clear();
    await this.semear();
  }

  private async semear(): Promise<void> {
    const dados = await this.dadosIniciais();
    for (const item of dados) {
      if (!item.id) {
        throw new Error(
          `${this.constructor.name}: todo item do seed precisa ter "id" (use common/seed/ids.ts)`,
        );
      }
      if (this.registros.has(item.id)) {
        throw new Error(
          `${this.constructor.name}: id repetido no seed: "${item.id}"`,
        );
      }
      this.registros.set(item.id, structuredClone(item));
    }
    if (dados.length > 0) {
      this.logger.log(`${dados.length} registro(s) carregado(s) do seed`);
    }
  }
}
