import { ApiProperty, PartialType, PickType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEnum, IsString } from 'class-validator';
import { StatusUsuario } from '../../common/enums/index.js';
import { CriarUsuarioDto } from './criar-usuario.dto.js';

/**
 * Corpo do PATCH /usuarios/:id. Todos os campos são opcionais e reaproveitam as mesmas
 * validações do cadastro. E-mail, CPF e senha não mudam por aqui.
 */
export class AtualizarUsuarioDto extends PartialType(
  PickType(CriarUsuarioDto, [
    'nome',
    'telefone',
    'matricula',
    'departamento',
    'perfil',
  ] as const),
) {}

/** Corpo do PATCH /usuarios/:id/status. */
export class AlterarStatusDto {
  @ApiProperty({ enum: StatusUsuario, example: StatusUsuario.Bloqueado })
  @IsEnum(StatusUsuario, {
    message: 'status inválido. Use "ativo", "inativo" ou "bloqueado".',
  })
  status!: StatusUsuario;
}

/** Corpo do PUT /usuarios/:id/habilitacoes: a lista nova SUBSTITUI a anterior. */
export class HabilitacoesDto {
  @ApiProperty({
    type: [String],
    example: ['eqp-impressora-3d'],
    description:
      'Ids de equipamentos que exigem treinamento. Lista vazia remove todas.',
  })
  @IsArray({
    message: 'equipamentoIds deve ser uma lista de ids de equipamentos.',
  })
  @ArrayMaxSize(50, { message: 'equipamentoIds aceita no máximo 50 itens.' })
  @IsString({
    each: true,
    message: 'Cada habilitação deve ser um id de equipamento.',
  })
  equipamentoIds!: string[];
}
