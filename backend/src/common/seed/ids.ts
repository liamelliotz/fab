/**
 * IDS FIXOS DOS DADOS DE EXEMPLO (seed)
 * ======================================================================================
 * Todos os seeds usam este arquivo. Assim um módulo pode apontar para um registro de outro
 * (ex.: o solicitante e os equipamentos de um empréstimo) sem importar o seed do colega e sem
 * esperar o merge dele: o id é o mesmo em qualquer lugar.
 *
 * Os dados vêm dos exemplos que o front já usa:
 *   - equipamentos: tela Materiais (features/equipamentos/lista/equipamento-lista.ts)
 *   - solicitantes e pedidos: tela Solicitações (features/admin/solicitacoes/admin-solicitacoes.ts)
 *   - contas de entrada: modo demonstração do front (admin@fab.com e professor@fab.com)
 *
 * Mudar um valor aqui muda o id em todos os seeds: avise o grupo no card antes.
 * ======================================================================================
 */

/** Usuários (seed em common/seed/usuarios.seed.ts). */
export const USUARIO_IDS = {
  admin: 'usr-admin', //        Administrador FAB       admin@fab.com
  professor: 'usr-professor', // Professor Demonstração  professor@fab.com
  joao: 'usr-joao', //          João Silva   (Eletrônica)  front: solicitante u1
  maria: 'usr-maria', //        Maria Santos (Design)      front: solicitante u2
  carlos: 'usr-carlos', //      Carlos Souza (Mecânica)    front: solicitante u3
  ana: 'usr-ana', //            Ana Lima     (Eletrônica)  front: solicitante u4
} as const;

/**
 * Equipamentos (seed no módulo equipamentos, Card 11).
 * Comentário: nome no front, patrimônio, id no front.
 */
export const EQUIPAMENTO_IDS = {
  multimetro: 'eqp-multimetro', //       Multímetro Digital Minipa ET-1002  PAT-0001  (id '1')
  osciloscopio: 'eqp-osciloscopio', //   Osciloscópio Rigol DS1054Z         PAT-0002  (id '2')
  parafusadeira: 'eqp-parafusadeira', // Parafusadeira Bosch 12V            PAT-0003  (id '3')
  impressora3d: 'eqp-impressora-3d', //  Impressora 3D Creality Ender 3     PAT-0004  (id '4')
  cortadoraLaser: 'eqp-cortadora-laser', // Cortadora a Laser 40W            PAT-0005  (id '5')
  filamentoPla: 'eqp-filamento-pla', //  Filamento PLA 1kg (branco)         PAT-0006  (id '6')
  arduinoUno: 'eqp-arduino-uno', //      Arduino Uno R3                     PAT-0007  (id '7')
  kitChaves: 'eqp-kit-chaves', //        Kit de Chaves de Precisão          PAT-0008  (id '8')
} as const;

/**
 * Empréstimos (seed no módulo emprestimos, Card 17). O seed cobre TODOS os status.
 * O número é o do protocolo (EMP-2026-00NN). Sugestão de cenário para cada um:
 *
 *   0036 devolvido    Ana    (devolveu dentro do prazo)
 *   0037 atrasado     Carlos (devolução prevista no passado, ainda com o item)
 *   0038 em_andamento João   (já retirou, dentro do prazo)
 *   0039 rejeitado    Maria  (com motivoRejeicao)
 *   0040 aprovado     Ana    Arduino Uno x3           (front: pedido id '4')
 *   0041 cancelado    João   (cancelado pelo próprio solicitante)
 *   0042 pendente     João   Multímetro x2            (front: pedido id '1')
 *   0043 pendente     Maria  Cortadora a Laser x1     (front: pedido id '2')
 *   0044 pendente     Carlos Parafusadeira x1 e Kit de Chaves x1 (front: pedido id '3')
 *
 * ATENÇÃO (Card 17): o gerador do protocolo deve usar o MAIOR número já existente no ano + 1
 * (e não a quantidade de pedidos), senão o primeiro pedido novo repetiria um protocolo do seed.
 * Use datas relativas a hoje no seed, para "atrasado" e "no prazo" continuarem corretos.
 */
export const EMPRESTIMO_IDS = {
  devolvido: 'emp-2026-0036',
  atrasado: 'emp-2026-0037',
  emAndamento: 'emp-2026-0038',
  rejeitado: 'emp-2026-0039',
  aprovado: 'emp-2026-0040',
  cancelado: 'emp-2026-0041',
  pendenteJoao: 'emp-2026-0042',
  pendenteMaria: 'emp-2026-0043',
  pendenteCarlos: 'emp-2026-0044',
} as const;
