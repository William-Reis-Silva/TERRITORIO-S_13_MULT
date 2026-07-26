/*************************************************
 * 🏢 UTILITÁRIOS DE CONGREGAÇÃO (MULTI-TENANT)
 * (sem dependência de Firebase/DOM — testável com Node puro)
 *************************************************/
function normalizarNumeroCongregacao(numero) {
  const limpo = String(numero ?? '').trim();
  if (!/^\d{3,10}$/.test(limpo)) return null;
  return limpo;
}

function gerarCodigoConvite() {
  // Sem 0, O, 1, I — evita confusão visual ao digitar o código
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 8; i++) {
    codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return codigo;
}

function caminhoSubcolecao(congId, nomeColecao) {
  const congIdValidado = normalizarNumeroCongregacao(congId);
  const nomeLimpo = String(nomeColecao ?? '').trim();
  if (congIdValidado === null) throw new Error('congId inválido');
  if (!nomeLimpo) throw new Error('nomeColecao é obrigatório');
  return `congregacoes/${congIdValidado}/${nomeLimpo}`;
}

const CongregacaoUtils = { normalizarNumeroCongregacao, gerarCodigoConvite, caminhoSubcolecao };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CongregacaoUtils;
}
if (typeof window !== 'undefined') {
  window.CongregacaoUtils = CongregacaoUtils;
}
