import { SetMetadata } from '@nestjs/common';

export const MENSAGEM_RESPOSTA = 'mensagemResposta';

/**
 * Define o texto do campo `mensagem` do envelope de sucesso daquela rota.
 *
 *   @Post()
 *   @MensagemResposta('Equipamento cadastrado.')
 *   criar(@Body() dto: CriarEquipamentoDto) { ... }
 */
export const MensagemResposta = (mensagem: string) =>
  SetMetadata(MENSAGEM_RESPOSTA, mensagem);
