// Registro_S13.js - Versão otimizada com carregamento simultâneo
import unifiedDataManager from "./UnifiedDataManager.js";

class MapaLoader {
  constructor() {
    this.currentImageUrl = null;
    this.currentFotoURL = null;
    this.imageCache = new Map();
    this.currentMapNumber = null;
    this.abortController = null;
  }

  // fotoURL vem do campo salvo no Firestore (territorio.fotoURL), apontando
  // para o Firebase Storage — não existe mais um diretório local de mapas.
  async carregarImagemMapa(numeroMapa, fotoURL) {
    const numero = parseInt(numeroMapa);

    if (isNaN(numero) || numero <= 0) {
      this.ocultarImagem();
      return;
    }

    if (this.currentMapNumber === numero && this.currentFotoURL === (fotoURL || null)) {
      return;
    }

    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    this.currentMapNumber = numero;
    this.currentFotoURL = fotoURL || null;

    if (!fotoURL) {
      this.mostrarSemImagem();
      return;
    }

    if (this.imageCache.has(fotoURL)) {
      const cachedResult = this.imageCache.get(fotoURL);
      if (cachedResult.exists) {
        this.mostrarImagem(fotoURL);
      } else {
        this.mostrarErro();
      }
      return;
    }

    this.mostrarLoading();

    try {
      const existe = await this.verificarImagemExiste(fotoURL, this.abortController.signal);

      if (this.currentFotoURL !== fotoURL) {
        return; // uma nova chamada substituiu esta antes de terminar
      }

      this.imageCache.set(fotoURL, { exists: existe });

      if (existe) {
        this.mostrarImagem(fotoURL);
      } else {
        this.mostrarErro();
      }
    } catch (error) {
      if (error.name !== "AbortError" && this.currentFotoURL === fotoURL) {
        console.error("Erro ao carregar imagem do mapa:", error);
        this.mostrarErro();
      }
    }
  }

  verificarImagemExiste(url, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }

      const img = new Image();

      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
        signal?.removeEventListener("abort", onAbort);
      };

      const onAbort = () => {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      };

      img.onload = () => {
        cleanup();
        resolve(true);
      };

      img.onerror = () => {
        cleanup();
        resolve(false);
      };

      setTimeout(() => {
        if (!signal?.aborted) {
          cleanup();
          resolve(false);
        }
      }, 3000);

      signal?.addEventListener("abort", onAbort);
      img.src = url;
    });
  }

  mostrarLoading() {
    this.ocultarTodosElementos();
    const loading = document.getElementById("mapa-loading");
    if (loading) {
      loading.style.display = "block";
      loading.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #6c757d;">
          <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="margin-top: 10px;">Carregando mapa ${this.currentMapNumber}...</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
    }
  }

  mostrarImagem(url) {
    this.ocultarTodosElementos();

    const img = document.getElementById("mapa-preview");
    const label = document.querySelector('label[for="mapa-preview"]');

    if (img) {
      img.src = url;
      img.style.display = "block";
      this.currentImageUrl = url;

      if (label) {
        label.style.display = "block";
        label.textContent = `Mapa do Território ${this.currentMapNumber}`;
      }

      console.log(`✅ Imagem do mapa ${this.currentMapNumber} carregada`);
    }
  }

  mostrarSemImagem() {
    this.ocultarTodosElementos();
    const semImagem = document.getElementById("mapa-no-image");
    if (semImagem) {
      semImagem.style.display = "block";
      semImagem.textContent = `Nenhuma imagem disponível para o território ${this.currentMapNumber}.`;
    }
  }

  mostrarErro() {
    this.ocultarTodosElementos();
    const erro = document.getElementById("mapa-error");
    if (erro) {
      erro.style.display = "block";
      erro.textContent = `Erro ao carregar a imagem do mapa ${this.currentMapNumber}.`;
    }
  }

  ocultarImagem() {
    this.ocultarTodosElementos();
    this.currentImageUrl = null;
    this.currentFotoURL = null;
    this.currentMapNumber = null;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  ocultarTodosElementos() {
    const elementos = ["mapa-loading", "mapa-preview", "mapa-error", "mapa-no-image"];

    elementos.forEach((id) => {
      const elemento = document.getElementById(id);
      if (elemento) elemento.style.display = "none";
    });

    const label = document.querySelector('label[for="mapa-preview"]');
    if (label) label.style.display = "none";
  }

  abrirImagemCompleta() {
    if (this.currentImageUrl) {
      window.open(this.currentImageUrl, "_blank");
    }
  }

  limparCache() {
    this.imageCache.clear();
    console.log("🗑️ Cache de imagens limpo");
  }

  getDebugInfo() {
    return {
      currentMapNumber: this.currentMapNumber,
      currentImageUrl: this.currentImageUrl,
      cacheSize: this.imageCache.size,
      cachedMaps: Array.from(this.imageCache.keys()),
    };
  }
}

