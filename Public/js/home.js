// home.js - Versão otimizada integrada com UnifiedDataManager
import unifiedDataManager from "./UnifiedDataManager.js";

class Home {
    constructor() {
        this.isInitialized = false;
        this.designacaoAtual = null;
        this.animationDuration = 300;
        this.elements = this._cacheElements();
    }

    _cacheElements() {
        return {
            // Interface do usuário
            username: document.getElementById("username"),
            adminLink: document.getElementById("admin"),
            logoutBtn: document.getElementById("logout"),
            
            // Tabela e controles
            tbody: document.getElementById("lista-designacoes"),
            loadingIndicator: document.getElementById("loading-indicator"),
            recarregarBtn: document.getElementById("recarregar_dados"),
            exportarBtn: document.getElementById("exportar_dados"),
            
            // Estatísticas
            totalRegistros: document.getElementById("total-registros"),
            emAndamento: document.getElementById("em-andamento"),
            concluidos: document.getElementById("concluidos"),
            
            // Status de conexão
            conectado: document.getElementById("conectado"),
            connectionStatus: document.getElementById("connection-status"),
            
            // Modal de edição
            modal: document.getElementById("myModal"),
            modalClose: document.querySelector(".close"),
            numeroMapaEdit: document.getElementById("numero_mapa_edit"),
            bairroEdit: document.getElementById("bairro_edit"),
            designadoParaEdit: document.getElementById("designado_para_edit"),
            dataInicioEdit: document.getElementById("data_inicio_edit"),
            dataConclusaoEdit: document.getElementById("data_conclusao_edit"),
            salvarEdicaoBtn: document.getElementById("salvar_edicao"),
            deletarRegistroBtn: document.getElementById("deletar_registro"),
            cancelarEdicaoBtn: document.getElementById("cancelar_edicao")
        };
    }
     // ==================== INICIALIZAÇÃO ====================

 async init() {
    try {
 
        if (!unifiedDataManager.isInitialized) {
            const success = await unifiedDataManager.init();
            if (!success) {
                throw new Error("Usuário não autenticado. Faça login para continuar.");
            }
        }

        this._configurarInterface();
        this._setupAllListeners();
        this._renderizarDados();

        this.isInitialized = true;

    } catch (error) {
    console.error("❌ Erro ao inicializar Home:", error);

    if (error.message.includes("não autenticado") || error.message.includes("Timeout na autenticação")) {
        // Redireciona automaticamente para login
        window.location.href = "login.html";
    } else {
        this._exibirErro("Erro ao carregar a aplicação: " + error.message);
    }
}

}

    // ==================== CONFIGURAÇÃO DA INTERFACE ====================

    _configurarInterface() {
        const permissions = unifiedDataManager.permissions;
        
        // Configurar nome do usuário
        if (this.elements.username && permissions.username) {
            this.elements.username.textContent = permissions.username;
        }

        // Aplicar permissões de admin
        if (this.elements.adminLink) {
            this.elements.adminLink.style.display = permissions.isAdmin ? "inline-block" : "none";
        }
        
        // Aplicar permissões de escrita
        this._aplicarPermissoesEscrita(permissions.canWrite);
        
        // Atualizar status de conexão
        this._atualizarStatusConexao();
        
    }

    _aplicarPermissoesEscrita(canWrite) {
        const writeElements = document.querySelectorAll('[data-write-required]');
        writeElements.forEach(el => {
            el.disabled = !canWrite;
            el.style.opacity = canWrite ? '1' : '0.5';
            if (!canWrite) el.title = 'Sem permissão para esta ação';
        });
    }

    // ==================== RENDERIZAÇÃO DE DADOS ====================

