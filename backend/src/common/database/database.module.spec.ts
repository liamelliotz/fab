import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Entity, PrimaryColumn } from 'typeorm';
import { DatabaseModule, entidadesDoBanco } from './database.module.js';

@Entity('exemplo')
class ExemploOrm {
  @PrimaryColumn({ type: 'text' })
  id!: string;
}

/** Monta só a configuração e o banco, com a DATABASE_URL que o teste quiser. */
const montar = (databaseUrl?: string) =>
  Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        load: [() => ({ DATABASE_URL: databaseUrl })],
      }),
      DatabaseModule.forRoot('postgres'),
    ],
  }).compile();

describe('DatabaseModule', () => {
  it('em memória, não importa nada (não tenta conectar)', () => {
    expect(DatabaseModule.forRoot('memoria').imports).toBeUndefined();
  });

  it('no postgres com o banco fora do ar, falha rápido e em português', async () => {
    // Porta 1: ninguém escuta, a conexão é recusada na hora.
    const inicio = Date.now();
    await expect(
      montar('postgresql://fab:fab_dev@127.0.0.1:1/fab'),
    ).rejects.toThrow(
      /^Não foi possível conectar ao PostgreSQL: conexão recusada.*\[ECONNREFUSED\]/,
    );
    expect(Date.now() - inicio).toBeLessThan(5_000); // sem novas tentativas
  });

  it('entidadesDoBanco só registra tabelas no modo postgres', async () => {
    expect(entidadesDoBanco([ExemploOrm], 'memoria')).toEqual([]);
    const [modulo] = entidadesDoBanco([ExemploOrm], 'postgres');
    expect(modulo.module.name).toBe('TypeOrmModule');
    // Em memória, um módulo com entidades monta sem banco nenhum.
    await expect(
      Test.createTestingModule({
        imports: entidadesDoBanco([ExemploOrm], 'memoria'),
      }).compile(),
    ).resolves.toBeDefined();
  });

  it('no postgres sem DATABASE_URL, explica o que falta', async () => {
    await expect(montar(undefined)).rejects.toThrow(
      'PERSISTENCIA=postgres, mas a DATABASE_URL não está no backend/.env',
    );
  });
});
