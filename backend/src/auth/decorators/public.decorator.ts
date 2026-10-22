import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'ehRotaPublica';

/**
 * Libera a rota (ou o controller inteiro) para quem não está logado.
 * Sem este decorator, toda rota da API exige token.
 *
 *   @Public()
 *   @Post('login')
 *   login(@Body() dto: LoginDto) { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
