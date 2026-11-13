import {
  descreverErroDeConexao,
  mensagemDeFalhaDeConexao,
  urlSemSenha,
} from './erro-de-conexao.js';

describe('erro de conexão com o banco', () => {
  it('AggregateError com mensagem vazia vira "conexão recusada"', () => {
    const interno = Object.assign(new Error(''), { code: 'ECONNREFUSED' });
    const agregado = new AggregateError([interno], '');
    expect(descreverErroDeConexao(agregado)).toBe(
      'conexão recusada: não há banco ouvindo nesse endereço e porta [ECONNREFUSED]',
    );
  });

  it.each([
    ['28P01', 'usuário ou senha incorretos'],
    ['3D000', 'o banco de dados informado não existe'],
    ['ENOTFOUND', 'endereço do banco não encontrado'],
  ])('traduz o código %s', (code, trecho) => {
    const erro = Object.assign(new Error('mensagem do driver'), { code });
    expect(descreverErroDeConexao(erro)).toContain(trecho);
  });

  it('código desconhecido mantém a mensagem original', () => {
    const erro = Object.assign(new Error('algo raro'), { code: 'XX000' });
    expect(descreverErroDeConexao(erro)).toBe('algo raro [XX000]');
  });

  it('nunca devolve texto vazio', () => {
    expect(descreverErroDeConexao(new Error(''))).toBe('erro desconhecido');
    expect(descreverErroDeConexao(undefined)).toBe('erro desconhecido');
  });

  it('a mensagem completa diz o que fazer', () => {
    const msg = mensagemDeFalhaDeConexao(
      Object.assign(new Error(''), { code: 'ECONNREFUSED' }),
    );
    expect(msg).toMatch(
      /^Não foi possível conectar ao PostgreSQL: conexão recusada/,
    );
    expect(msg).toContain('docker compose up -d');
    expect(msg).toContain('PERSISTENCIA=memoria');
  });

  it('esconde a senha da URL no log', () => {
    expect(urlSemSenha('postgresql://fab:fab_dev@localhost:5432/fab')).toBe(
      'postgresql://fab@localhost:5432/fab',
    );
    expect(urlSemSenha('isto não é url')).toBe('(DATABASE_URL inválida)');
  });
});
