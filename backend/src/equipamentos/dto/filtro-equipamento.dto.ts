import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginacaoDto } from '../../common/dto/index.js';
import {
  CategoriaEquipamento,
  StatusEquipamento,
} from '../../common/enums/index.js';

/** Query string do GET /equipamentos. Igual ao FiltroEquipamentoDTO do front, mais a paginação. */
export class FiltroEquipamentoDto extends PaginacaoDto {
  @ApiPropertyOptional({ description: 'Trecho do nome ou do patrimônio.' })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'busca deve ter no máximo 80 caracteres.' })
  busca?: string;

  @ApiPropertyOptional({ enum: CategoriaEquipamento })
  @IsOptional()
  @IsEnum(CategoriaEquipamento, { message: 'categoria inválida.' })
  categoria?: CategoriaEquipamento;

  @ApiPropertyOptional({ enum: StatusEquipamento })
  @IsOptional()
  @IsEnum(StatusEquipamento, { message: 'status inválido.' })
  status?: StatusEquipamento;

  @ApiPropertyOptional({
    description: 'true = só itens disponíveis e com saldo.',
    default: false,
  })
  @IsOptional()
  // A query string chega como texto: "true" e "1" viram true; "false" e "0" viram false.
  @Transform(({ value }) =>
    value === 'true' || value === '1' || value === true
      ? true
      : value === 'false' || value === '0' || value === false
        ? false
        : value,
  )
  @IsBoolean({ message: 'apenasDisponiveis deve ser true ou false.' })
  apenasDisponiveis?: boolean;
}
