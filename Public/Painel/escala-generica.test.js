const test = require('node:test');
const assert = require('node:assert/strict');
const {
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
} = require('./escala-generica.js');

test('DIA_LABELS tem uma entrada para cada chave de DIA_OFFSET', () => {
  assert.deepEqual(Object.keys(DIA_LABELS).sort(), Object.keys(DIA_OFFSET).sort());
});

test('prefixoDocParaListaId mapeia as 3 listas legadas usadas na tabela de atividades', () => {
  assert.equal(prefixoDocParaListaId('dirigentes-sexta'), 'sexta');
  assert.equal(prefixoDocParaListaId('dirigentes-sabado'), 'sabado');
  assert.equal(prefixoDocParaListaId('grupos-domingo'), 'domingo');
});

test('prefixoDocParaListaId retorna o próprio listaId para listas customizadas', () => {
  assert.equal(prefixoDocParaListaId('dirigentes-terca'), 'dirigentes-terca');
});

test('PREFIXO_DOC_LEGADO não inclui idosos/acompanhantes (não são "um dirigente" sozinho)', () => {
  assert.equal('idosos' in PREFIXO_DOC_LEGADO, false);
  assert.equal('acompanhantes' in PREFIXO_DOC_LEGADO, false);
});

test('proximaDataParaDia soma o offset correto a partir da segunda-feira', () => {
  const segunda = new Date(2026, 6, 20); // referência: "segunda" da semana

  assert.equal(proximaDataParaDia(segunda, 'segunda').getDate(), 20);
  assert.equal(proximaDataParaDia(segunda, 'terca').getDate(), 21);
  assert.equal(proximaDataParaDia(segunda, 'quarta').getDate(), 22);
  assert.equal(proximaDataParaDia(segunda, 'quinta').getDate(), 23);
  assert.equal(proximaDataParaDia(segunda, 'sexta').getDate(), 24);
  assert.equal(proximaDataParaDia(segunda, 'sabado').getDate(), 25);
  assert.equal(proximaDataParaDia(segunda, 'domingo').getDate(), 26);
});

test('proximaDataParaDia lança erro para dia inválido', () => {
  const segunda = new Date(2026, 6, 20);
  assert.throws(() => proximaDataParaDia(segunda, 'feriado'), /Dia inválido/);
});

test('DIA_OFFSET tem exatamente os 7 dias da semana', () => {
  assert.deepEqual(Object.keys(DIA_OFFSET).sort(), [
    'domingo', 'quarta', 'quinta', 'sabado', 'segunda', 'sexta', 'terca',
  ].sort());
});

test('isListaIdLegado reconhece as 5 listas fixas e nega o resto', () => {
  LISTAIDS_LEGADO.forEach((id) => assert.equal(isListaIdLegado(id), true));
  assert.equal(isListaIdLegado('dirigentes-terca'), false);
  assert.equal(isListaIdLegado(''), false);
});

test('LISTAIDS_LEGADO está congelada', () => {
  assert.throws(() => { LISTAIDS_LEGADO.push('x'); }, TypeError);
});

test('slugify remove acentos, minusculiza e troca separadores por hífen', () => {
  assert.equal(slugify('Dirigentes de Terça'), 'dirigentes-de-terca');
  assert.equal(slugify('João XXIII'), 'joao-xxiii');
  assert.equal(slugify('  Córrego do Caçador  '), 'corrego-do-cacador');
});

test('slugify colapsa hífens duplicados e remove das bordas', () => {
  assert.equal(slugify('--Alto   Serenata--'), 'alto-serenata');
});

test('slugify de string vazia/só espaços retorna string vazia', () => {
  assert.equal(slugify(''), '');
  assert.equal(slugify('   '), '');
  assert.equal(slugify(undefined), '');
});

test('docIdGenerico monta "listaId_data"', () => {
  assert.equal(docIdGenerico('dirigentes-terca', '2026-07-21'), 'dirigentes-terca_2026-07-21');
});

test('proximoIndice retorna 0 para lista vazia', () => {
  assert.equal(proximoIndice([], 'Joebel'), 0);
});

test('proximoIndice retorna 0 quando o último nome não está na lista (pessoa nova)', () => {
  assert.equal(proximoIndice(['Ana', 'Bruno'], 'Carlos'), 0);
  assert.equal(proximoIndice(['Ana', 'Bruno'], null), 0);
  assert.equal(proximoIndice(['Ana', 'Bruno'], undefined), 0);
});

test('proximoIndice avança para o próximo da lista', () => {
  assert.equal(proximoIndice(['Ana', 'Bruno', 'Carlos'], 'Ana'), 1);
  assert.equal(proximoIndice(['Ana', 'Bruno', 'Carlos'], 'Bruno'), 2);
});

test('proximoIndice dá a volta (wrap) no último nome da lista', () => {
  assert.equal(proximoIndice(['Ana', 'Bruno', 'Carlos'], 'Carlos'), 0);
});
