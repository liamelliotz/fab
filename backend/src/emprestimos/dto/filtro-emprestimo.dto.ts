import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StatusEmprestimo } from '../../common/enums/index.js';

export class FiltroEmprestimoDto {
  @IsOptional() @IsEnum(StatusEmprestimo) status?: StatusEmprestimo;
  @IsOptional() @IsString() solicitanteId?: string;
  @IsOptional() @IsString() responsavelId?: string;
  @IsOptional() @IsString() busca?: string; // protocolo ou nome
}