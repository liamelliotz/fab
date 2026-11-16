import { IsBoolean, IsString, MaxLength, ValidateIf, IsNotEmpty } from 'class-validator';

export class AvaliarEmprestimoDto {
  @IsBoolean() aprovado!: boolean;

  /** Obrigatório quando reprova. */
  @ValidateIf((o: AvaliarEmprestimoDto) => !o.aprovado)
  @IsString() @IsNotEmpty() @MaxLength(500)
  motivoRejeicao?: string;
}