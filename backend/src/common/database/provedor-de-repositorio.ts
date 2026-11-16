import { Logger, type Provider, type Type } from '@nestjs/common';
import { lerModoPersistencia, type ModoPersistencia } from './persistencia.js';

const avisados = new Set<string>();

/**
 * Os métodos públicos que a versão do banco precisa ter: os mesmos da versão em memória,
 * menos os que só existem nela (carregar o seed e zerar os dados nos testes).
 *
 *   export class UsuariosPostgresRepository
 *     implements ContratoDoRepositorio<UsuariosRepository> { ... }
 *
 * Com o `implements`, o TypeScript avisa na hora se faltar um método ou se a assinatura mudar.
 */
export type ContratoDoRepositorio<T> = Omit<
  Pick<T, keyof T>,
  'onModuleInit' | 'redefinir' | 'contar'
>;

/**
 * Escolhe a implementação de um repositório conforme PERSISTENCIA, mantendo o MESMO token
 * de injeção. Assim os services não mudam nada: eles continuam pedindo, por exemplo,
 * `@Inject(UsuariosRepository)` e recebem a versão em memória ou a do PostgreSQL.
 *
 * Uso, no módulo:
 *
 *   providers: [
 *     UsuariosService,
 *     provedorDeRepositorio(UsuariosRepository, UsuariosPostgresRepository),
 *   ],
 *
 * - `emMemoria` é o repositório atual (e também o token).
 * - `noPostgres` precisa ter os mesmos métodos públicos. Enquanto ele não existir, deixe o
 *   segundo argumento de fora: com PERSISTENCIA=postgres o módulo segue em memória e o log avisa.
 */
export function provedorDeRepositorio<T>(
  emMemoria: Type<T>,
  noPostgres?: Type<ContratoDoRepositorio<T>>,
  modo: ModoPersistencia = lerModoPersistencia(),
): Provider {
  if (modo === 'postgres' && !noPostgres && !avisados.has(emMemoria.name)) {
    avisados.add(emMemoria.name);
    new Logger('Banco').warn(
      `${emMemoria.name} ainda não tem versão no PostgreSQL: continua em memória.`,
    );
  }
  return {
    provide: emMemoria,
    useClass: modo === 'postgres' && noPostgres ? noPostgres : emMemoria,
  };
}
