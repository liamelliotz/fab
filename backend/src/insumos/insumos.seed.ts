import {
  CategoriaInsumo as C,
  MotivoMovimentacao as M,
  TipoMovimentacao as T,
  UnidadeMedida as U,
} from '../common/enums/index.js';
import { INSUMO_IDS as INS, USUARIO_IDS as USR } from '../common/seed/ids.js';
import { hojeIso, somarDias } from '../common/utils/data.util.js';
import type { Insumo } from './entities/insumo.entity.js';
import type { MovimentacaoInsumo } from './entities/movimentacao-insumo.entity.js';

const CRIADO_EM = '2026-08-01T13:00:00.000Z';

/**
 * Insumos de exemplo e o histórico que explica o saldo de cada um.
 * O teste common/seed/seed.spec.ts confere que saldo = entradas - saídas e que nenhum
 * saldo intermediário fica negativo.
 *
 * Casos cobertos: abaixo do mínimo (filamento), zerado (pincel), com validade (álcool)
 * e saldo decimal (estanho, em kg).
 */
export function criarInsumosSeed(hoje: string = hojeIso()): {
  insumos: Insumo[];
  movimentacoes: MovimentacaoInsumo[];
} {
  const base = { ativo: true, criadoEm: CRIADO_EM };
  const insumos: Insumo[] = [
    {
      ...base,
      id: INS.filamentoPla,
      nome: 'Filamento PLA 1 kg (branco)',
      descricao: 'Filamento de 1,75 mm para as impressoras 3D.',
      categoria: C.Impressao3d,
      unidadeMedida: U.Rolo,
      quantidadeAtual: 2,
      estoqueMinimo: 3,
      fornecedor: '3D Fila',
      localizacao: 'Sala de prototipagem - Armário 1',
    },
    {
      ...base,
      id: INS.estanho,
      nome: 'Estanho para solda 60/40',
      categoria: C.Eletronica,
      unidadeMedida: U.Quilo,
      quantidadeAtual: 1.25,
      estoqueMinimo: 0.5,
      fornecedor: 'Eletrônica Macapá',
      localizacao: 'Bancada 03 - Gaveteiro A',
    },
    {
      ...base,
      id: INS.resistores,
      nome: 'Resistores 1/4 W (sortidos)',
      categoria: C.Eletronica,
      unidadeMedida: U.Unidade,
      quantidadeAtual: 420,
      estoqueMinimo: 100,
      fornecedor: 'Eletrônica Macapá',
      localizacao: 'Bancada 03 - Gaveteiro B',
    },
    {
      ...base,
      id: INS.papelA4,
      nome: 'Papel A4 (resma de 500 folhas)',
      categoria: C.Papelaria,
      unidadeMedida: U.Pacote,
      quantidadeAtual: 12,
      estoqueMinimo: 5,
      fornecedor: 'Papelaria Central',
      localizacao: 'Almoxarifado',
    },
    {
      ...base,
      id: INS.pincelQuadro,
      nome: 'Pincel para quadro branco (azul)',
      categoria: C.Papelaria,
      unidadeMedida: U.Unidade,
      quantidadeAtual: 0,
      estoqueMinimo: 10,
      fornecedor: 'Papelaria Central',
      localizacao: 'Almoxarifado',
    },
    {
      ...base,
      id: INS.alcoolIsopropilico,
      nome: 'Álcool isopropílico 1 L',
      descricao: 'Limpeza de placas e da mesa da impressora 3D.',
      categoria: C.Limpeza,
      unidadeMedida: U.Litro,
      quantidadeAtual: 3,
      estoqueMinimo: 2,
      fornecedor: 'Química Norte',
      validade: somarDias(hoje, 45),
      localizacao: 'Sala de prototipagem - Armário 2',
    },
  ];

  // [insumo, tipo, quantidade, motivo, dias a partir de hoje, destinatário?, validade do lote?]
  const lancamentos: [string, T, number, M, number, string?, string?][] = [
    [INS.filamentoPla, T.Entrada, 10, M.Compra, -60],
    [INS.filamentoPla, T.Saida, 3, M.UsoEmAula, -40, USR.professor],
    [INS.filamentoPla, T.Saida, 2, M.UsoEmAula, -25, USR.ana],
    [INS.filamentoPla, T.Saida, 2, M.UsoEmAula, -12, USR.professor],
    [INS.filamentoPla, T.Saida, 1, M.Perda, -4],
    [INS.estanho, T.Entrada, 2, M.Compra, -60],
    [INS.estanho, T.Saida, 0.5, M.UsoEmAula, -30, USR.carlos],
    [INS.estanho, T.Saida, 0.25, M.UsoEmAula, -9, USR.carlos],
    [INS.resistores, T.Entrada, 500, M.Doacao, -50],
    [INS.resistores, T.Saida, 80, M.UsoEmAula, -20, USR.carlos],
    [INS.papelA4, T.Entrada, 20, M.Compra, -45],
    [INS.papelA4, T.Saida, 5, M.UsoEmAula, -28, USR.maria],
    [INS.papelA4, T.Saida, 3, M.UsoEmAula, -7, USR.joao],
    [INS.pincelQuadro, T.Entrada, 24, M.Compra, -55],
    [INS.pincelQuadro, T.Saida, 12, M.UsoEmAula, -35, USR.maria],
    [INS.pincelQuadro, T.Saida, 12, M.UsoEmAula, -6, USR.joao],
    [
      INS.alcoolIsopropilico,
      T.Entrada,
      4,
      M.Compra,
      -30,
      undefined,
      somarDias(hoje, 45),
    ],
    [INS.alcoolIsopropilico, T.Saida, 1, M.UsoEmAula, -10, USR.professor],
  ];

  const saldos = new Map<string, number>();
  const movimentacoes = lancamentos.map(
    (
      [insumoId, tipo, quantidade, motivo, dias, destinatarioId, validadeLote],
      indice,
    ): MovimentacaoInsumo => {
      const anterior = saldos.get(insumoId) ?? 0;
      // Arredonda em 3 casas para o saldo decimal não acumular erro (0.1 + 0.2).
      const saldoApos =
        Math.round(
          (anterior + (tipo === T.Entrada ? quantidade : -quantidade)) * 1000,
        ) / 1000;
      saldos.set(insumoId, saldoApos);
      const ocorridaEm = `${somarDias(hoje, dias)}T13:00:00.000Z`;
      return {
        id: `mov-${String(indice + 1).padStart(3, '0')}`,
        insumoId,
        tipo,
        quantidade,
        saldoApos,
        motivo,
        responsavelId: USR.admin,
        ...(destinatarioId ? { destinatarioId } : {}),
        ...(validadeLote ? { validadeLote } : {}),
        ocorridaEm,
        criadoEm: ocorridaEm,
      };
    },
  );

  return { insumos, movimentacoes };
}
