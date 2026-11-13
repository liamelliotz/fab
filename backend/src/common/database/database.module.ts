import { Logger, Module, type DynamicModule, type Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { ErroDeConfiguracao } from '../erro-de-configuracao.js';
import { mensagemDeFalhaDeConexao, urlSemSenha } from './erro-de-conexao.js';
import { lerModoPersistencia, type ModoPersistencia } from './persistencia.js';

/** Quanto esperar o banco responder antes de desistir (ms). */
const TEMPO_LIMITE_DE_CONEXAO = 5_000;

/**
 * Conexão com o PostgreSQL via TypeORM. Registrado UMA vez, no AppModule.
 *
 * - PERSISTENCIA=memoria (padrão): não conecta em nada. A API sobe sem banco.
 * - PERSISTENCIA=postgres: conecta na DATABASE_URL ao subir. Se o banco não responder,
 *   a API NÃO sobe e o erro sai em português.
 *
 * As tabelas NUNCA são criadas pelo TypeORM (`synchronize: false`): quem cria e altera é
 * `npm run db:migrate`, com os arquivos de database/migrations. As entidades de cada módulo
 * entram sozinhas (`autoLoadEntities`) quando o módulo chama `TypeOrmModule.forFeature([...])`.
 */
@Module({})
export class DatabaseModule {
  static forRoot(
    modo: ModoPersistencia = lerModoPersistencia(),
  ): DynamicModule {
    if (modo !== 'postgres') {
      return { module: DatabaseModule };
    }

    const logger = new Logger('Banco');
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService): TypeOrmModuleOptions => {
            const url = config.get<string>('DATABASE_URL')?.trim();
            if (!url) {
              throw new ErroDeConfiguracao(
                'PERSISTENCIA=postgres, mas a DATABASE_URL não está no backend/.env. ' +
                  'Copie a linha do .env.example ou use PERSISTENCIA=memoria.',
              );
            }
            return {
              type: 'postgres',
              url,
              synchronize: false, // nunca: as tabelas vêm das migrations em SQL
              migrationsRun: false,
              autoLoadEntities: true,
              // Sem novas tentativas: banco fora do ar = erro claro na hora.
              retryAttempts: 0,
              extra: { connectionTimeoutMillis: TEMPO_LIMITE_DE_CONEXAO },
            };
          },
          // Abre a conexão nós mesmos, para traduzir o erro e registrar no log.
          dataSourceFactory: async (opcoes?: DataSourceOptions) => {
            const dataSource = new DataSource(opcoes!);
            try {
              await dataSource.initialize();
            } catch (erro) {
              throw new ErroDeConfiguracao(mensagemDeFalhaDeConexao(erro), {
                cause: erro,
              });
            }
            const url = (opcoes as { url?: string } | undefined)?.url ?? '';
            logger.log(`Conectado ao PostgreSQL: ${urlSemSenha(url)}`);
            return dataSource;
          },
        }),
      ],
    };
  }
}

/**
 * Registra as entidades (tabelas) de um módulo, SÓ no modo postgres.
 * Em memória devolve uma lista vazia: o `TypeOrmModule.forFeature` exige a conexão e
 * quebraria a API sem banco.
 *
 *   @Module({ imports: [...entidadesDoBanco([UsuarioOrm, UsuarioHabilitacaoOrm])], ... })
 */
export function entidadesDoBanco(
  entidades: Type[],
  modo: ModoPersistencia = lerModoPersistencia(),
): DynamicModule[] {
  return modo === 'postgres' ? [TypeOrmModule.forFeature(entidades)] : [];
}