  _renderizarDados() {
    if (!this.elements.tbody) {
        console.warn("⚠️ Elemento tbody não encontrado");
        return;
    }

    const registros = unifiedDataManager.data;

    if (registros.length === 0) {
        this._exibirEstadoVazio();
    } else {
        const registrosOrdenados = this._ordenarRegistrosPorPrioridade(registros);
        this._renderizarTabela(registrosOrdenados);
    }
    this._esconderCarregamento();
    this._renderizarAlertasGrupos();
}

_renderizarAlertasGrupos() {
    const container = document.getElementById("alertas-grupos");
    if (!container) return;

    const registros = unifiedDataManager.data;
    const hoje = new Date();
    const LIMITE_DIAS = 30;

    // Filtra registros em andamento e atrasados, agrupa por grupo
    const atrasadosPorGrupo = {};
    for (const r of registros) {
        if (r.dataConclusao) continue;
        const dataInicio = new Date(r.dataInicio);
        const diasPassados = Math.floor((hoje - dataInicio) / (1000 * 60 * 60 * 24));
        if (diasPassados <= LIMITE_DIAS) continue;

        const grupo = r.designadoPara || "Sem grupo";
        if (!atrasadosPorGrupo[grupo]) atrasadosPorGrupo[grupo] = [];
        atrasadosPorGrupo[grupo].push({ mapa: r.mapa, dias: diasPassados });
    }

    const grupos = Object.keys(atrasadosPorGrupo);
    if (grupos.length === 0) {
        container.style.display = "none";
        return;
    }

    const cards = grupos.map(grupo => {
        const items = atrasadosPorGrupo[grupo];
        const mapasStr = items.map(i => `<strong>${i.mapa}</strong>`).join(", ");
        const pior = Math.max(...items.map(i => i.dias));
        return `
          <div class="alerta-grupo-card">
            <span class="alerta-icone">⚠️</span>
            <div class="alerta-texto">
              <span class="alerta-grupo">${grupo}</span>
              <span class="alerta-detalhe">${items.length} mapa(s) atrasado(s): ${mapasStr} — maior atraso: ${pior} dias</span>
            </div>
          </div>`;
    }).join("");

    container.innerHTML = `
      <div class="alertas-header">Territórios com atraso superior a ${LIMITE_DIAS} dias</div>
      <div class="alertas-grid">${cards}</div>`;
    container.style.display = "block";
}

// NOVO MÉTODO para ordenar com prioridade
_ordenarRegistrosPorPrioridade(registros) {
    return registros
        .slice() // Criar cópia para não modificar o array original
        .sort((a, b) => {
            const statusA = this._determinarStatusRegistro(a);
            const statusB = this._determinarStatusRegistro(b);
            
            // Prioridades:
            // 1. Em Andamento = 1
            // 2. Atrasado = 2
            // 3. Concluído = 3
            const prioridades = {
                'em-andamento': 1,
                'atrasado': 2,
                'concluido': 3
            };
            
            const prioridadeA = prioridades[statusA.classe];
            const prioridadeB = prioridades[statusB.classe];
            
            // Se as prioridades são diferentes, ordenar por prioridade
            if (prioridadeA !== prioridadeB) {
                return prioridadeA - prioridadeB;
            }
            
            // Se mesma prioridade, ordenar por data (mais recente primeiro)
            const dataA = new Date(a.dataInicio || 0);
            const dataB = new Date(b.dataInicio || 0);
            return dataB - dataA;
        })
        .slice(0, 20); // Limitar aos 20 primeiros após ordenação
}
    _exibirCarregamento() {
        if (this.elements.tbody) {
            this.elements.tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 30px;">
                        <div class="loading-state">
                            <div class="spinner"></div>
                            <p style="margin: 15px 0 0 0; color: #666;">Carregando designações...</p>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = "block";
        }
    }

