// Tenant.js — resolve a congregação do usuário logado e expõe coleções
// escopadas por congregação. Script não-modular; depende de
// CongregacaoUtils.js e Firebaseconfig.js já carregados antes dele.
(function () {
  let _congIdPromise = null;

  function resolverCongId() {
    if (_congIdPromise) return _congIdPromise;

    _congIdPromise = new Promise((resolve, reject) => {
      const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
        unsubscribe();

        if (!user) {
          reject(new Error('Usuário não autenticado'));
          return;
        }

        try {
          const doc = await firebase.firestore().collection('usuarios').doc(user.uid).get();
          const congId = doc.exists ? doc.data().congregacaoId : null;

          if (!congId) {
            reject(new Error('Usuário sem congregação vinculada'));
            return;
          }

          resolve(congId);
        } catch (err) {
          reject(err);
        }
      });
    });

    return _congIdPromise;
  }

  function collectionSync(congId, nomeColecao) {
    return firebase.firestore().collection(CongregacaoUtils.caminhoSubcolecao(congId, nomeColecao));
  }

  async function collection(nomeColecao) {
    const congId = await resolverCongId();
    return collectionSync(congId, nomeColecao);
  }

  window.Tenant = { resolverCongId, collection, collectionSync };
})();
