import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { API_URL } from '../../../core/constants/api.constants';
import { criarEmprestimosDemo } from '../../../core/services/emprestimo.service';
import { AdminEmprestimos } from './admin-emprestimos';

const original = environment.modoDemo;
describe('Listagem administrativa de empréstimos', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    environment.modoDemo = false; localStorage.clear();
    TestBed.configureTestingModule({ imports: [AdminEmprestimos], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); environment.modoDemo = original; localStorage.clear(); });
  it('filtra na API por status e atrasos e mostra o responsável pelo material', () => {
    const fixture = TestBed.createComponent(AdminEmprestimos); const c = fixture.componentInstance;
    const req = http.expectOne(`${API_URL}/emprestimos?pagina=1&itensPorPagina=10`);
    req.flush({ dados: { itens: [], totalItens: 0, paginaAtual: 1, totalPaginas: 0 } });
    c.atualizarFiltro({ target: { value: 'em_andamento' } } as unknown as Event);
    http.expectOne(`${API_URL}/emprestimos?status=em_andamento&pagina=1&itensPorPagina=10`)
      .flush({ dados: { itens: [], totalItens: 0, paginaAtual: 1, totalPaginas: 0 } });
    c.atualizarAtrasados({ target: { checked: true } } as unknown as Event);
    const atraso = { ...criarEmprestimosDemo()[0], status: 'atrasado' };
    http.expectOne(`${API_URL}/emprestimos?status=em_andamento&atrasadosApenas=true&pagina=1&itensPorPagina=10`)
      .flush({ dados: { itens: [atraso], totalItens: 1, paginaAtual: 1, totalPaginas: 1 } });
    fixture.detectChanges();
    const linha = fixture.nativeElement.querySelector('tbody tr') as HTMLElement;
    expect(linha.textContent).toContain(atraso.responsavel.nome); expect(linha.textContent).toContain('Atrasado');
    expect(linha.textContent).toContain(atraso.itens[0].equipamentoId);
  });
  it('cancela a resposta antiga ao trocar filtros e exibe erro de carregamento', () => {
    const fixture = TestBed.createComponent(AdminEmprestimos);
    const antiga = http.expectOne(`${API_URL}/emprestimos?pagina=1&itensPorPagina=10`);
    fixture.componentInstance.atualizarFiltro({ target: { value: 'devolvido' } } as unknown as Event);
    expect(antiga.cancelled).toBe(true);
    http.expectOne(`${API_URL}/emprestimos?status=devolvido&pagina=1&itensPorPagina=10`)
      .flush({ mensagem: 'Serviço indisponível' }, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges(); expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('Serviço indisponível');
  });
});
