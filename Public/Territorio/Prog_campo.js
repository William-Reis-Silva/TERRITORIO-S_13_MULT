/*************************************************
 * 🏢 RESOLUÇÃO DA CONGREGAÇÃO
 * Tela pública do Salão: ?cong=48991 na URL, sem exigir login.
 * Dentro do app (usuário logado): resolve pela sessão via Tenant.js.
 *************************************************/
function resolverCongIdDaTela() {
  const congIdDaUrl = new URLSearchParams(window.location.search).get("cong");
  const congIdNormalizado = congIdDaUrl ? CongregacaoUtils.normalizarNumeroCongregacao(congIdDaUrl) : null;

  if (congIdNormalizado) {
    return Promise.resolve(congIdNormalizado);
  }

  return Tenant.resolverCongId();
}

/*************************************************
 * 📅 CONTROLE DE SEMANAS
 *************************************************/
let offsetSemanas = 0;

/*************************************************
 * 🚀 INICIALIZAÇÃO DA TELA
 *************************************************/
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM pronto, iniciando carregamento");
  configurarBotoes();
  obterSemana(0);
});

/*************************************************
 * ⏪⏩ BOTÕES DE NAVEGAÇÃO
 *************************************************/
function configurarBotoes() {
  const btnAnterior = document.getElementById("semana-anterior");
  const btnProxima = document.getElementById("semana-proxima");

  if (!btnAnterior || !btnProxima) return;

  btnAnterior.addEventListener("click", () => {
    offsetSemanas--;
    obterSemana(offsetSemanas);
  });

  btnProxima.addEventListener("click", () => {
    offsetSemanas++;
    obterSemana(offsetSemanas);
  });
}

/*************************************************
 * 📆 OBTÉM SEMANA ATUAL
 *************************************************/
function obterSemana(offset = 0) {
  console.log("📆 Carregando semana", offset);

  const hoje = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
    })
  );

  const diaSemana = hoje.getDay(); // 0 = domingo

  // Segunda-feira
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(
    hoje.getDate() -
      (diaSemana === 0 ? 6 : diaSemana - 1) +
      offset * 7
  );

  // Domingo
  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(inicioSemana.getDate() + 6);

  atualizarTextoSemana(inicioSemana, fimSemana);
  carregarDados(inicioSemana);
}

/*************************************************
 * 📝 ATUALIZA TEXTO DA SEMANA
 *************************************************/
function atualizarTextoSemana(inicio, fim) {
  const el = document.getElementById("semana-atual");
  if (!el) return;

  const meses = [
    "janeiro","fevereiro","março","abril","maio","junho",
    "julho","agosto","setembro","outubro","novembro","dezembro",
  ];

  const formatar = (d) =>
    `${d.getDate()} de ${meses[d.getMonth()]}`;

  el.textContent = `Semana de ${formatar(inicio)} a ${formatar(fim)}`;
}

/*************************************************
 * 🆔 GERA ID DO DOCUMENTO
 *************************************************/
