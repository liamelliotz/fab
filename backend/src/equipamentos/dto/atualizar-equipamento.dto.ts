import { ApiHideProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsEmpty } from 'class-validator';
import { CriarEquipamentoDto } from './criar-equipamento.dto.js';

/**
 * Corpo do `PATCH /equipamentos/:id` (só admin): os mesmos campos do cadastro, todos
 * opcionais, menos o `codigoPatrimonio`, que nunca muda. A situação (`status`) também
 * não entra aqui: quem a altera é o `PATCH /equipamentos/:id/ativo`.
 */
export class AtualizarEquipamentoDto extends PartialType(
  OmitType(CriarEquipamentoDto, ['codigoPatrimonio'] as const),
) {
  /**
   * Existe só para recusar com 400 quem tentar enviar o campo (sem isto o ValidationPipe
   * descartaria o valor em silêncio e a rota responderia 200 como se tivesse aceitado).
   */
  @ApiHideProperty()
  @IsEmpty({ message: 'codigoPatrimonio não pode ser alterado.' })
  codigoPatrimonio?: never;
}