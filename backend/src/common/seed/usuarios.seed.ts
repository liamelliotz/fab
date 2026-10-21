import { Perfil, StatusUsuario } from '../enums/index.js';
import { USUARIO_IDS } from './ids.js';

/**
 * Dados iniciais dos usuários, ainda SEM criptografia: a senha está em texto porque o hash
 * (bcryptjs) é gerado pelo UsuariosRepository no Card 4, ao carregar o seed. Por isso este
 * seed existe só para desenvolvimento e demonstração. Nunca coloque senha de verdade aqui.
 *
 * Campos iguais ao `Usuario` do front (docs/contrato-api.md, seção 3). Todos os CPFs são
 * fictícios (válidos só no cálculo dos dígitos verificadores).
 */
export interface UsuarioSeed {
  id: string;
  nome: string;
  email: string;
  /** Senha em texto (só do seed). O Card 4 troca por `senhaHash`. */
  senha: string;
  cpf: string;
  telefone?: string;
  matricula?: string;
  departamento?: string;
  perfil: Perfil;
  status: StatusUsuario;
  criadoEm: string;
}

export const USUARIOS_SEED: UsuarioSeed[] = [
  // Contas de entrada (as mesmas do modo demonstração do front)
  {
    id: USUARIO_IDS.admin,
    nome: 'Administrador FAB',
    email: 'admin@fab.com',
    senha: 'admin123',
    cpf: '52998224725',
    telefone: '96991110001',
    departamento: 'Coordenação',
    perfil: Perfil.Admin,
    status: StatusUsuario.Ativo,
    criadoEm: '2026-08-01',
  },
  {
    id: USUARIO_IDS.professor,
    nome: 'Professor Demonstração',
    email: 'professor@fab.com',
    senha: 'prof123',
    cpf: '11144477735',
    telefone: '96991110002',
    departamento: 'Eletrônica',
    perfil: Perfil.Usuario,
    status: StatusUsuario.Ativo,
    criadoEm: '2026-08-01',
  },

  // Solicitantes dos pedidos de exemplo (precisam existir para o nome aparecer nas listagens, Card 19)
  {
    id: USUARIO_IDS.joao,
    nome: 'João Silva',
    email: 'joao@escola.br',
    senha: 'prof123',
    cpf: '39053344705',
    telefone: '96991110003',
    departamento: 'Eletrônica',
    perfil: Perfil.Usuario,
    status: StatusUsuario.Ativo,
    criadoEm: '2026-08-05',
  },
  {
    id: USUARIO_IDS.maria,
    nome: 'Maria Santos',
    email: 'maria@escola.br',
    senha: 'prof123',
    cpf: '16899535009',
    telefone: '96991110004',
    departamento: 'Design',
    perfil: Perfil.Usuario,
    status: StatusUsuario.Ativo,
    criadoEm: '2026-08-05',
  },
  {
    id: USUARIO_IDS.carlos,
    nome: 'Carlos Souza',
    email: 'carlos@escola.br',
    senha: 'prof123',
    cpf: '93541134780',
    telefone: '96991110005',
    departamento: 'Mecânica',
    perfil: Perfil.Usuario,
    status: StatusUsuario.Ativo,
    criadoEm: '2026-08-06',
  },
  {
    id: USUARIO_IDS.ana,
    nome: 'Ana Lima',
    email: 'ana@escola.br',
    senha: 'prof123',
    cpf: '74685426002',
    telefone: '96991110006',
    departamento: 'Eletrônica',
    perfil: Perfil.Usuario,
    status: StatusUsuario.Ativo,
    criadoEm: '2026-08-06',
  },
];