function docId(tipo, data) {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${tipo}_${y}-${m}-${d}`;
}

/*************************************************
 * 🔒 ESCAPA TEXTO ANTES DE INSERIR VIA innerHTML
 *************************************************/
function escaparTextoHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/*************************************************
 * 📦 CARREGA DADOS DO FIRESTORE (ATUALIZADO)
 *************************************************/
async function carregarDados(inicioSemana) {
  console.log("📦 Carregando dados Firestore");

  const congId = await resolverCongIdDaTela();

  const segunda = new Date(inicioSemana);
  segunda.setHours(0, 0, 0, 0);

  const sexta = new Date(segunda);
  sexta.setDate(segunda.getDate() + 4);

  const sabado = new Date(segunda);
  sabado.setDate(segunda.getDate() + 5);

  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);

  // Obter o ano para acessar a coleção correta
  const ano = sabado.getFullYear();

  const sextaEl = document.getElementById("sexta");
  const sabadoEl = document.getElementById("sabado");
  const domingoEl = document.getElementById("domingo");
  const idosoEl = document.getElementById("idoso");
  const acompanhanteEl = document.getElementById("acompanhante");

  // Limpar campos
  if (sextaEl) sextaEl.textContent = "-";
  if (sabadoEl) sabadoEl.textContent = "-";
  if (domingoEl) domingoEl.textContent = "-";
  if (idosoEl) idosoEl.textContent = "-";
  if (acompanhanteEl) acompanhanteEl.textContent = "-";

  // 🔹 SEXTA - fallback estático legado (só tem efeito se a linha estática
  // com id="sexta" ainda estiver no DOM, ex: congregação sem config-semanal)
  Tenant.collectionSync(congId, "programacao")
    .doc(String(ano))
    .collection("agendamentos")
    .doc(docId("sexta", sexta))
    .get()
    .then((doc) => {
      if (doc.exists && sextaEl) {
        const d = doc.data();
        sextaEl.textContent = d.evento || d.dirigente || "-";
        console.log("✅ Sexta:", d.evento || d.dirigente);
      } else {
        console.log("⚠️ Nenhum dirigente encontrado para esta sexta");
      }
    })
    .catch((error) => {
      console.error("❌ Erro ao buscar sexta:", error);
      if (sextaEl) sextaEl.textContent = "Erro";
    });

  // 🔹 SÁBADO - fallback estático legado
  Tenant.collectionSync(congId, "programacao")
    .doc(String(ano))
    .collection("agendamentos")
    .doc(docId("sabado", sabado))
    .get()
    .then((doc) => {
      if (doc.exists && sabadoEl) {
        const d = doc.data();
        sabadoEl.textContent = d.evento || d.dirigente || "-";
        console.log("✅ Sábado:", d.evento || d.dirigente);
      } else {
        console.log("⚠️ Nenhum dirigente encontrado para este sábado");
      }
    })
    .catch((error) => {
      console.error("❌ Erro ao buscar sábado:", error);
      if (sabadoEl) sabadoEl.textContent = "Erro";
    });

  // 🔹 DOMINGO - fallback estático legado
  Tenant.collectionSync(congId, "programacao")
    .doc(String(ano))
    .collection("agendamentos")
    .doc(docId("domingo", domingo))
    .get()
    .then((doc) => {
      if (doc.exists && domingoEl) {
        const d = doc.data();
        domingoEl.textContent = d.evento || d.grupo || "-";
        console.log("✅ Domingo:", d.evento || d.grupo);
      } else {
        console.log("⚠️ Nenhum grupo encontrado para este domingo");
      }
    })
    .catch((error) => {
      console.error("❌ Erro ao buscar domingo:", error);
      if (domingoEl) domingoEl.textContent = "Erro";
    });

  // 🔹 IDOSOS - Nova estrutura (inalterado)
  Tenant.collectionSync(congId, "programacao")
    .doc(String(ano))
    .collection("agendamentos")
    .doc(docId("idosos", sabado))
    .get()
    .then((doc) => {
      if (!doc.exists) {
        console.log("⚠️ Nenhum idoso encontrado para este sábado");
        return;
      }

      const d = doc.data();

      if (idosoEl) {
        idosoEl.textContent = d.evento || d.idoso || "-";
        console.log("✅ Idoso:", d.evento || d.idoso);
      }

      if (acompanhanteEl) {
        acompanhanteEl.textContent = d.evento || d.acompanhante || "-";
        console.log("✅ Acompanhante:", d.evento || d.acompanhante);
      }
    })
    .catch((error) => {
      console.error("❌ Erro ao buscar idosos:", error);
      if (idosoEl) idosoEl.textContent = "Erro";
      if (acompanhanteEl) acompanhanteEl.textContent = "Erro";
    });

  // 🔹 PROGRAMAÇÃO SEMANAL CONFIGURÁVEL (congregacoes/{congId}/programacao/config-semanal)
  try {
    const configSnap = await Tenant.collectionSync(congId, "programacao")
      .doc("config-semanal")
      .get();

    // Sem config: mantém a tabela estática de fallback intocada e os Idosos visíveis.
    if (!configSnap.exists) return;

    const config = configSnap.data() || {};

    const homeIdosoEl = document.getElementById("home-idoso");
    if (homeIdosoEl) {
      homeIdosoEl.style.display = config.idososAtivo === false ? "none" : "";
    }

    const linhas = Array.isArray(config.linhas) ? config.linhas : [];
    if (!linhas.length) return;

    await renderizarCorpoAtividades(congId, ano, segunda, linhas);
  } catch (error) {
    console.error("❌ Erro ao carregar programação semanal configurável:", error);
  }
}

/*************************************************
 * 🧱 RENDERIZA #corpo-atividades A PARTIR DA CONFIG
 *************************************************/
async function renderizarCorpoAtividades(congId, ano, segunda, linhas) {
  const corpo = document.getElementById("corpo-atividades");
  if (!corpo) return;

  const linhasHtml = await Promise.all(
    linhas.map((linha) => montarLinhaHtml(congId, ano, segunda, linha))
  );

  corpo.innerHTML = linhasHtml.join("");
}

async function montarLinhaHtml(congId, ano, segunda, linha) {
  const diaLabel =
    (window.EscalaGenerica && EscalaGenerica.DIA_LABELS[linha.dia]) ||
    linha.dia ||
    "-";

  let dirigente = "-";
  if (linha.fonte === "auto" && linha.listaId) {
    dirigente = await buscarDirigenteAuto(congId, ano, segunda, linha);
  } else if (linha.fonte === "manual") {
    dirigente = linha.dirigenteManual || "-";
  }

  return (
    "<tr>" +
    `<td>${escaparTextoHtml(diaLabel)}</td>` +
    `<td>${escaparTextoHtml(linha.modalidade)}</td>` +
    `<td>${escaparTextoHtml(linha.hora)}</td>` +
    `<td>${escaparTextoHtml(dirigente)}</td>` +
    `<td>${escaparTextoHtml(linha.local)}</td>` +
    "</tr>"
  );
}

async function buscarDirigenteAuto(congId, ano, segunda, linha) {
  try {
    const data = EscalaGenerica.proximaDataParaDia(segunda, linha.dia);
    const prefixo = EscalaGenerica.prefixoDocParaLinha(linha);

    const doc = await Tenant.collectionSync(congId, "programacao")
      .doc(String(ano))
      .collection("agendamentos")
      .doc(docId(prefixo, data))
      .get();

    if (!doc.exists) return "-";

    const d = doc.data();
    // grupos-domingo grava o nome em `grupo`, não em `dirigente`
    return d.evento || d.dirigente || d.grupo || "-";
  } catch (error) {
    console.error("❌ Erro ao buscar dirigente automático:", error);
    return "Erro";
  }
}