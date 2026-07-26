// Variável global para armazenar territórios no modo local (offline)
const territorios = [];

// Tamanho máximo aceito para a foto do mapa (espelha o limite em storage.rules)
const MAX_MAPA_FOTO_BYTES = 2 * 1024 * 1024;

// Verificar se Firebase está disponível
firebase.auth().onAuthStateChanged(function (user) {
  const usuarioLogado = !!user;

  if (!usuarioLogado) {
    mensagemAcessoNegado.style.display = "none";

    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        mensagemAcessoNegado.style.display = "block";
      });
    });
  } else {
    document.getElementById("user-greeting").style.display = "block";

    if (user.uid) {
      const userId = user.uid;
      const userDocRef = firebase.firestore().collection("usuarios").doc(userId);

      userDocRef
        .get()
        .then(function (doc) {
          if (doc.exists) {
            const userData = doc.data();
            if (userData && userData.usuario) {
              document.getElementById("username").textContent = userData.usuario;
            } else {
              document.getElementById("username").textContent = "Usuário";
            }
          } else {
            console.warn("Documento do usuário não encontrado");
            document.getElementById("username").textContent = "Usuário";
          }
        })
        .catch(function (error) {
          console.error("Erro ao recuperar os dados do usuário:", error);
        });
    }
  }
});

function verificarFirebase() {
  return typeof firebase !== "undefined" && typeof db !== "undefined" && typeof storage !== "undefined";
}

// Função para criar efeito visual de upload
function criarEfeitoUpload(elemento, arquivo) {
  const container = elemento.parentElement;

  // Criar elemento de preview
  const previewContainer = document.createElement("div");
  previewContainer.className = "upload-preview-container";

  // Criar barra de progresso
  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar";

  const progressFill = document.createElement("div");
  progressFill.className = "progress-fill";

  // Efeito de brilho na barra
  const shine = document.createElement("div");
  shine.className = "progress-shine";

  progressFill.appendChild(shine);
  progressBar.appendChild(progressFill);

  // Informações do arquivo
  const fileInfo = document.createElement("div");
  fileInfo.innerHTML = `
    <div class="file-info">
      <span class="file-icon">📷</span>
      <strong>${arquivo.name}</strong>
    </div>
    <div class="file-size">
      Tamanho: ${(arquivo.size / 1024).toFixed(1)} KB
    </div>
  `;

  const statusText = document.createElement("div");
  statusText.className = "upload-status";
  statusText.textContent = "Preparando upload...";

  previewContainer.appendChild(fileInfo);
  previewContainer.appendChild(progressBar);
  previewContainer.appendChild(statusText);

  container.appendChild(previewContainer);

  return {
    updateProgress: (percent) => {
      progressFill.style.width = percent + "%";
      statusText.textContent = `Enviando... ${percent}%`;
    },
    showSuccess: () => {
      progressFill.style.background = "linear-gradient(90deg, #28a745, #20c997)";
      statusText.textContent = "✅ Upload concluído com sucesso!";
      statusText.className = "upload-status success";
      previewContainer.className = "upload-preview-container success";
      previewContainer.classList.add("upload-success");
    },
    showError: (message) => {
      progressFill.className = "progress-fill error";
      statusText.textContent = `❌ Erro: ${message}`;
      statusText.className = "upload-status error";
      previewContainer.className = "upload-preview-container error";
    },
    remove: () => {
      setTimeout(() => {
        if (previewContainer.parentElement) {
          previewContainer.classList.add("fade-out");
          setTimeout(() => previewContainer.remove(), 300);
        }
      }, 3000);
    },
  };
}