    _esconderCarregamento() {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = "none";
        }
    }

    _exibirEstadoVazio() {
        this.elements.tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state" style="text-align: center; padding: 40px;">
                    <div>
                        <div style="font-size: 3em; margin-bottom: 20px;">📋</div>
                        <h3 style="color: #666; margin: 0 0 15px 0;">Nenhuma designação encontrada</h3>
                        <p style="color: #999; margin: 0 0 20px 0;">Comece criando um novo registro</p>
                        <a href="Registro_S13.html" class="btn btn-primary">
                            ➕ Criar Nova Designação
                        </a>
                    </div>
                </td>
            </tr>
        `;
    }

    _renderizarTabela(registros) {
        // Limitar a 20 registros mais recentes
        const registrosLimitados = registros.slice(0, 20);
        
        // Usar DocumentFragment para melhor performance
        const fragment = document.createDocumentFragment();
        
        registrosLimitados.forEach(registro => {
            const row = this._criarLinhaTabela(registro);
            fragment.appendChild(row);
        });
        // Atualizar tabela de uma vez
        this.elements.tbody.innerHTML = "";
        this.elements.tbody.appendChild(fragment);
    }

    _criarLinhaTabela(registro) {
        const row = document.createElement("tr");
        const status = this._determinarStatusRegistro(registro);
        const permissions = unifiedDataManager.permissions;

        // Aplicar classe CSS baseada no status
        row.className = `registro-row ${status.classe}`;

        row.innerHTML = `
            <td class="mapa-cell">
                <strong>${registro.mapa || "-"}</strong>
            </td>
            <td class="bairro-cell">${registro.bairro || "-"}</td>
            <td class="designado-cell">${registro.designadoPara || "-"}</td>
            <td class="data-cell">${this._formatarData(registro.dataInicio)}</td>
            <td class="data-cell">${this._formatarData(registro.dataConclusao)}</td>
            <td class="status-cell">
              <span class="status-badge ${status.classe}">${status.texto}</span>
            </td>
        `;
        

        // Event listeners
        this._adicionarEventosLinha(row, registro, permissions);

        return row;
    }

    _adicionarEventosLinha(row, registro, permissions) {
        // Botão de edição
        const btnEditar = row.querySelector(".btn-editar");
        if (btnEditar) {
            btnEditar.addEventListener("click", (e) => {
                e.stopPropagation();
                this._abrirModalEdicao(registro);
            });
        }

        // Duplo clique na linha
        row.addEventListener("dblclick", () => {
            if (permissions.canWrite) {
                this._abrirModalEdicao(registro);
            } else {
                this._visualizarRegistro(registro);
            }
        });

    }

    _determinarStatusRegistro(registro) {
        if (registro.dataConclusao) {
            return { classe: "concluido", texto: " Concluído" };
        }
        
        // Verificar atraso (mais de 30 dias)
        const dataInicio = new Date(registro.dataInicio);
        const hoje = new Date();
        const diasPassados = Math.floor((hoje - dataInicio) / (1000 * 60 * 60 * 24));
        
        if (diasPassados > 30) {
            return { classe: "atrasado", texto: "⚠️ Atrasado" };
        }
        
        return { classe: "em-andamento", texto: " Em Andamento" };
    }

_formatarData(dataStr) {
    if (!dataStr) return "-";
    try {
        let date;
        if (typeof dataStr === 'object' && dataStr.seconds) {
            date = new Date(dataStr.seconds * 1000);
        } else if (typeof dataStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
            const [ano, mes, dia] = dataStr.split("-");
            date = new Date(ano, mes - 1, dia); // <-- cria como local
        } else {
            date = new Date(dataStr);
        }
        if (isNaN(date.getTime())) return dataStr;
        return new Intl.DateTimeFormat("pt-BR").format(date);
    } catch {
        return dataStr || "-";
    }
}
    _atualizarStatusConexao() {
        const status = unifiedDataManager.connectionStatus;
        
        const statusText = status.isOnline ? "🟢 Online" : "🔴 Offline";
        const statusClass = status.isOnline ? "status-online" : "status-offline";
        
        if (this.elements.conectado) {
            this.elements.conectado.textContent = statusText;
            this.elements.conectado.className = statusClass;
        }

        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.innerHTML = `<span class="${statusClass}">${statusText}</span>`;
        }
    }

    // ==================== LISTENERS DE EVENTOS ====================

    _setupAllListeners() {
        this._setupControlListeners();
        this._setupModalListeners();
        this._setupUnifiedDataListeners();
    }

    _setupControlListeners() {
        // Recarregar dados
        if (this.elements.recarregarBtn) {
            this.elements.recarregarBtn.addEventListener("click", () => {
                this._exibirCarregamento();
                setTimeout(() => this._renderizarDados(), 100);
            });
        }

        // Exportar dados
        if (this.elements.exportarBtn) {
            this.elements.exportarBtn.addEventListener("click", () => {
                unifiedDataManager.exportData();
                this._exibirToast("Dados exportados com sucesso!", "success");
            });
        }

        // Logout
        if (this.elements.logoutBtn) {
            this.elements.logoutBtn.addEventListener("click", async (e) => {
                e.preventDefault();
                await this._realizarLogout();
            });
        }
    }

    _setupModalListeners() {
        // Fechar modal
        if (this.elements.modalClose) {
            this.elements.modalClose.addEventListener("click", () => this._fecharModal());
        }

        // Fechar modal clicando no overlay
        if (this.elements.modal) {
            this.elements.modal.addEventListener("click", (e) => {
                if (e.target === this.elements.modal) this._fecharModal();
            });
        }

        // Botões do modal
        if (this.elements.cancelarEdicaoBtn) {
            this.elements.cancelarEdicaoBtn.addEventListener("click", () => this._fecharModal());
        }

        if (this.elements.salvarEdicaoBtn) {
            this.elements.salvarEdicaoBtn.addEventListener("click", () => this._salvarEdicao());
        }

        if (this.elements.deletarRegistroBtn) {
            this.elements.deletarRegistroBtn.addEventListener("click", () => this._deletarRegistro());
        }

        // Tecla ESC para fechar modal
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.elements.modal?.style.display === "flex") {
                this._fecharModal();
            }
        });
    }

    _setupUnifiedDataListeners() {
        // Dados atualizados
        window.addEventListener('unified:registrosUpdated', (event) => {
            console.log("📡 Dados atualizados:", event.detail);
            this._renderizarDados();
            
            if (event.detail.source === 'server') {
                this._exibirToast(`${event.detail.changes} atualizações recebidas`, "info");
            }
        });

        // Status de conexão
        window.addEventListener('unified:connectionRestored', () => {
            this._atualizarStatusConexao();
            this._exibirToast("Conexão restaurada", "success");
        });

        window.addEventListener('unified:connectionLost', () => {
            this._atualizarStatusConexao();
            this._exibirToast("Modo offline ativo", "warning");
        });

        // Operações CRUD
        window.addEventListener('unified:designacaoCriada', (event) => {
            this._exibirToast(`Nova designação: Mapa ${event.detail.mapa}`, "success");
        });

        window.addEventListener('unified:designacaoAtualizada', () => {
            this._exibirToast("Designação atualizada", "success");
        });

        window.addEventListener('unified:designacaoDeletada', (event) => {
            this._exibirToast(`Designação removida: Mapa ${event.detail.mapa}`, "info");
        });

        window.addEventListener('unified:snapshotError', (event) => {
            console.error("Erro de sincronização:", event.detail);
            this._exibirToast("Erro de sincronização", "error");
        });
    }

    // ==================== MODAL DE EDIÇÃO ====================

    _abrirModalEdicao(registro) {
        if (!this.elements.modal || !unifiedDataManager.permissions.canWrite) {
            this._exibirToast("Sem permissão para editar", "error");
            return;
        }

        this.designacaoAtual = registro;

        // Preencher campos do modal
        this._preencherCamposModal(registro);

        // Exibir modal com animação
        this.elements.modal.style.display = "flex";
        this.elements.modal.style.opacity = "0";
        
        requestAnimationFrame(() => {
            this.elements.modal.style.opacity = "1";
            
            // Focar primeiro campo editável
            const primeiroInput = this.elements.modal.querySelector('input:not([disabled])');
            if (primeiroInput) primeiroInput.focus();
        });
    }

    _preencherCamposModal(registro) {
        const campos = {
            numeroMapaEdit: registro.mapa || "",
            bairroEdit: registro.bairro || "",
            designadoParaEdit: registro.designadoPara || "",
            dataInicioEdit: this._formatarDataParaInput(registro.dataInicio),
            dataConclusaoEdit: this._formatarDataParaInput(registro.dataConclusao)
        };

        Object.entries(campos).forEach(([campo, valor]) => {
            if (this.elements[campo]) {
                this.elements[campo].value = valor;
            }
        });
    }

    _formatarDataParaInput(dataStr) {
        if (!dataStr) return "";
        
        try {
            let date;
            if (typeof dataStr === 'object' && dataStr.seconds) {
                date = new Date(dataStr.seconds * 1000);
            } else {
                date = new Date(dataStr);
            }
            
            if (isNaN(date.getTime())) return "";
            return date.toISOString().split('T')[0];
        } catch {
            return "";
        }
    }

    _fecharModal() {
        if (!this.elements.modal) return;
        
        this.elements.modal.style.opacity = "0";
        setTimeout(() => {
            this.elements.modal.style.display = "none";
            this.designacaoAtual = null;
        }, this.animationDuration);
    }

    async _salvarEdicao() {
        if (!this.designacaoAtual) return;

        try {
            const dadosAtualizados = this._coletarDadosFormulario();
            
            await unifiedDataManager.updateDesignacao(this.designacaoAtual.id, dadosAtualizados);
            this._fecharModal();
            
        } catch (error) {
            console.error("❌ Erro ao salvar:", error);
            this._exibirToast("Erro ao salvar alterações", "error");
        }
    }

    _coletarDadosFormulario() {
        return {
            mapa: this.elements.numeroMapaEdit?.value || this.designacaoAtual.mapa,
            bairro: this.elements.bairroEdit?.value || this.designacaoAtual.bairro,
            designadoPara: this.elements.designadoParaEdit?.value || this.designacaoAtual.designadoPara,
            dataInicio: this.elements.dataInicioEdit?.value || this.designacaoAtual.dataInicio,
            dataConclusao: this.elements.dataConclusaoEdit?.value || null
        };
    }

    async _deletarRegistro() {
        if (!this.designacaoAtual || !confirm("Confirma a exclusão deste registro?")) {
            return;
        }

        try {
            await unifiedDataManager.deleteDesignacao(this.designacaoAtual.id);
            this._fecharModal();
            
        } catch (error) {
            console.error("❌ Erro ao deletar:", error);
            this._exibirToast("Erro ao excluir registro", "error");
        }
    }

    _visualizarRegistro(registro) {
        this._exibirToast(`Visualizando: Mapa ${registro.mapa} - ${registro.bairro}`, "info");
    }

    // ==================== UTILITÁRIOS ====================

    async _realizarLogout() {
        try {
            await firebase.auth().signOut();
            console.log("👋 Logout realizado");
            window.location.href = "login.html";
        } catch (error) {
            console.error("Erro no logout:", error);
            this._exibirToast("Erro ao sair", "error");
        }
    }

    _exibirErro(mensagem) {
        if (this.elements.tbody) {
            this.elements.tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 30px;">
                        <div class="error-state">
                            <p style="color: #dc3545; margin: 0 0 15px 0; font-size: 1.1em;">❌ ${mensagem}</p>
                            <button onclick="location.reload()" class="btn btn-primary">
                                🔄 Tentar Novamente
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
        this._exibirToast(mensagem, "error");
    }

    _exibirToast(mensagem, tipo = "info", duracao = 4000) {
        // Remover toast anterior se existir
        const toastAnterior = document.getElementById("home-toast");
        if (toastAnterior) toastAnterior.remove();

        // Criar novo toast
        const toast = document.createElement("div");
        toast.id = "home-toast";
        
        const cores = {
            success: "linear-gradient(135deg, #28a745, #20c997)",
            error: "linear-gradient(135deg, #dc3545, #fd7e14)",
            info: "linear-gradient(135deg, #17a2b8, #6f42c1)",
            warning: "linear-gradient(135deg, #ffc107, #fd7e14)"
        };

        Object.assign(toast.style, {
            position: "fixed",
            top: "20px",
            right: "20px",
            padding: "15px 20px",
            borderRadius: "8px",
            color: "white",
            fontWeight: "600",
            zIndex: "10000",
            maxWidth: "350px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            background: cores[tipo] || cores.info,
            transform: "translateX(100%)",
            transition: "all 0.3s ease",
            opacity: "0"
        });

        toast.textContent = mensagem;
        document.body.appendChild(toast);

        // Animação de entrada
        requestAnimationFrame(() => {
            toast.style.opacity = "1";
            toast.style.transform = "translateX(0)";
        });

        // Auto-remover
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(100%)";
            setTimeout(() => toast.remove(), 300);
        }, duracao);
    }

    // ==================== API PÚBLICA ====================

    async refresh() {
        console.log("🔄 Atualizando interface...");
        this._exibirCarregamento();
        setTimeout(() => this._renderizarDados(), 100);
    }

    showToast(mensagem, tipo) {
        this._exibirToast(mensagem, tipo);
    }

    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            hasElements: Object.keys(this.elements).length,
            unifiedManager: unifiedDataManager.debugInfo(),
            currentRecord: this.designacaoAtual
        };
    }
}

// Auto-inicialização
document.addEventListener("DOMContentLoaded", () => {
    const home = new Home();
    home.init();
    
    // Expor para debug
    window.home = home;
});

export default Home;