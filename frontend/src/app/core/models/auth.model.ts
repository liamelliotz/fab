/**
 * @file auth.model.ts
 * @description Contratos de dados para autenticação, tokens JWT e sessões.
 */

import { Usuario } from './usuario.model';

/**
 * Payload para autenticação via formulário de login.
 */
export interface LoginCredenciaisDTO {
  email: string;
  senha: string;
}

/**
 * Resposta de sucesso de autenticação contendo tokens e dados do usuário logado.
 */
export interface AuthResponse {
  tokenAcesso: string;
  refreshToken?: string;
  tipoToken: string; // Ex: 'Bearer'
  expiraEm: number; // Timestamp ou segundos
  usuario: Usuario;
}

/**
 * Payload decodificado do Token JWT armazenado na sessão.
 */
export interface JwtPayload {
  sub: string; // ID do usuário
  email: string;
  perfil: string;
  exp: number;
  iat: number;
}
