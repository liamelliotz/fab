import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { Perfil, StatusUsuario } from '../../common/enums/index.js';

/**
 * Linha da tabela `usuarios` (database/migrations/001_criar_tabelas.sql).
 * Só descreve a tabela: quem cria e altera colunas é a migration, nunca esta classe.
 * As habilitações ficam em outra tabela (`usuario-habilitacao.orm-entity.ts`).
 */
@Entity('usuarios')
export class UsuarioOrm {
  @PrimaryColumn({ name: 'id', type: 'text' })
  id!: string;

  @Column({ name: 'nome', type: 'varchar', length: 120 })
  nome!: string;

  @Column({ name: 'email', type: 'varchar', length: 120 })
  email!: string;

  @Column({ name: 'senha_hash', type: 'text' })
  senhaHash!: string;

  @Column({ name: 'cpf', type: 'char', length: 11 })
  cpf!: string;

  @Column({ name: 'telefone', type: 'varchar', length: 11, nullable: true })
  telefone!: string | null;

  @Column({ name: 'matricula', type: 'varchar', length: 30, nullable: true })
  matricula!: string | null;

  @Column({ name: 'departamento', type: 'varchar', length: 80, nullable: true })
  departamento!: string | null;

  @Column({ name: 'perfil', type: 'text' })
  perfil!: Perfil;

  @Column({ name: 'status', type: 'text' })
  status!: StatusUsuario;

  @Column({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @Column({ name: 'atualizado_em', type: 'timestamptz', nullable: true })
  atualizadoEm!: Date | null;
}
