import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class ItemSolicitadoDto {
  @ApiProperty({ example: 'eqp-projetor', description: 'Id do equipamento.' })
  @IsString({ message: 'equipamentoId deve ser um texto.' })
  @IsNotEmpty({ message: 'Informe o equipamentoId de cada item.' })
  equipamentoId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt({ message: 'A quantidade deve ser um número inteiro.' })
  @Min(1, { message: 'A quantidade deve ser maior que 0.' })
  quantidade!: number;

  @ApiPropertyOptional({ example: 'Com o cabo HDMI.' })
  @IsOptional()
  @IsString({ message: 'observacoes deve ser um texto.' })
  observacoes?: string;
}

export class SolicitarEmprestimoDto {
  @ApiProperty({
    type: [ItemSolicitadoDto],
    description: 'Ao menos 1 item, sem equipamento repetido.',
  })
  @IsArray({ message: 'itens deve ser uma lista.' })
  @ArrayMinSize(1, { message: 'Informe ao menos 1 item.' })
  @ArrayUnique((item: ItemSolicitadoDto) => item.equipamentoId, {
    message: 'Equipamento repetido na lista de itens',
  })
  @ValidateNested({ each: true })
  @Type(() => ItemSolicitadoDto)
  itens!: ItemSolicitadoDto[];

  @ApiProperty({
    example: 'Aula prática de apresentação de projetos com a turma do 2º ano.',
    minLength: 10,
    maxLength: 500,
  })
  @IsString({ message: 'A justificativa deve ser um texto.' })
  @Length(10, 500, {
    message: 'A justificativa deve ter de 10 a 500 caracteres.',
  })
  justificativa!: string;

  @ApiProperty({
    example: '2026-12-01',
    description: 'AAAA-MM-DD, de hoje em diante.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dataPrevistaRetirada deve estar no formato AAAA-MM-DD',
  })
  dataPrevistaRetirada!: string;

  @ApiProperty({
    example: '2026-12-03',
    description:
      'AAAA-MM-DD. O período não passa do menor prazo máximo dos itens.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dataPrevistaDevolucao deve estar no formato AAAA-MM-DD',
  })
  dataPrevistaDevolucao!: string;
}
