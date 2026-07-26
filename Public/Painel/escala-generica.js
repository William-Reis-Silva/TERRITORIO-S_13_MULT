/*************************************************
 * 🔁 MOTOR DE ROTAÇÃO GENÉRICO — LÓGICA PURA
 * (sem dependência de Firebase/DOM — testável com Node puro)
 * Generaliza o que gerarESalvarEscala()/aplicarEvento() já fazem
 * de forma hardcoded para sexta/sábado/domingo, permitindo
 * qualquer dia da semana apontar para qualquer lista de rotação.
 *************************************************/
const DIA_OFFSET = {
  segunda: 0,
  terca: 1,
  quarta: 2,
  quinta: 3,
  sexta: 4,
  sabado: 5,
  domingo: 6,
};

const DIA_LABELS = Object.freeze({
  segunda: 'Segunda',
  terca: 'Terça',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
  sabado: 'Sábado',
  domingo: 'Domingo',
});

const LISTAIDS_LEGADO = Object.freeze([
  'dirigentes-sabado',
  'grupos-domingo',
  'idosos',
  'acompanhantes',
  'dirigentes-sexta',
]);

function isListaIdLegado(listaId) {
  return LISTAIDS_LEGADO.includes(listaId);
}

// segunda: Date (00:00 da segunda-feira da semana alvo). dia: chave de DIA_OFFSET.
function proximaDataParaDia(segunda, dia) {
  const offset = DIA_OFFSET[dia];
  if (offset === undefined) {
    throw new Error(`Dia inválido: ${dia}`);
  }
  const data = new Date(segunda);
  data.setDate(segunda.getDate() + offset);
  return data;
}

const DIACRITICOS_REGEX = new RegExp('[̀-ͯ]', 'g');

function slugify(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(DIACRITICOS_REGEX, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function docIdGenerico(listaId, dataISO) {
  return `${listaId}_${dataISO}`;
}

// O motor legado (gerarESalvarEscala/aplicarEvento) grava os documentos
// gerados com prefixos curtos fixos (sexta_, sabado_, domingo_), não com o
// nome completo da lista (dirigentes-sexta, dirigentes-sabado, grupos-domingo).
// Quem for LER os documentos gerados para uma linha automática que aponta
// para uma dessas 3 listas legadas precisa desse mapeamento — senão procura
// um docId que nunca existe. Listas customizadas usam o próprio listaId como
// prefixo (sem mapeamento).
const PREFIXO_DOC_LEGADO = Object.freeze({
  'dirigentes-sexta': 'sexta',
  'dirigentes-sabado': 'sabado',
  'grupos-domingo': 'domingo',
});

function prefixoDocParaListaId(listaId) {
  return PREFIXO_DOC_LEGADO[listaId] || listaId;
}

// lista: array de nomes (ordenado). ultimoNome: último nome usado antes do corte, ou null/undefined.
// Mesma lógica do `proxIdx` inline em gerenciamento_escala.html (gerarESalvarEscala/aplicarEvento).
function proximoIndice(lista, ultimoNome) {
  if (!lista.length) return 0;
  const i = lista.indexOf(ultimoNome);
  return i === -1 ? 0 : (i + 1) % lista.length;
}

const EscalaGenerica = {
  DIA_OFFSET,
  DIA_LABELS,
  LISTAIDS_LEGADO,
  isListaIdLegado,
  proximaDataParaDia,
  slugify,
  docIdGenerico,
  proximoIndice,
  PREFIXO_DOC_LEGADO,
  prefixoDocParaListaId,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EscalaGenerica;
}
if (typeof window !== 'undefined') {
  window.EscalaGenerica = EscalaGenerica;
}
