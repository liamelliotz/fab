import { Perfil, StatusUsuario } from '../enums/index.js';
import { EQUIPAMENTO_IDS, USUARIO_IDS } from './ids.js';

/**
 * Dados iniciais dos usuários, ainda SEM criptografia: a senha está em texto porque o hash
 * (bcryptjs) é gerado ao carregar o seed (UsuariosRepository e `npm run db:seed`). Por isso
 * este seed existe só para desenvolvimento e demonstração. Nunca coloque senha de verdade aqui.
 *
 * Todos os CPFs são fictícios (válidos só no cálculo dos dígitos verificadores).
 */
export interface UsuarioSeed {
  id: string;
  nome: string;
  email: string;
  /** Senha em texto (só do seed). Vira `senhaHash` ao carregar. */
  senha: string;
  cpf: string;
  telefone?: string;
  matricula?: string;
  departamento?: string;
  habilitacoes: string[];
  perfil: Perfil;
  status: StatusUsuario;
  criadoEm: string;
}

const base = {
  status: StatusUsuario.Ativo,
  criadoEm: '2026-08-01T13:00:00.000Z',
};

export const USUARIOS_SEED: UsuarioSeed[] = [
  // Contas de entrada (as mesmas do modo demonstração do front)
  {
    ...base,
    id: USUARIO_IDS.admin,
    nome: 'Administrador FAB',
    email: 'admin@fab.com',
    senha: 'admin123',
    cpf: '52998224725',
    telefone: '96991110001',
    departamento: 'Coordenação',
    habilitacoes: [],
    perfil: Perfil.Admin,
  },
  {
    ...base,
    id: USUARIO_IDS.professor,
    nome: 'Professor Demonstração',
    email: 'professor@fab.com',
    senha: 'prof123',
    cpf: '11144477735',
    telefone: '96991110002',
    departamento: 'Docência',
    habilitacoes: [EQUIPAMENTO_IDS.impressora3d],
    perfil: Perfil.Usuario,
  },
  // Colegas (recebem transferências na demonstração)
  {
    ...base,
    id: USUARIO_IDS.joao,
    nome: 'João Silva',
    email: 'joao@escola.br',
    senha: 'prof123',
    cpf: '39053344705',
    telefone: '96991110003',
    departamento: 'Informática',
    habilitacoes: [],
    perfil: Perfil.Usuario,
  },
  {
    ...base,
    id: USUARIO_IDS.maria,
    nome: 'Maria Santos',
    email: 'maria@escola.br',
    senha: 'prof123',
    cpf: '16899535009',
    telefone: '96991110004',
    departamento: 'Secretaria',
    habilitacoes: [],
    perfil: Perfil.Usuario,
  },
  {
    ...base,
    id: USUARIO_IDS.carlos,
    nome: 'Carlos Souza',
    email: 'carlos@escola.br',
    senha: 'prof123',
    cpf: '93541134780',
    telefone: '96991110005',
    departamento: 'Eletrônica',
    habilitacoes: [],
    perfil: Perfil.Usuario,
  },
  {
    ...base,
    id: USUARIO_IDS.ana,
    nome: 'Ana Lima',
    email: 'ana@escola.br',
    senha: 'prof123',
    cpf: '74685426002',
    telefone: '96991110006',
    departamento: 'Informática',
    habilitacoes: [EQUIPAMENTO_IDS.impressora3d, EQUIPAMENTO_IDS.osciloscopio],
    perfil: Perfil.Usuario,
  },
];
