import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CodigoBalcaoDto {
  @IsString()
  @IsNotEmpty()
  codigo!: string;
}

export class DevolucaoBalcaoDto extends CodigoBalcaoDto {
  @IsOptional()
  @IsBoolean()
  houveAvaria?: boolean;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
