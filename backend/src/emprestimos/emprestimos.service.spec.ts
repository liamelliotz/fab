import { EmprestimosRepository } from './emprestimos.repository.js';
import { EmprestimosService } from './emprestimos.service.js';

describe('EmprestimosService: protocolo', () => {
  let repositorio: EmprestimosRepository;
  let service: EmprestimosService;

  beforeEach(async () => {
    repositorio = new EmprestimosRepository();
    await repositorio.onModuleInit(); // carrega o seed (até EMP-AAAA-0045)
    service = new EmprestimosService(repositorio);
  });

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
