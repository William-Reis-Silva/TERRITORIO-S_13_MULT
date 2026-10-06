firebase.auth().onAuthStateChanged(function (user) {
  const usuarioLogado = !!user;

  // Verificar se o elemento existe antes de tentar acessá-lo
  const mensagemAcessoNegado = document.getElementById("mensagemAcessoNegado");
  const links = document.querySelectorAll("a"); // ou o seletor correto para seus links

  if (!usuarioLogado) {
    if (mensagemAcessoNegado) {
      mensagemAcessoNegado.style.display = "none";
    }

    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        if (mensagemAcessoNegado) {
          mensagemAcessoNegado.style.display = "block";
        }
      });
    });
  } else {
    const userGreeting = document.getElementById("user-greeting");
    if (userGreeting) {
      userGreeting.style.display = "block";
    }

    if (user.uid) {
      const userId = user.uid;
      const userDocRef = firebase.firestore().collection("usuarios").doc(userId);

      userDocRef
        .get()
        .then(function (doc) {
          const usernameElement = document.getElementById("username");
          if (!usernameElement) return;

          if (doc.exists) {
            const userData = doc.data();
            if (userData && userData.usuario) {
              usernameElement.textContent = userData.usuario;
            } else {
              usernameElement.textContent = "Usuário";
            }
          } else {
            console.warn("Documento do usuário não encontrado");
            usernameElement.textContent = "Usuário";
          }
        })
        .catch(function (error) {
          console.error("Erro ao recuperar os dados do usuário:", error);
        });
    }
  }
});

let mapData = {}; // Dados agrupados por número do mapa
let currentYear = getCurrentServiceYear();

document.addEventListener("DOMContentLoaded", async function () {
  const congId = await Tenant.resolverCongId();

  // Obtemos todos os documentos da coleção 'designacoes'
  const snapshot = await Tenant.collectionSync(congId, "designacoes").get();

  snapshot.forEach((doc) => {
    const data = doc.data();
    const { mapa } = data;
    if (!mapData[mapa]) mapData[mapa] = [];
    mapData[mapa].push(data);
  });

  updateYearDisplay();
  renderTable(mapData);
  
  // Adicionar event listeners para os botões de navegação de ano
  setupYearNavigation();
});

function getCurrentServiceYear() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() < 8 ? year : year + 1;
}

function setupYearNavigation() {
  const prevYearBtn = document.getElementById("prevYearBtn");
  const nextYearBtn = document.getElementById("nextYearBtn");

  if (prevYearBtn) {
    prevYearBtn.addEventListener("click", function () {
      currentYear--;
      updateYearDisplay();
      renderTable(mapData);
      if (document.getElementById("view-por-grupo").style.display !== "none") {
        renderPorGrupo();
      }
    });
  }

  if (nextYearBtn) {
    nextYearBtn.addEventListener("click", function () {
      currentYear++;
      updateYearDisplay();
      renderTable(mapData);
      if (document.getElementById("view-por-grupo").style.display !== "none") {
        renderPorGrupo();
      }
    });
  }
}

// ── Controle de abas ──
function mostrarAba(aba) {
  const viewMapa = document.getElementById("view-por-mapa");
  const viewGrupo = document.getElementById("view-por-grupo");
  const btnMapa = document.getElementById("tab-btn-mapa");
  const btnGrupo = document.getElementById("tab-btn-grupo");

  if (aba === "por-mapa") {
    viewMapa.style.display = "";
    viewGrupo.style.display = "none";
    btnMapa.classList.add("tab-btn-active");
    btnGrupo.classList.remove("tab-btn-active");
  } else {
    viewMapa.style.display = "none";
    viewGrupo.style.display = "";
    btnMapa.classList.remove("tab-btn-active");
    btnGrupo.classList.add("tab-btn-active");
    renderPorGrupo();
  }
}

// ── Grupos (dinâmicos, vindos do Firestore) ──
let _gruposCache = null;

async function buscarGruposSequenciaveis() {
  if (_gruposCache) return _gruposCache;
  const congId = await Tenant.resolverCongId();
  const snap = await Tenant.collectionSync(congId, "grupos").get();
  const dinamicos = snap.docs.map((d) => d.id).sort((a, b) => a.localeCompare(b, "pt-BR"));
  // Congregação sempre primeiro; campanhas não entram (não têm sequência própria)
  _gruposCache = ["Congregação", ...dinamicos];
  return _gruposCache;
}

function vezesHtml(vezes) {
  if (!vezes) return `<span class="sg-vezes-zero">—</span>`;
  return `<span class="sg-badge ${vezes > 1 ? "sg-vezes--repetido" : "sg-concluido"}">${vezes}×</span>`;
}