// Configurar formulário de território (COM efeito visual)
document.getElementById("config-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const congId = await Tenant.resolverCongId();

  const bairro = document.getElementById("bairro").value;
  const mapa = document.getElementById("mapa-config").value;
  const fotoInput = document.getElementById("mapa-foto");
  const fotoFile = fotoInput.files[0];
  const resultDiv = document.getElementById("config-result");

  // Verificar se todos os campos estão preenchidos
  if (!bairro.trim()) {
    resultDiv.innerHTML = '<p class="result-error">Por favor, preencha o campo Bairro!</p>';
    return;
  }

  if (!mapa.trim()) {
    resultDiv.innerHTML = '<p class="result-error">Por favor, preencha o Número do Mapa!</p>';
    return;
  }

  if (!fotoFile) {
    resultDiv.innerHTML = '<p class="result-error">Por favor, selecione uma imagem do mapa!</p>';
    fotoInput.focus();
    return;
  }

  // Verificar se é uma imagem válida
  if (!fotoFile.type.startsWith("image/")) {
    resultDiv.innerHTML = '<p class="result-error">Por favor, selecione apenas arquivos de imagem!</p>';
    fotoInput.focus();
    return;
  }

  if (fotoFile.size > MAX_MAPA_FOTO_BYTES) {
    resultDiv.innerHTML = `<p class="result-error">⚠️ A imagem tem ${(fotoFile.size / 1024 / 1024).toFixed(1)} MB. O tamanho máximo permitido é 2 MB. Reduza o tamanho da imagem e tente novamente.</p>`;
    fotoInput.focus();
    return;
  }

  console.log("Arquivo selecionado:", fotoFile.name, "Tamanho:", fotoFile.size, "Tipo:", fotoFile.type);

  if (!verificarFirebase()) {
    // Modo local - simular salvamento
    territorios.push({
      bairro,
      mapa: Number(mapa),
      foto: fotoFile.name,
      criadoEm: new Date(),
    });

    resultDiv.innerHTML = '<p class="result-success">Território salvo localmente! (Modo offline)</p>';
    document.getElementById("config-form").reset();
    return;
  }

  // Criar efeito visual de upload
  const uploadEffect = criarEfeitoUpload(fotoInput, fotoFile);

  try {
    // Simular progresso inicial
    uploadEffect.updateProgress(10);

    // Verificar se já existe território com esse número
    const existeQuery = await Tenant.collectionSync(congId, "territorios").where("mapa", "==", Number(mapa)).get();
    if (!existeQuery.empty) {
      uploadEffect.showError("Já existe um território com esse número de mapa!");
      uploadEffect.remove();
      return;
    }

    uploadEffect.updateProgress(30);

    // 1. Upload da imagem no Storage do Firebase
    const nomeArquivo = `${Date.now()}-${mapa}-${fotoFile.name}`;
    const storageRef = storage.ref(`congregacoes/${congId}/mapas/${nomeArquivo}`);

    console.log("Iniciando upload para:", storageRef.fullPath);

    // Upload com monitoramento de progresso
    const uploadTask = storageRef.put(fotoFile);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 60 + 30; // 30-90%
        uploadEffect.updateProgress(Math.round(progress));
      },
      (error) => {
        console.error("Erro no upload:", error);
        uploadEffect.showError(error.message);
        uploadEffect.remove();
      }
    );

    const snapshot = await uploadTask;
    const fotoURL = await snapshot.ref.getDownloadURL();

    uploadEffect.updateProgress(95);
    console.log("Upload concluído. URL:", fotoURL);

    // 2. Salvar no Firestore (SEM campo status)
    const docRef = await Tenant.collectionSync(congId, "territorios").add({
      bairro: bairro.trim(),
      mapa: Number(mapa),
      fotoURL,
      nomeArquivo: fotoFile.name,
    });

    uploadEffect.updateProgress(100);
    console.log("Documento salvo com ID:", docRef.id);

    uploadEffect.showSuccess();
    uploadEffect.remove();

    resultDiv.innerHTML = '<p class="result-success">🎉 Território salvo com sucesso!</p>';
    document.getElementById("config-form").reset();
  } catch (error) {
    console.error("Erro ao salvar território:", error);

    // storage/unauthorized é o mesmo código de erro tanto para "sem
    // permissão de escrita" quanto para "regra de tamanho/tipo rejeitou o
    // arquivo" — como já validamos tipo e tamanho antes de chegar aqui, se
    // ainda assim cair nesse código com o arquivo perto/acima do limite, é
    // quase certeza que é a regra de tamanho do Storage (que pode estar
    // configurada de forma diferente do valor local em storage.rules).
    const provavelLimiteDeTamanho =
      error.code === "storage/unauthorized" && fotoFile.size > MAX_MAPA_FOTO_BYTES * 0.9;

    const mensagemAmigavel = provavelLimiteDeTamanho
      ? "Tamanho máximo: 2 MB. Reduza o tamanho da imagem e tente novamente."
      : error.code === "storage/unauthorized"
      ? "Você não tem permissão para enviar arquivos. Peça a um administrador para liberar seu acesso."
      : error.message;

    uploadEffect.showError(mensagemAmigavel);
    uploadEffect.remove();
    resultDiv.innerHTML = `<p class="result-error">Erro ao salvar território: ${mensagemAmigavel}</p>`;
  }
});

