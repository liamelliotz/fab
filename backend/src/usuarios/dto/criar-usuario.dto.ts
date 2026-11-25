import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Perfil } from '../../common/enums/index.js';
import { IsCpf } from '../validadores/cpf.validator.js';

/** Tira os espaços das pontas (texto vazio vira inválido no @IsNotEmpty). */
const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Corpo do POST /usuarios. Só o admin cria contas (não existe cadastro público). */
export class CriarUsuarioDto {
  @ApiProperty({ example: 'Beatriz Costa' })
  @Transform(aparar)
  @IsString({ message: 'Informe o nome.' })
  @IsNotEmpty({ message: 'Informe o nome.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  nome!: string;

  @ApiProperty({ example: 'beatriz@escola.br' })
  @Transform(aparar)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(120, { message: 'O e-mail deve ter no máximo 120 caracteres.' })
  email!: string;

  @ApiProperty({
    example: '529.982.247-25',
    description: 'Com ou sem pontuação.',
  })
  @Transform(aparar)
  @IsCpf()
  cpf!: string;

  @ApiProperty({ example: 'senha-forte-123', minLength: 8 })
  @IsString({ message: 'Informe a senha.' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  senha!: string;

  @ApiPropertyOptional({
    example: '(96) 99111-0007',
    description: 'Com DDD. A máscara é opcional: só os dígitos são guardados.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\D/g, '') : value,
  )
  @Matches(/^\d{10,11}$/, {
    message: 'O telefone deve ter 10 ou 11 dígitos, com DDD.',
  })
  telefone?: string;

  @ApiPropertyOptional({ example: '2026-0042' })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(30, { message: 'A matrícula deve ter no máximo 30 caracteres.' })
  matricula?: string;

  @ApiPropertyOptional({ example: 'Informática' })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(80, {
    message: 'O departamento deve ter no máximo 80 caracteres.',
  })
  departamento?: string;

  @ApiPropertyOptional({ enum: Perfil, default: Perfil.Usuario })
  @IsOptional()
  @IsEnum(Perfil, { message: 'perfil inválido. Use "admin" ou "usuario".' })
  perfil?: Perfil;

  @ApiPropertyOptional({
    type: [String],
    example: ['eqp-impressora-3d'],
    description: 'Ids de equipamentos que exigem treinamento.',
  })
  @IsOptional()
  @IsArray({
    message: 'habilitacoes deve ser uma lista de ids de equipamentos.',
  })
  @ArrayMaxSize(50, { message: 'habilitacoes aceita no máximo 50 itens.' })
  @IsString({
    each: true,
    message: 'Cada habilitação deve ser um id de equipamento.',
  })
  habilitacoes?: string[];
}
