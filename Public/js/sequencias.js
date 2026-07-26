import unifiedDataManager from "./UnifiedDataManager.js";

function formatarData(str) {
  if (!str) return "—";
  const [ano, mes, dia] = str.split("-");
  return `${dia}/${mes}/${ano}`;
}

function statusLabel(s) {
  if (!s || s === "em andamento") return "andamento";
  if (s === "concluído" || s === "concluido") return "concluido";
  return "disponivel";
}

function renderChip(item, isProximo) {
  if (isProximo) {
    return `<span class="seq-chip seq-chip--proximo" title="Próximo sugerido: Mapa ${item.mapa} · ${item.bairro || ""}">
      ${item.mapa} →
    </span>`;
  }
  const cls = statusLabel(item.status);
  const label = cls === "andamento" ? `${item.mapa} ●` : item.mapa;
  const tip = `Mapa ${item.mapa} · ${item.bairro || ""} · ${formatarData(item.dataInicio)}${item.dataConclusao ? " → " + formatarData(item.dataConclusao) : ""}`;
  return `<span class="seq-chip seq-chip--${cls}" title="${tip}">${label}</span>`;
}

function renderGrupoCard(grupo, dados, totalMapas) {
  const { sequencia, proximo } = dados;

  const concluidos = sequencia.filter(d => d.status === "concluído" || d.status === "concluido").length;
  const emAndamento = sequencia.filter(d => d.status === "em andamento").length;
  const progressoPct = totalMapas > 0 ? Math.round((concluidos / totalMapas) * 100) : 0;

  const ultimoAtribuido = sequencia.length > 0 ? sequencia[sequencia.length - 1] : null;
  const ultimaData = ultimoAtribuido
    ? formatarData(ultimoAtribuido.dataConclusao || ultimoAtribuido.dataInicio)
    : "—";

  // Chips: mostrar os últimos 10 + próximo
  const visiveis = sequencia.slice(-10);
  const chips = visiveis.map(d => renderChip(d, false)).join("");
  const chipProximo = proximo ? renderChip(proximo, true) : "";
  const reticencias = sequencia.length > 10
    ? `<span class="seq-chip seq-chip--mais" title="${sequencia.length - 10} anteriores">…</span>`
    : "";

  return `
    <div class="seq-card">
      <div class="seq-card-header">
        <h2 class="seq-card-title">${grupo}</h2>
        <div class="seq-card-meta">
          <span class="seq-meta-item seq-meta--concluido">${concluidos} concluídos</span>
          ${emAndamento > 0 ? `<span class="seq-meta-item seq-meta--andamento">${emAndamento} em andamento</span>` : ""}
          <span class="seq-meta-item">Último: ${ultimaData}</span>
        </div>
      </div>

      <div class="seq-progress-bar">
        <div class="seq-progress-fill" style="width:${progressoPct}%"></div>
      </div>
      <div class="seq-progress-label">${progressoPct}% dos mapas concluídos (${concluidos} de ${totalMapas})</div>

      <div class="seq-chain">
        ${reticencias}${chips}
        ${chipProximo || "<span class='seq-chip seq-chip--sem'>Todos em andamento</span>"}
      </div>

      ${proximo ? `
      <div class="seq-proximo-bloco">
        <span class="seq-proximo-label">Próximo a designar</span>
        <span class="seq-proximo-mapa">Mapa ${proximo.mapa}</span>
        <span class="seq-proximo-bairro">${proximo.bairro || "—"}</span>
        <a href="Registro_S13.html" class="seq-btn-novo">+ Novo Registro</a>
      </div>` : ""}
    </div>
  `;
}

async function renderizarSequencias() {
  const container = document.getElementById("seq-grupos");
  const loading = document.getElementById("seq-loading");
  const statusEl = document.getElementById("seq-status");

  try {
    const grupos = unifiedDataManager.getGruposSequenciaveis();
    const resumo = await unifiedDataManager.getResumoSequenciasGrupos();
    const totalMapas = unifiedDataManager.getAllTerritorios().length;

    let html = "";
    for (const grupo of grupos) {
      html += renderGrupoCard(grupo, resumo[grupo] || { sequencia: [], proximo: null }, totalMapas);
    }

    container.innerHTML = html;
    container.style.display = "flex";
    loading.style.display = "none";

    const totalGrupos = grupos.length;
    const comSugestao = grupos.filter(g => resumo[g]?.proximo).length;
    statusEl.textContent = `${comSugestao} de ${totalGrupos} grupos com próximo mapa definido`;
    statusEl.className = "seq-badge seq-badge--ok";
  } catch (error) {
    console.error("❌ Erro ao renderizar sequências:", error);
    loading.innerHTML = `<p class="seq-erro">Erro ao carregar dados. Verifique sua conexão.</p>`;
    statusEl.textContent = "Erro";
    statusEl.className = "seq-badge seq-badge--erro";
  }
}

async function init() {
  try {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      const ok = await unifiedDataManager.init();
      if (!ok) throw new Error("Falha no UnifiedDataManager");

      await renderizarSequencias();

      // Recarrega ao receber atualização de designações ou de grupos
      window.addEventListener("unified:registrosUpdated", () => {
        renderizarSequencias();
      });
      window.addEventListener("unified:gruposUpdated", () => {
        renderizarSequencias();
      });
    });
  } catch (error) {
    console.error("❌ Erro na inicialização:", error);
  }
}

document.addEventListener("DOMContentLoaded", init);