// Configurar formulário de designação (ATUALIZADO)
document.getElementById("gerenciar-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const congId = await Tenant.resolverCongId();

  const responsavel = document.getElementById("responsavel").value;
  const mapa = document.getElementById("mapa-num").value;
  const data = document.getElementById("data-designacao").value;
  const resultDiv = document.getElementById("gerenciar-result");

  // Validações
  if (!responsavel.trim()) {
    resultDiv.innerHTML = '<p class="result-error">Por favor, preencha o campo Responsável!</p>';
    return;
  }

  if (!mapa.trim()) {
    resultDiv.innerHTML = '<p class="result-error">Por favor, preencha o Número do Mapa!</p>';
    return;
  }

  if (!data.trim()) {
    resultDiv.innerHTML = '<p class="result-error">Por favor, selecione uma Data de Designação!</p>';
    return;
  }

  if (!verificarFirebase()) {
    resultDiv.innerHTML =
      '<p class="result-warning">Firebase não configurado. Não é possível designar territórios no modo offline.</p>';
    return;
  }

  try {
    // Mostrar loading
    resultDiv.innerHTML = '<p class="result-loading">Designando território...</p>';

    // Verificar se o território existe
    const territorioQuery = await Tenant.collectionSync(congId, "territorios").where("mapa", "==", Number(mapa)).get();

    if (territorioQuery.empty) {
      resultDiv.innerHTML = '<p class="result-error">Mapa não encontrado!</p>';
      return;
    }

    // Verificar se já existe uma designação ativa para este mapa
    const designacaoAtivaQuery = await Tenant.collectionSync(congId, "designacoes")
      .where("mapa", "==", Number(mapa))
      .where("status", "==", "em andamento")
      .get();

    if (!designacaoAtivaQuery.empty) {
      resultDiv.innerHTML = '<p class="result-error">Este mapa já está designado para outra pessoa!</p>';
      return;
    }

    // Salvar a nova designação
    await Tenant.collectionSync(congId, "designacoes").add({
      mapa: Number(mapa),
      designadoPara: responsavel.trim(),
      dataInicio: data,
      status: "em andamento",
    });

    resultDiv.innerHTML = `<p style="color: green;">Mapa ${mapa} designado para ${responsavel}.</p>`;
    document.getElementById("gerenciar-form").reset();
  } catch (err) {
    console.error("Erro ao designar território:", err);
    resultDiv.innerHTML = `<p class="result-error">Erro ao designar território: ${err.message}</p>`;
  }
});

// Função para calcular status do território baseado nas designações
function calcularStatusTerritorio(mapa, designacoes) {
  const designacoesDoMapa = designacoes.filter((d) => d.mapa === mapa);

  if (designacoesDoMapa.length === 0) {
    return "disponível";
  }

  // Buscar a designação mais recente
  const designacaoRecente = designacoesDoMapa.sort(
    (a, b) => (b.criadoEm?.toDate() || 0) - (a.criadoEm?.toDate() || 0)
  )[0];

  return designacaoRecente.status || "disponível";
}

// Função para gerar HTML da tabela de territórios
function gerarTabelaTerritorios(territoriosData, designacoesData) {
  let html = `
    <div class="report-section">
      <h3>Lista de Territórios (Ordenados por Mapa)</h3>
      <table class="report-table">
        <tr>
          <th>Mapa</th>
          <th>Bairro</th>
          <th>Status</th>
          <th>Designado Para</th>
          <th>Ações</th>
        </tr>
  `;

  territoriosData.forEach((territorio) => {
    const statusClass =
      territorio.statusCalculado === "disponível"
        ? "status-available"
        : territorio.statusCalculado === "em andamento"
        ? "status-progress"
        : "status-completed";

    // Encontrar designação ativa para mostrar responsável
    const designacaoAtiva = designacoesData.find((d) => d.mapa === territorio.mapa && d.status === "em andamento");
    const responsavel = designacaoAtiva ? designacaoAtiva.designadoPara : "-";

    html += `
      <tr>
        <td class="map-number">${territorio.mapa}</td>
        <td>${territorio.bairro}</td>
        <td class="${statusClass}">${territorio.statusCalculado}</td>
        <td>${responsavel}</td>
        <td>
          <button onclick="concluirTerritorio(${territorio.mapa})" 
                  ${territorio.statusCalculado !== "em andamento" ? "disabled" : ""} 
                  class="action-button complete">
            Concluir
          </button>
          <button onclick="disponibilizarTerritorio(${territorio.mapa})" 
                  ${territorio.statusCalculado === "disponível" ? "disabled" : ""} 
                  class="action-button available">
            Disponibilizar
          </button>
        </td>
      </tr>
    `;
  });

  html += "</table></div>";
  return html;
}

