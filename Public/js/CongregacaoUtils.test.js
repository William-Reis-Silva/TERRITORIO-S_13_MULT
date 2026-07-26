const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizarNumeroCongregacao, gerarCodigoConvite, caminhoSubcolecao } = require('./CongregacaoUtils.js');

test('normalizarNumeroCongregacao aceita número válido', () => {
  assert.equal(normalizarNumeroCongregacao('48991'), '48991');
});

test('normalizarNumeroCongregacao remove espaços nas bordas', () => {
  assert.equal(normalizarNumeroCongregacao('  48991  '), '48991');
});

test('normalizarNumeroCongregacao rejeita letras', () => {
  assert.equal(normalizarNumeroCongregacao('4899A'), null);
});

test('normalizarNumeroCongregacao rejeita número curto demais', () => {
  assert.equal(normalizarNumeroCongregacao('12'), null);
});

test('normalizarNumeroCongregacao rejeita vazio', () => {
  assert.equal(normalizarNumeroCongregacao(''), null);
  assert.equal(normalizarNumeroCongregacao(undefined), null);
});

test('gerarCodigoConvite gera código de 8 caracteres no alfabeto esperado', () => {
  const codigo = gerarCodigoConvite();
  assert.equal(codigo.length, 8);
  assert.match(codigo, /^[A-HJ-NP-Z2-9]{8}$/);
});

test('caminhoSubcolecao monta o caminho da subcoleção', () => {
  assert.equal(caminhoSubcolecao('48991', 'territorios'), 'congregacoes/48991/territorios');
});

test('caminhoSubcolecao lança erro sem congId', () => {
  assert.throws(() => caminhoSubcolecao('', 'territorios'));
});

test('caminhoSubcolecao lança erro sem nomeColecao', () => {
  assert.throws(() => caminhoSubcolecao('48991', ''));
});

test('caminhoSubcolecao lança erro com congId inválido', () => {
  assert.throws(() => caminhoSubcolecao('abc', 'territorios'));
});
