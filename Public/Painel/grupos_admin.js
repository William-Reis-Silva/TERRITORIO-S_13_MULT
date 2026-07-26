// grupos_admin.js — Painel de gestão de grupos e bairros travados
// Script não-modular; usa firebase.firestore() diretamente (window.db disponível via Firebaseconfig.js)

(function () {
  let _isAdmin = false;
  let _adminChecado = false;

  // ── Admin ──────────────────────────────────────────────

  async function verificarAdmin() {
    if (_adminChecado) return _isAdmin;
    const user = firebase.auth().currentUser;
    if (!user) {
      _adminChecado = true;
      return false;
    }
    const doc = await firebase.firestore().collection('usuarios').doc(user.uid).get();
    _isAdmin = doc.exists && doc.data().isAdmin === true;
    _adminChecado = true;
    return _isAdmin;
  }

  // ── Dados ──────────────────────────────────────────────

  async function buscarGrupos() {
    const congId = await Tenant.resolverCongId();
    const snap = await Tenant.collectionSync(congId, 'grupos').get();
    return snap.docs.map(d => d.id).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  async function buscarBairrosDoGrupo(grupo) {
    const congId = await Tenant.resolverCongId();
    const doc = await Tenant.collectionSync(congId, 'grupo-bairros').doc(grupo).get();
    return doc.exists ? (doc.data().bairros || []) : [];
  }

  async function buscarMapasDoGrupo(grupo) {
    const congId = await Tenant.resolverCongId();
    const doc = await Tenant.collectionSync(congId, 'grupo-bairros').doc(grupo).get();
    return doc.exists ? (doc.data().mapas || []) : [];
  }

  // ── Renderização ─────────────────────────────────────────

  function renderCard(grupo, bairros, mapas, isAdmin) {
    const key = grupo.replace(/\s/g, '_');
    const tagsBairros = bairros.map(b => `
      <span class="ga-tag">
        ${b}
        ${isAdmin ? `<button type="button" class="ga-tag-remove" onclick="removerBairro('${grupo}', '${b.replace(/'/g, "\\'")}')">&times;</button>` : ''}
      </span>
    `).join('');

    const tagsMapas = mapas.map(m => `
      <span class="ga-tag ga-tag-mapa">
        Mapa ${m}
        ${isAdmin ? `<button type="button" class="ga-tag-remove" onclick="removerMapa('${grupo}', ${m})">&times;</button>` : ''}
      </span>
    `).join('');

    return `
      <div class="ga-card" id="ga-card-${key}">
        <div class="ga-card-header">
          <h3 class="ga-grupo">${grupo}</h3>
          ${isAdmin ? `<button class="ga-btn ga-btn-remover-grupo" onclick="removerGrupo('${grupo}')">Remover grupo</button>` : ''}
        </div>

        <div class="ga-secao">
          <span class="ga-secao-label">Bairros travados (inteiros)</span>
          <div class="ga-bairros">
            ${tagsBairros || '<span class="ga-sem-bairros">Nenhum bairro travado</span>'}
          </div>
          ${isAdmin ? `
          <div class="ga-add-row">
            <input type="text" id="ga-input-${key}" class="ga-input" placeholder="Nome do bairro" />
            <button class="ga-btn ga-btn-save" onclick="adicionarBairro('${grupo}')">+ Travar bairro</button>
          </div>` : ''}
        </div>

        <div class="ga-secao">
          <span class="ga-secao-label">Mapas específicos travados (mesmo em bairro não travado)</span>
          <div class="ga-bairros">
            ${tagsMapas || '<span class="ga-sem-bairros">Nenhum mapa individual travado</span>'}
          </div>
          ${isAdmin ? `
          <div class="ga-add-row">
            <input type="number" min="1" id="ga-input-mapa-${key}" class="ga-input" placeholder="Nº do mapa" />
            <button class="ga-btn ga-btn-save" onclick="adicionarMapa('${grupo}')">+ Travar mapa</button>
          </div>` : ''}
        </div>

        ${bairros.length === 0 && mapas.length === 0
          ? '<p class="ga-sem-bairros" style="padding:0 16px 14px;">Sem travas — o grupo pode receber qualquer mapa livre</p>'
          : ''}
      </div>`;
  }

  async function carregarPainelGrupos() {
    const container = document.getElementById('grupos-admin-container');
    const loading = document.getElementById('grupos-admin-loading');
    const formNovoGrupo = document.getElementById('grupos-admin-novo-form');
    if (!container || !loading) return;

    loading.style.display = 'block';
    container.style.display = 'none';

    try {
      const isAdmin = await verificarAdmin();
      if (formNovoGrupo) formNovoGrupo.style.display = isAdmin ? 'flex' : 'none';

      const grupos = await buscarGrupos();
      const resultados = await Promise.all(grupos.map(async grupo => ({
        grupo,
        bairros: await buscarBairrosDoGrupo(grupo),
        mapas: await buscarMapasDoGrupo(grupo)
      })));

      container.innerHTML = grupos.length > 0
        ? `<div class="ga-grid">${resultados.map(r => renderCard(r.grupo, r.bairros, r.mapas, isAdmin)).join('')}</div>`
        : `<p class="ga-vazio">Nenhum grupo cadastrado ainda.${isAdmin ? ' Crie o primeiro grupo acima.' : ''}</p>`;

      loading.style.display = 'none';
      container.style.display = 'block';
    } catch (err) {
      console.error('Erro ao carregar painel de grupos:', err);
      loading.textContent = 'Erro ao carregar. Verifique sua conexão.';
    }
  }

  // ── Ações globais (chamadas pelo onclick inline) ──────────

  window.criarGrupoAdmin = async function () {
    const input = document.getElementById('grupos-admin-novo-input');
    if (!input) return;
    const nome = input.value.trim();
    if (!nome) {
      alert('Digite um nome de grupo.');
      return;
    }

    try {
      if (!(await verificarAdmin())) {
        alert('Apenas administradores podem criar grupos.');
        return;
      }
      const existentes = await buscarGrupos();
      if (existentes.includes(nome) || nome === 'Congregação' || nome === 'Campanha Congresso' || nome === 'Campanha Celebração') {
        alert('Já existe um grupo com esse nome.');
        return;
      }
      const congId = await Tenant.resolverCongId();
      await Tenant.collectionSync(congId, 'grupos').doc(nome).set({
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      input.value = '';
      await carregarPainelGrupos();
    } catch (err) {
      alert('Erro ao criar grupo: ' + err.message);
    }
  };

  window.removerGrupo = async function (grupo) {
    if (!confirm(`Remover o ${grupo}? Isso libera todos os bairros travados para ele.`)) return;

    try {
      if (!(await verificarAdmin())) {
        alert('Apenas administradores podem remover grupos.');
        return;
      }
      const congId = await Tenant.resolverCongId();
      await Tenant.collectionSync(congId, 'grupos').doc(grupo).delete();
      await Tenant.collectionSync(congId, 'grupo-bairros').doc(grupo).delete();
      await carregarPainelGrupos();
    } catch (err) {
      alert('Erro ao remover grupo: ' + err.message);
    }
  };

  window.adicionarBairro = async function (grupo) {
    const key = grupo.replace(/\s/g, '_');
    const input = document.getElementById(`ga-input-${key}`);
    if (!input) return;
    const bairro = input.value.trim();
    if (!bairro) {
      alert('Digite o nome de um bairro.');
      return;
    }

    try {
      if (!(await verificarAdmin())) {
        alert('Apenas administradores podem editar bairros.');
        return;
      }
      const atuais = await buscarBairrosDoGrupo(grupo);
      if (atuais.includes(bairro)) {
        alert('Esse bairro já está travado para este grupo.');
        return;
      }
      const congId = await Tenant.resolverCongId();
      await Tenant.collectionSync(congId, 'grupo-bairros').doc(grupo).set({
        bairros: [...atuais, bairro],
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      input.value = '';
      await carregarPainelGrupos();
    } catch (err) {
      alert('Erro ao adicionar bairro: ' + err.message);
    }
  };

  window.removerBairro = async function (grupo, bairro) {
    try {
      if (!(await verificarAdmin())) {
        alert('Apenas administradores podem editar bairros.');
        return;
      }
      const atuais = await buscarBairrosDoGrupo(grupo);
      const congId = await Tenant.resolverCongId();
      await Tenant.collectionSync(congId, 'grupo-bairros').doc(grupo).set({
        bairros: atuais.filter(b => b !== bairro),
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await carregarPainelGrupos();
    } catch (err) {
      alert('Erro ao remover bairro: ' + err.message);
    }
  };

  window.adicionarMapa = async function (grupo) {
    const key = grupo.replace(/\s/g, '_');
    const input = document.getElementById(`ga-input-mapa-${key}`);
    if (!input) return;
    const mapa = parseInt(input.value);
    if (isNaN(mapa) || mapa <= 0) {
      alert('Digite um número de mapa válido.');
      return;
    }

    try {
      if (!(await verificarAdmin())) {
        alert('Apenas administradores podem editar mapas.');
        return;
      }
      const atuais = await buscarMapasDoGrupo(grupo);
      if (atuais.includes(mapa)) {
        alert('Esse mapa já está travado para este grupo.');
        return;
      }
      const congId = await Tenant.resolverCongId();
      await Tenant.collectionSync(congId, 'grupo-bairros').doc(grupo).set({
        mapas: [...atuais, mapa],
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      input.value = '';
      await carregarPainelGrupos();
    } catch (err) {
      alert('Erro ao adicionar mapa: ' + err.message);
    }
  };

  window.removerMapa = async function (grupo, mapa) {
    try {
      if (!(await verificarAdmin())) {
        alert('Apenas administradores podem editar mapas.');
        return;
      }
      const atuais = await buscarMapasDoGrupo(grupo);
      const congId = await Tenant.resolverCongId();
      await Tenant.collectionSync(congId, 'grupo-bairros').doc(grupo).set({
        mapas: atuais.filter(m => m !== mapa),
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await carregarPainelGrupos();
    } catch (err) {
      alert('Erro ao remover mapa: ' + err.message);
    }
  };

  window.carregarPainelGrupos = carregarPainelGrupos;

  // ── Estilos inline (evita dependência de um CSS extra no painel) ──
  const style = document.createElement('style');
  style.textContent = `
    .ga-grid { display: flex; flex-direction: column; gap: 16px; }

    .ga-card {
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }

    .ga-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
    }

    .ga-grupo {
      margin: 0;
      font-size: 15px;
      color: #1e2733;
      flex: 1;
    }

    .ga-secao {
      border-bottom: 1px solid #f0f0f0;
    }
    .ga-secao:last-of-type { border-bottom: none; }

    .ga-secao-label {
      display: block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #888;
      padding: 12px 16px 0;
    }

    .ga-bairros {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 16px 14px;
    }

    .ga-tag-mapa {
      background: #e8f5e9;
      color: #2e7d32;
      border-color: #a5d6a7;
    }
    .ga-tag-mapa .ga-tag-remove { color: #2e7d32; }
    .ga-tag-mapa .ga-tag-remove:hover { color: #b71c1c; }

    .ga-sem-bairros {
      font-size: 0.8rem;
      color: #aaa;
      font-style: italic;
    }

    .ga-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #e8eaf6;
      color: #253875;
      border: 1px solid #c5cae9;
      border-radius: 999px;
      padding: 4px 6px 4px 12px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .ga-tag-remove {
      background: none;
      border: none;
      color: #253875;
      font-size: 1rem;
      line-height: 1;
      cursor: pointer;
      padding: 0 4px;
    }
    .ga-tag-remove:hover { color: #b71c1c; }

    .ga-add-row {
      display: flex;
      gap: 8px;
      padding: 0 16px 16px;
      flex-wrap: wrap;
    }

    .ga-input {
      flex: 1;
      min-width: 140px;
      height: 34px;
      border: 1px solid #bbb;
      border-radius: 5px;
      padding: 4px 10px;
      font-size: 14px;
      color: #1e2733;
    }

    .ga-btn {
      height: 34px;
      padding: 0 16px;
      border: none;
      border-radius: 5px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s;
      white-space: nowrap;
    }
    .ga-btn:hover { opacity: 0.82; }

    .ga-btn-save { background: #253875; color: #fff; }
    .ga-btn-remover-grupo { background: #fdecea; color: #b71c1c; }

    .ga-vazio {
      color: #888;
      font-size: 0.9rem;
      text-align: center;
      padding: 20px;
    }
  `;
  document.head.appendChild(style);
})();
