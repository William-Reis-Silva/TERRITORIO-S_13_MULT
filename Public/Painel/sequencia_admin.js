// sequencia_admin.js — Painel de controle de sequência por grupo
// Script não-modular; usa firebase.firestore() diretamente (window.db disponível via Firebaseconfig.js)

(function () {
  let _territorios = [];   // cache local de territórios
  let _carregado = false;

  // ── Grupos (dinâmicos, vindos do Firestore) ───────────────

  async function buscarGruposSequenciaveis() {
    const congId = await Tenant.resolverCongId();
    const snap = await Tenant.collectionSync(congId, 'grupos').get();
    const dinamicos = snap.docs.map(d => d.id).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    // Congregação sempre primeiro; campanhas não entram (não têm sequência própria)
    return ['Congregação', ...dinamicos];
  }

  // ── Helpers ──────────────────────────────────────────────

  function formatarData(str) {
    if (!str) return '—';
    const [a, m, d] = str.split('-');
    return `${d}/${m}/${a}`;
  }

  async function buscarTerritorios() {
    if (_territorios.length > 0) return _territorios;
    const congId = await Tenant.resolverCongId();
    const snap = await Tenant.collectionSync(congId, 'territorios').orderBy('mapa').get();
    _territorios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return _territorios;
  }

  async function buscarUltimaDesignacaoGrupo(grupo) {
    const congId = await Tenant.resolverCongId();
    const snap = await Tenant.collectionSync(congId, 'designacoes')
      .where('designadoPara', '==', grupo)
      .orderBy('dataInicio', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data();
  }

  async function buscarOverride(grupo) {
    const congId = await Tenant.resolverCongId();
    const doc = await Tenant.collectionSync(congId, 'sequencia-config').doc(grupo).get();
    return doc.exists ? doc.data() : null;
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

  function calcularProxAutomatic(ultimoMapa, territorios) {
    if (!ultimoMapa) {
      return territorios.find(t => t.status !== 'em andamento') || null;
    }
    const idx = territorios.findIndex(t => t.mapa === ultimoMapa);
    const candidatos = idx === -1
      ? territorios
      : [...territorios.slice(idx + 1), ...territorios.slice(0, idx + 1)];
    return candidatos.find(t => t.status !== 'em andamento') || null;
  }

  // ── Renderização ─────────────────────────────────────────

  function renderCard(grupo, ultima, override, proximoAuto) {
    const ultimoMapaNum = ultima ? ultima.mapa : null;
    const ultimaData = ultima ? formatarData(ultima.dataInicio) : '—';
    const overrideNum = override?.proximoMapaOverride || null;

    const proximoExibido = overrideNum || (proximoAuto ? proximoAuto.mapa : null);
    const isOverride = !!overrideNum;

    return `
      <div class="sa-card" id="sa-card-${grupo.replace(/\s/g, '_')}">
        <div class="sa-card-header">
          <h3 class="sa-grupo">${grupo}</h3>
          ${isOverride ? '<span class="sa-badge sa-badge-override">Override ativo</span>' : '<span class="sa-badge sa-badge-auto">Automático</span>'}
        </div>

        <div class="sa-info-row">
          <div class="sa-info-item">
            <span class="sa-label">Último mapa</span>
            <span class="sa-value">${ultimoMapaNum ? `Mapa ${ultimoMapaNum}` : '—'}</span>
            <span class="sa-sub">${ultimaData}</span>
          </div>
          <div class="sa-info-item">
            <span class="sa-label">Próximo sugerido</span>
            <span class="sa-value ${isOverride ? 'sa-value-override' : 'sa-value-auto'}">
              Mapa ${proximoExibido || '—'}
            </span>
            <span class="sa-sub">${isOverride ? 'Definido manualmente' : 'Calculado automaticamente'}</span>
          </div>
        </div>

        <div class="sa-actions">
          <div class="sa-override-form">
            <label class="sa-label">Forçar próximo mapa:</label>
            <div class="sa-override-row">
              <input
                type="number"
                id="override-input-${grupo.replace(/\s/g, '_')}"
                class="sa-input"
                placeholder="Nº do mapa"
                min="1"
                value="${overrideNum || ''}"
              />
              <button class="sa-btn sa-btn-save" onclick="salvarOverride('${grupo}')">Salvar</button>
              ${isOverride
                ? `<button class="sa-btn sa-btn-clear" onclick="limparOverride('${grupo}')">Limpar</button>`
                : ''}
            </div>
          </div>
        </div>
      </div>`;
  }

  async function carregarPainelSequencia() {
    const container = document.getElementById('seq-admin-container');
    const loading = document.getElementById('seq-admin-loading');
    if (!container || !loading) return;

    loading.style.display = 'block';
    container.style.display = 'none';

    try {
      const [territorios, grupos] = await Promise.all([
        buscarTerritorios(),
        buscarGruposSequenciaveis()
      ]);

      const resultados = await Promise.all(grupos.map(async grupo => {
        const [ultima, override, bairrosDoGrupo, mapasDoGrupo] = await Promise.all([
          buscarUltimaDesignacaoGrupo(grupo),
          buscarOverride(grupo),
          buscarBairrosDoGrupo(grupo),
          buscarMapasDoGrupo(grupo)
        ]);
        const ultimoMapa = ultima ? ultima.mapa : null;
        const territoriosDoGrupo = (bairrosDoGrupo.length > 0 || mapasDoGrupo.length > 0)
          ? territorios.filter(t => bairrosDoGrupo.includes(t.bairro) || mapasDoGrupo.includes(t.mapa))
          : territorios;
        const proximoAuto = calcularProxAutomatic(ultimoMapa, territoriosDoGrupo);
        return { grupo, ultima, override, proximoAuto };
      }));

      container.innerHTML = `<div class="sa-grid">${resultados.map(r =>
        renderCard(r.grupo, r.ultima, r.override, r.proximoAuto)
      ).join('')}</div>`;

      loading.style.display = 'none';
      container.style.display = 'block';
      _carregado = true;
    } catch (err) {
      console.error('Erro ao carregar painel de sequência:', err);
      loading.textContent = 'Erro ao carregar. Verifique sua conexão.';
    }
  }

  // ── Ações globais (chamadas pelo onclick inline) ──────────

  window.salvarOverride = async function (grupo) {
    const key = grupo.replace(/\s/g, '_');
    const input = document.getElementById(`override-input-${key}`);
    if (!input) return;

    const valor = parseInt(input.value);
    if (isNaN(valor) || valor <= 0) {
      alert('Digite um número de mapa válido.');
      return;
    }

    try {
      const congId = await Tenant.resolverCongId();
      await Tenant.collectionSync(congId, 'sequencia-config')
        .doc(grupo)
        .set({
          proximoMapaOverride: valor,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      _territorios = []; // força refresh
      await carregarPainelSequencia();
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

  window.limparOverride = async function (grupo) {
    if (!confirm(`Limpar override do ${grupo}? O sistema voltará à sugestão automática.`)) return;

    try {
      const congId = await Tenant.resolverCongId();
      await Tenant.collectionSync(congId, 'sequencia-config')
        .doc(grupo)
        .set({
          proximoMapaOverride: null,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      _territorios = [];
      await carregarPainelSequencia();
    } catch (err) {
      alert('Erro ao limpar: ' + err.message);
    }
  };

  window.carregarPainelSequencia = carregarPainelSequencia;

  // ── Estilos inline (evita dependência de um CSS extra no painel) ──
  const style = document.createElement('style');
  style.textContent = `
    .sa-grid { display: flex; flex-direction: column; gap: 16px; }

    .sa-card {
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }

    .sa-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
    }

    .sa-grupo {
      margin: 0;
      font-size: 15px;
      color: #1e2733;
      flex: 1;
    }

    .sa-badge {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      padding: 2px 9px;
      border-radius: 999px;
    }

    .sa-badge-auto     { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
    .sa-badge-override { background: #fff3e0; color: #e65100; border: 1px solid #ffcc80; }

    .sa-info-row {
      display: flex;
      gap: 0;
      padding: 14px 16px;
      border-bottom: 1px solid #f0f0f0;
    }

    .sa-info-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sa-info-item + .sa-info-item {
      border-left: 1px solid #eeeeee;
      padding-left: 16px;
      margin-left: 16px;
    }

    .sa-label {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #888;
      display: block;
    }

    .sa-value {
      font-size: 1.05rem;
      font-weight: 700;
      color: #1e2733;
      font-variant-numeric: tabular-nums;
    }

    .sa-value-auto     { color: #2e7d32; }
    .sa-value-override { color: #e65100; }

    .sa-sub {
      font-size: 0.72rem;
      color: #aaa;
    }

    .sa-actions {
      padding: 12px 16px;
    }

    .sa-override-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 6px;
      flex-wrap: wrap;
    }

    .sa-input {
      width: 100px;
      height: 34px;
      border: 1px solid #bbb;
      border-radius: 5px;
      padding: 4px 10px;
      font-size: 14px;
      text-align: center;
      color: #1e2733;
    }

    .sa-btn {
      height: 34px;
      padding: 0 16px;
      border: none;
      border-radius: 5px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .sa-btn:hover { opacity: 0.82; }

    .sa-btn-save  { background: #253875; color: #fff; }
    .sa-btn-clear { background: #e0e0e0; color: #555; }
  `;
  document.head.appendChild(style);
})();