// ── Renderização: Por Grupo ──
async function renderPorGrupo() {
  const container = document.getElementById("view-por-grupo");
  if (!container) return;

  const grupos = await buscarGruposSequenciaveis();
  const start = new Date(currentYear - 1, 8, 1);
  const end = new Date(currentYear, 7, 31);

  let html = "";

  for (const grupo of grupos) {
    const registrosGrupo = [];

    for (const [mapa, registros] of Object.entries(mapData)) {
      for (const r of registros) {
        if (r.designadoPara !== grupo) continue;
        const ini = new Date(r.dataInicio);
        const fim = r.dataConclusao ? new Date(r.dataConclusao) : null;
        const dentroDoAno =
          (ini >= start && ini <= end) ||
          (fim && fim >= start && fim <= end);
        if (dentroDoAno) {
          registrosGrupo.push({ ...r, mapaNum: parseInt(mapa) });
        }
      }
    }

    registrosGrupo.sort((a, b) => new Date(a.dataInicio) - new Date(b.dataInicio));

    // Quantas vezes cada mapa foi concluído pelo grupo neste ano de serviço
    // (conta pela data de conclusão, não pela de início).
    const conclusoesPorMapa = new Map();
    for (const r of registrosGrupo) {
      if (!r.dataConclusao) continue;
      const fim = new Date(r.dataConclusao);
      if (fim < start || fim > end) continue;
      conclusoesPorMapa.set(r.mapaNum, (conclusoesPorMapa.get(r.mapaNum) || 0) + 1);
    }
    html += `<div class="grupo-section">
      <h3 class="grupo-title">${grupo}
        <span class="grupo-count">${registrosGrupo.length} designação(ões)</span>
      </h3>
      <table class="grupo-table">
        <thead>
          <tr>
            <th>#</th><th>Mapa</th><th>Bairro</th>
            <th>Data de Início</th><th>Data de Conclusão</th><th>Status</th>
            <th title="Quantas vezes o grupo concluiu este mapa no ano de serviço">Vezes concluído</th>
          </tr>
        </thead>
        <tbody>`;

    if (registrosGrupo.length === 0) {
      html += `<tr><td colspan="7" class="grupo-vazio">Nenhuma designação neste ano de serviço</td></tr>`;
    } else {
      registrosGrupo.forEach((r, idx) => {
        const concluido = !!r.dataConclusao;
        const statusCls = concluido ? "sg-concluido" : "sg-andamento";
        const statusTxt = concluido ? "Concluído" : "Em Andamento";
        html += `<tr>
          <td class="sg-seq">${idx + 1}º</td>
          <td><strong>${r.mapaNum}</strong></td>
          <td>${r.bairro || "—"}</td>
          <td>${formatDate(r.dataInicio)}</td>
          <td>${formatDate(r.dataConclusao)}</td>
          <td><span class="sg-badge ${statusCls}">${statusTxt}</span></td>
          <td class="sg-vezes">${vezesHtml(conclusoesPorMapa.get(r.mapaNum) || 0)}</td>
        </tr>`;
      });
    }

    html += `</tbody></table></div>`;
  }

  container.innerHTML = html;
}

function updateYearDisplay() {
  const yearDisplay = document.getElementById("serviceYear");
  if (!yearDisplay) return;

  const start = new Date(currentYear - 1, 8, 1);
  const end = new Date(currentYear, 7, 31);
  yearDisplay.innerHTML = `Ano de serviço: ${currentYear} (Período: ${formatDateFromObject(start)} - ${formatDateFromObject(end)})`;
}

// Nova função para formatar objetos Date
function formatDateFromObject(dateObj) {
  if (!dateObj) return "";
  
  return `${String(dateObj.getDate()).padStart(2, "0")}/${String(
    dateObj.getMonth() + 1
  ).padStart(2, "0")}/${dateObj.getFullYear()}`;
}

// Função para formatar strings de data
function formatDate(dateStr) {
  if (!dateStr) return "";

  const [year, month, day] = dateStr.split("-");
  // Usar os valores diretamente sem criar objeto Date para evitar problemas de fuso horário
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function renderTable(data) {
  const table = document.querySelector("table tbody");
  if (!table) return;
  
  table.innerHTML = "";

  const maxMapas = Math.max(...Object.keys(data).map(Number)); // quantidade de mapas automática 
  const start = new Date(currentYear - 1, 8, 1);
  const end = new Date(currentYear, 7, 31);

  for (let i = 1; i <= maxMapas; i++) {
    const registros = (data[i] || []).filter((entry) => {
      const ini = new Date(entry.dataInicio);
      const fim = new Date(entry.dataConclusao);
      return (ini >= start && ini <= end) || (fim >= start && fim <= end);
    });

    const ultRegistroAnterior = (data[i] || [])
      .filter((entry) => new Date(entry.dataConclusao) < start)
      .sort((a, b) => new Date(b.dataConclusao) - new Date(a.dataConclusao))[0];

    addRow(table, i, registros, ultRegistroAnterior?.dataConclusao);
  }
}

function addRow(table, mapa, registros, ultDataAnterior) {
  const row1 = table.insertRow();
  const cellMapa = row1.insertCell(0);
  const cellUltima = row1.insertCell(1);

  cellMapa.innerText = mapa;
  cellMapa.rowSpan = 2;
  cellUltima.innerText = registros[registros.length - 1]?.dataConclusao
    ? formatDate(registros[registros.length - 1].dataConclusao)
    : formatDate(ultDataAnterior);
  cellUltima.rowSpan = 2;

  for (let j = 0; j < 4; j++) {
    const cell = row1.insertCell();
    cell.colSpan = 2;
    cell.innerText = registros[j]?.designadoPara || "";
  }

  const row2 = table.insertRow();
  for (let j = 0; j < 4; j++) {
    const cell1 = row2.insertCell();
    const cell2 = row2.insertCell();
    cell1.innerText = registros[j]?.dataInicio ? formatDate(registros[j].dataInicio) : "";
    cell2.innerText = registros[j]?.dataConclusao ? formatDate(registros[j].dataConclusao) : "";
  }
}