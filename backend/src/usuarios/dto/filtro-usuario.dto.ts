import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacaoDto } from '../../common/dto/index.js';
import { Perfil, StatusUsuario } from '../../common/enums/index.js';

/** Query string do GET /usuarios (admin). */
export class FiltroUsuarioDto extends PaginacaoDto {
  @ApiPropertyOptional({
    description: 'Trecho do nome, e-mail, matrícula ou departamento.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'busca deve ter no máximo 80 caracteres.' })
  busca?: string;

  @ApiPropertyOptional({ enum: Perfil })
  @IsOptional()
  @IsEnum(Perfil, { message: 'perfil inválido.' })
  perfil?: Perfil;

  @ApiPropertyOptional({ enum: StatusUsuario })
  @IsOptional()
  @IsEnum(StatusUsuario, { message: 'status inválido.' })
  status?: StatusUsuario;
}

/** Query string do GET /usuarios/resumo (qualquer logado). */
export class FiltroResumoUsuarioDto {
  @ApiPropertyOptional({ description: 'Trecho do nome ou do departamento.' })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'busca deve ter no máximo 80 caracteres.' })
  busca?: string;
}
