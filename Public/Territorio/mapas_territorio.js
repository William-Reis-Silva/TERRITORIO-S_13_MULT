/*************************************************
 * 🗺️ MAPAS DE TERRITÓRIO — MULTI-CONGREGAÇÃO
 * Gera o menu "Mapas" e as galerias dinamicamente a partir de
 * congregacoes/{congId}/territorios (bairro + fotoURL), em vez de
 * bairros e imagens fixos no HTML. "Configurar" = cadastrar o
 * território normalmente em Painel > Configurar Território — o
 * menu e as galerias aqui se atualizam sozinhos para qualquer
 * congregação.
 *
 * Tudo dentro de uma IIFE: index_territorio.html também carrega
 * escala-generica.js (script clássico, mesmo escopo global) que já
 * declara um `const DIACRITICOS_REGEX` próprio — sem isolar este
 * arquivo, os dois nomes colidem e o navegador lança
 * "Identifier 'DIACRITICOS_REGEX' has already been declared",
 * o que impede ESTE arquivo inteiro de rodar (erro de parse, não só
 * de execução) e deixa "Carregando mapas..." travado para sempre.
 *************************************************/
(function () {
  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const DIACRITICOS_REGEX = new RegExp("[̀-ͯ]", "g");

  function slugifyBairro(nome) {
    const slug = String(nome ?? "")
      .normalize("NFD")
      .replace(DIACRITICOS_REGEX, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || "bairro";
  }

  // Mesma lógica de Prog_campo.js: se a página foi aberta por um link
  // público com "?cong=ID" na URL, usa esse ID direto (sem precisar de
  // login). Só cai para Tenant.resolverCongId() (que exige usuário
  // autenticado) quando não há esse parâmetro.
  async function resolverCongIdParaMapas() {
    const congIdDaUrl = new URLSearchParams(window.location.search).get("cong");
    const congIdNormalizado = congIdDaUrl ? CongregacaoUtils.normalizarNumeroCongregacao(congIdDaUrl) : null;
    return congIdNormalizado || Tenant.resolverCongId();
  }

  // Sem isso, uma falha silenciosa (sessão que nunca resolve, rede lenta,
  // permissão negada) deixava "Carregando mapas..." parado pra sempre, sem
  // nunca mostrar o motivo — o erro real só ia pro console.error, invisível
  // pra quem está usando o site.
  function comTimeout(promise, ms, mensagemTimeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error(mensagemTimeout)), ms);
      promise.then(
        (valor) => { clearTimeout(timeoutId); resolve(valor); },
        (erro) => { clearTimeout(timeoutId); reject(erro); }
      );
    });
  }

  async function carregarMapasTerritorio() {
    const menu = document.getElementById("mapas-dropdown-menu");
    const container = document.getElementById("mapas");
    if (!menu || !container) return;

    try {
      const congId = await comTimeout(
        resolverCongIdParaMapas(),
        12000,
        "Tempo esgotado identificando sua congregação (a sessão de login não respondeu). Recarregue a página."
      );
      const snapshot = await comTimeout(
        Tenant.collectionSync(congId, "territorios").orderBy("bairro").get(),
        12000,
        "Tempo esgotado buscando os territórios no Firestore."
      );

      if (snapshot.empty) {
        menu.innerHTML = '<li><span class="nav-link">Nenhum território cadastrado</span></li>';
        container.innerHTML =
          '<p style="text-align:center;padding:20px;">Nenhum território cadastrado ainda. Cadastre em Painel &gt; Configurar Território.</p>';
        return;
      }

      const porBairro = new Map();
      snapshot.forEach((doc) => {
        const data = doc.data();
        const bairro = (data.bairro || "Sem bairro").trim() || "Sem bairro";
        if (!porBairro.has(bairro)) porBairro.set(bairro, []);
        porBairro.get(bairro).push(data);
      });

      const slugsUsados = new Set();
      let menuHtml = "";
      let sectionsHtml = "";

      Array.from(porBairro.keys())
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .forEach((bairro) => {
          let slug = slugifyBairro(bairro);
          while (slugsUsados.has(slug)) slug += "-2";
          slugsUsados.add(slug);

          const bairroEscapado = escapeHtml(bairro);
          menuHtml += `<li><a href="javascript:void(0);" onclick="showSection('${slug}')">${bairroEscapado}</a></li>`;

          const territoriosDoBairro = porBairro.get(bairro).sort((a, b) => (a.mapa || 0) - (b.mapa || 0));

          const imagensHtml = territoriosDoBairro
            .map((t) => {
              if (!t.fotoURL) {
                return `<p class="mapa-sem-imagem">Mapa ${escapeHtml(t.mapa)} sem imagem cadastrada.</p>`;
              }
              return `<img src="${escapeHtml(t.fotoURL)}" alt="${bairroEscapado} - Mapa ${escapeHtml(
                t.mapa
              )}" loading="lazy" onclick="openFullscreen(this.src)" />`;
            })
            .join("\n");

          sectionsHtml += `
          <div id="${slug}" class="section" style="display:none;">
            <h1>${bairroEscapado}</h1>
            <div class="conteudo">${imagensHtml}</div>
          </div>
        `;
        });

      menu.innerHTML = menuHtml;
      container.innerHTML = sectionsHtml;
    } catch (error) {
      console.error("❌ Erro ao carregar mapas de território:", error);
      const detalhe = (error && error.code) ? `${error.message} (${error.code})` : (error && error.message) || String(error);
      menu.innerHTML = '<li><span class="nav-link">Erro ao carregar</span></li>';
      container.innerHTML =
        `<p style="text-align:center;padding:20px;color:#dc3545;">Erro ao carregar mapas: ${escapeHtml(detalhe)}</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", carregarMapasTerritorio);
})();
