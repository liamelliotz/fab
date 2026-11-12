import {
  StatusEmprestimo as S,
  TipoEventoEmprestimo as T,
} from '../common/enums/index.js';
import {
  EMPRESTIMO_IDS as EMP,
  EQUIPAMENTO_IDS as EQP,
  USUARIO_IDS as USR,
} from '../common/seed/ids.js';
import { hojeIso, somarDias } from '../common/utils/data.util.js';
import type {
  Emprestimo,
  EventoEmprestimo,
} from './entities/emprestimo.entity.js';

/**
 * Pedidos de exemplo, um de cada situação. As datas são relativas a hoje, para "atrasado" e
 * "no prazo" continuarem certos com o passar do tempo.
 *
 * REGRAS DESTE SEED (o teste common/seed/seed.spec.ts confere todas):
 *  - o estoque de common/seed/equipamentos.seed.ts já desconta os pedidos aprovados e em andamento;
 *  - nenhum pedido passa do prazo máximo do material;
 *  - quem pede item com treinamento tem a habilitação;
 *  - `atrasado` não é gravado: o pedido 0037 está `em_andamento` com a data vencida.
 */
export function criarEmprestimosSeed(hoje: string = hojeIso()): Emprestimo[] {
  const dia = (dias: number) => somarDias(hoje, dias);
  const admin = USR.admin;

  /** Monta a linha do tempo: [tipo, dias a partir de hoje, quem fez, detalhe?]. */
  const historico = (
    id: string,
    ...eventos: [T, number, string, string?][]
  ): EventoEmprestimo[] =>
    eventos.map(([tipo, dias, porId, detalhe], indice) => ({
      id: `${id}-ev${indice + 1}`,
      tipo,
      // Horas diferentes no mesmo dia mantêm a ordem dos eventos.
      em: `${dia(dias)}T${String(12 + indice).padStart(2, '0')}:00:00.000Z`,
      porId,
      ...(detalhe ? { detalhe } : {}),
    }));

  return [
    // 0036 devolvido (João): Notebook Dell, devolvido um dia antes do prazo
    {
      id: EMP.devolvido,
      protocolo: 'EMP-2026-0036',
      solicitanteId: USR.joao,
      responsavelId: USR.joao,
      itens: [{ equipamentoId: EQP.notebookDell, quantidade: 1 }],
      justificativa: 'Aula de lógica de programação no laboratório 2.',
      status: S.Devolvido,
      dataSolicitacao: `${dia(-13)}T12:00:00.000Z`,
      dataPrevistaRetirada: dia(-12),
      dataPrevistaDevolucao: dia(-8),
      dataRetiradaEfetiva: dia(-12),
      dataDevolucaoEfetiva: dia(-9),
      avaliadoPorId: admin,
      houveAvaria: false,
      historico: historico(
        EMP.devolvido,
        [T.Solicitado, -13, USR.joao],
        [T.Aprovado, -13, admin],
        [T.Retirado, -12, admin],
        [T.Devolvido, -9, admin, 'Devolvido sem avarias.'],
      ),
    },
    // 0037 em andamento COM PRAZO VENCIDO (Ana): a API responde "atrasado"
    {
      id: EMP.atrasado,
      protocolo: 'EMP-2026-0037',
      solicitanteId: USR.ana,
      responsavelId: USR.ana,
      itens: [{ equipamentoId: EQP.osciloscopio, quantidade: 1 }],
      justificativa: 'Medições no projeto de eletrônica do 3º ano.',
      status: S.EmAndamento,
      dataSolicitacao: `${dia(-11)}T12:00:00.000Z`,
      dataPrevistaRetirada: dia(-10),
      dataPrevistaDevolucao: dia(-3),
      dataRetiradaEfetiva: dia(-10),
      avaliadoPorId: admin,
      codigoDevolucao: 'T6R9NB',
      historico: historico(
        EMP.atrasado,
        [T.Solicitado, -11, USR.ana],
        [T.Aprovado, -11, admin],
        [T.Retirado, -10, admin],
      ),
    },
    // 0038 em andamento (Professor): Projetor, dentro do prazo
    {
      id: EMP.emAndamentoProjetor,
      protocolo: 'EMP-2026-0038',
      solicitanteId: USR.professor,
      responsavelId: USR.professor,
      itens: [{ equipamentoId: EQP.projetor, quantidade: 1 }],
      justificativa: 'Apresentação dos seminários da turma B.',
      status: S.EmAndamento,
      dataSolicitacao: `${dia(-2)}T12:00:00.000Z`,
      dataPrevistaRetirada: dia(-1),
      dataPrevistaDevolucao: dia(2),
      dataRetiradaEfetiva: dia(-1),
      avaliadoPorId: admin,
      codigoDevolucao: 'W4D7KC',
      historico: historico(
        EMP.emAndamentoProjetor,
        [T.Solicitado, -2, USR.professor],
        [T.Aprovado, -2, admin],
        [T.Retirado, -1, admin],
      ),
    },
    // 0039 rejeitado (Maria): com motivo
    {
      id: EMP.rejeitado,
      protocolo: 'EMP-2026-0039',
      solicitanteId: USR.maria,
      responsavelId: USR.maria,
      itens: [{ equipamentoId: EQP.caixaDeSom, quantidade: 3 }],
      justificativa: 'Evento da secretaria no pátio.',
      status: S.Rejeitado,
      dataSolicitacao: `${dia(-2)}T12:00:00.000Z`,
      dataPrevistaRetirada: dia(2),
      dataPrevistaDevolucao: dia(4),
      avaliadoPorId: admin,
      motivoRejeicao: 'Caixas reservadas para a feira de ciências no período.',
      historico: historico(
        EMP.rejeitado,
        [T.Solicitado, -2, USR.maria],
        [
          T.Rejeitado,
          -1,
          admin,
          'Caixas reservadas para a feira de ciências no período.',
        ],
      ),
    },
    // 0040 aprovado (Professor): aguardando retirada, com código
    {
      id: EMP.aprovadoProfessor,
      protocolo: 'EMP-2026-0040',
      solicitanteId: USR.professor,
      responsavelId: USR.professor,
      itens: [{ equipamentoId: EQP.notebookDell, quantidade: 2 }],
      justificativa: 'Oficina de planilhas com a turma A.',
      status: S.Aprovado,
      dataSolicitacao: `${dia(-1)}T12:00:00.000Z`,
      dataPrevistaRetirada: dia(1),
      dataPrevistaDevolucao: dia(6),
      avaliadoPorId: admin,
      codigoRetirada: 'H3Q8ZW',
      historico: historico(
        EMP.aprovadoProfessor,
        [T.Solicitado, -1, USR.professor],
        [T.Aprovado, -1, admin],
      ),
    },
    // 0041 cancelado (João): cancelado pelo próprio solicitante
    {
      id: EMP.cancelado,
      protocolo: 'EMP-2026-0041',
      solicitanteId: USR.joao,
      responsavelId: USR.joao,
      itens: [{ equipamentoId: EQP.multimetro, quantidade: 1 }],
      justificativa: 'Demonstração de circuitos em série.',
      status: S.Cancelado,
      dataSolicitacao: `${dia(-2)}T12:00:00.000Z`,
      dataPrevistaRetirada: dia(3),
      dataPrevistaDevolucao: dia(6),
      historico: historico(
        EMP.cancelado,
        [T.Solicitado, -2, USR.joao],
        [T.Cancelado, -1, USR.joao, 'A aula foi remarcada.'],
      ),
    },
    // 0042 pendente (João): Multímetro x2
    {
      id: EMP.pendenteJoao,
      protocolo: 'EMP-2026-0042',
      solicitanteId: USR.joao,
      responsavelId: USR.joao,
      itens: [{ equipamentoId: EQP.multimetro, quantidade: 2 }],
      justificativa: 'Prática de medição de tensão e corrente.',
      status: S.Pendente,
      dataSolicitacao: `${dia(0)}T12:00:00.000Z`,
      dataPrevistaRetirada: dia(2),
      dataPrevistaDevolucao: dia(5),
      historico: historico(EMP.pendenteJoao, [T.Solicitado, 0, USR.joao]),
    },
    // 0043 pendente (Carlos): Kit de ferramentas e Caixa de som
    {
      id: EMP.pendenteCarlos,
      protocolo: 'EMP-2026-0043',
      solicitanteId: USR.carlos,
      responsavelId: USR.carlos,
      itens: [
        { equipamentoId: EQP.kitFerramentas, quantidade: 1 },
        { equipamentoId: EQP.caixaDeSom, quantidade: 1 },
      ],
      justificativa: 'Manutenção dos kits de robótica com os alunos.',
      status: S.Pendente,
      dataSolicitacao: `${dia(0)}T12:00:00.000Z`,
      dataPrevistaRetirada: dia(2),
      dataPrevistaDevolucao: dia(4),
      historico: historico(EMP.pendenteCarlos, [T.Solicitado, 0, USR.carlos]),
    },
    // 0044 em andamento (Professor): Impressora 3D (exige habilitação; serve para a transferência)
    {
      id: EMP.emAndamentoImpressora,
      protocolo: 'EMP-2026-0044',
      solicitanteId: USR.professor,
      responsavelId: USR.professor,
      itens: [{ equipamentoId: EQP.impressora3d, quantidade: 1 }],
      justificativa: 'Impressão das peças do projeto integrador.',
      status: S.EmAndamento,
      dataSolicitacao: `${dia(-3)}T12:00:00.000Z`,
      dataPrevistaRetirada: dia(-2),
      dataPrevistaDevolucao: dia(3),
      dataRetiradaEfetiva: dia(-2),
      avaliadoPorId: admin,
      codigoDevolucao: 'P8X2MJ',
      historico: historico(
        EMP.emAndamentoImpressora,
        [T.Solicitado, -3, USR.professor],
        [T.Aprovado, -3, admin],
        [T.Retirado, -2, admin],
      ),
    },
    // 0045 aprovado (Ana): aguardando retirada, com código
    {
      id: EMP.aprovadoAna,
      protocolo: 'EMP-2026-0045',
      solicitanteId: USR.ana,
      responsavelId: USR.ana,
      itens: [{ equipamentoId: EQP.notebookLenovo, quantidade: 1 }],
      justificativa: 'Correção de provas no laboratório.',
      status: S.Aprovado,
      dataSolicitacao: `${dia(-1)}T12:00:00.000Z`,
      dataPrevistaRetirada: dia(1),
      dataPrevistaDevolucao: dia(5),
      avaliadoPorId: admin,
      codigoRetirada: 'K7M4PX',
      historico: historico(
        EMP.aprovadoAna,
        [T.Solicitado, -1, USR.ana],
        [T.Aprovado, -1, admin],
      ),
    },
  ];
}
