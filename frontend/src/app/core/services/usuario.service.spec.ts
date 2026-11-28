import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { API_URL } from '../constants/api.constants';
import { UsuarioService } from './usuario.service';

const modoOriginal = environment.modoDemo;
const pagina = (itens: unknown[] = []) => ({
  sucesso: true,
  dados: { itens, totalItens: itens.length, paginaAtual: 1, totalPaginas: 1, itensPorPagina: 10, temProxima: false, temAnterior: false },
});

describe('UsuarioService com a API (cards A6 e A7)', () => {
  let http: HttpTestingController;
  let service: UsuarioService;

  beforeEach(() => {
    environment.modoDemo = false;
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => {
    http?.verify();
    environment.modoDemo = modoOriginal;
    localStorage.clear(); sessionStorage.clear();
  });
  function iniciar() {
    service = TestBed.inject(UsuarioService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  }

  it('com a API, nenhuma conta nem senha fica no navegador (e a sobra da demonstração é apagada)', () => {
    localStorage.setItem('fab_demo_v9_usuarios', '[{"email":"professor@fab.com"}]');
    localStorage.setItem('fab_demo_v9_senhas', '{"professor@fab.com":"prof123"}');
    iniciar();
    expect(localStorage.getItem('fab_demo_v9_usuarios')).toBeNull();
    expect(localStorage.getItem('fab_demo_v9_senhas')).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain('prof123');
  });

  it('as contas de exemplo não têm campo senha e usam os ids do seed da API', () => {
    iniciar();
    const contas = service.todos();
    expect(contas.map((u) => u.id)).toEqual(['usr-admin', 'usr-professor', 'usr-joao', 'usr-maria', 'usr-carlos', 'usr-ana']);
    expect(contas.some((u) => 'senha' in u)).toBe(false);
  });

  it('listar envia busca e paginação para GET /usuarios', () => {
    iniciar();
    const receber = vi.fn();
    service.listar({ busca: 'ana', pagina: 2, itensPorPagina: 10 }).subscribe(receber);
    const req = http.expectOne((r) => r.url === `${API_URL}/usuarios`);
    expect(req.request.params.get('busca')).toBe('ana');
    expect(req.request.params.get('pagina')).toBe('2');
    req.flush(pagina());
    expect(receber).toHaveBeenCalledWith(expect.objectContaining({ totalItens: 0 }));
  });

  it('criar, mudar status, editar perfil e habilitar usam as rotas do contrato', () => {
    iniciar();
    service.criar({ nome: ' Bia Souza ', email: 'BIA@escola.br', cpf: '529.982.247-25', senha: 'senha-123', telefone: '(96) 99111-0001' }).subscribe();
    const criar = http.expectOne(`${API_URL}/usuarios`);
    expect(criar.request.method).toBe('POST');
    expect(criar.request.body).toEqual(expect.objectContaining({ nome: 'Bia Souza', email: 'bia@escola.br', cpf: '52998224725', telefone: '96991110001' }));
    criar.flush({ dados: {} });

    service.alterarStatus('usr-joao', 'bloqueado').subscribe();
    const status = http.expectOne(`${API_URL}/usuarios/usr-joao/status`);
    expect(status.request.method).toBe('PATCH');
    expect(status.request.body).toEqual({ status: 'bloqueado' });
    status.flush({ dados: {} });

    service.editar('usr-joao', { perfil: 'admin' }).subscribe();
    const editar = http.expectOne(`${API_URL}/usuarios/usr-joao`);
    expect(editar.request.method).toBe('PATCH');
    editar.flush({ dados: {} });

    service.definirHabilitacoes('usr-joao', ['eqp-impressora-3d']).subscribe();
    const hab = http.expectOne(`${API_URL}/usuarios/usr-joao/habilitacoes`);
    expect(hab.request.method).toBe('PUT');
    expect(hab.request.body).toEqual({ equipamentoIds: ['eqp-impressora-3d'] });
    hab.flush({ dados: {} });

    service.listarColegas().subscribe();
    http.expectOne(`${API_URL}/usuarios/resumo`).flush({ dados: [] });
    service.minhaConta('usr-joao').subscribe();
    http.expectOne(`${API_URL}/auth/me`).flush({ dados: {} });
  });
});

describe('UsuarioService na demonstração', () => {
  beforeEach(() => { environment.modoDemo = true; localStorage.clear(); });
  afterEach(() => { environment.modoDemo = modoOriginal; localStorage.clear(); });

  it('cria conta, guarda a senha à parte e aplica as travas do admin', () => {
    const service = TestBed.inject(UsuarioService);
    const erros: number[] = [];
    service.criar({ nome: 'Bia', email: 'bia@escola.br', cpf: '529.982.247-25', senha: 'senha-123' })
      .subscribe({ error: (e) => erros.push(e.status) }); // CPF do admin: 409
    service.criar({ nome: 'Bia', email: 'bia@escola.br', cpf: '153.509.460-56', senha: 'senha-123' }).subscribe();
    expect(erros).toEqual([409]);
    expect(service.autenticar('bia@escola.br', 'senha-123').usuario?.nome).toBe('Bia');
    expect(service.todos().some((u) => 'senha' in u)).toBe(false);

    service.alterarStatus('usr-admin', 'bloqueado', 'usr-admin').subscribe({ error: (e) => erros.push(e.status) });
    expect(erros).toEqual([409, 409]);
  });
});
