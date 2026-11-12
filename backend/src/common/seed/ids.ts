/**
 * IDS FIXOS DOS DADOS DE EXEMPLO (seed)
 * ======================================================================================
 * Todos os seeds usam este arquivo. Assim um módulo pode apontar para um registro de outro
 * (ex.: o solicitante e os equipamentos de um empréstimo) sem importar o seed do colega e sem
 * esperar o merge dele: o id é o mesmo em qualquer lugar (memória e banco).
 *
 * Os dados são os MESMOS da demonstração do front (equipamento.service.ts e usuario.service.ts),
 * para a apresentação mostrar os mesmos itens com o backend ligado.
 *
 * Mudar um valor aqui muda o id em todos os seeds: avise o grupo no card antes.
 * ======================================================================================
 */

/** Usuários (seed em common/seed/usuarios.seed.ts). */
export const USUARIO_IDS = {
  admin: 'usr-admin', //         Administrador FAB       admin@fab.com
  professor: 'usr-professor', // Professor Demonstração  professor@fab.com
  joao: 'usr-joao', //           João Silva    joao@escola.br
  maria: 'usr-maria', //         Maria Santos  maria@escola.br
  carlos: 'usr-carlos', //       Carlos Souza  carlos@escola.br
  ana: 'usr-ana', //             Ana Lima      ana@escola.br   (habilitada na Impressora 3D)
} as const;

/** Equipamentos (seed em common/seed/equipamentos.seed.ts). Mesma ordem do front (ids '1' a '10'). */
export const EQUIPAMENTO_IDS = {
  notebookDell: 'eqp-notebook-dell', //       PAT-0001  Notebook Dell Inspiron 15
  projetor: 'eqp-projetor', //                PAT-0002  Projetor Epson PowerLite
  notebookLenovo: 'eqp-notebook-lenovo', //   PAT-0003  Notebook Lenovo IdeaPad 3
  caixaDeSom: 'eqp-caixa-de-som', //          PAT-0004  Caixa de som Bluetooth
  multimetro: 'eqp-multimetro', //            PAT-0005  Multímetro Digital Minipa ET-1002
  kitFerramentas: 'eqp-kit-ferramentas', //   PAT-0006  Kit de ferramentas de precisão
  parafusadeira: 'eqp-parafusadeira', //      PAT-0007  Parafusadeira Bosch 12 V (em manutenção)
  impressora3d: 'eqp-impressora-3d', //       PAT-0008  Impressora 3D Creality Ender 3 V2 (treinamento)
  cortadoraLaser: 'eqp-cortadora-laser', //   PAT-0009  Cortadora a laser CO2 40 W (inativa)
  osciloscopio: 'eqp-osciloscopio', //        PAT-0010  Osciloscópio Rigol DS1054Z (emprestado)
} as const;

/** Empréstimos (seed em emprestimos/emprestimos.seed.ts). Um de cada situação. */
export const EMPRESTIMO_IDS = {
  devolvido: 'emp-2026-0036',
  atrasado: 'emp-2026-0037',
  emAndamentoProjetor: 'emp-2026-0038',
  rejeitado: 'emp-2026-0039',
  aprovadoProfessor: 'emp-2026-0040',
  cancelado: 'emp-2026-0041',
  pendenteJoao: 'emp-2026-0042',
  pendenteCarlos: 'emp-2026-0043',
  emAndamentoImpressora: 'emp-2026-0044',
  aprovadoAna: 'emp-2026-0045',
} as const;

/** Insumos (seed em insumos/insumos.seed.ts). */
export const INSUMO_IDS = {
  filamentoPla: 'ins-filamento-pla', //   abaixo do mínimo (entra na lista de reposição)
  estanho: 'ins-estanho',
  resistores: 'ins-resistores',
  papelA4: 'ins-papel-a4',
  pincelQuadro: 'ins-pincel-quadro', //   zerado
  alcoolIsopropilico: 'ins-alcool-isopropilico', // tem validade
} as const;