class RegistroS13 {
  constructor() {
    this.auth = firebase.auth();
    this.currentUser = null;
    this.mapaLoader = new MapaLoader();
    this.debounceTimer = null;
    this._sugestaoAtual = null;
  }

  async init() {
    try {
      console.log("🚀 Iniciando RegistroS13...");

      await this._aguardarLogin();
      console.log("✅ Usuário autenticado:", this.currentUser.email);

      const success = await unifiedDataManager.init();
      if (!success) {
        throw new Error("Falha na inicialização do UnifiedDataManager");
      }

      console.log("✅ UnifiedDataManager inicializado");

      this._configurarInterface();
      this._setupEventListeners();
      this._setupUnifiedListeners();
      this._setupMapaLoader();

      console.log("✅ RegistroS13 inicializado");
    } catch (error) {
      console.error("❌ Erro na inicialização:", error);
      this._mostrarDialogo("Erro ao iniciar sistema: " + error.message, "error");
    }
  }

  async _aguardarLogin() {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.auth.onAuthStateChanged((user) => {
        unsubscribe();
        if (user) {
          this.currentUser = user;
          resolve();
        } else {
          console.log("❌ Usuário não autenticado, redirecionando...");
          window.location.href = "./login.html";
          reject(new Error("Usuário não autenticado"));
        }
      });
    });
  }

  _popularGrupos() {
    const select = document.getElementById("designado_para");
    if (!select) return;
    const grupos = unifiedDataManager.getGrupos();
    select.innerHTML = grupos.map((g) => `<option value="${g}">${g}</option>`).join("");
  }

  _configurarInterface() {
    this._popularGrupos();

    const permissions = unifiedDataManager.permissions;
    const greetingElement = document.getElementById("user-greeting");

    if (greetingElement && permissions.username) {
      greetingElement.textContent = permissions.username;
    }

    const canWrite = permissions.canWrite;
    const saveButton = document.getElementById("Salvar");

    if (saveButton) {
      if (!canWrite) {
        saveButton.disabled = true;
        saveButton.title = "Sem permissão para criar registros";
        saveButton.innerHTML = "🔒 Sem Permissão";
      } else {
        saveButton.disabled = false;
        saveButton.innerHTML = "<span>💾</span> Salvar";
      }
    }

    this._atualizarStatusConexao();
  }

  _setupEventListeners() {
    const numeroMapaInput = document.getElementById("numero_mapa");
    if (numeroMapaInput) {
      // Função unificada para processar mudanças no número do mapa
      const processarMudancaMapa = async (valor) => {
        const numero = parseInt(valor);
        if (!isNaN(numero) && numero > 0) {
          // Executar busca de território e carregamento de imagem simultaneamente
          const territorio = unifiedDataManager.getTerritorio(numero);
          await Promise.all([
            this._buscarTerritorio(numero),
            this.mapaLoader.carregarImagemMapa(numero, territorio?.fotoURL)
          ]);
        } else {
          // Limpar campos se número inválido
          const bairroInput = document.getElementById("bairro");
          if (bairroInput) {
            bairroInput.value = "";
            bairroInput.placeholder = "Bairro será preenchido automaticamente";
          }
          this.mapaLoader.ocultarImagem();
        }
      };

      // Event listener com debounce unificado para input
      numeroMapaInput.addEventListener("input", (e) => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          processarMudancaMapa(e.target.value);
        }, 200); // Debounce reduzido para 200ms
      });

      // Event listener para change (quando usuário sai do campo)
      numeroMapaInput.addEventListener("change", (e) => {
        clearTimeout(this.debounceTimer);
        processarMudancaMapa(e.target.value);
      });

      // Event listener para keyup (para casos específicos como Tab)
      numeroMapaInput.addEventListener("keyup", (e) => {
        // Se for Tab, Enter ou Escape, processar imediatamente
        if (e.key === "Tab" || e.key === "Enter" || e.key === "Escape") {
          clearTimeout(this.debounceTimer);
          processarMudancaMapa(e.target.value);
        }
      });
    }

    // Listener para sugestão de sequência ao mudar o grupo
    const designadoParaSelect = document.getElementById("designado_para");
    if (designadoParaSelect) {
      designadoParaSelect.addEventListener("change", (e) => {
        this._carregarSugestaoGrupo(e.target.value);
        this._verificarTravaGrupo();
      });
      // Carregar sugestão para o valor inicial assim que o manager estiver pronto
      window.addEventListener("unified:territoriosUpdated", () => {
        if (!this._sugestaoCarregada) {
          this._sugestaoCarregada = true;
          this._carregarSugestaoGrupo(designadoParaSelect.value);
        }
      }, { once: true });
    }

    const aplicarSugestaoBtn = document.getElementById("aplicar-sugestao");
    if (aplicarSugestaoBtn) {
      aplicarSugestaoBtn.addEventListener("click", () => {
        if (this._sugestaoAtual) {
          const numeroMapaInput = document.getElementById("numero_mapa");
          if (numeroMapaInput) {
            numeroMapaInput.value = this._sugestaoAtual.mapa;
            const territorio = unifiedDataManager.getTerritorio(this._sugestaoAtual.mapa);
            Promise.all([
              this._buscarTerritorio(this._sugestaoAtual.mapa),
              this.mapaLoader.carregarImagemMapa(this._sugestaoAtual.mapa, territorio?.fotoURL)
            ]);
          }
        }
      });
    }

    const salvarBtn = document.getElementById("Salvar");
    if (salvarBtn) {
      salvarBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this._salvarRegistro();
      });
    }

    const closeDialog = document.getElementById("close-dialog");
    if (closeDialog) {
      closeDialog.addEventListener("click", () => {
        this._fecharDialogo();
      });
    }

    window.addEventListener("click", (e) => {
      const dialog = document.getElementById("dialog");
      if (e.target === dialog) {
        this._fecharDialogo();
      }
    });

    this._setupValidacao();
  }

  _setupMapaLoader() {
    const mapaImg = document.getElementById("mapa-preview");

    if (mapaImg) {
      mapaImg.addEventListener("click", () => {
        this.mapaLoader.abrirImagemCompleta();
      });
      mapaImg.style.cursor = "pointer";
      mapaImg.title = "Clique para ampliar a imagem";
    }

    console.log("🗺️ Carregador de imagens configurado");
  }

  _setupUnifiedListeners() {
    window.addEventListener("unified:designacaoCriada", (event) => {
      console.log("✅ Nova designação criada:", event.detail);
      this._mostrarDialogo(`Designação criada com sucesso para o Mapa ${event.detail.mapa}!`, "success");
      this._limparFormulario();
    });

    window.addEventListener("unified:connectionRestored", () => {
      this._atualizarStatusConexao();
      this._mostrarToast("Conexão restaurada", "success");
    });

    window.addEventListener("unified:connectionLost", () => {
      this._atualizarStatusConexao();
      this._mostrarToast("Modo offline - dados serão sincronizados quando a conexão for restaurada", "warning");
    });

    window.addEventListener("unified:snapshotError", (event) => {
      console.error("Erro de sincronização:", event.detail);
      this._mostrarToast("Erro de sincronização - verifique sua conexão", "error");
    });

    window.addEventListener("unified:gruposUpdated", () => {
      const select = document.getElementById("designado_para");
      const valorAtual = select?.value;
      this._popularGrupos();
      if (select && valorAtual && Array.from(select.options).some((o) => o.value === valorAtual)) {
        select.value = valorAtual;
      }
      this._verificarTravaGrupo();
    });
  }

  async _buscarTerritorio(numero) {
    const bairroInput = document.getElementById("bairro");
    if (!bairroInput) return;

    if (isNaN(numero) || numero <= 0) {
      bairroInput.value = "";
      bairroInput.placeholder = "Bairro será preenchido automaticamente";
      return;
    }

    try {
      const territorio = unifiedDataManager.getTerritorio(numero);

      if (territorio) {
        bairroInput.value = territorio.bairro || "";
        bairroInput.placeholder = "";

        if (territorio.status === "em andamento") {
          this._mostrarToast(`⚠️ Território ${numero} já está em andamento`, "warning");
        }
      } else {
        bairroInput.value = "";
        bairroInput.placeholder = "Território não encontrado - digite o bairro manualmente";
        console.warn(`⚠️ Território ${numero} não encontrado`);
      }
    } catch (error) {
      console.error("Erro ao buscar território:", error);
      bairroInput.value = "";
      bairroInput.placeholder = "Erro ao buscar - digite o bairro manualmente";
    }

    await this._verificarTravaGrupo();
  }

  // Mostra/esconde o aviso de bairro travado a outro grupo, conforme o bairro e o grupo selecionados
  async _verificarTravaGrupo() {
    const alerta = document.getElementById("grupo-trava-alerta");
    const mensagemEl = document.getElementById("grupo-trava-mensagem");
    const forcarLabel = document.getElementById("grupo-trava-forcar-label");
    const forcarCheckbox = document.getElementById("grupo-trava-forcar");
    if (!alerta || !mensagemEl || !forcarLabel || !forcarCheckbox) return;

    const numeroMapa = parseInt(document.getElementById("numero_mapa")?.value);
    const bairro = document.getElementById("bairro")?.value?.trim();
    const grupo = document.getElementById("designado_para")?.value?.trim();

    if (!bairro || !grupo || unifiedDataManager.podeRegistrarNoGrupo(numeroMapa, bairro, grupo)) {
      alerta.style.display = "none";
      forcarLabel.style.display = "none";
      forcarCheckbox.checked = false;
      return;
    }

    const dono = unifiedDataManager.getGrupoDonoDoMapa(numeroMapa, bairro);
    const isAdmin = unifiedDataManager.permissions?.isAdmin;

    alerta.style.display = "block";
    forcarCheckbox.checked = false;

    if (isAdmin) {
      mensagemEl.textContent = `⚠️ O bairro "${bairro}" pertence ao ${dono}. Marque a opção abaixo para forçar o registro para "${grupo}" mesmo assim.`;
      forcarLabel.style.display = "flex";
    } else {
      mensagemEl.textContent = `⚠️ O bairro "${bairro}" pertence ao ${dono}. Só o próprio grupo (ou um administrador) pode registrar aqui no momento.`;
      forcarLabel.style.display = "none";
    }
  }

  _setupValidacao() {
    const numeroMapaInput = document.getElementById("numero_mapa");
    if (numeroMapaInput) {
      numeroMapaInput.addEventListener("input", (e) => {
        const valor = parseInt(e.target.value);
        if (isNaN(valor) || valor <= 0) {
          e.target.setCustomValidity("Digite um número de mapa válido");
        } else {
          e.target.setCustomValidity("");
        }
      });
    }

    const dataInicioInput = document.getElementById("data_inicio");
    if (dataInicioInput) {
      dataInicioInput.addEventListener("change", (e) => {
        const dataInicio = new Date(e.target.value);
        const hoje = new Date();

        if (dataInicio > hoje) {
          e.target.setCustomValidity("A data de início não pode ser futura");
        } else {
          e.target.setCustomValidity("");
        }
      });
    }

    const dataConclusaoInput = document.getElementById("data_conclusao");
    if (dataConclusaoInput) {
      dataConclusaoInput.addEventListener("change", (e) => {
        const dataConclusao = new Date(e.target.value);
        const dataInicioInput = document.getElementById("data_inicio");

        if (dataInicioInput && dataInicioInput.value) {
          const dataInicio = new Date(dataInicioInput.value);

          if (dataConclusao < dataInicio) {
            e.target.setCustomValidity("A data de conclusão deve ser posterior à data de início");
          } else {
            e.target.setCustomValidity("");
          }
        }
      });
    }
  }

  async _carregarSugestaoGrupo(grupo) {
    const panel = document.getElementById("sugestao-panel");
    if (!panel) return;

    if (grupo === "Campanha Congresso" || grupo === "Campanha Celebração") {
      panel.style.display = "none";
      this._sugestaoAtual = null;
      return;
    }

    panel.style.display = "block";
    panel.classList.add("sugestao-loading");

    try {
      const sugestao = await unifiedDataManager.getProximoMapaSugerido(grupo);
      panel.classList.remove("sugestao-loading");

      if (!sugestao) {
        panel.style.display = "none";
        this._sugestaoAtual = null;
        return;
      }

      this._sugestaoAtual = sugestao;

      const numEl = document.getElementById("sugestao-mapa-num");
      const bairroEl = document.getElementById("sugestao-bairro");
      if (numEl) numEl.textContent = sugestao.mapa;
      if (bairroEl) bairroEl.textContent = sugestao.bairro || "—";

      const chipsContainer = document.getElementById("sugestao-chips");
      if (chipsContainer) {
        const chips = sugestao.historicoRecente.map((h) => {
          const isAtivo = h.status === "em andamento";
          return `<span class="chip${isAtivo ? " chip-andamento" : ""}">${h.mapa}${isAtivo ? " ●" : ""}</span>`;
        });
        chips.push(`<span class="chip chip-proximo">${sugestao.mapa} →</span>`);
        chipsContainer.innerHTML = chips.join("");
      }
    } catch (error) {
      console.error("Erro ao carregar sugestão de grupo:", error);
      panel.classList.remove("sugestao-loading");
      panel.style.display = "none";
    }
  }

  async _salvarRegistro() {
    const permissions = unifiedDataManager.permissions;
    if (!permissions.canWrite) {
      this._mostrarDialogo("Você não tem permissão para criar registros.", "error");
      return;
    }

    const numeroMapa = parseInt(document.getElementById("numero_mapa")?.value);
    const bairro = document.getElementById("bairro")?.value?.trim();
    const designadoPara = document.getElementById("designado_para")?.value?.trim();
    const dataInicio = document.getElementById("data_inicio")?.value;
    const dataConclusao = document.getElementById("data_conclusao")?.value;

    const erros = this._validarFormulario(numeroMapa, bairro, designadoPara, dataInicio, dataConclusao);
    if (erros.length > 0) {
      this._mostrarDialogo(erros.join("\n"), "error");
      return;
    }

    if (!unifiedDataManager.podeRegistrarNoGrupo(numeroMapa, bairro, designadoPara)) {
      const dono = unifiedDataManager.getGrupoDonoDoMapa(numeroMapa, bairro);
      const isAdmin = unifiedDataManager.permissions?.isAdmin;

      if (!isAdmin) {
        this._mostrarDialogo(`Este bairro pertence ao ${dono}. Só o próprio grupo (ou um administrador) pode registrar aqui.`, "error");
        return;
      }

      const forcarCheckbox = document.getElementById("grupo-trava-forcar");
      if (!forcarCheckbox?.checked) {
        this._mostrarDialogo(`Este bairro pertence ao ${dono}. Marque "Forçar registro mesmo assim" se quiser continuar.`, "error");
        return;
      }

      const confirmado = confirm(
        `Tem certeza? O bairro "${bairro}" pertence ao ${dono}, e este registro vai para "${designadoPara}".`
      );
      if (!confirmado) return;
    }

    const btn = document.getElementById("Salvar");
    const btnTextoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "💾 Salvando...";

    try {
      console.log("💾 Salvando nova designação...");

      const novaDesignacao = {
        mapa: numeroMapa,
        bairro: bairro,
        designadoPara: designadoPara,
        dataInicio: dataInicio,
        dataConclusao: dataConclusao || null,
      };

      const novoId = await unifiedDataManager.createDesignacao(novaDesignacao);

      console.log("✅ Designação salva com ID:", novoId);
    } catch (error) {
      console.error("❌ Erro ao salvar:", error);
      this._mostrarDialogo(`Erro ao salvar: ${error.message}`, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = btnTextoOriginal;
    }
  }

  _validarFormulario(numeroMapa, bairro, designadoPara, dataInicio, dataConclusao) {
    const erros = [];

    if (isNaN(numeroMapa) || numeroMapa <= 0) {
      erros.push("• Número do mapa é obrigatório e deve ser um número válido");
    }

    if (!bairro) {
      erros.push("• Bairro é obrigatório");
    }

    if (!designadoPara) {
      erros.push("• Campo 'Designado Para' é obrigatório");
    }

    if (!dataInicio) {
      erros.push("• Data de início é obrigatória");
    } else {
      const dataInicioObj = new Date(dataInicio);
      const hoje = new Date();
      if (dataInicioObj > hoje) {
        erros.push("• Data de início não pode ser futura");
      }
    }

    if (dataConclusao && dataInicio) {
      const dataInicioObj = new Date(dataInicio);
      const dataConclusaoObj = new Date(dataConclusao);
      if (dataConclusaoObj < dataInicioObj) {
        erros.push("• Data de conclusão deve ser posterior à data de início");
      }
    }

    return erros;
  }

  _mostrarDialogo(mensagem, tipo = "info") {
    const dialog = document.getElementById("dialog");
    const message = document.getElementById("dialog-message");

    if (message) {
      message.textContent = mensagem;
      message.className = `dialog-message ${tipo}`;
    }

    if (dialog) {
      dialog.style.display = "flex";

      if (tipo === "success") {
        setTimeout(() => {
          this._fecharDialogo();
        }, 5000);
      }
    }
  }

  _fecharDialogo() {
    const dialog = document.getElementById("dialog");
    if (dialog) {
      dialog.style.display = "none";
    }
  }

  _limparFormulario() {
    const campos = ["numero_mapa", "bairro", "designado_para", "data_inicio", "data_conclusao"];

    campos.forEach((id) => {
      const elemento = document.getElementById(id);
      if (elemento) {
        if (id === "designado_para") {
          elemento.value = "Congregação";
        } else {
          elemento.value = "";
        }

        elemento.setCustomValidity("");
      }
    });

    // Limpar imagem do mapa também
    this.mapaLoader.ocultarImagem();

    const primeiroInput = document.getElementById("numero_mapa");
    if (primeiroInput) {
      primeiroInput.focus();
    }
  }

  _atualizarStatusConexao() {
    const status = unifiedDataManager.connectionStatus;
    const statusElement = document.getElementById("connection-status");

    if (statusElement) {
      if (status.isOnline) {
        statusElement.innerHTML = "🟢 Online";
        statusElement.className = "status-online";
      } else {
        statusElement.innerHTML = "🔴 Offline";
        statusElement.className = "status-offline";
      }
    }
  }

  _mostrarToast(mensagem, tipo = "info") {
    let toast = document.getElementById("toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        z-index: 9999;
        display: none;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: opacity 0.3s ease;
      `;
      document.body.appendChild(toast);
    }

    const cores = {
      success: "#28a745",
      error: "#dc3545",
      info: "#17a2b8",
      warning: "#ffc107",
    };

    toast.style.backgroundColor = cores[tipo] || cores.info;
    toast.textContent = mensagem;
    toast.style.display = "block";
    toast.style.opacity = "1";

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => {
        toast.style.display = "none";
      }, 300);
    }, 4000);
  }

  debugInfo() {
    return {
      unifiedManager: unifiedDataManager.debugInfo(),
      permissions: unifiedDataManager.permissions,
      connectionStatus: unifiedDataManager.connectionStatus,
      mapaLoader: this.mapaLoader,
    };
  }

  async reloadData() {
    try {
      console.log("🔄 Recarregando dados...");
      this._configurarInterface();
      this._mostrarToast("Dados atualizados", "success");
    } catch (error) {
      console.error("Erro ao recarregar dados:", error);
      this._mostrarToast("Erro ao recarregar dados", "error");
    }
  }
}

// Inicialização global
let registroInstance;

document.addEventListener("DOMContentLoaded", async () => {
  registroInstance = new RegistroS13();
  await registroInstance.init();
});

window.registroS13 = registroInstance;

export default RegistroS13;