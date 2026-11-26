import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CategoriaInsumo, UnidadeMedida } from '../../common/enums/index.js';

/** Tira os espaços das pontas dos textos (outros tipos passam direto e caem na validação). */
export const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** O banco guarda quantidades em NUMERIC(12, 3): até 999.999.999,999. */
export const QUANTIDADE_MAXIMA = 999_999_999;

/**
 * Corpo do POST /insumos. O saldo NÃO é um campo do insumo: `quantidadeInicial` só serve para
 * registrar a primeira entrada (ajuste_positivo). Depois disso o saldo só muda por movimentação.
 */
export class CriarInsumoDto {
  @ApiProperty({
    example: 'Filamento PETG 1 kg (preto)',
    maxLength: 120,
    description: 'Único, sem diferenciar maiúsculas nem espaços nas pontas.',
  })
  @Transform(aparar)
  @IsString({ message: 'nome deve ser um texto.' })
  @IsNotEmpty({ message: 'Informe o nome do insumo.' })
  @MaxLength(120, { message: 'nome deve ter no máximo 120 caracteres.' })
  nome!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(aparar)
  @IsString({ message: 'descricao deve ser um texto.' })
  @MaxLength(500, { message: 'descricao deve ter no máximo 500 caracteres.' })
  descricao?: string;

  @ApiProperty({ enum: CategoriaInsumo })
  @IsEnum(CategoriaInsumo, { message: 'categoria inválida.' })
  categoria!: CategoriaInsumo;

  @ApiProperty({ enum: UnidadeMedida })
  @IsEnum(UnidadeMedida, { message: 'unidadeMedida inválida.' })
  unidadeMedida!: UnidadeMedida;

  @ApiProperty({
    example: 3,
    minimum: 0,
    description:
      'Quando o saldo chega a este valor (ou menos), o item entra na lista "a repor".',
  })
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 },
    {
      message:
        'estoqueMinimo deve ser um número com no máximo 3 casas decimais.',
    },
  )
  @Min(0, { message: 'estoqueMinimo não pode ser negativo.' })
  @Max(QUANTIDADE_MAXIMA, { message: 'estoqueMinimo é grande demais.' })
  estoqueMinimo!: number;

  @ApiPropertyOptional({
    example: 5,
    minimum: 0,
    default: 0,
    description:
      'Saldo inicial. Maior que zero vira uma entrada "ajuste_positivo" (nunca um saldo gravado direto).',
  })
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 },
    {
      message:
        'quantidadeInicial deve ser um número com no máximo 3 casas decimais.',
    },
  )
  @Min(0, { message: 'quantidadeInicial não pode ser negativa.' })
  @Max(QUANTIDADE_MAXIMA, { message: 'quantidadeInicial é grande demais.' })
  quantidadeInicial?: number;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(aparar)
  @IsString({ message: 'fornecedor deve ser um texto.' })
  @MaxLength(120, { message: 'fornecedor deve ter no máximo 120 caracteres.' })
  fornecedor?: string;

  @ApiPropertyOptional({
    example: '2027-03-31',
    description: 'AAAA-MM-DD. Deixe em branco se o item não vence.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'validade deve estar no formato AAAA-MM-DD.',
  })
  validade?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(aparar)
  @IsString({ message: 'localizacao deve ser um texto.' })
  @MaxLength(120, {
    message: 'localizacao deve ter no máximo 120 caracteres.',
  })
  localizacao?: string;
}
