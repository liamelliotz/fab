import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { API_URL } from '../constants/api.constants';

const envelope = <T>(dados: T) => ({ sucesso: true, dados, mensagem: 'OK', erros: [], timestamp: '2026-11-16T12:00:00Z' });

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('monta URL, codifica filtros, preserva false/0 e ignora vazios', () => {
    let resultado: unknown;
    api.get('/equipamentos', { busca: 'cabo & fonte', categoria: '', outro: '  ', pagina: 0,
      ativo: false, omitido: undefined, nulo: null, ids: ['a', '', 'b'], vazia: [] })
      .subscribe((dados) => resultado = dados);
    const req = http.expectOne((r) => r.url === `${API_URL}/equipamentos`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['ativo', 'busca', 'ids', 'pagina']);
    expect(req.request.params.get('ativo')).toBe('false');
    expect(req.request.params.get('pagina')).toBe('0');
    expect(req.request.params.getAll('ids')).toEqual(['a', 'b']);
    expect(req.request.urlWithParams).toContain('cabo%20%26%20fonte');
    req.flush(envelope({ itens: [{ id: 'eq1' }], totalItens: 1 }));
    expect(resultado).toEqual({ itens: [{ id: 'eq1' }], totalItens: 1 });
  });

  for (const metodo of ['post', 'patch', 'put'] as const) {
    it(`${metodo} envia corpo e devolve somente dados`, () => {
      let resultado: unknown;
      api[metodo]('usuarios/u1', { nome: 'Ana' }, { ativo: true }).subscribe((dados) => resultado = dados);
      const req = http.expectOne(`${API_URL}/usuarios/u1?ativo=true`);
      expect(req.request.method).toBe(metodo.toUpperCase());
      expect(req.request.body).toEqual({ nome: 'Ana' });
      req.flush(envelope({ id: 'u1', nome: 'Ana' }));
      expect(resultado).toEqual({ id: 'u1', nome: 'Ana' });
    });
  }
  it('delete aceita filtros e respostas com dados nulos', () => {
    let resultado: unknown = 'pendente';
    api.delete('/emprestimos/e1/transferencia', { motivo: '' }).subscribe((dados) => resultado = dados);
    const req = http.expectOne(`${API_URL}/emprestimos/e1/transferencia`);
    expect(req.request.method).toBe('DELETE');
    req.flush(envelope(null));
    expect(resultado).toBeNull();
  });
});
