import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/** Corpo do `PATCH /equipamentos/:id/ativo` (só admin). */
export class DefinirAtivoDto {
  @ApiProperty({
    description:
      '`false` inativa o equipamento (só com todas as unidades no estoque); `true` o reativa.',
  })
  @IsBoolean({ message: 'ativo deve ser true ou false.' })
  ativo: boolean;
}