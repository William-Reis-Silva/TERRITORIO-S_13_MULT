// congregacao_admin.js — Painel de gestão do convite e membros da congregação
// Script não-modular; usa firebase.firestore() e Tenant.js diretamente.

(function () {
  let _isAdmin = false;
  let _adminChecado = false;

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

  function escapeHtml(texto) {
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderMembro(uid, dados, isAdmin, ehVocêMesmo) {
    return `
      <div class="ga-card" id="ca-membro-${uid}" style="padding:12px 16px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div>
          <strong>${escapeHtml(dados.usuario || 'Sem nome')}</strong>
          <div style="font-size:0.8rem; color:#888;">${escapeHtml(dados.email || '')}${ehVocêMesmo ? ' (você)' : ''}</div>
        </div>
        <div style="display:flex; gap:16px;">
          <label style="display:flex; align-items:center; gap:4px; font-size:0.8rem;">
            <input type="checkbox" ${dados.writtenPermission ? 'checked' : ''} ${isAdmin ? '' : 'disabled'}
              onchange="alterarPermissaoMembro('${uid}', 'writtenPermission', this.checked)" />
            Pode escrever
          </label>
          <label style="display:flex; align-items:center; gap:4px; font-size:0.8rem;">
            <input type="checkbox" ${dados.isAdmin ? 'checked' : ''} ${isAdmin && !ehVocêMesmo ? '' : 'disabled'}
              onchange="alterarPermissaoMembro('${uid}', 'isAdmin', this.checked)" />
            Admin
          </label>
        </div>
      </div>`;
  }

  async function carregarPainelCongregacao() {
    const codigoInput = document.getElementById('ca-codigo-convite');
    const membrosLoading = document.getElementById('ca-membros-loading');
    const membrosContainer = document.getElementById('ca-membros-container');
    if (!codigoInput || !membrosLoading || !membrosContainer) return;

    membrosLoading.style.display = 'block';
    membrosContainer.style.display = 'none';

    try {
      const isAdmin = await verificarAdmin();
      const congId = await Tenant.resolverCongId();
      const congregacaoDoc = await firebase.firestore().collection('congregacoes').doc(congId).get();
      codigoInput.value = congregacaoDoc.exists ? (congregacaoDoc.data().codigoConvite || '—') : '—';

      const uidAtual = firebase.auth().currentUser.uid;
      const membrosSnap = await firebase.firestore()
        .collection('usuarios')
        .where('congregacaoId', '==', congId)
        .get();

      const membros = membrosSnap.docs.map(d => ({ uid: d.id, ...d.data() }))
        .sort((a, b) => (a.usuario || '').localeCompare(b.usuario || '', 'pt-BR'));

      membrosContainer.innerHTML = membros
        .map(m => renderMembro(m.uid, m, isAdmin, m.uid === uidAtual))
        .join('');

      membrosLoading.style.display = 'none';
      membrosContainer.style.display = 'block';
    } catch (err) {
      console.error('Erro ao carregar painel de congregação:', err);
      membrosLoading.textContent = 'Erro ao carregar. Verifique sua conexão.';
    }
  }

  window.copiarCodigoConvite = function () {
    const codigoInput = document.getElementById('ca-codigo-convite');
    if (!codigoInput || !codigoInput.value || codigoInput.value === '—') return;
    navigator.clipboard.writeText(codigoInput.value)
      .then(() => alert('Código copiado!'))
      .catch(() => alert('Não foi possível copiar. Copie manualmente: ' + codigoInput.value));
  };

  window.regenerarCodigoConvite = async function () {
    if (!confirm('Gerar um novo código invalida o código atual. Continuar?')) return;

    try {
      if (!(await verificarAdmin())) {
        alert('Apenas administradores podem gerar um novo código.');
        return;
      }
      const congId = await Tenant.resolverCongId();
      const congregacaoDoc = await firebase.firestore().collection('congregacoes').doc(congId).get();
      const codigoAntigo = congregacaoDoc.exists ? congregacaoDoc.data().codigoConvite : null;
      const novoCodigo = CongregacaoUtils.gerarCodigoConvite();

      await firebase.firestore().collection('convites').doc(novoCodigo).set({ congregacaoId: congId, ativo: true });
      await firebase.firestore().collection('congregacoes').doc(congId).update({ codigoConvite: novoCodigo });

      // Invalida o código antigo só depois do novo já estar ativo, pra nunca
      // deixar a congregação sem nenhum código válido se algo falhar no meio.
      if (codigoAntigo && codigoAntigo !== novoCodigo) {
        try {
          await firebase.firestore().collection('convites').doc(codigoAntigo).update({ ativo: false });
        } catch (invalidacaoErr) {
          console.error('Não foi possível invalidar o código antigo:', invalidacaoErr);
        }
      }

      await carregarPainelCongregacao();
    } catch (err) {
      alert('Erro ao gerar novo código: ' + err.message);
    }
  };

  window.alterarPermissaoMembro = async function (uid, campo, valor) {
    try {
      if (!(await verificarAdmin())) {
        alert('Apenas administradores podem alterar permissões.');
        await carregarPainelCongregacao();
        return;
      }
      await firebase.firestore().collection('usuarios').doc(uid).update({ [campo]: valor });
    } catch (err) {
      alert('Erro ao alterar permissão: ' + err.message);
      await carregarPainelCongregacao();
    }
  };

  window.carregarPainelCongregacao = carregarPainelCongregacao;
})();
