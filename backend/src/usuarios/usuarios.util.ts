import { compare, hash } from 'bcryptjs';

/** Custo do bcrypt: 10 é o padrão da indústria (cada +1 dobra o tempo de cálculo). */
export const RODADAS_DO_HASH = 10;

/**
 * Gera o hash bcrypt de uma senha.
 * O bcrypt só considera os primeiros 72 bytes: os DTOs devem limitar o tamanho da senha.
 */
export function gerarHash(senha: string): Promise<string> {
  return hash(senha, RODADAS_DO_HASH);
}

// Hash de uma senha qualquer, calculado uma única vez (na primeira necessidade).
let hashFalso: Promise<string> | undefined;

/**
 * Confere a senha digitada com o hash guardado.
 *
 * Se o usuário não existe (`senhaHash` ausente), compara com um hash falso e devolve `false`.
 * Assim o tempo de resposta é parecido com o de um e-mail existente, e quem tenta o login
 * não descobre pelo tempo quais e-mails estão cadastrados.
 */
export async function conferirSenha(
  senha: string,
  senhaHash?: string,
): Promise<boolean> {
  if (!senhaHash) {
    hashFalso ??= gerarHash('senha-que-nao-pertence-a-ninguem');
    await compare(senha, await hashFalso);
    return false;
  }
  return compare(senha, senhaHash);
}

/** E-mail sem espaços nas pontas e em minúsculas ("  Ana@Escola.BR " -> "ana@escola.br"). */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** CPF só com os dígitos ("529.982.247-25" -> "52998224725"). */
export function normalizarCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}
