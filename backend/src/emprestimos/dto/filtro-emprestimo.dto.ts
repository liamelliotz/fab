import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { PaginacaoDto } from '../../common/dto/paginacao.dto.js';
import { StatusEmprestimo } from '../../common/enums/index.js';

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Filtros do GET /emprestimos (admin). Estende a paginação (?pagina=1&itensPorPagina=10). */
export class FiltroEmprestimoDto extends PaginacaoDto {
  @ApiPropertyOptional({
    enum: StatusEmprestimo,
    description: 'Situação exibida do pedido. "atrasado" vale para pedidos com devolução vencida.',
  })
  @IsOptional()
  @IsEnum(StatusEmprestimo, { message: 'status inválido.' })
  status?: StatusEmprestimo;

  @ApiPropertyOptional({ description: 'Id de quem abriu o pedido.' })
  @IsOptional()
  @IsString({ message: 'solicitanteId deve ser um texto.' })
  solicitanteId?: string;

  @ApiPropertyOptional({ description: 'Id de quem está com o material agora.' })
  @IsOptional()
  @IsString({ message: 'responsavelId deve ser um texto.' })
  responsavelId?: string;

  @ApiPropertyOptional({
    description: 'Texto procurado no protocolo ou no nome do solicitante/responsável.',
    example: 'EMP-2026-0037',
  })
  @IsOptional()
  @IsString({ message: 'busca deve ser um texto.' })
  busca?: string;

  @ApiPropertyOptional({
    description: 'Pedidos solicitados a partir desta data (AAAA-MM-DD).',
    example: '2026-11-01',
  })
  @IsOptional()
  @Matches(DATA_ISO, { message: 'dataInicio deve estar no formato AAAA-MM-DD.' })
  dataInicio?: string;

  @ApiPropertyOptional({
    description: 'Pedidos solicitados até esta data (AAAA-MM-DD).',
    example: '2026-11-30',
  })
  @IsOptional()
  @Matches(DATA_ISO, { message: 'dataFim deve estar no formato AAAA-MM-DD.' })
  dataFim?: string;

  @ApiPropertyOptional({
    description: 'Se true, traz só os pedidos atrasados.',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'atrasadosApenas deve ser true ou false.' })
  atrasadosApenas?: boolean;
}