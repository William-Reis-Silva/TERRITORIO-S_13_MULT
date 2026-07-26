let programacaoCache = null;
let dadosCompletos = null;

function formatarData(data) {
    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return `${data.getDate()} de ${meses[data.getMonth()]}`;
}

function formatarPeriodoSemana(sabado, domingo) {
    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    
    // Pega a data do sábado (ou domingo se não houver sábado)
    let dataRef = sabado || domingo;
    
    // Encontra a segunda-feira da semana
    let diaSemana = dataRef.getDay(); // 0 = domingo, 6 = sábado
    let diasParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana; // Se for domingo, volta 6 dias
    
    let segundaFeira = new Date(dataRef);
    segundaFeira.setDate(dataRef.getDate() + diasParaSegunda);
    
    // Domingo é 6 dias após a segunda
    let domingoFim = new Date(segundaFeira);
    domingoFim.setDate(segundaFeira.getDate() + 6);
    
    // Formatar considerando mudança de mês
    if (segundaFeira.getMonth() === domingoFim.getMonth()) {
        // Mesmo mês
        return `Semana de ${segundaFeira.getDate()} a ${domingoFim.getDate()} de ${meses[segundaFeira.getMonth()]}`;
    } else {
        // Meses diferentes
        return `Semana de ${segundaFeira.getDate()} de ${meses[segundaFeira.getMonth()]} a ${domingoFim.getDate()} de ${meses[domingoFim.getMonth()]}`;
    }
}

// Nova função para obter a chave da semana baseada na segunda-feira
function getChaveSemana(data) {
    let diaSemana = data.getDay();
    let diasParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    
    let segundaFeira = new Date(data);
    segundaFeira.setDate(data.getDate() + diasParaSegunda);
    
    // Usar ano-mês-dia da segunda-feira como chave única
    const ano = segundaFeira.getFullYear();
    const mes = String(segundaFeira.getMonth()).padStart(2, '0');
    const dia = String(segundaFeira.getDate()).padStart(2, '0');
    
    return `${ano}-${mes}-${dia}`;
}

// Nova função para determinar em qual mês exibir a semana
function getMesExibicao(sabado, domingo, idosos) {
    // Prioridade: sábado > domingo > idosos
    if (sabado) return sabado.data.getMonth();
    if (domingo) return domingo.data.getMonth();
    if (idosos) return idosos.data.getMonth();
    return null;
}

function aplicarFiltro() {
    const mesFiltro = document.getElementById('mes-filtro').value;
    if (dadosCompletos) {
        const dadosFiltrados = {};
        Object.keys(dadosCompletos).forEach(chave => {
            const semana = dadosCompletos[chave];
            if (mesFiltro === '' || semana.mesExibicao === parseInt(mesFiltro)) {
                dadosFiltrados[chave] = semana;
            }
        });
        const ano = document.getElementById('ano-visualizar').value;
        renderizarProgramacao(dadosFiltrados, ano);
    }
}

