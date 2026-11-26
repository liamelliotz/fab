/**
 * Planta da ESCOLA FICTÍCIA usada no modo demonstração (mapa de itens).
 *
 * Cada local tem um id estável (usado nos pedidos, nos insumos e no mapa) e a posição do
 * desenho em um quadro de 1000 × 600. Quando a escola real for cadastrada pela API,
 * esta lista vira o cadastro de locais (salas, laboratórios e depósitos).
 */

export type TipoLocal = 'sala' | 'laboratorio' | 'administrativo' | 'deposito' | 'convivencia' | 'externo';

export interface LocalEscola {
  id: string;
  nome: string;
  /** Agrupamento físico exibido no mapa e nos filtros. */
  bloco: string;
  tipo: TipoLocal;
  /** Retângulo do desenho (quadro de 1000 × 600). O local externo não aparece na planta. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Nome da escola fictícia mostrada no mapa. */
export const NOME_ESCOLA_MODELO = 'Escola Estadual Modelo FAB';

export const LOCAIS_ESCOLA: readonly LocalEscola[] = [
  // Bloco A — salas de aula e auditório
  { id: 'sala-101', nome: 'Sala 101', bloco: 'Bloco A · Salas de aula', tipo: 'sala', x: 30, y: 52, w: 140, h: 116 },
  { id: 'sala-102', nome: 'Sala 102', bloco: 'Bloco A · Salas de aula', tipo: 'sala', x: 180, y: 52, w: 140, h: 116 },
  { id: 'sala-103', nome: 'Sala 103', bloco: 'Bloco A · Salas de aula', tipo: 'sala', x: 330, y: 52, w: 140, h: 116 },
  { id: 'sala-104', nome: 'Sala 104', bloco: 'Bloco A · Salas de aula', tipo: 'sala', x: 480, y: 52, w: 140, h: 116 },
  { id: 'auditorio', nome: 'Auditório', bloco: 'Bloco A · Salas de aula', tipo: 'convivencia', x: 640, y: 52, w: 330, h: 116 },
  // Bloco B — laboratórios e biblioteca
  { id: 'lab-informatica', nome: 'Lab. de Informática', bloco: 'Bloco B · Laboratórios', tipo: 'laboratorio', x: 30, y: 232, w: 200, h: 140 },
  { id: 'lab-maker', nome: 'Lab. Maker', bloco: 'Bloco B · Laboratórios', tipo: 'laboratorio', x: 240, y: 232, w: 200, h: 140 },
  { id: 'lab-ciencias', nome: 'Lab. de Ciências', bloco: 'Bloco B · Laboratórios', tipo: 'laboratorio', x: 450, y: 232, w: 170, h: 140 },
  { id: 'lab-eletronica', nome: 'Lab. de Eletrônica', bloco: 'Bloco B · Laboratórios', tipo: 'laboratorio', x: 630, y: 232, w: 170, h: 140 },
  { id: 'biblioteca', nome: 'Biblioteca', bloco: 'Bloco B · Laboratórios', tipo: 'convivencia', x: 810, y: 232, w: 160, h: 140 },
  // Bloco C — administração e depósitos
  { id: 'coordenacao', nome: 'Coordenação (balcão)', bloco: 'Bloco C · Administração', tipo: 'administrativo', x: 30, y: 436, w: 190, h: 124 },
  { id: 'almox-ti', nome: 'Almoxarifado de TI', bloco: 'Bloco C · Administração', tipo: 'deposito', x: 230, y: 436, w: 170, h: 124 },
  { id: 'sala-professores', nome: 'Sala dos Professores', bloco: 'Bloco C · Administração', tipo: 'administrativo', x: 410, y: 436, w: 170, h: 124 },
  { id: 'sala-manutencao', nome: 'Sala de Manutenção', bloco: 'Bloco C · Administração', tipo: 'deposito', x: 590, y: 436, w: 170, h: 124 },
  { id: 'quadra', nome: 'Quadra', bloco: 'Área externa', tipo: 'convivencia', x: 770, y: 436, w: 200, h: 124 },
  // Fora da escola: assistência técnica (unidades enviadas para conserto)
  { id: 'assistencia', nome: 'Assistência técnica', bloco: 'Fora da escola', tipo: 'externo', x: 0, y: 0, w: 0, h: 0 },
];

/** Locais onde um professor pode usar um material (exclui depósitos e o externo). */
export const LOCAIS_DE_USO = LOCAIS_ESCOLA.filter(
  (l) => l.tipo !== 'deposito' && l.tipo !== 'externo' && l.id !== 'coordenacao',
);

export function buscarLocal(id: string | undefined | null): LocalEscola | undefined {
  return id ? LOCAIS_ESCOLA.find((l) => l.id === id) : undefined;
}

export function nomeLocal(id: string | undefined | null): string {
  return buscarLocal(id)?.nome ?? 'Local não informado';
}

/**
 * Local de GUARDA de um material (onde ele fica quando não está emprestado), deduzido do texto
 * "Localização" do cadastro. Assim o cadastro atual continua valendo sem campo novo.
 */
export function localDeGuarda(localizacao: string | undefined | null): LocalEscola {
  const texto = (localizacao ?? '').toLowerCase();
  const id =
    texto.includes('armário de ti') || texto.includes('almoxarifado')
      ? 'almox-ti'
      : texto.includes('bancada') || texto.includes('eletrônica')
        ? 'lab-eletronica'
        : texto.includes('prototipagem') || texto.includes('corte') || texto.includes('maker') || /armário 0\d/.test(texto)
          ? 'lab-maker'
          : texto.includes('informática')
            ? 'lab-informatica'
            : texto.includes('ciências')
              ? 'lab-ciencias'
              : texto.includes('biblioteca')
                ? 'biblioteca'
                : texto.includes('coordenação') || texto.includes('secretaria')
                  ? 'coordenacao'
                  : 'almox-ti';
  return buscarLocal(id)!;
}

/**
 * Local a partir de um texto livre que começa (ou contém) o nome de um local da planta,
 * ex.: "Lab. Maker · Armário 3". Sem correspondência, usa a mesma dedução do local de guarda.
 */
export function localPorTexto(texto: string | undefined | null): LocalEscola {
  const t = (texto ?? '').toLowerCase();
  return LOCAIS_ESCOLA.find((l) => l.tipo !== 'externo' && t.includes(l.nome.toLowerCase())) ?? localDeGuarda(texto);
}
