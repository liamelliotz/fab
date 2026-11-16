import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Linha da tabela de ligação `usuario_habilitacoes`: um usuário habilitado a usar um
 * equipamento que exige treinamento. Uma linha por par (usuário, equipamento).
 */
@Entity('usuario_habilitacoes')
export class UsuarioHabilitacaoOrm {
  @PrimaryColumn({ name: 'usuario_id', type: 'text' })
  usuarioId!: string;

  @PrimaryColumn({ name: 'equipamento_id', type: 'text' })
  equipamentoId!: string;

  /** Quem concedeu (admin). Fica vazio enquanto a rota de habilitações não existir. */
  @Column({ name: 'concedida_por_id', type: 'text', nullable: true })
  concedidaPorId!: string | null;

  /** Preenchida pelo banco (DEFAULT now()). */
  @Column({ name: 'concedida_em', type: 'timestamptz', default: () => 'now()' })
  concedidaEm!: Date;
}
