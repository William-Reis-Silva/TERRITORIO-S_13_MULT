const test = require('node:test');
const assert = require('node:assert/strict');
const { eventoParaData, formatarDataISO } = require('./eventos.js');

test('eventoParaData retorna null quando não há eventos', () => {
  assert.equal(eventoParaData('2026-08-08', []), null);
});

test('eventoParaData retorna a descrição quando a data está dentro do intervalo', () => {
  const eventos = [{ descricao: 'Congresso', dataInicio: '2026-08-07', dataFim: '2026-08-09' }];
  assert.equal(eventoParaData('2026-08-08', eventos), 'Congresso');
});

test('eventoParaData retorna null quando a data está fora do intervalo', () => {
  const eventos = [{ descricao: 'Congresso', dataInicio: '2026-08-07', dataFim: '2026-08-09' }];
  assert.equal(eventoParaData('2026-08-10', eventos), null);
});

test('eventoParaData funciona para evento de um único dia (dataInicio === dataFim)', () => {
  const eventos = [{ descricao: 'Assembleia de Circuito', dataInicio: '2026-09-05', dataFim: '2026-09-05' }];
  assert.equal(eventoParaData('2026-09-05', eventos), 'Assembleia de Circuito');
  assert.equal(eventoParaData('2026-09-04', eventos), null);
  assert.equal(eventoParaData('2026-09-06', eventos), null);
});

test('eventoParaData considera bordas inclusivas do intervalo', () => {
  const eventos = [{ descricao: 'Congresso', dataInicio: '2026-08-07', dataFim: '2026-08-09' }];
  assert.equal(eventoParaData('2026-08-07', eventos), 'Congresso');
  assert.equal(eventoParaData('2026-08-09', eventos), 'Congresso');
});

test('eventoParaData retorna o evento cuja data bate quando há múltiplos eventos cadastrados', () => {
  const eventos = [
    { descricao: 'Congresso', dataInicio: '2026-08-07', dataFim: '2026-08-09' },
    { descricao: 'Feriado Local', dataInicio: '2026-09-05', dataFim: '2026-09-05' }
  ];
  assert.equal(eventoParaData('2026-09-05', eventos), 'Feriado Local');
  assert.equal(eventoParaData('2026-08-08', eventos), 'Congresso');
});

test('formatarDataISO formata data no padrão YYYY-MM-DD com zero à esquerda', () => {
  assert.equal(formatarDataISO(new Date(2026, 7, 8)), '2026-08-08'); // mês 7 = agosto (0-indexed)
  assert.equal(formatarDataISO(new Date(2026, 0, 1)), '2026-01-01');
});
