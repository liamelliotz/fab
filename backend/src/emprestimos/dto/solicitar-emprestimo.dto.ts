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
  @IsString() @IsNotEmpty() equipamentoId!: string;
  @IsInt() @Min(1) quantidade!: number;
  @IsOptional() @IsString() observacoes?: string;
}

export class SolicitarEmprestimoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: ItemSolicitadoDto) => item.equipamentoId, {
    message: 'Equipamento repetido na lista de itens',
  })
  @ValidateNested({ each: true })
  @Type(() => ItemSolicitadoDto)
  itens!: ItemSolicitadoDto[];

  @IsString() @Length(10, 500) justificativa!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dataPrevistaRetirada deve estar no formato AAAA-MM-DD',
  })
  dataPrevistaRetirada!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dataPrevistaDevolucao deve estar no formato AAAA-MM-DD',
  })
  dataPrevistaDevolucao!: string;
}
