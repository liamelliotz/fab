import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { API_URL } from '../../../core/constants/api.constants';
import { Emprestimo } from '../../../core/models/emprestimo.model';
import { criarEmprestimosDemo } from '../../../core/services/emprestimo.service';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AdminBalcao } from './admin-balcao';
import { AdminSolicitacoes } from '../solicitacoes/admin-solicitacoes';

const original = environment.modoDemo;
function pedido(status: Emprestimo['status'] = 'aprovado'): Emprestimo { return { ...criarEmprestimosDemo()[0], status }; }
describe('Balcão administrativo pela tela e HTTP', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); environment.modoDemo = false;
    TestBed.configureTestingModule({ imports: [AdminBalcao, AdminSolicitacoes], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { listas(); http.verify(); TestBed.inject(NotificationService).limpar(); environment.modoDemo = original; localStorage.clear(); sessionStorage.clear(); });
  /** Com a API, o balcão carrega as listas "aguardando retirada" e "em uso" ao abrir e após cada registro. */
  function listas() {
    for (const req of http.match((r) => r.method === 'GET' && r.url === `${API_URL}/emprestimos`
      && ['aprovado', 'em_andamento'].includes(r.params.get('status') ?? ''))) {
      req.flush({ dados: { itens: [], totalItens: 0, paginaAtual: 1, totalPaginas: 0, temAnterior: false, temProxima: false } });
    }
  }
  function abrir() { const f = TestBed.createComponent(AdminBalcao); f.detectChanges(); listas(); return f; }
  function digitar(f: ComponentFixture<AdminBalcao>, codigo: string) {
    const input = f.nativeElement.querySelector('input[type=text]') as HTMLInputElement;
    input.value = codigo; input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    f.detectChanges();
  }
  function confirmar(f: ComponentFixture<AdminBalcao>) {
    (f.nativeElement.querySelector('.bal__acoes .bal__btn--ok') as HTMLButtonElement).click(); f.detectChanges();
  }
  it('QR seguido de Enter só consulta; o POST exige confirmação explícita', () => {
    const f = abrir(); digitar(f, 'FAB:R:EMP-2026-0042:k7m4px');
    const req = http.expectOne(`${API_URL}/emprestimos/balcao/consulta?codigo=K7M4PX`);
    expect(req.request.method).toBe('GET');
    req.flush({ dados: { tipo: 'retirada', emprestimo: pedido() } }); f.detectChanges();
    http.expectNone((r) => r.method === 'POST');
    confirmar(f); f.componentInstance.confirmar();
    const retirada = http.expectOne(`${API_URL}/emprestimos/balcao/retirada`);
    expect(retirada.request.body).toEqual({ codigo: 'K7M4PX' });
    retirada.flush({ dados: pedido('em_andamento') }); f.detectChanges();
    expect(f.componentInstance.alvo()).toBeNull(); expect(f.componentInstance.codigo()).toBe('');
  });
  it('código já usado mostra a mensagem original e não permite confirmar', () => {
    const f = abrir(); digitar(f, 'K7M4PX');
    http.expectOne(`${API_URL}/emprestimos/balcao/consulta?codigo=K7M4PX`)
      .flush({ mensagem: 'Código já utilizado ou não encontrado' }, { status: 404, statusText: 'Not Found' });
    f.detectChanges(); expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('Código já utilizado');
    f.componentInstance.confirmar(); http.expectNone((r) => r.method === 'POST');
  });
  it('observações são obrigatórias na devolução com avaria e seguem para a API', () => {
    const f = abrir(); f.componentInstance.trocarAba('devolucao'); f.detectChanges();
    digitar(f, 'P8X2MJ');
    http.expectOne(`${API_URL}/emprestimos/balcao/consulta?codigo=P8X2MJ`)
      .flush({ dados: { tipo: 'devolucao', emprestimo: pedido('atrasado') } }); f.detectChanges();
    (f.nativeElement.querySelector('.dev__opcao--problema') as HTMLButtonElement).click(); f.detectChanges();
    expect((f.nativeElement.querySelector('textarea') as HTMLTextAreaElement).required).toBe(true);
    confirmar(f); http.expectNone((r) => r.method === 'POST');
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('observações');
    const obs = f.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    obs.value = 'Cabo rompido'; obs.dispatchEvent(new Event('input')); confirmar(f);
    const req = http.expectOne(`${API_URL}/emprestimos/balcao/devolucao`);
    expect(req.request.body).toEqual({ codigo: 'P8X2MJ', houveAvaria: true, observacoes: 'Cabo rompido' });
    req.flush({ dados: pedido('devolvido') }); f.detectChanges();
    expect(f.componentInstance.alvo()).toBeNull();
    expect(TestBed.inject(NotificationService).notificacoes()[0].mensagem).toContain('com avaria');
  });
  it('não aceita código da outra operação e cancela consulta antiga ao trocar aba', () => {
    const f = abrir(); digitar(f, 'FAB:D:EMP-2026-0044:P8X2MJ');
    http.expectNone(() => true); expect(f.componentInstance.erro()).toContain('outra operação');
    digitar(f, 'K7M4PX');
    const req = http.expectOne(`${API_URL}/emprestimos/balcao/consulta?codigo=K7M4PX`);
    f.componentInstance.trocarAba('devolucao');
    expect(req.cancelled).toBe(true); expect(f.componentInstance.alvo()).toBeNull();
    digitar(f, 'P8X2MJ');
    http.expectOne(`${API_URL}/emprestimos/balcao/consulta?codigo=P8X2MJ`)
      .flush({ dados: { tipo: 'retirada', emprestimo: pedido() } });
    expect(f.componentInstance.erro()).toContain('Use a aba Retirada');
    expect(f.componentInstance.alvo()).toBeNull();
  });
  it('após disputa de código no POST exige nova conferência e mantém o erro da API', () => {
    const f = abrir(); digitar(f, 'K7M4PX');
    http.expectOne(`${API_URL}/emprestimos/balcao/consulta?codigo=K7M4PX`)
      .flush({ dados: { tipo: 'retirada', emprestimo: pedido() } }); f.detectChanges(); confirmar(f);
    http.expectOne(`${API_URL}/emprestimos/balcao/retirada`)
      .flush({ mensagem: 'Código já utilizado por outro atendimento' }, { status: 409, statusText: 'Conflict' }); f.detectChanges();
    expect(f.componentInstance.alvo()).toBeNull(); expect(f.nativeElement.textContent).toContain('Código já utilizado por outro atendimento');
  });
  it('percorre aprovação, consulta, retirada e devolução pela UI com respostas controladas', () => {
    const sol = TestBed.createComponent(AdminSolicitacoes); const pendente = pedido('pendente');
    http.expectOne(`${API_URL}/emprestimos?status=pendente&pagina=1&itensPorPagina=10`)
      .flush({ dados: { itens: [pendente], totalItens: 1, paginaAtual: 1, totalPaginas: 1, temAnterior: false, temProxima: false } });
    sol.detectChanges(); (sol.nativeElement.querySelector('.sol__btn--aprovar') as HTMLButtonElement).click(); sol.detectChanges();
    (sol.nativeElement.querySelector('.sol__painel .sol__btn--aprovar') as HTMLButtonElement).click();
    http.expectOne(`${API_URL}/emprestimos/${pendente.id}/avaliar`).flush({ dados: { ...pendente, status: 'aprovado', codigoRetirada: 'K7M4PX' } });
    http.expectOne(`${API_URL}/emprestimos?status=pendente&pagina=1&itensPorPagina=10`)
      .flush({ dados: { itens: [], totalItens: 0, paginaAtual: 1, totalPaginas: 0, temAnterior: false, temProxima: false } });
    const f = abrir(); digitar(f, 'K7M4PX');
    http.expectOne(`${API_URL}/emprestimos/balcao/consulta?codigo=K7M4PX`)
      .flush({ dados: { tipo: 'retirada', emprestimo: pedido() } }); f.detectChanges(); confirmar(f);
    http.expectOne(`${API_URL}/emprestimos/balcao/retirada`).flush({ dados: { ...pedido('em_andamento'), codigoDevolucao: 'P8X2MJ' } });
    f.componentInstance.trocarAba('devolucao'); f.detectChanges(); digitar(f, 'FAB:D:EMP-2026-0042:P8X2MJ');
    http.expectOne(`${API_URL}/emprestimos/balcao/consulta?codigo=P8X2MJ`)
      .flush({ dados: { tipo: 'devolucao', emprestimo: pedido('em_andamento') } }); f.detectChanges(); confirmar(f);
    const dev = http.expectOne(`${API_URL}/emprestimos/balcao/devolucao`);
    expect(dev.request.body).toEqual({ codigo: 'P8X2MJ', houveAvaria: false }); dev.flush({ dados: pedido('devolvido') });
    expect(f.componentInstance.alvo()).toBeNull();
  });
  it('unidades com avaria e faltando seguem para a API descritas nas observações', () => {
    const f = abrir(); f.componentInstance.trocarAba('devolucao'); f.detectChanges();
    const emprestado = { ...pedido('em_andamento'), itens: [{ ...pedido().itens[0], quantidade: 3 }] };
    digitar(f, 'P8X2MJ');
    http.expectOne(`${API_URL}/emprestimos/balcao/consulta?codigo=P8X2MJ`)
      .flush({ dados: { tipo: 'devolucao', emprestimo: emprestado } }); f.detectChanges();
    (f.nativeElement.querySelector('.dev__opcao--problema') as HTMLButtonElement).click(); f.detectChanges();
    const item = emprestado.itens[0];
    f.componentInstance.mudarQuantidade(item, 'avariadas', 1);
    f.componentInstance.mudarAvaria(item.equipamentoId, { gravidade: 'grave', descricao: 'Tela trincada' });
    f.componentInstance.mudarQuantidade(item, 'faltando', 1); f.detectChanges();
    expect((f.nativeElement.querySelector('textarea') as HTMLTextAreaElement).required).toBe(false);
    confirmar(f);
    const nome = TestBed.inject(EquipamentoService).buscarPorId(item.equipamentoId)?.nome ?? item.equipamento?.nome;
    const req = http.expectOne(`${API_URL}/emprestimos/balcao/devolucao`);
    expect(req.request.body).toEqual({ codigo: 'P8X2MJ', houveAvaria: true,
      observacoes: `${nome}: 1 com avaria (grave) - Tela trincada; 1 faltando` });
    req.flush({ dados: pedido('devolvido') }); f.detectChanges();
    expect(TestBed.inject(NotificationService).notificacoes()[0].mensagem).toContain('Veja em Manutenção');
  });
});
