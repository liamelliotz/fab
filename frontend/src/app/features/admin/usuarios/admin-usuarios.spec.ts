import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { API_URL } from '../../../core/constants/api.constants';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { Usuario } from '../../../core/models/usuario.model';
import { NotificationService } from '../../../core/services/notification.service';
import { AdminUsuarios } from './admin-usuarios';

const modoOriginal = environment.modoDemo;
const joao: Usuario = {
  id: 'usr-joao', nome: 'João Silva', email: 'joao@escola.br', cpf: '39053344705',
  perfil: 'usuario', status: 'ativo', habilitacoes: [], criadoEm: '2026-08-01T10:00:00.000Z',
};
const pagina = (itens: Usuario[], total = itens.length) => ({
  sucesso: true,
  dados: { itens, totalItens: total, paginaAtual: 1, totalPaginas: 1, itensPorPagina: 10, temProxima: false, temAnterior: false },
});

describe('Tela de Usuários com a API (card A7)', () => {
  let http: HttpTestingController;

  /** Responde as listas de /usuarios pendentes: a página da tabela e as contagens dos cartões. */
  function responderUsuarios(itens: Usuario[] = [joao]) {
    for (const req of http.match((r) => r.method === 'GET' && r.url === `${API_URL}/usuarios`)) {
      req.flush(req.request.params.get('itensPorPagina') === '1' ? pagina([], 6) : pagina(itens));
    }
  }

  /** Abre a tela e responde o que ela pede: equipamentos com treinamento, lista e totais. */
  function abrir() {
    const f = TestBed.createComponent(AdminUsuarios);
    f.detectChanges();
    http.expectOne((r) => r.url === `${API_URL}/equipamentos`).flush({
      dados: { itens: [{ id: 'eqp-impressora-3d', nome: 'Impressora 3D', requerTreinamento: true, status: 'disponivel' }], totalItens: 1 },
    });
    responderUsuarios();
    f.detectChanges();
    return f;
  }

  beforeEach(() => {
    environment.modoDemo = false;
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [AdminUsuarios],
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    TestBed.inject(NotificationService).limpar();
    environment.modoDemo = modoOriginal;
    localStorage.clear(); sessionStorage.clear();
  });

  it('a tabela e os totais vêm da API', () => {
    const f = abrir();
    expect(f.nativeElement.textContent).toContain('João Silva');
    expect(f.componentInstance.totais().usuarios).toBe(6);
  });

  it('a busca é feita no servidor e volta para a página 1', async () => {
    vi.useFakeTimers();
    const f = abrir();
    const campo = f.nativeElement.querySelector('input.busca') as HTMLInputElement;
    campo.value = 'ana'; campo.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(350);
    const reqs = http.match((r) => r.url === `${API_URL}/usuarios` && r.params.get('busca') === 'ana');
    expect(reqs.length).toBe(1);
    expect(reqs[0].request.params.get('pagina')).toBe('1');
    reqs[0].flush(pagina([]));
    responderUsuarios([]);
    vi.useRealTimers();
  });

  it('bloquear chama PATCH /status e recarrega a lista', () => {
    const f = abrir();
    const bloquear = [...f.nativeElement.querySelectorAll('button')]
      .find((b) => (b as HTMLElement).textContent?.trim() === 'Bloquear') as HTMLButtonElement;
    bloquear.click();
    const req = http.expectOne(`${API_URL}/usuarios/usr-joao/status`);
    expect(req.request.body).toEqual({ status: 'bloqueado' });
    req.flush({ dados: { ...joao, status: 'bloqueado' } });
    responderUsuarios([{ ...joao, status: 'bloqueado' }]);
    expect(TestBed.inject(NotificationService).notificacoes().at(-1)?.mensagem).toContain('bloqueado');
  });

  it('habilitações salvam a lista inteira com os ids da API', () => {
    const f = abrir();
    f.componentInstance.abrirHabilitacoes(joao); f.detectChanges();
    const caixa = f.nativeElement.querySelector('.hab input[type=checkbox]') as HTMLInputElement;
    caixa.checked = true; caixa.dispatchEvent(new Event('change'));
    f.componentInstance.salvarHabilitacoes();
    const req = http.expectOne(`${API_URL}/usuarios/usr-joao/habilitacoes`);
    expect(req.request.body).toEqual({ equipamentoIds: ['eqp-impressora-3d'] });
    req.flush({ dados: joao });
    responderUsuarios();
  });

  it('409 da API (e-mail repetido) aparece pelo serviço de notificações e o formulário continua aberto', () => {
    const f = abrir();
    f.componentInstance.alternarForm();
    f.componentInstance.form.setValue({
      nome: 'João Repetido', email: 'joao@escola.br', cpf: '153.509.460-56', telefone: '(96) 99111-0009',
      departamento: '', matricula: '', perfil: 'usuario', senha: 'senha-123',
    });
    f.componentInstance.criar();
    http.expectOne((r) => r.method === 'POST' && r.url === `${API_URL}/usuarios`).flush(
      { sucesso: false, mensagem: 'Já existe um usuário com este e-mail.', erros: [] },
      { status: 409, statusText: 'Conflict' },
    );
    const avisos = TestBed.inject(NotificationService).notificacoes();
    expect(avisos.at(-1)).toEqual(expect.objectContaining({ tipo: 'erro', mensagem: 'Já existe um usuário com este e-mail.' }));
    expect(f.componentInstance.formAberto()).toBe(true);
  });

  it('400 de validação mostra a mensagem e os campos pelo serviço de notificações', () => {
    const f = abrir();
    f.componentInstance.form.setValue({
      nome: 'Bia Souza', email: 'bia@escola.br', cpf: '153.509.460-56', telefone: '(96) 99111-0009',
      departamento: '', matricula: '', perfil: 'usuario', senha: 'senha-123',
    });
    f.componentInstance.criar();
    http.expectOne((r) => r.method === 'POST' && r.url === `${API_URL}/usuarios`).flush(
      { sucesso: false, mensagem: 'Dados inválidos.', erros: ['cpf: CPF inválido.'] },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(TestBed.inject(NotificationService).notificacoes().at(-1)?.erros).toEqual(['cpf: CPF inválido.']);
  });
});
