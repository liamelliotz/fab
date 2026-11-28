import { TestBed } from '@angular/core/testing';
import { AcessibilidadeService, PREFERENCIAS_PADRAO } from './acessibilidade.service';

// Tema (claro, escuro, automático) e fonte de leitura fácil: classes no <html> e preferência salva.
describe('AcessibilidadeService: tema e fonte', () => {
  let service: AcessibilidadeService;
  const html = () => document.documentElement.classList;

  beforeEach(() => {
    localStorage.clear();
    html().remove('tema-escuro', 'a11y-fonte-legivel');
    TestBed.configureTestingModule({});
    service = TestBed.inject(AcessibilidadeService);
    // O VLibras carrega um script externo: fica desligado nos testes.
    service.mudar('libras', false);
    TestBed.tick();
  });

  afterEach(() => {
    localStorage.clear();
    html().remove('tema-escuro', 'a11y-fonte-legivel');
  });

  it('começa no tema claro, sem a fonte de leitura fácil', () => {
    expect(PREFERENCIAS_PADRAO.tema).toBe('claro');
    expect(service.temaAtual()).toBe('claro');
    expect(html().contains('tema-escuro')).toBe(false);
  });

  it('tema escuro e fonte de leitura fácil viram classes no <html> e ficam salvos', () => {
    service.mudar('tema', 'escuro');
    service.mudar('fonteLegivel', true);
    TestBed.tick();
    expect(html().contains('tema-escuro')).toBe(true);
    expect(html().contains('a11y-fonte-legivel')).toBe(true);
    // O index.html lê esta chave antes do app carregar (a tela não pisca em branco)
    expect(JSON.parse(localStorage.getItem('fab_acessibilidade')!)).toMatchObject({ tema: 'escuro', fonteLegivel: true });

    service.restaurar();
    TestBed.tick();
    expect(html().contains('tema-escuro')).toBe(false);
    expect(html().contains('a11y-fonte-legivel')).toBe(false);
  });

  it('o tema automático segue o sistema', () => {
    service.mudar('tema', 'sistema');
    TestBed.tick();
    const sistemaEscuro = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    expect(service.temaAtual()).toBe(sistemaEscuro ? 'escuro' : 'claro');
  });
});
