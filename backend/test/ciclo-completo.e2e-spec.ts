import { abrirCiclo, cpfValido, dados, hoje } from './apoio/ciclo.js';

interface Conta {
  id: string;
  email: string;
}
interface Equipamento {
  id: string;
  quantidadeDisponivel: number;
  quantidadeTotal: number;
}
interface Pedido {
  id: string;
  status: string;
  codigoRetirada?: string;
  codigoDevolucao?: string;
  responsavel: { id: string };
  dataPrevistaDevolucao: string;
  historico: { id: string; tipo: string; em: string; por: { id: string } }[];
}

// Um cenário autocontido: nenhum it usa registros deixados por outro it ou arquivo.
describe('E5 - ciclo completo de empréstimo', () => {
  it('cria contas e equipamento, aprova, retira, transfere, devolve com avaria e conclui manutenção', async () => {
    const c = await abrirCiclo();
    try {
      const { http, admin, sufixo } = c;
      const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
      const criarProfessor = async (nome: string) => {
        const email = `${nome}.${sufixo}@e5.example`;
        const conta = await dados<Conta>(
          http
            .post('/api/usuarios')
            .set(auth(admin))
            .send({
              nome: `Professor ${nome} E5`,
              email,
              cpf: cpfValido(),
              senha: 'SenhaE5-12345',
              perfil: 'usuario',
              departamento: 'Teste E5',
            }),
          201,
        );
        await c.persistido('usuarios', conta.id);
        return { ...conta, token: await c.login(email, 'SenhaE5-12345') };
      };
      const professor = await criarProfessor('origem');
      const destino = await criarProfessor('destino');
      const equipamento = await dados<Equipamento>(
        http
          .post('/api/equipamentos')
          .set(auth(admin))
          .send({
            nome: `Equipamento E5 ${sufixo}`,
            descricao: 'Equipamento exclusivo do cenário de integração',
            codigoPatrimonio: `E5-${sufixo}`,
            categoria: 'ferramenta',
            localizacao: 'Sala de testes',
            requerTreinamento: false,
            quantidadeTotal: 2,
            prazoMaximoDias: 7,
          }),
        201,
      );
      await c.persistido('equipamentos', equipamento.id);
      const estoque = async () =>
        dados<Equipamento>(
          http.get(`/api/equipamentos/${equipamento.id}`).set(auth(admin)),
        );
      const inicial = (await estoque()).quantidadeDisponivel;
      expect(inicial).toBe(2);
      const data = hoje();
      const solicitado = await dados<Pedido>(
        http
          .post('/api/emprestimos')
          .set(auth(professor.token))
          .send({
            itens: [{ equipamentoId: equipamento.id, quantidade: 1 }],
            justificativa: 'Uso em aula no cenário independente E5',
            dataPrevistaRetirada: data,
            dataPrevistaDevolucao: data,
          }),
        201,
      );
      expect(solicitado.status).toBe('pendente');
      await c.persistido('emprestimos', solicitado.id);
      expect((await estoque()).quantidadeDisponivel).toBe(inicial); // solicitar não reserva
      const aprovado = await dados<Pedido>(
        http
          .patch(`/api/emprestimos/${solicitado.id}/avaliar`)
          .set(auth(admin))
          .send({ aprovado: true }),
      );
      expect(aprovado.status).toBe('aprovado');
      expect(aprovado.codigoRetirada).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
      expect((await estoque()).quantidadeDisponivel).toBe(inicial - 1);
      const conferido = await dados<{ tipo: string; emprestimo: Pedido }>(
        http
          .get('/api/emprestimos/balcao/consulta')
          .set(auth(admin))
          .query({ codigo: aprovado.codigoRetirada }),
      );
      expect(conferido.tipo).toBe('retirada');
      expect(conferido.emprestimo.id).toBe(solicitado.id);
      const retirado = await dados<Pedido>(
        http
          .post('/api/emprestimos/balcao/retirada')
          .set(auth(admin))
          .send({ codigo: aprovado.codigoRetirada }),
        201,
      );
      expect(retirado.status).toBe('em_andamento');
      expect(retirado.codigoRetirada).toBeFalsy();
      expect(retirado.codigoDevolucao).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
      await http
        .get('/api/emprestimos/balcao/consulta')
        .set(auth(admin))
        .query({ codigo: aprovado.codigoRetirada })
        .expect(404);
      await dados<Pedido>(
        http
          .post(`/api/emprestimos/${solicitado.id}/transferencia`)
          .set(auth(professor.token))
          .send({
            paraId: destino.id,
            motivo: 'Continuidade da atividade de aula E5',
          }),
        201,
      );
      const transferido = await dados<Pedido>(
        http
          .patch(`/api/emprestimos/${solicitado.id}/transferencia/aceitar`)
          .set(auth(destino.token))
          .send({}),
      );
      expect(transferido.responsavel.id).toBe(destino.id);
      expect(transferido.dataPrevistaDevolucao).toBe(data);
      expect(transferido.codigoDevolucao).toBeTruthy();
      expect(transferido.codigoDevolucao).not.toBe(retirado.codigoDevolucao);
      await http
        .get('/api/emprestimos/balcao/consulta')
        .set(auth(admin))
        .query({ codigo: retirado.codigoDevolucao })
        .expect(404);
      const avaria = 'Cabo danificado no cenário de integração E5';
      await http
        .post('/api/emprestimos/balcao/devolucao')
        .set(auth(admin))
        .send({ codigo: transferido.codigoDevolucao, houveAvaria: true })
        .expect(400);
      const devolvido = await dados<Pedido>(
        http.post('/api/emprestimos/balcao/devolucao').set(auth(admin)).send({
          codigo: transferido.codigoDevolucao,
          houveAvaria: true,
          observacoes: avaria,
        }),
        201,
      );
      expect(devolvido.status).toBe('devolvido');
      expect(devolvido.codigoDevolucao).toBeFalsy();
      expect((await estoque()).quantidadeDisponivel).toBe(inicial - 1); // unidade avariada não fica disponível
      const manutencoes = await dados<{
        itens: { id: string; status: string; emprestimoId?: string }[];
      }>(
        http
          .get('/api/manutencoes')
          .set(auth(admin))
          .query({ equipamentoId: equipamento.id, itensPorPagina: 100 }),
      );
      expect(manutencoes.itens).toHaveLength(1);
      const manutencao = manutencoes.itens[0];
      expect(manutencao.status).toBe('avariado');
      expect(manutencao.emprestimoId).toBe(solicitado.id);
      await c.persistido('manutencoes', manutencao.id);
      await dados(
        http.patch(`/api/manutencoes/${manutencao.id}`).set(auth(admin)).send({
          status: 'em_assistencia',
          assistencia: 'Oficina de teste E5',
        }),
      );
      await dados(
        http
          .patch(`/api/manutencoes/${manutencao.id}`)
          .set(auth(admin))
          .send({ status: 'concluido' }),
      );
      expect((await estoque()).quantidadeDisponivel).toBe(inicial);
      await c.persistido('equipamentos', equipamento.id, {
        quantidade_disponivel: inicial,
      });
      await c.persistido('emprestimos', solicitado.id, {
        status: 'devolvido',
        responsavel_id: destino.id,
        codigo_retirada: null,
        codigo_devolucao: null,
      });
      await c.persistido('manutencoes', manutencao.id, { status: 'concluido' });
      const final = await dados<Pedido>(
        http.get(`/api/emprestimos/${solicitado.id}`).set(auth(admin)),
      );
      expect(final.historico.map((e) => e.tipo)).toEqual([
        'solicitado',
        'aprovado',
        'retirado',
        'transferencia_solicitada',
        'transferencia_aceita',
        'devolvido',
      ]);
      expect(final.historico.slice(0, retirado.historico.length)).toEqual(
        retirado.historico,
      );
      expect(new Set(final.historico.map((e) => e.id)).size).toBe(
        final.historico.length,
      );
      for (const evento of final.historico) {
        expect(Number.isNaN(Date.parse(evento.em))).toBe(false);
        expect(evento.por.id).toBeTruthy();
      }
      await http
        .get('/api/emprestimos/balcao/consulta')
        .set(auth(admin))
        .query({ codigo: transferido.codigoDevolucao })
        .expect(404);
    } finally {
      await c.fechar();
    }
  }, 120_000);
});
