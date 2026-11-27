import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/** Corpo do PATCH /insumos/:id/ativo. */
export class AlterarAtivoInsumoDto {
  @ApiProperty({
    example: false,
    description:
      'false = desativa (some das listas comuns e não aceita movimentação); true = reativa.',
  })
  @IsBoolean({ message: 'ativo deve ser true ou false.' })
  ativo!: boolean;
}
