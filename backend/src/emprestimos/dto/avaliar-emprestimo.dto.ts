import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class AvaliarEmprestimoDto {
  @IsBoolean()
  aprovado!: boolean;

  /** Obrigatório quando reprova: de 5 a 300 caracteres. */
  @ValidateIf((o: AvaliarEmprestimoDto) => !o.aprovado)
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(300)
  motivo?: string;
}