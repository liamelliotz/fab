/**
 * npm run db:seed
 * APAGA os dados das tabelas e grava os dados de exemplo. São os MESMOS seeds usados pelos
 * repositórios em memória (uma única fonte), então o banco e a memória começam iguais.
 * Só para desenvolvimento: o script se recusa a rodar com NODE_ENV=production.
 */
import type pg from 'pg';
import { EQUIPAMENTOS_SEED, USUARIOS_SEED } from '../common/seed/index.js';
import { criarEmprestimosSeed } from '../emprestimos/emprestimos.seed.js';
import { criarInsumosSeed } from '../insumos/insumos.seed.js';
import { gerarHash } from '../usuarios/usuarios.util.js';
import { conectar, emTransacao } from './conexao.js';

/** INSERT com as colunas na ordem das chaves do objeto. */
async function inserir(
  cliente: pg.Client,
  tabela: string,
  linha: Record<string, unknown>,
): Promise<void> {
  const colunas = Object.keys(linha);
  const marcadores = colunas.map((_, indice) => `$${indice + 1}`);
  await cliente.query(
    `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${marcadores.join(', ')})`,
    colunas.map((coluna) => linha[coluna] ?? null),
  );
}

async function semear(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:seed apaga os dados e não roda em produção.');
  }
  const cliente = await conectar();
  try {
    await emTransacao(cliente, async () => {
      // TRUNCATE não dispara os gatilhos de "só acréscimo" (eles são por linha).
      await cliente.query(`
        TRUNCATE movimentacoes_insumo, insumos, tokens_redefinicao_senha, manutencoes,
                 emprestimo_transferencias, emprestimo_eventos, emprestimo_itens, emprestimos,
                 sequencias_protocolo, usuario_habilitacoes, equipamentos, usuarios`);

      for (const { senha, habilitacoes: _h, ...u } of USUARIOS_SEED) {
        await inserir(cliente, 'usuarios', {
          id: u.id,
          nome: u.nome,
          email: u.email,
          senha_hash: await gerarHash(senha),
          cpf: u.cpf,
          telefone: u.telefone,
          matricula: u.matricula,
          departamento: u.departamento,
          perfil: u.perfil,
          status: u.status,
          criado_em: u.criadoEm,
        });
      }

      for (const e of EQUIPAMENTOS_SEED) {
        await inserir(cliente, 'equipamentos', {
          id: e.id,
          nome: e.nome,
          descricao: e.descricao,
          codigo_patrimonio: e.codigoPatrimonio,
          categoria: e.categoria,
          status: e.status,
          localizacao: e.localizacao,
          foto_url: e.fotoUrl,
          requer_treinamento: e.requerTreinamento,
          prazo_maximo_dias: e.prazoMaximoDias,
          quantidade_total: e.quantidadeTotal,
          quantidade_disponivel: e.quantidadeDisponivel,
          criado_em: e.criadoEm,
        });
      }

      for (const u of USUARIOS_SEED) {
        for (const equipamentoId of u.habilitacoes) {
          await inserir(cliente, 'usuario_habilitacoes', {
            usuario_id: u.id,
            equipamento_id: equipamentoId,
          });
        }
      }

      const emprestimos = criarEmprestimosSeed();
      const ultimoPorAno = new Map<number, number>();
      for (const p of emprestimos) {
        await inserir(cliente, 'emprestimos', {
          id: p.id,
          protocolo: p.protocolo,
          solicitante_id: p.solicitanteId,
          responsavel_id: p.responsavelId,
          justificativa: p.justificativa,
          status: p.status,
          data_solicitacao: p.dataSolicitacao,
          data_prevista_retirada: p.dataPrevistaRetirada,
          data_prevista_devolucao: p.dataPrevistaDevolucao,
          data_retirada_efetiva: p.dataRetiradaEfetiva,
          data_devolucao_efetiva: p.dataDevolucaoEfetiva,
          avaliado_por_id: p.avaliadoPorId,
          motivo_rejeicao: p.motivoRejeicao,
          codigo_retirada: p.codigoRetirada,
          codigo_devolucao: p.codigoDevolucao,
          houve_avaria: p.houveAvaria,
          observacoes_devolucao: p.observacoesDevolucao,
        });
        for (const item of p.itens) {
          await inserir(cliente, 'emprestimo_itens', {
            emprestimo_id: p.id,
            equipamento_id: item.equipamentoId,
            quantidade: item.quantidade,
            observacoes: item.observacoes,
          });
        }
        for (const evento of p.historico) {
          await inserir(cliente, 'emprestimo_eventos', {
            id: evento.id,
            emprestimo_id: p.id,
            tipo: evento.tipo,
            em: evento.em,
            por_id: evento.porId,
            detalhe: evento.detalhe,
          });
        }
        const [, ano, numero] = p.protocolo.split('-').map(Number);
        ultimoPorAno.set(ano, Math.max(ultimoPorAno.get(ano) ?? 0, numero));
      }
      for (const [ano, ultimo] of ultimoPorAno) {
        await inserir(cliente, 'sequencias_protocolo', { ano, ultimo });
      }

      const { insumos, movimentacoes } = criarInsumosSeed();
      for (const i of insumos) {
        await inserir(cliente, 'insumos', {
          id: i.id,
          nome: i.nome,
          descricao: i.descricao,
          categoria: i.categoria,
          unidade_medida: i.unidadeMedida,
          quantidade_atual: i.quantidadeAtual,
          estoque_minimo: i.estoqueMinimo,
          fornecedor: i.fornecedor,
          validade: i.validade,
          localizacao: i.localizacao,
          ativo: i.ativo,
          criado_em: i.criadoEm,
        });
      }
      for (const m of movimentacoes) {
        await inserir(cliente, 'movimentacoes_insumo', {
          id: m.id,
          insumo_id: m.insumoId,
          tipo: m.tipo,
          quantidade: m.quantidade,
          saldo_apos: m.saldoApos,
          motivo: m.motivo,
          observacao: m.observacao,
          responsavel_id: m.responsavelId,
          destinatario_id: m.destinatarioId,
          validade_lote: m.validadeLote,
          ocorrida_em: m.ocorridaEm,
          criado_em: m.criadoEm,
        });
      }

      console.log(
        `Seed gravado: ${USUARIOS_SEED.length} usuários, ${EQUIPAMENTOS_SEED.length} equipamentos, ` +
          `${emprestimos.length} empréstimos, ${insumos.length} insumos e ${movimentacoes.length} movimentações.`,
      );
    });
  } finally {
    await cliente.end();
  }
}

semear().catch((erro: Error) => {
  console.error(`Falha no seed: ${erro.message}`);
  process.exitCode = 1;
});