// Função para gerar HTML da tabela de designações
function gerarTabelaDesignacoes(designacoesData) {
  let html = `
    <div class="report-section">
      <h3>Designações Recentes</h3>
      <table class="report-table">
        <tr>
          <th>Mapa</th>
          <th>Designado Para</th>
          <th>Data Início</th>
          <th>Status</th>
          <th>Data Conclusão</th>
        </tr>
  `;

  designacoesData
    .sort((a, b) => (b.criadoEm?.toDate() || 0) - (a.criadoEm?.toDate() || 0))
    .slice(0, 15)
    .forEach((designacao) => {
      const dataConclusao = designacao.dataConclusao || "-";
      const statusClass =
        designacao.status === "em andamento"
          ? "status-progress"
          : designacao.status === "concluído"
          ? "status-completed"
          : "status-available";

      html += `
        <tr>
          <td class="map-number">${designacao.mapa}</td>
          <td>${designacao.designadoPara}</td>
          <td>${designacao.dataInicio}</td>
          <td class="${statusClass}">${designacao.status}</td>
          <td>${dataConclusao}</td>
        </tr>
      `;
    });

  html += "</table></div>";
  return html;
}

// Função para atualizar relatório (COM ORDENAÇÃO CRESCENTE)
async function atualizarRelatorio() {
  const resultDiv = document.getElementById("relatorio-result");

  if (!verificarFirebase()) {
    resultDiv.innerHTML = `
      <p class="result-warning">Firebase não configurado.</p>
      <p>Configure o Firebase para ver dados em tempo real.</p>
    `;
    return;
  }

  try {
    resultDiv.innerHTML = '<p class="result-loading">Carregando relatório...</p>';
    const congId = await Tenant.resolverCongId();

    // 1. Buscar todos os territórios
    const territoriosSnapshot = await Tenant.collectionSync(congId, "territorios").orderBy("mapa", "asc").get();
    const territoriosData = [];

    territoriosSnapshot.forEach((doc) => {
      territoriosData.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // 2. Buscar todas as designações
    const designSnapshot = await Tenant.collectionSync(congId, "designacoes").get();
    const designacoesData = [];

    designSnapshot.forEach((doc) => {
      designacoesData.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // 3. Calcular estatísticas baseadas nas designações
    let total = territoriosData.length;
    let disponivel = 0;
    let andamento = 0;
    let concluidos = 0;

    // Adicionar status calculado a cada território
    territoriosData.forEach((territorio) => {
      territorio.statusCalculado = calcularStatusTerritorio(territorio.mapa, designacoesData);

      switch (territorio.statusCalculado) {
        case "disponível":
          disponivel++;
          break;
        case "em andamento":
          andamento++;
          break;
        case "concluído":
          concluidos++;
          break;
      }
    });

    // Ordenar territorios por número do mapa (crescente)
    territoriosData.sort((a, b) => a.mapa - b.mapa);

    // Construir HTML do relatório
    let html = `
      <div class="report-summary">
        <h3>Resumo Geral</h3>
        <p><strong>Total de territórios:</strong> ${total}</p>
        <p><strong>Disponíveis:</strong> ${disponivel}</p>
        <p><strong>Em andamento:</strong> ${andamento}</p>
        <p><strong>Concluídos:</strong> ${concluidos}</p>
      </div>
    `;

    // Tabela de territórios
    if (territoriosData.length > 0) {
      html += gerarTabelaTerritorios(territoriosData, designacoesData);
    }

    // Tabela de designações recentes
    if (designacoesData.length > 0) {
      html += gerarTabelaDesignacoes(designacoesData);
    }

    resultDiv.innerHTML = html;
  } catch (error) {
    console.error("Erro ao carregar relatório:", error);
    resultDiv.innerHTML = '<p class="result-error">Erro ao carregar dados. Verifique o console.</p>';
  }
}

// Funções para ações nos territórios (ATUALIZADAS para trabalhar com designações)
async function concluirTerritorio(mapa) {
  if (!verificarFirebase()) {
    alert("Firebase não configurado. Esta ação não está disponível no modo offline.");
    return;
  }

  try {
    const congId = await Tenant.resolverCongId();

    // Buscar designação ativa para este mapa
    const designacaoQuery = await Tenant.collectionSync(congId, "designacoes")
      .where("mapa", "==", Number(mapa))
      .where("status", "==", "em andamento")
      .get();

    if (designacaoQuery.empty) {
      alert("Não há designação ativa para este território!");
      return;
    }

    // Atualizar a designação para concluída
    const designacaoDoc = designacaoQuery.docs[0];
    await designacaoDoc.ref.update({
      status: "concluído",
      dataConclusao: new Date().toISOString().split("T")[0], // Data atual no formato YYYY-MM-DD
    });

    alert("Território marcado como concluído com sucesso!");
    atualizarRelatorio();
  } catch (error) {
    console.error("Erro ao concluir território:", error);
    alert("Erro ao concluir território: " + error.message);
  }
}

async function disponibilizarTerritorio(mapa) {
  if (!verificarFirebase()) {
    alert("Firebase não configurado. Esta ação não está disponível no modo offline.");
    return;
  }

  try {
    const congId = await Tenant.resolverCongId();

    // Buscar designação ativa para este mapa
    const designacaoQuery = await Tenant.collectionSync(congId, "designacoes")
      .where("mapa", "==", Number(mapa))
      .where("status", "in", ["em andamento", "concluído"])
      .get();

    if (!designacaoQuery.empty) {
      // Atualizar todas as designações para "disponível" (histórico)
      const batch = db.batch();
      designacaoQuery.docs.forEach((doc) => {
        batch.update(doc.ref, { status: "disponível" });
      });
      await batch.commit();
    }

    alert("Território disponibilizado com sucesso!");
    atualizarRelatorio();
  } catch (error) {
    console.error("Erro ao disponibilizar território:", error);
    alert("Erro ao disponibilizar território: " + error.message);
  }
}

// Função para preview de imagem selecionada
function criarPreviewImagem(file, resultDiv) {
  const reader = new FileReader();
  reader.onload = function (e) {
    resultDiv.innerHTML = `
      <div class="image-preview-container">
        <div class="image-preview-success">
          <span class="success-icon">✅</span>
          <strong class="success-text"> Imagem selecionada com sucesso!</strong>
        </div>
        <div class="image-preview">
          <img src="${e.target.result}" alt="Preview">
        </div>
        <div class="image-preview-info">
          📄 <strong>${file.name}</strong><br>
          📏 Tamanho: ${(file.size / 1024).toFixed(1)} KB
        </div>
      </div>
    `;
  };
  reader.readAsDataURL(file);
}

// Disponibilizar funções globalmente
window.atualizarRelatorio = atualizarRelatorio;
window.concluirTerritorio = concluirTerritorio;
window.disponibilizarTerritorio = disponibilizarTerritorio;

// Feedback visual para seleção de arquivo (MELHORADO)
document.getElementById("mapa-foto").addEventListener("change", function (e) {
  const file = e.target.files[0];
  const resultDiv = document.getElementById("config-result");

  if (file) {
    if (!file.type.startsWith("image/")) {
      resultDiv.innerHTML = `
        <p class="result-error">
          ⚠️ Por favor, selecione apenas arquivos de imagem
        </p>
      `;
      e.target.value = "";
    } else if (file.size > MAX_MAPA_FOTO_BYTES) {
      resultDiv.innerHTML = `
        <p class="result-error">
          ⚠️ A imagem tem ${(file.size / 1024 / 1024).toFixed(1)} MB. O tamanho máximo permitido é 2 MB. Reduza o tamanho da imagem e tente novamente.
        </p>
      `;
      e.target.value = "";
    } else {
      // Criar preview da imagem
      criarPreviewImagem(file, resultDiv);
    }
  } else {
    resultDiv.innerHTML = "";
  }
});

console.log("Script otimizado carregado com sucesso! 🚀");
