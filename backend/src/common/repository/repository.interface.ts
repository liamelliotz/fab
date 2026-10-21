/**
 * Contrato de acesso a dados. Os services conversam SEMPRE com esta interface,
 * nunca com o armazenamento em si. Hoje a implementação é em memória (InMemoryRepository);
 * quando o PostgreSQL entrar, troca-se só a implementação e as regras de negócio não mudam.
 *
 * Os métodos são assíncronos (Promise) de propósito: com o banco real eles serão assíncronos
 * de qualquer jeito, então o código dos services já nasce pronto para isso (use `await`).
 */
export interface IRepository<T extends { id: string }> {
  /** Guarda um registro novo. Sem `id`, gera um id em texto (UUID). Devolve o registro salvo. */
  criar(dados: NovoRegistro<T>): Promise<T>;

  /** Busca pelo id. Devolve `null` se não existir (o service decide lançar o 404). */
  buscarPorId(id: string): Promise<T | null>;

  /** Devolve todos os registros, na ordem em que foram criados. Filtros e paginação ficam no service. */
  listar(): Promise<T[]>;

  /** Altera só os campos informados (o `id` nunca muda). Devolve o registro atualizado ou `null` se não existir. */
  atualizar(id: string, dados: Partial<Omit<T, 'id'>>): Promise<T | null>;

  /** Apaga o registro. Devolve `true` se existia e `false` se não existia. */
  remover(id: string): Promise<boolean>;
}

/** Dados de um registro novo: tudo da entidade, com o `id` opcional (os seeds informam o próprio id fixo). */
export type NovoRegistro<T extends { id: string }> = Omit<T, 'id'> & {
  id?: string;
};
