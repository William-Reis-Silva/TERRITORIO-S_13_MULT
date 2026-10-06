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

  // Histórico completo do grupo, do mais antigo ao mais recente: o último
  // item é a última designação; os concluídos alimentam a marca na lista.
  async function buscarDesignacoesGrupo(grupo) {
    const congId = await Tenant.resolverCongId();
    const snap = await Tenant.collectionSync(congId, 'designacoes')
      .where('designadoPara', '==', grupo)
      .orderBy('dataInicio', 'asc')
      .get();
    return snap.docs.map(d => d.data());
  }

  // mapa → data (AAAA-MM-DD) da conclusão mais recente pelo grupo
  function ultimasConclusoes(designacoes) {
    const porMapa = new Map();
    for (const d of designacoes) {
      if (!d.dataConclusao) continue;
      // normalmente "AAAA-MM-DD"; registros antigos podem trazer Timestamp
      const data = typeof d.dataConclusao === 'string'
        ? d.dataConclusao
        : (typeof d.dataConclusao.toDate === 'function' ? d.dataConclusao.toDate().toISOString().slice(0, 10) : null);
      if (!data) continue;
      const atual = porMapa.get(d.mapa);
      if (!atual || data > atual) porMapa.set(d.mapa, data);
    }
    return porMapa;
  }

  async function buscarOverride(grupo) {
    const congId = await Tenant.resolverCongId();
    const doc = await Tenant.collectionSync(congId, 'sequencia-config').doc(grupo).get();
    return doc.exists ? doc.data() : null;
  }

  async function buscarReserva(grupo) {
    const congId = await Tenant.resolverCongId();
    const doc = await Tenant.collectionSync(congId, 'grupo-bairros').doc(grupo).get();
    const dados = doc.exists ? doc.data() : {};
    return { bairros: dados.bairros || [], mapas: dados.mapas || [] };
  }

  // Estado da lista de mapas de cada grupo (para reordenar antes de salvar).
  // grupo → { ordem: [territorio...], alterada: bool, aberta: bool, ultimoMapa, proximoMapa }
  const _listas = {};

  function chaveGrupo(grupo) {
    return grupo.replace(/\s/g, '_');
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

        <div class="sa-lista" id="sa-lista-${chaveGrupo(grupo)}">${renderListaMapas(grupo)}</div>
      </div>`;
  }

  function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderListaMapas(grupo) {
    const estado = _listas[grupo];
    if (!estado) return '';
    const { ordem, alterada, personalizada, aberta, ultimoMapa, proximoMapa, conclusoes } = estado;

    const titulo = `
      <button class="sa-lista-toggle" onclick="toggleListaMapas('${grupo}')">
        ${aberta ? '▾' : '▸'} Mapas do grupo (${ordem.length})
        <span class="sa-lista-modo">${personalizada || alterada ? 'ordem personalizada' : 'ordem numérica'}</span>
      </button>`;
    if (!aberta) return titulo;

    if (!ordem.length) return titulo + '<div class="sa-lista-vazia">Nenhum mapa neste grupo.</div>';

    const linhas = ordem.map((t, i) => {
      const marcas = [
        t.mapa === ultimoMapa ? '<span class="sa-tag sa-tag-ultimo">último</span>' : '',
        t.mapa === proximoMapa ? '<span class="sa-tag sa-tag-proximo">próximo</span>' : '',
        t.status === 'em andamento' ? '<span class="sa-tag sa-tag-andamento">em andamento</span>' : '',
        conclusoes.has(t.mapa) ? `<span class="sa-tag sa-tag-concluido" title="Última conclusão por este grupo">✓ concluído ${formatarData(conclusoes.get(t.mapa))}</span>` : ''
      ].join('');
      return `
        <li class="sa-lista-item${t.mapa === proximoMapa ? ' sa-lista-item--proximo' : ''}">
          <span class="sa-lista-pos">${i + 1}º</span>
          <span class="sa-lista-mapa">Mapa ${t.mapa}</span>
          <span class="sa-lista-bairro">${escHtml(t.bairro || '—')}</span>
          <span class="sa-lista-tags">${marcas}</span>
          <span class="sa-lista-mover">
            <button class="sa-btn-mover" aria-label="Subir mapa ${t.mapa}" onclick="moverMapaSequencia('${grupo}', ${i}, -1)" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="sa-btn-mover" aria-label="Descer mapa ${t.mapa}" onclick="moverMapaSequencia('${grupo}', ${i}, 1)" ${i === ordem.length - 1 ? 'disabled' : ''}>↓</button>
          </span>
        </li>`;
    }).join('');

    return `${titulo}
      <ol class="sa-lista-itens">${linhas}</ol>
      <div class="sa-lista-acoes">
        ${alterada ? '<span class="sa-lista-aviso">Ordem alterada — não salva</span>' : ''}
        <button class="sa-btn sa-btn-save" onclick="salvarOrdemSequencia('${grupo}')" ${alterada ? '' : 'disabled'}>Salvar ordem</button>
        ${alterada ? `<button class="sa-btn sa-btn-clear" onclick="carregarPainelSequencia()">Descartar</button>` : ''}
        ${personalizada && !alterada ? `<button class="sa-btn sa-btn-clear" onclick="restaurarOrdemNumerica('${grupo}')">Voltar à ordem numérica</button>` : ''}
      </div>`;
  }

  function atualizarLista(grupo) {
    const el = document.getElementById(`sa-lista-${chaveGrupo(grupo)}`);
    if (el) el.innerHTML = renderListaMapas(grupo);
  }

  async function gravarOrdem(grupo, ordemMapas) {
    const congId = await Tenant.resolverCongId();
    await Tenant.collectionSync(congId, 'sequencia-config')
      .doc(grupo)
      .set({
        ordemMapas,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
  }

  window.toggleListaMapas = function (grupo) {
    const estado = _listas[grupo];
    if (!estado) return;
    estado.aberta = !estado.aberta;
    atualizarLista(grupo);
  };

  window.moverMapaSequencia = function (grupo, i, direcao) {
    const estado = _listas[grupo];
    const j = i + direcao;
    if (!estado || j < 0 || j >= estado.ordem.length) return;
    [estado.ordem[i], estado.ordem[j]] = [estado.ordem[j], estado.ordem[i]];
    estado.alterada = true;
    atualizarLista(grupo);
  };

  window.salvarOrdemSequencia = async function (grupo) {
    const estado = _listas[grupo];
    if (!estado) return;
    try {
      await gravarOrdem(grupo, estado.ordem.map(t => t.mapa));
      _territorios = [];
      await carregarPainelSequencia();
    } catch (err) {
      alert('Erro ao salvar ordem: ' + err.message);
    }
  };

  window.restaurarOrdemNumerica = async function (grupo) {
    if (!confirm(`Voltar a sequência do ${grupo} para a ordem numérica dos mapas?`)) return;
    try {
      await gravarOrdem(grupo, firebase.firestore.FieldValue.delete());
      _territorios = [];
      await carregarPainelSequencia();
    } catch (err) {
      alert('Erro ao restaurar ordem: ' + err.message);
    }
  };

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

      // Reservas de todos os grupos: um grupo sem reserva (ex: Congregação)
      // só enxerga os mapas que nenhum outro grupo reservou.
      const reservasLista = await Promise.all(grupos.map(buscarReserva));
      const reservas = Object.fromEntries(grupos.map((g, i) => [g, reservasLista[i]]));

      const resultados = await Promise.all(grupos.map(async grupo => {
        const [designacoes, override] = await Promise.all([
          buscarDesignacoesGrupo(grupo),
          buscarOverride(grupo)
        ]);
        const ultima = designacoes.length ? designacoes[designacoes.length - 1] : null;
        const ultimoMapa = ultima ? ultima.mapa : null;
        const territoriosDoGrupo = SequenciaUtils.territoriosDoGrupo(territorios, grupo, reservas);
        const ordenados = SequenciaUtils.ordenarTerritoriosDoGrupo(territoriosDoGrupo, override?.ordemMapas);
        const proximoAuto = SequenciaUtils.proximoNaSequencia(ordenados, ultimoMapa);

        _listas[grupo] = {
          ordem: ordenados,
          alterada: false,
          personalizada: Array.isArray(override?.ordemMapas) && override.ordemMapas.length > 0,
          aberta: _listas[grupo]?.aberta || false,
          ultimoMapa,
          conclusoes: ultimasConclusoes(designacoes),
          proximoMapa: override?.proximoMapaOverride || (proximoAuto ? proximoAuto.mapa : null)
        };
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
    .sa-btn:disabled { opacity: 0.4; cursor: default; }

    .sa-lista { border-top: 1px solid #f0f0f0; }

    .sa-lista-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: none;
      border: none;
      font-size: 13px;
      font-weight: 700;
      color: #1e2733;
      cursor: pointer;
      text-align: left;
    }
    .sa-lista-toggle:hover { background: #fafafa; }

    .sa-lista-modo {
      margin-left: auto;
      font-size: 0.7rem;
      font-weight: 400;
      color: #888;
    }

    .sa-lista-vazia { padding: 0 16px 12px; color: #999; font-style: italic; font-size: 13px; }

    .sa-lista-itens {
      list-style: none;
      margin: 0;
      padding: 0 16px;
      max-height: 420px;
      overflow-y: auto;
    }

    .sa-lista-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 4px;
      border-bottom: 1px solid #f3f3f3;
      font-size: 13px;
    }
    .sa-lista-item--proximo { background: #f1f8e9; }

    .sa-lista-pos    { width: 32px; color: #999; font-variant-numeric: tabular-nums; }
    .sa-lista-mapa   { width: 70px; font-weight: 700; color: #1e2733; }
    .sa-lista-bairro { flex: 1; color: #555; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sa-lista-tags   { display: flex; gap: 4px; flex-wrap: wrap; }

    .sa-tag {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 999px;
    }
    .sa-tag-ultimo    { background: #eceff1; color: #455a64; }
    .sa-tag-proximo   { background: #e8f5e9; color: #2e7d32; }
    .sa-tag-andamento { background: #e3f2fd; color: #1565c0; }
    .sa-tag-concluido { background: #f1f8e9; color: #33691e; border: 1px solid #c5e1a5; }

    .sa-lista-mover { display: flex; gap: 4px; }
    .sa-btn-mover {
      width: 28px;
      height: 28px;
      border: 1px solid #ccc;
      border-radius: 5px;
      background: #fff;
      cursor: pointer;
      font-size: 13px;
    }
    .sa-btn-mover:disabled { opacity: 0.3; cursor: default; }

    .sa-lista-acoes {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 10px 16px 14px;
    }
    .sa-lista-aviso { font-size: 12px; color: #e65100; font-weight: 700; margin-right: auto; }

    @media (max-width: 480px) {
      .sa-lista-bairro { display: none; }
    }
  `;
  document.head.appendChild(style);
})();
