import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  StatusEmprestimo,
  TipoEventoEmprestimo,
} from '../common/enums/index.js';
import {
  EMPRESTIMO_IDS as EMP,
  USUARIO_IDS as USR,
} from '../common/seed/ids.js';
import type { EquipamentosService } from '../equipamentos/equipamentos.service.js';
import type { UsuariosService } from '../usuarios/usuarios.service.js';
import { EmprestimosRepository } from './emprestimos.repository.js';
import { EmprestimosService } from './emprestimos.service.js';

describe('EmprestimosService', () => {
  let repositorio: EmprestimosRepository;
  let service: EmprestimosService;
  let reservarVarios: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    repositorio = new EmprestimosRepository();
    await repositorio.onModuleInit();

    reservarVarios = vi.fn().mockResolvedValue([]);
    const equipamentos = {
      reservarVarios,
    } as unknown as EquipamentosService;

    service = new EmprestimosService(
      repositorio,
      null as unknown as UsuariosService,
      equipamentos,
    );
  });

  describe('gerarProtocolo', () => {
    it('continua depois do maior número do seed', async () => {
      expect(await service.gerarProtocolo('2026-11-11')).toBe('EMP-2026-0046');
      expect(await service.gerarProtocolo('2026-11-11')).toBe('EMP-2026-0047');
    });

    it('recomeça em 0001 a cada ano', async () => {
      expect(await service.gerarProtocolo('2027-01-02')).toBe('EMP-2027-0001');
      expect(await service.gerarProtocolo('2027-01-02')).toBe('EMP-2027-0002');
    });

    it('pedidos simultâneos nunca recebem o mesmo protocolo', async () => {
      const protocolos = await Promise.all(
        Array.from({ length: 50 }, () => service.gerarProtocolo('2026-11-11')),
      );
      expect(new Set(protocolos).size).toBe(50);
    });

    it('redefinir() zera o contador junto com os dados', async () => {
      await service.gerarProtocolo('2026-11-11');
      await repositorio.redefinir();
      expect(await service.gerarProtocolo('2026-11-11')).toBe('EMP-2026-0046');
    });
  });

  describe('avaliar', () => {
    it('aprova pedido pendente, reserva equipamentos e gera código de retirada', async () => {
      const resultado = await service.avaliar(
        EMP.pendenteJoao,
        { aprovado: true },
        USR.admin,
      );

      expect(reservarVarios).toHaveBeenCalledOnce();
      expect(resultado.status).toBe(StatusEmprestimo.Aprovado);
      expect(resultado.avaliadoPorId).toBe(USR.admin);
      expect(resultado.codigoRetirada).toMatch(/^[A-Z0-9]{6}$/);
      expect(resultado.historico.at(-1)?.tipo).toBe(
        TipoEventoEmprestimo.Aprovado,
      );
    });

    it('rejeita pedido pendente e registra o motivo', async () => {
      const motivo = 'Equipamento reservado para outra atividade.';

      const resultado = await service.avaliar(
        EMP.pendenteJoao,
        { aprovado: false, motivo },
        USR.admin,
      );

      expect(resultado.status).toBe(StatusEmprestimo.Rejeitado);
      expect(resultado.avaliadoPorId).toBe(USR.admin);
      expect(resultado.motivoRejeicao).toBe(motivo);
      expect(resultado.historico.at(-1)?.tipo).toBe(
        TipoEventoEmprestimo.Rejeitado,
      );
      expect(resultado.historico.at(-1)?.detalhe).toBe(motivo);
      expect(reservarVarios).not.toHaveBeenCalled();
    });

    it('não aprova se a reserva de estoque falhar', async () => {
      reservarVarios.mockRejectedValueOnce(
        new ConflictException('Estoque insuficiente.'),
      );

      await expect(
        service.avaliar(EMP.pendenteJoao, { aprovado: true }, USR.admin),
      ).rejects.toBeInstanceOf(ConflictException);

      const pedido = await repositorio.buscarPorId(EMP.pendenteJoao);
      expect(pedido?.status).toBe(StatusEmprestimo.Pendente);
      expect(pedido?.codigoRetirada).toBeUndefined();
    });

    it('não avalia pedido que não está pendente', async () => {
      await expect(
        service.avaliar(EMP.aprovadoProfessor, { aprovado: true }, USR.admin),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('cancelar', () => {
    it('permite ao solicitante cancelar o próprio pedido pendente', async () => {
      const resultado = await service.cancelar(EMP.pendenteJoao, USR.joao);

      expect(resultado.status).toBe(StatusEmprestimo.Cancelado);
      expect(resultado.historico.at(-1)?.tipo).toBe(
        TipoEventoEmprestimo.Cancelado,
      );
      expect(resultado.historico.at(-1)?.porId).toBe(USR.joao);
    });

    it('impede outro usuário de cancelar o pedido', async () => {
      await expect(
        service.cancelar(EMP.pendenteJoao, USR.carlos),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const pedido = await repositorio.buscarPorId(EMP.pendenteJoao);
      expect(pedido?.status).toBe(StatusEmprestimo.Pendente);
    });

    it('não permite cancelar pedido que não está pendente', async () => {
      await expect(
        service.cancelar(EMP.aprovadoProfessor, USR.professor),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
