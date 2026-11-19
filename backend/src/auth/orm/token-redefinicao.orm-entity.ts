import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Linha da tabela `tokens_redefinicao_senha` (database/migrations/001_criar_tabelas.sql). */
@Entity('tokens_redefinicao_senha')
export class TokenRedefinicaoOrm {
  @PrimaryColumn({ name: 'id', type: 'text' })
  id!: string;

  @Column({ name: 'usuario_id', type: 'text' })
  usuarioId!: string;

  /** Só o hash SHA-256. O token em texto nunca chega ao banco. */
  @Column({ name: 'token_hash', type: 'text' })
  tokenHash!: string;

  @Column({ name: 'expira_em', type: 'timestamptz' })
  expiraEm!: Date;

  @Column({ name: 'usado_em', type: 'timestamptz', nullable: true })
  usadoEm!: Date | null;

  @Column({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}
