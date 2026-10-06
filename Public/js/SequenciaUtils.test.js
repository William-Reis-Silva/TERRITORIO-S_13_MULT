const test = require('node:test');
const assert = require('node:assert/strict');
const { ordenarTerritoriosDoGrupo, proximoNaSequencia, territoriosDoGrupo } = require('./SequenciaUtils.js');

const t = (mapa, status = 'disponível') => ({ mapa, status });
const mapas = (lista) => lista.map((x) => x.mapa);

test('ordenarTerritoriosDoGrupo sem ordem personalizada ordena pelo número do mapa', () => {
  assert.deepEqual(mapas(ordenarTerritoriosDoGrupo([t(3), t(1), t(2)], null)), [1, 2, 3]);
  assert.deepEqual(mapas(ordenarTerritoriosDoGrupo([t(3), t(1), t(2)], [])), [1, 2, 3]);
});

test('ordenarTerritoriosDoGrupo segue a ordem personalizada', () => {
  assert.deepEqual(mapas(ordenarTerritoriosDoGrupo([t(1), t(2), t(3)], [3, 1, 2])), [3, 1, 2]);
});

test('ordenarTerritoriosDoGrupo põe mapas fora da ordem salva no fim, por número', () => {
  assert.deepEqual(mapas(ordenarTerritoriosDoGrupo([t(5), t(1), t(4), t(2)], [2, 1])), [2, 1, 4, 5]);
});

test('ordenarTerritoriosDoGrupo ignora mapas da ordem que não pertencem mais ao grupo', () => {
  assert.deepEqual(mapas(ordenarTerritoriosDoGrupo([t(1), t(2)], [9, 2, 1])), [2, 1]);
});

test('ordenarTerritoriosDoGrupo não altera o array recebido', () => {
  const entrada = [t(2), t(1)];
  ordenarTerritoriosDoGrupo(entrada, null);
  assert.deepEqual(mapas(entrada), [2, 1]);
});

test('proximoNaSequencia sem último mapa retorna o primeiro livre', () => {
  const lista = [t(3, 'em andamento'), t(1), t(2)];
  assert.equal(proximoNaSequencia(lista, null).mapa, 1);
});

test('proximoNaSequencia continua depois do último e dá a volta', () => {
  const lista = [t(3), t(1), t(2)];
  assert.equal(proximoNaSequencia(lista, 1).mapa, 2);
  assert.equal(proximoNaSequencia(lista, 2).mapa, 3);
});

test('proximoNaSequencia pula mapas em andamento', () => {
  const lista = [t(1), t(2, 'em andamento'), t(3)];
  assert.equal(proximoNaSequencia(lista, 1).mapa, 3);
});

test('proximoNaSequencia retorna null se todos estão em andamento', () => {
  assert.equal(proximoNaSequencia([t(1, 'em andamento')], null), null);
});

test('proximoNaSequencia com último mapa fora da lista começa do início', () => {
  assert.equal(proximoNaSequencia([t(4), t(5)], 99).mapa, 4);
});

const tb = (mapa, bairro) => ({ mapa, bairro });
const reservas = {
  Eldorado: { bairros: ['Eldorado'], mapas: [] },
  Olaria: { bairros: [], mapas: [7] },
  Congregação: { bairros: [], mapas: [] },
};
const universo = [tb(1, 'Eldorado'), tb(2, 'Eldorado'), tb(5, 'Centro'), tb(6, 'Centro'), tb(7, 'Centro')];

test('territoriosDoGrupo: grupo com reserva fica só com os seus bairros/mapas', () => {
  assert.deepEqual(mapas(territoriosDoGrupo(universo, 'Eldorado', reservas)), [1, 2]);
  assert.deepEqual(mapas(territoriosDoGrupo(universo, 'Olaria', reservas)), [7]);
});

test('territoriosDoGrupo: grupo sem reserva fica só com os mapas livres', () => {
  assert.deepEqual(mapas(territoriosDoGrupo(universo, 'Congregação', reservas)), [5, 6]);
});

test('territoriosDoGrupo: sem nenhuma reserva cadastrada, tudo é livre', () => {
  assert.deepEqual(mapas(territoriosDoGrupo(universo, 'Congregação', {})), [1, 2, 5, 6, 7]);
});
