import { Perfil, StatusUsuario } from '../../common/enums/index.js';

/**
 * Usuário como é GUARDADO (com o hash da senha). Campos iguais ao `Usuario` do front
 * (docs/contrato-api.md, seção 3), mais o `senhaHash`.
 *
 * ATENÇÃO: este tipo nunca pode sair numa resposta da API. Quem fala com o mundo de fora
 * usa `UsuarioPublico` (o `UsuariosService` já devolve assim).
 */
export interface Usuario {
  id: string;
  nome: string;
  /** Sempre em minúsculas e sem espaços nas pontas. */
  email: string;
  /** Hash bcrypt da senha. Nunca a senha em texto. */
  senhaHash: string;
  /** Só os 11 dígitos, sem pontos e traço. */
  cpf: string;
  telefone?: string;
  matricula?: string;
  departamento?: string;
  perfil: Perfil;
  status: StatusUsuario;
  /** Data de criação (ISO 8601). */
  criadoEm: string;
  /** Data da última alteração (ISO 8601). */
  atualizadoEm?: string;
}

/** O usuário como a API devolve: igual ao `Usuario`, sem o `senhaHash`. */
export type UsuarioPublico = Omit<Usuario, 'senhaHash'>;

/** Remove o `senhaHash`. Passe por aqui todo usuário que for sair do módulo. */
export function paraPublico(usuario: Usuario): UsuarioPublico {
  const copia: Partial<Usuario> = { ...usuario };
  delete copia.senhaHash;
  return copia as UsuarioPublico;
}
