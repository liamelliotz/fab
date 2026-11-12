import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Corpo do POST /auth/login. O login não exige tamanho mínimo de senha: quem decide é o 401. */
export class LoginDto {
  @ApiProperty({ example: 'admin@fab.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(120, { message: 'O e-mail deve ter no máximo 120 caracteres.' })
  email!: string;

  @ApiProperty({ example: 'admin123' })
  @IsString({ message: 'Informe a senha.' })
  @IsNotEmpty({ message: 'Informe a senha.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  senha!: string;
}
