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
import { CategoriaInsumo } from '../../common/enums/index.js';

/** A query string chega como texto: "true" e "1" viram true; "false" e "0" viram false. */
const paraBooleano = ({ value }: { value: unknown }) =>
  value === 'true' || value === '1' || value === true
    ? true
    : value === 'false' || value === '0' || value === false
      ? false
      : value;

/** Query string do GET /insumos, mais a paginação. */
export class FiltroInsumoDto extends PaginacaoDto {
  @ApiPropertyOptional({ description: 'Trecho do nome ou do fornecedor.' })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'busca deve ter no máximo 80 caracteres.' })
  busca?: string;

  @ApiPropertyOptional({ enum: CategoriaInsumo })
  @IsOptional()
  @IsEnum(CategoriaInsumo, { message: 'categoria inválida.' })
  categoria?: CategoriaInsumo;

  @ApiPropertyOptional({
    description:
      'true = só os itens que atingiram o estoque mínimo (quantidadeAtual <= estoqueMinimo).',
    default: false,
  })
  @IsOptional()
  @Transform(paraBooleano)
  @IsBoolean({ message: 'apenasARepor deve ser true ou false.' })
  apenasARepor?: boolean;

  @ApiPropertyOptional({
    description: 'true = inclui os insumos desativados.',
    default: false,
  })
  @IsOptional()
  @Transform(paraBooleano)
  @IsBoolean({ message: 'incluirInativos deve ser true ou false.' })
  incluirInativos?: boolean;
}