async function carregarProgramacao() {
    const ano = document.getElementById('ano-visualizar').value;
    const content = document.getElementById('content');

    if (!ano) {
        alert('Informe um ano válido');
        return;
    }

    content.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Carregando programação de ${ano}...</p>
        </div>
    `;

    try {
        const congId = await Tenant.resolverCongId();
        const snapshot = await Tenant.collectionSync(congId, 'programacao')
            .doc(String(ano))
            .collection('agendamentos')
            .get();

        if (snapshot.empty) {
            content.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <h3>Nenhuma programação encontrada</h3>
                    <p>Não há dados para o ano ${ano}</p>
                </div>
            `;
            return;
        }

        const dados = {};
        snapshot.forEach(doc => {
            const [tipo, dataStr] = doc.id.split('_');
            const [y, m, d] = dataStr.split('-');
            const data = new Date(y, m - 1, d);

            // Usar a chave baseada na segunda-feira da semana
            const chave = getChaveSemana(data);

            if (!dados[chave]) {
                dados[chave] = {
                    sabado: null,
                    domingo: null,
                    idosos: null,
                    mesExibicao: null // Será definido depois
                };
            }

            if (tipo === 'sabado') {
                dados[chave].sabado = {
                    data,
                    dirigente: doc.data().dirigente,
                    evento: doc.data().evento || null
                };
            } else if (tipo === 'domingo') {
                dados[chave].domingo = {
                    data,
                    grupo: doc.data().grupo,
                    evento: doc.data().evento || null
                };
            } else if (tipo === 'idosos') {
                dados[chave].idosos = {
                    data,
                    idoso: doc.data().idoso,
                    acompanhante: doc.data().acompanhante,
                    evento: doc.data().evento || null
                };
            }
        });

        // Definir o mês de exibição para cada semana
        Object.keys(dados).forEach(chave => {
            const semana = dados[chave];
            semana.mesExibicao = getMesExibicao(semana.sabado, semana.domingo, semana.idosos);
        });

        dadosCompletos = dados;
        programacaoCache = dados;
        document.getElementById('mes-filtro').value = '';
        renderizarProgramacao(dados, ano);

    } catch (error) {
        console.error('Erro ao carregar:', error);
        content.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3>❌ Erro ao carregar</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function renderizarProgramacao(dados, ano) {
    const content = document.getElementById('content');
    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const porMes = {};
    Object.values(dados).forEach(semana => {
        const mesExib = semana.mesExibicao;
        if (mesExib !== null) {
            if (!porMes[mesExib]) {
                porMes[mesExib] = [];
            }
            porMes[mesExib].push(semana);
        }
    });

    let html = '';
    
    Object.keys(porMes).sort((a, b) => a - b).forEach(mes => {
        html += `
            <div class="month-section">
                <h2 class="month-title">${meses[mes]} ${ano}</h2>
                <div class="week-grid">
        `;

        // Ordenar semanas por data
        porMes[mes].sort((a, b) => {
            const dataA = a.sabado?.data || a.domingo?.data || a.idosos?.data;
            const dataB = b.sabado?.data || b.domingo?.data || b.idosos?.data;
            return dataA - dataB;
        });

        porMes[mes].forEach(semana => {
            // Unir sábado e domingo em um único card
            if (semana.sabado || semana.domingo) {
                const periodoSemana = formatarPeriodoSemana(
                    semana.sabado ? semana.sabado.data : null,
                    semana.domingo ? semana.domingo.data : null
                );
                
                html += `
                    <div class="week-card">
                        <div class="week-header">
                            <div class="week-date">${periodoSemana}</div>
                        </div>
                        ${semana.sabado ? `
                            <div class="week-info">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <div class="day-badge sabado-badge">Sábado - ${formatarData(semana.sabado.data)}</div>
                                </div>
                                ${semana.sabado.evento ? `
                                    <div class="info-row">
                                        <div class="info-icon">🎪</div>
                                        <div class="info-content">
                                            <div class="info-label">Evento Especial</div>
                                            <div class="info-value">${semana.sabado.evento}</div>
                                        </div>
                                    </div>
                                ` : `
                                    <div class="info-row">
                                        <div class="info-icon">🎤</div>
                                        <div class="info-content">
                                            <div class="info-label">Dirigente de Campo</div>
                                            <div class="info-value">${semana.sabado.dirigente}</div>
                                        </div>
                                    </div>
                                    ${semana.idosos ? `
                                        <div class="info-row">
                                            <div class="info-icon">👴</div>
                                            <div class="info-content">
                                                <div class="info-label">Idoso</div>
                                                <div class="info-value">${semana.idosos.idoso}</div>
                                            </div>
                                        </div>
                                        <div class="info-row">
                                            <div class="info-icon">🤝</div>
                                            <div class="info-content">
                                                <div class="info-label">Acompanhante</div>
                                                <div class="info-value">${semana.idosos.acompanhante}</div>
                                            </div>
                                        </div>
                                    ` : ''}
                                `}
                            </div>
                        ` : ''}
                        
                        ${semana.domingo ? `
                            ${semana.sabado ? '<div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(0,0,0,0.1), transparent); margin: 0 20px;"></div>' : ''}
                            <div class="week-info">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <div class="day-badge domingo-badge">Domingo - ${formatarData(semana.domingo.data)}</div>
                                </div>
                                <div class="info-row">
                                    <div class="info-icon">${semana.domingo.evento ? '🎪' : '👥'}</div>
                                    <div class="info-content">
                                        <div class="info-label">${semana.domingo.evento ? 'Evento Especial' : 'Grupo'}</div>
                                        <div class="info-value">${semana.domingo.evento || semana.domingo.grupo}</div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
        });

        html += `
                </div>
            </div>
        `;
    });

    content.innerHTML = html;
}

// Carregar automaticamente ao abrir a página
window.addEventListener('DOMContentLoaded', function() {
    // Aguarda o Firebase estar pronto
    setTimeout(function() {
        carregarProgramacao();
    }, 500);
});