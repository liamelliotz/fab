import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CategoriaInsumo, UnidadeMedida } from '../../common/enums/index.js';
import { aparar, QUANTIDADE_MAXIMA } from './criar-insumo.dto.js';

/**
 * Corpo do PATCH /insumos/:id: só os campos informados mudam.
 *
 * De propósito NÃO existe `quantidadeAtual` (nem `quantidadeInicial`) aqui: o saldo só muda por
 * movimentação. Como o ValidationPipe global usa `whitelist`, quem mandar esses campos tem
 * os valores descartados, e o saldo continua o mesmo. A `validade` também não entra: ela
 * é calculada a partir dos lotes das entradas.
 * Para ativar ou desativar use PATCH /insumos/:id/ativo.
 */
export class AtualizarInsumoDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(aparar)
  @IsString({ message: 'nome deve ser um texto.' })
  @IsNotEmpty({ message: 'nome não pode ficar vazio.' })
  @MaxLength(120, { message: 'nome deve ter no máximo 120 caracteres.' })
  nome?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(aparar)
  @IsString({ message: 'descricao deve ser um texto.' })
  @MaxLength(500, { message: 'descricao deve ter no máximo 500 caracteres.' })
  descricao?: string;

  @ApiPropertyOptional({ enum: CategoriaInsumo })
  @IsOptional()
  @IsEnum(CategoriaInsumo, { message: 'categoria inválida.' })
  categoria?: CategoriaInsumo;

  @ApiPropertyOptional({ enum: UnidadeMedida })
  @IsOptional()
  @IsEnum(UnidadeMedida, { message: 'unidadeMedida inválida.' })
  unidadeMedida?: UnidadeMedida;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 },
    {
      message:
        'estoqueMinimo deve ser um número com no máximo 3 casas decimais.',
    },
  )
  @Min(0, { message: 'estoqueMinimo não pode ser negativo.' })
  @Max(QUANTIDADE_MAXIMA, { message: 'estoqueMinimo é grande demais.' })
  estoqueMinimo?: number;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(aparar)
  @IsString({ message: 'fornecedor deve ser um texto.' })
  @MaxLength(120, { message: 'fornecedor deve ter no máximo 120 caracteres.' })
  fornecedor?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(aparar)
  @IsString({ message: 'localizacao deve ser um texto.' })
  @MaxLength(120, {
    message: 'localizacao deve ter no máximo 120 caracteres.',
  })
  localizacao?: string;
}
