/*************************************************
 * 🔢 SEQUÊNCIA DE MAPAS POR GRUPO — LÓGICA PURA
 * (sem dependência de Firebase/DOM — testável com Node puro)
 * Usada pelo painel (sequencia_admin.js) e pelo UnifiedDataManager
 * (Registro S-13 / Sequências), para os dois calcularem igual.
 *************************************************/

// ordemMapas: números de mapa na ordem definida pelo admin
// (sequencia-config/{grupo}.ordemMapas). Mapas do grupo que não estão nela
// (ex: mapa novo) vão para o fim, por número; números da ordem que não
// pertencem mais ao grupo são ignorados.
function ordenarTerritoriosDoGrupo(territorios, ordemMapas) {
  const porNumero = [...territorios].sort((a, b) => a.mapa - b.mapa);
  if (!Array.isArray(ordemMapas) || !ordemMapas.length) return porNumero;

  const posicao = new Map(ordemMapas.map((mapa, i) => [Number(mapa), i]));
  const naOrdem = porNumero
    .filter((t) => posicao.has(t.mapa))
    .sort((a, b) => posicao.get(a.mapa) - posicao.get(b.mapa));
  const fora = porNumero.filter((t) => !posicao.has(t.mapa));
  return [...naOrdem, ...fora];
}

// reservas: { grupo: { bairros: [...], mapas: [...] } } (coleção grupo-bairros).
// Grupo com reserva → só os bairros/mapas dele. Grupo sem reserva (ex:
// Congregação) → só os mapas livres, sem dono por mapa nem por bairro.
function territoriosDoGrupo(territorios, grupo, reservas) {
  const doGrupo = reservas?.[grupo] || {};
  const bairros = doGrupo.bairros || [];
  const mapas = doGrupo.mapas || [];
  if (bairros.length || mapas.length) {
    return territorios.filter((t) => bairros.includes(t.bairro) || mapas.includes(t.mapa));
  }
  const outras = Object.entries(reservas || {}).filter(([g]) => g !== grupo).map(([, r]) => r || {});
  const reservado = (t) => outras.some((r) => (r.mapas || []).includes(t.mapa) || (r.bairros || []).includes(t.bairro));
  return territorios.filter((t) => !reservado(t));
}

// Próximo mapa livre depois do último usado, dando a volta na lista.
function proximoNaSequencia(territoriosOrdenados, ultimoMapa) {
  const idx = ultimoMapa == null ? -1 : territoriosOrdenados.findIndex((t) => t.mapa === ultimoMapa);
  const candidatos = idx === -1
    ? territoriosOrdenados
    : [...territoriosOrdenados.slice(idx + 1), ...territoriosOrdenados.slice(0, idx + 1)];
  return candidatos.find((t) => t.status !== 'em andamento') || null;
}

const SequenciaUtils = { ordenarTerritoriosDoGrupo, proximoNaSequencia, territoriosDoGrupo };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SequenciaUtils;
}
if (typeof window !== 'undefined') {
  window.SequenciaUtils = SequenciaUtils;
}
