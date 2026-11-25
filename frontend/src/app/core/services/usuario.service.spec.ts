import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { UsuarioService } from './usuario.service';

const modoOriginal = environment.modoDemo;

describe('UsuarioService e senhas no navegador (card A6)', () => {
  afterEach(() => { environment.modoDemo = modoOriginal; localStorage.clear(); sessionStorage.clear(); });

  it('com a API, nenhuma senha é gravada no localStorage', () => {
    environment.modoDemo = false; localStorage.clear();
    TestBed.inject(UsuarioService);
    TestBed.tick();
    const gravado = JSON.stringify(localStorage);
    expect(gravado).toContain('professor@fab.com');
    expect(gravado).not.toContain('senha');
    expect(gravado).not.toContain('prof123');
  });

  it('os ids das contas de exemplo são os mesmos do seed da API', () => {
    const ids = TestBed.inject(UsuarioService).todos().map((u) => u.id);
    expect(ids).toEqual(['usr-admin', 'usr-professor', 'usr-joao', 'usr-maria', 'usr-carlos', 'usr-ana']);
  });
});
