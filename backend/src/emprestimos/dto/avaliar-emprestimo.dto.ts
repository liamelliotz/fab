import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class AvaliarEmprestimoDto {
  @ApiProperty({ example: true, description: 'true aprova; false reprova.' })
  @IsBoolean({ message: 'aprovado deve ser true ou false.' })
  aprovado!: boolean;

  /** Obrigatório quando reprova: de 5 a 300 caracteres. */
  @ApiPropertyOptional({
    example: 'Equipamento reservado para a feira de ciências.',
    description: 'Obrigatório ao reprovar (5 a 300 caracteres).',
  })
  @ValidateIf((o: AvaliarEmprestimoDto) => !o.aprovado)
  @IsString({ message: 'O motivo deve ser um texto.' })
  @IsNotEmpty({ message: 'Informe o motivo da reprovação.' })
  @MinLength(5, { message: 'O motivo deve ter de 5 a 300 caracteres.' })
  @MaxLength(300, { message: 'O motivo deve ter de 5 a 300 caracteres.' })
  motivo?: string;
}
