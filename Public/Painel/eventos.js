/*************************************************
 * 🎪 EVENTOS ESPECIAIS DA ESCALA — LÓGICA PURA
 * (sem dependência de Firebase/DOM — testável com Node puro)
 *************************************************/
function eventoParaData(dataStr, eventos) {
  for (const evento of eventos) {
    if (dataStr >= evento.dataInicio && dataStr <= evento.dataFim) {
      return evento.descricao;
    }
  }
  return null;
}

function formatarDataISO(data) {
  const yyyy = data.getFullYear();
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const dd = String(data.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const EventosEscala = { eventoParaData, formatarDataISO };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventosEscala;
}
if (typeof window !== 'undefined') {
  window.EventosEscala = EventosEscala;
}
