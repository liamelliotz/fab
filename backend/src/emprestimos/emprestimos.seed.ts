import { StatusEmprestimo as S } from '../common/enums/index.js';
import {
  EMPRESTIMO_IDS,
  EQUIPAMENTO_IDS,
  USUARIO_IDS,
} from '../common/seed/ids.js';
import { paraIso } from './atrasos/calcular-atraso.js';
import type { Emprestimo } from './entities/emprestimo.entity.js';

/** Data relativa a hoje: dias positivos = futuro, negativos = passado. */
function dia(dias: number, base: Date): string {
  const data = new Date(base);
  data.setDate(data.getDate() + dias);
  return paraIso(data);
}

export function criarEmprestimosSeed(hoje: Date = new Date()): Emprestimo[] {
  const admin = USUARIO_IDS.admin;

  return [
    // 0036 devolvido (Ana): devolveu dentro do prazo
    {
      id: EMPRESTIMO_IDS.devolvido,
      protocolo: 'EMP-2026-0036',
      solicitanteId: USUARIO_IDS.ana,
      itens: [{ equipamentoId: EQUIPAMENTO_IDS.osciloscopio, quantidade: 1 }],
      dataRetirada: dia(-10, hoje),
      dataDevolucaoPrevista: dia(-7, hoje),
      dataRetiradaEfetiva: dia(-10, hoje),
      dataDevolucaoEfetiva: dia(-8, hoje),
      status: S.Devolvido,
      avaliadoPor: admin,
      houveAvaria: false,
      criadoEm: dia(-12, hoje),
    },
    // 0037 atrasado (Carlos): devolução prevista no passado, ainda com o item
    {
      id: EMPRESTIMO_IDS.atrasado,
      protocolo: 'EMP-2026-0037',
      solicitanteId: USUARIO_IDS.carlos,
      itens: [{ equipamentoId: EQUIPAMENTO_IDS.impressora3d, quantidade: 1 }],
      dataRetirada: dia(-10, hoje),
      dataDevolucaoPrevista: dia(-3, hoje),
      dataRetiradaEfetiva: dia(-10, hoje),
      status: S.Atrasado,
      avaliadoPor: admin,
      criadoEm: dia(-12, hoje),
    },
    // 0038 em_andamento (João): já retirou, dentro do prazo
    {
      id: EMPRESTIMO_IDS.emAndamento,
      protocolo: 'EMP-2026-0038',
      solicitanteId: USUARIO_IDS.joao,
      itens: [{ equipamentoId: EQUIPAMENTO_IDS.filamentoPla, quantidade: 2 }],
      dataRetirada: dia(-1, hoje),
      dataDevolucaoPrevista: dia(5, hoje),
      dataRetiradaEfetiva: dia(-1, hoje),
      status: S.EmAndamento,
      avaliadoPor: admin,
      criadoEm: dia(-3, hoje),
    },
    // 0039 rejeitado (Maria): com motivo
    {
      id: EMPRESTIMO_IDS.rejeitado,
      protocolo: 'EMP-2026-0039',
      solicitanteId: USUARIO_IDS.maria,
      itens: [{ equipamentoId: EQUIPAMENTO_IDS.cortadoraLaser, quantidade: 1 }],
      dataRetirada: dia(2, hoje),
      dataDevolucaoPrevista: dia(4, hoje),
      status: S.Rejeitado,
      avaliadoPor: admin,
      motivoRejeicao: 'Equipamento reservado para aula prática no período.',
      criadoEm: dia(-2, hoje),
    },
    // 0040 aprovado (Ana): Arduino Uno x3, ainda não retirou
    {
      id: EMPRESTIMO_IDS.aprovado,
      protocolo: 'EMP-2026-0040',
      solicitanteId: USUARIO_IDS.ana,
      itens: [{ equipamentoId: EQUIPAMENTO_IDS.arduinoUno, quantidade: 3 }],
      dataRetirada: dia(1, hoje),
      dataDevolucaoPrevista: dia(8, hoje),
      status: S.Aprovado,
      avaliadoPor: admin,
      criadoEm: dia(-1, hoje),
    },
    // 0041 cancelado (João): cancelado pelo próprio solicitante
    {
      id: EMPRESTIMO_IDS.cancelado,
      protocolo: 'EMP-2026-0041',
      solicitanteId: USUARIO_IDS.joao,
      itens: [{ equipamentoId: EQUIPAMENTO_IDS.multimetro, quantidade: 1 }],
      dataRetirada: dia(3, hoje),
      dataDevolucaoPrevista: dia(6, hoje),
      status: S.Cancelado,
      criadoEm: dia(-2, hoje),
    },
    // 0042 pendente (João): Multímetro x2
    {
      id: EMPRESTIMO_IDS.pendenteJoao,
      protocolo: 'EMP-2026-0042',
      solicitanteId: USUARIO_IDS.joao,
      itens: [{ equipamentoId: EQUIPAMENTO_IDS.multimetro, quantidade: 2 }],
      dataRetirada: dia(2, hoje),
      dataDevolucaoPrevista: dia(5, hoje),
      status: S.Pendente,
      criadoEm: dia(0, hoje),
    },
    // 0043 pendente (Maria): Cortadora a Laser x1
    {
      id: EMPRESTIMO_IDS.pendenteMaria,
      protocolo: 'EMP-2026-0043',
      solicitanteId: USUARIO_IDS.maria,
      itens: [{ equipamentoId: EQUIPAMENTO_IDS.cortadoraLaser, quantidade: 1 }],
      dataRetirada: dia(3, hoje),
      dataDevolucaoPrevista: dia(4, hoje),
      status: S.Pendente,
      criadoEm: dia(0, hoje),
    },
    // 0044 pendente (Carlos): Parafusadeira x1 e Kit de Chaves x1
    {
      id: EMPRESTIMO_IDS.pendenteCarlos,
      protocolo: 'EMP-2026-0044',
      solicitanteId: USUARIO_IDS.carlos,
      itens: [
        { equipamentoId: EQUIPAMENTO_IDS.parafusadeira, quantidade: 1 },
        { equipamentoId: EQUIPAMENTO_IDS.kitChaves, quantidade: 1 },
      ],
      dataRetirada: dia(2, hoje),
      dataDevolucaoPrevista: dia(3, hoje),
      status: S.Pendente,
      criadoEm: dia(0, hoje),
    },
  ];
}