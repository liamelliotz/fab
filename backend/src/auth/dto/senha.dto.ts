import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Corpo do POST /auth/recuperar-senha. */
export class RecuperarSenhaDto {
  @ApiProperty({ example: 'professor@fab.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(120, { message: 'O e-mail deve ter no máximo 120 caracteres.' })
  email!: string;
}

/** Corpo do POST /auth/redefinir-senha. O `token` vem do link. */
export class RedefinirSenhaDto {
  @ApiProperty({ description: 'Token que veio no link de redefinição.' })
  @IsString({ message: 'Informe o token do link.' })
  @IsNotEmpty({ message: 'Informe o token do link.' })
  @MaxLength(200, { message: 'Token inválido.' })
  token!: string;

  @ApiProperty({ example: 'nova-senha-forte', minLength: 8 })
  @IsString({ message: 'Informe a nova senha.' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  novaSenha!: string;
}
