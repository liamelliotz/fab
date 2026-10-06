/**
 * @file usuario.model.ts
 * @description Definições de tipos, contratos de dados e DTOs para gestão de usuários.
 * Atende aos fluxos de autenticação, controle de acesso baseado em papéis (RBAC)
 * e vínculos operacionais do sistema FAB.
 */

/**
 * Papéis de acesso disponíveis no sistema.
 *
 * - `admin`: Acesso irrestrito a todas as configurações, relatórios e cadastros.
 * - `responsavel_lab`: Gerencia equipamentos, manutenções e aprova pedidos de empréstimo.
 * - `usuario`: Solicitante padrão (estudante/servidor) com permissão para pedir empréstimos.
 */
export type PerfilUsuario = 'admin' | 'usuario' | 'responsavel_lab';

/**
 * Situação cadastral da conta do usuário.
 *
 * - `ativo`: Conta habilitada a realizar solicitações e navegar no sistema.
 * - `inativo`: Conta desativada voluntariamente ou por término de vínculo.
 * - `bloqueado`: Suspensão preventiva (ex.: atrasos graves na devolução de itens).
 */
export type StatusUsuario = 'ativo' | 'inativo' | 'bloqueado';

/**
 * Entidade completa do Usuário conforme persistida e retornada pela API.
 */
export interface Usuario {
  /** Identificador único universal (UUID) gerado no banco de dados */
  id: string;

  /** Nome completo do usuário */
  nome: string;

  /** E-mail corporativo ou acadêmico (utilizado como login) */
  email: string;

  /** Registro de Cadastro de Pessoa Física devidamente formatado ou limpo */
  cpf: string;

  /** Número de contato telefônico ou WhatsApp com DDD */
  telefone?: string;

  /** Número de matrícula institucional ou funcional */
  matricula?: string;

  /** Setor, laboratório de origem ou curso ao qual o usuário está vinculado */
  departamento?: string;

  /** Nível de autorização atribuído na plataforma */
  perfil: PerfilUsuario;

  /** Condição atual do cadastro para validação de acesso */
  status: StatusUsuario;

  /** Data e hora de criação do registro (formato ISO 8601) */
  criadoEm: string;

  /** Data e hora da última modificação cadastral (formato ISO 8601) */
  atualizadoEm?: string;
}

/**
 * Contrato de envio de dados para o formulário de cadastro de usuário.
 * Contempla a senha inicial requerida para autenticação.
 */
export interface CriarUsuarioDTO {
  nome: string;
  email: string;
  cpf: string;
  senha: string;
  telefone?: string;
  matricula?: string;
  departamento?: string;
  perfil?: PerfilUsuario;
}

/**
 * Contrato para atualização parcial de dados do usuário (requisição PATCH/PUT).
 * Todos os campos são opcionais para permitir edições pontuais.
 */
export interface AtualizarUsuarioDTO {
  nome?: string;
  telefone?: string;
  matricula?: string;
  departamento?: string;
  perfil?: PerfilUsuario;
  status?: StatusUsuario;
}

/**
 * Estrutura enxuta de dados do usuário para exibição em listas relacionais,
 * seletores suspensos (selects), cartões de autor e logs de auditoria.
 */
export interface UsuarioResumo {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  departamento?: string;
}