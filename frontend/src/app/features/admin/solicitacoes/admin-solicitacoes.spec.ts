import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { API_URL } from '../../../core/constants/api.constants';
import { criarEmprestimosDemo } from '../../../core/services/emprestimo.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AdminSolicitacoes } from './admin-solicitacoes';

const original = environment.modoDemo;
const pendente = () => criarEmprestimosDemo().find((s) => s.status === 'pendente')!;
function pagina(itens: unknown[], p = 1, total = itens.length) {
  return { dados: { itens, paginaAtual: p, itensPorPagina: 10, totalItens: total, totalPaginas: Math.ceil(total / 10), temAnterior: p > 1, temProxima: p * 10 < total } };
}
describe('Solicitações administrativas pela API', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); environment.modoDemo = false;
    TestBed.configureTestingModule({ imports: [AdminSolicitacoes], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.inject(NotificationService).limpar(); environment.modoDemo = original; localStorage.clear(); sessionStorage.clear(); });
  function abrir(total = 1) {
    const fixture = TestBed.createComponent(AdminSolicitacoes);
    const req = http.expectOne(`${API_URL}/emprestimos?status=pendente&pagina=1&itensPorPagina=10`);
    req.flush(pagina([pendente()], 1, total)); fixture.detectChanges(); return fixture;
  }
  it('lista pendentes com paginação e pede a segunda página ao backend', () => {
    const fixture = abrir(11);
    fixture.componentInstance.mudarPagina(1);
    http.expectOne(`${API_URL}/emprestimos?status=pendente&pagina=2&itensPorPagina=10`).flush(pagina([pendente()], 2, 11));
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Página 2 de 2');
  });
  it('mostra estoque insuficiente no painel, sem aprovar localmente ou duplicar o envio', () => {
    const fixture = abrir();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.sol__btn--aprovar') as HTMLButtonElement).click(); fixture.detectChanges();
    const confirmar = el.querySelector('.sol__painel .sol__btn--aprovar') as HTMLButtonElement;
    confirmar.click(); confirmar.click();
    const req = http.expectOne(`${API_URL}/emprestimos/${pendente().id}/avaliar`);
    expect(req.request.body).toEqual({ aprovado: true });
    req.flush({ mensagem: 'Estoque insuficiente para o item' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Estoque insuficiente');
    expect(fixture.componentInstance.selecionada()?.status).toBe('pendente');
  });
  it('reprovar exige 5 a 300 caracteres e atualiza a lista depois da resposta', () => {
    const fixture = abrir(); const c = fixture.componentInstance;
    c.iniciar(pendente(), 'reprovar'); c.justificativa.set('não'); c.confirmar();
    http.expectNone((r) => r.method === 'PATCH'); expect(c.erro()).toContain('5 a 300');
    c.justificativa.set('Sem justificativa de uso'); c.confirmar();
    const req = http.expectOne(`${API_URL}/emprestimos/${pendente().id}/avaliar`);
    expect(req.request.body).toEqual({ aprovado: false, motivo: 'Sem justificativa de uso' });
    req.flush({ dados: { ...pendente(), status: 'rejeitado' } });
    http.expectOne(`${API_URL}/emprestimos?status=pendente&pagina=1&itensPorPagina=10`).flush(pagina([]));
    expect(c.selecionada()).toBeNull(); expect(c.resposta()?.itens).toHaveLength(0);
  });
});
