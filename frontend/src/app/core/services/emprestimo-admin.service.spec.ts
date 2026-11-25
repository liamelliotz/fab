import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { EmprestimoAdminService } from './emprestimo-admin.service';
import { AuthService } from './auth.service';
import { criarEmprestimosDemo } from './emprestimo.service';
import { API_URL } from '../constants/api.constants';

// Estes testes usam as contas da demonstração (entrarComoDemo): rodam com o modo demonstração ligado.
const modoDemoDoAmbiente = environment.modoDemo;
beforeEach(() => { environment.modoDemo = true; });
afterEach(() => { environment.modoDemo = modoDemoDoAmbiente; });

const original = environment.modoDemo;
describe('EmprestimoAdminService e contrato HTTP', () => {
  let service: EmprestimoAdminService;
  let http: HttpTestingController;
  beforeEach(() => {
    environment.modoDemo = false; localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EmprestimoAdminService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); environment.modoDemo = original; localStorage.clear(); sessionStorage.clear(); });
  it('envia filtros e paginação à API e devolve a página do envelope', () => {
    const receber = vi.fn();
    service.listar({ status: 'aprovado', atrasadosApenas: true, pagina: 2, itensPorPagina: 10,
      solicitanteId: 'usr-joao', dataInicio: '2026-01-01', dataFim: '2026-12-31' }).subscribe(receber);
    const req = http.expectOne((r) => r.url === `${API_URL}/emprestimos`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('pagina')).toBe('2');
    expect(req.request.params.get('atrasadosApenas')).toBe('true');
    expect(req.request.params.get('solicitanteId')).toBe('usr-joao');
    expect(req.request.params.get('status')).toBe('aprovado');
    const dados = { itens: [], totalItens: 0, paginaAtual: 2, totalPaginas: 0, itensPorPagina: 10, temProxima: false, temAnterior: true };
    req.flush({ sucesso: true, dados }); expect(receber).toHaveBeenCalledWith(dados);
  });
  it('avalia por PATCH e preserva a mensagem de estoque insuficiente, sem fallback', () => {
    const erro = vi.fn();
    service.avaliar('p1', { aprovado: true }).subscribe({ error: erro });
    const req = http.expectOne(`${API_URL}/emprestimos/p1/avaliar`);
    expect(req.request.method).toBe('PATCH'); expect(req.request.body).toEqual({ aprovado: true });
    req.flush({ mensagem: 'Estoque insuficiente' }, { status: 409, statusText: 'Conflict' });
    expect(erro.mock.calls[0][0].error.mensagem).toBe('Estoque insuficiente');
  });
  it('consulta QR normalizado via GET e retira por POST com somente codigo', () => {
    service.consultarCodigo('FAB:R:EMP-2026-0042:k7m4px').subscribe();
    const req = http.expectOne(`${API_URL}/emprestimos/balcao/consulta?codigo=K7M4PX`);
    expect(req.request.method).toBe('GET'); req.flush({ dados: { tipo: 'retirada', emprestimo: criarEmprestimosDemo()[0] } });
    service.retirar('k7m-4px').subscribe();
    const retirada = http.expectOne(`${API_URL}/emprestimos/balcao/retirada`);
    expect(retirada.request.method).toBe('POST'); expect(retirada.request.body).toEqual({ codigo: 'K7M4PX' });
    retirada.flush({ dados: criarEmprestimosDemo()[0] });
  });
  it('exige observações para avaria e envia devolução no contrato, sem data inventada', () => {
    const erro = vi.fn();
    service.devolver({ codigo: 'P8X2MJ', houveAvaria: true, observacoes: '  ' }).subscribe({ error: erro });
    http.expectNone(`${API_URL}/emprestimos/balcao/devolucao`); expect(erro).toHaveBeenCalledOnce();
    service.devolver({ codigo: 'FAB:D:EMP-2026-0044:p8x2mj', houveAvaria: true, observacoes: '  Cabo rompido  ' }).subscribe();
    const req = http.expectOne(`${API_URL}/emprestimos/balcao/devolucao`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ codigo: 'P8X2MJ', houveAvaria: true, observacoes: 'Cabo rompido' });
    req.flush({ dados: criarEmprestimosDemo()[0] });
  });
  it('modo demo mantém paginação e o ciclo local sem enviar HTTP', () => {
    TestBed.resetTestingModule(); environment.modoDemo = true;
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).entrarComoDemo('usr-admin');
    service = TestBed.inject(EmprestimoAdminService);
    const receber = vi.fn();
    service.listar({ status: 'pendente', itensPorPagina: 1 }).subscribe(receber);
    expect(receber.mock.calls[0][0].itens).toHaveLength(1);
    expect(receber.mock.calls[0][0].itens[0].status).toBe('pendente');
    const pedido = receber.mock.calls[0][0].itens[0];
    let codigo = '';
    service.avaliar(pedido.id, { aprovado: true }).subscribe((s) => codigo = s.codigoRetirada!);
    expect(codigo).toHaveLength(6);
    service.retirar(codigo).subscribe((s) => {
      expect(s.status).toBe('em_andamento');
      service.devolver({ codigo: s.codigoDevolucao!, houveAvaria: false }).subscribe((fim) => expect(fim.status).toBe('devolvido'));
    });
    http.expectNone(() => true);
  });
});
