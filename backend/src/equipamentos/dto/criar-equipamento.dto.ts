import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CategoriaEquipamento } from '../../common/enums/index.js';

/** Tira os espaços das pontas dos textos antes de validar. */
export const aparar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Corpo do `POST /equipamentos` (só admin). Igual ao `CriarEquipamentoDTO` do front. */
export class CriarEquipamentoDto {
  @ApiProperty({ example: 'Multímetro Digital Minipa ET-1002' })
  @Transform(aparar)
  @IsString({ message: 'nome deve ser um texto.' })
  @IsNotEmpty({ message: 'nome é obrigatório.' })
  @MaxLength(120, { message: 'nome deve ter no máximo 120 caracteres.' })
  nome: string;

  @ApiProperty({ example: 'Mede tensão, corrente e resistência.' })
  @Transform(aparar)
  @IsString({ message: 'descricao deve ser um texto.' })
  @MaxLength(1000, { message: 'descricao deve ter no máximo 1000 caracteres.' })
  descricao: string;

  @ApiProperty({
    example: 'PAT-0001',
    description:
      'Único no acervo, sem diferenciar maiúsculas nem espaços. Não pode ser alterado depois.',
  })
  @Transform(aparar)
  @IsString({ message: 'codigoPatrimonio deve ser um texto.' })
  @IsNotEmpty({ message: 'codigoPatrimonio é obrigatório.' })
  @MaxLength(50, {
    message: 'codigoPatrimonio deve ter no máximo 50 caracteres.',
  })
  codigoPatrimonio: string;

  @ApiProperty({ enum: CategoriaEquipamento })
  @IsEnum(CategoriaEquipamento, { message: 'categoria inválida.' })
  categoria: CategoriaEquipamento;

  @ApiProperty({ example: 'Bancada 03 - Gaveteiro B' })
  @Transform(aparar)
  @IsString({ message: 'localizacao deve ser um texto.' })
  @IsNotEmpty({ message: 'localizacao é obrigatória.' })
  @MaxLength(120, { message: 'localizacao deve ter no máximo 120 caracteres.' })
  localizacao: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'fotoUrl deve ser um texto.' })
  @MaxLength(2048, { message: 'fotoUrl deve ter no máximo 2048 caracteres.' })
  fotoUrl?: string;

  @ApiProperty()
  @IsBoolean({ message: 'requerTreinamento deve ser true ou false.' })
  requerTreinamento: boolean;

  @ApiProperty({ minimum: 1, maximum: 365, example: 7 })
  @IsInt({ message: 'prazoMaximoDias deve ser um número inteiro.' })
  @Min(1, { message: 'prazoMaximoDias deve ser no mínimo 1.' })
  @Max(365, { message: 'prazoMaximoDias deve ser no máximo 365.' })
  prazoMaximoDias: number;

  @ApiProperty({ minimum: 0, example: 5 })
  @IsInt({ message: 'quantidadeTotal deve ser um número inteiro.' })
  @Min(0, { message: 'quantidadeTotal deve ser no mínimo 0.' })
  quantidadeTotal: number;
}