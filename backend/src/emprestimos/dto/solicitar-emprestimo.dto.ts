import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsInt, IsNotEmpty,
  IsOptional, IsString, Min, ValidateNested,
} from 'class-validator';

export class ItemSolicitadoDto {
  @IsString() @IsNotEmpty() equipamentoId!: string;
  @IsInt() @Min(1) quantidade!: number;
  @IsOptional() @IsString() observacoes?: string;
}

export class SolicitarEmprestimoDto {
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => ItemSolicitadoDto)
  itens!: ItemSolicitadoDto[];

  @IsString() @IsNotEmpty() justificativa!: string;
  @IsDateString() dataPrevistaRetirada!: string;
  @IsDateString() dataPrevistaDevolucao!: string;
}