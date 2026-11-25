import { Perfil, StatusEmprestimo } from '../common/enums/index.js';
import type { Equipamento } from '../equipamentos/entities/equipamento.entity.js';
import type { Usuario } from '../usuarios/entities/usuario.entity.js';
import type {
  Emprestimo,
  EventoEmprestimo,
  ItemEmprestimo,
  TransferenciaPendente,
} from './entities/emprestimo.entity.js';

export interface UsuarioResumo {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  departamento?: string;
}

/** Tudo que o conversor precisa para trocar ids por objetos. Quem chama monta isso (card C2). */
export interface ContextoResposta {
  usuarios: Map<string, Usuario>;
  equipamentos: Map<string, Equipamento>;
}

export type EventoResposta = Omit<EventoEmprestimo, 'porId'> & {
  por: UsuarioResumo | null;
};

export type ItemResposta = Omit<ItemEmprestimo, 'equipamentoId'> & {
  equipamento: Equipamento | null;
};

export type TransferenciaResposta = Omit<TransferenciaPendente, 'deId' | 'paraId'> & {
  de: UsuarioResumo | null;
  para: UsuarioResumo | null;
};

export type EmprestimoResposta = Omit<
  Emprestimo,
  | 'solicitanteId'
  | 'responsavelId'
  | 'avaliadoPorId'
  | 'itens'
  | 'historico'
  | 'transferenciaPendente'
  | 'status'
> & {
  status: StatusEmprestimo; // aqui pode ser "atrasado"
  solicitante: UsuarioResumo | null;
  responsavel: UsuarioResumo | null;
  responsavelAprovacao: UsuarioResumo | null;
  itens: ItemResposta[];
  historico: EventoResposta[];
  transferenciaPendente?: TransferenciaResposta;
};

function dataLocal(d: Date): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

/**
 * Status que vai na resposta. O banco guarda "em_andamento"; se o prazo de devolução
 * já passou, a resposta diz "atrasado". Não altera o objeto gravado.
 */
export function statusParaResposta(
  emprestimo: Emprestimo,
  agora: Date = new Date(),
): StatusEmprestimo {
  const vencido = emprestimo.dataPrevistaDevolucao < dataLocal(agora);
  if (emprestimo.status === StatusEmprestimo.EmAndamento && vencido) {
    return StatusEmprestimo.Atrasado;
  }
  return emprestimo.status;
}

function resumir(
  id: string | undefined,
  ctx: ContextoResposta,
): UsuarioResumo | null {
  if (!id) return null;
  const u = ctx.usuarios.get(id);
  if (!u) return null; // nunca devolve o id solto
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    departamento: u.departamento,
  };
}

export function paraResposta(
  emprestimo: Emprestimo,
  quemPede: Pick<Usuario, 'id' | 'perfil'>,
  ctx: ContextoResposta,
  agora: Date = new Date(),
): EmprestimoResposta {
  const {
    solicitanteId,
    responsavelId,
    avaliadoPorId,
    itens,
    historico,
    transferenciaPendente,
    codigoRetirada,
    codigoDevolucao,
    status: _statusGravado,
    ...resto
  } = emprestimo;

  const veCodigos =
    quemPede.perfil === Perfil.Admin || quemPede.id === responsavelId;

  return {
    ...resto,
    status: statusParaResposta(emprestimo, agora),
    solicitante: resumir(solicitanteId, ctx),
    responsavel: resumir(responsavelId, ctx),
    responsavelAprovacao: resumir(avaliadoPorId, ctx),
    itens: itens.map(({ equipamentoId, ...item }) => ({
      ...item,
      equipamento: ctx.equipamentos.get(equipamentoId) ?? null,
    })),
    historico: historico.map(({ porId, ...evento }) => ({
      ...evento,
      por: resumir(porId, ctx),
    })),
    ...(transferenciaPendente && {
      transferenciaPendente: {
        motivo: transferenciaPendente.motivo,
        solicitadaEm: transferenciaPendente.solicitadaEm,
        de: resumir(transferenciaPendente.deId, ctx),
        para: resumir(transferenciaPendente.paraId, ctx),
      },
    }),
    // Sem permissão, a chave nem existe na resposta.
    ...(veCodigos && codigoRetirada !== undefined && { codigoRetirada }),
    ...(veCodigos && codigoDevolucao !== undefined && { codigoDevolucao }),
  };
}