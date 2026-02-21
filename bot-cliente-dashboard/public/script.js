document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    const statusMsg = document.getElementById('status-message');
    const container = document.getElementById('reports-container');

    const fetchData = async () => {
        try {
            refreshBtn.textContent = "Sincronizando...";
            
            const response = await fetch('/api/bot-data', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) throw new Error('Error al obtener datos');
            
            const result = await response.json();
            const reports = result.data || [];

            renderReports(reports);
            showStatusMessage('Datos sincronizados con éxito', '#00f5d4');
            
        } catch (error) {
            console.error(error);
            showStatusMessage('Error de conexión con el servidor', '#ff3366');
            container.innerHTML = '<div class="empty-state">No se pudo cargar la información. Intenta de nuevo más tarde.</div>';
        } finally {
            refreshBtn.textContent = "Sincronizar Datos";
        }
    };

    const renderReports = (reports) => {
        container.innerHTML = '';
        
        if (reports.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay informes registrados por el momento. Esperando datos de n8n...</div>';
            return;
        }

        // 1. Agrupar por Categoría, y luego por Técnico
        const byCategory = {};
        
        reports.forEach(r => {
            const cat = r.categoria || 'Sin Categoría';
            const tec = r.tecnico || 'Sin Asignar';
            
            if (!byCategory[cat]) byCategory[cat] = {};
            if (!byCategory[cat][tec]) byCategory[cat][tec] = [];
            
            byCategory[cat][tec].push(r);
        });

        // 2. Construir el DOM basándose en la agrupación
        for (const cat in byCategory) {
            const catSection = document.createElement('div');
            catSection.className = 'category-section';
            catSection.innerHTML = `<h2 class="category-title">${cat}</h2>`;
            
            const tecGrid = document.createElement('div');
            tecGrid.className = 'technicians-grid';

            for (const tec in byCategory[cat]) {
                const tecCard = document.createElement('div');
                tecCard.className = 'technician-card';
                tecCard.innerHTML = `<h3 class="technician-title">👨‍🔧 Técnico: ${tec}</h3>`;
                
                const reqList = document.createElement('div');
                reqList.className = 'requests-list';
                
                byCategory[cat][tec].forEach(req => {
                    const urg = (req.urgencia || 'Normal').toLowerCase();
                    let urgColor = '#00f5d4'; // Baja
                    let borderColor = '#00f5d4';
                    
                    if (urg.includes('alta')) { urgColor = '#ff3366'; borderColor = '#ff3366'; }
                    else if (urg.includes('media')) { urgColor = '#ffcc00'; borderColor = '#ffcc00'; }

                    const reqItem = document.createElement('div');
                    reqItem.className = 'report-item';
                    reqItem.style.borderLeftColor = borderColor;
                    
                    const estadoClass = (req.estado || 'pendiente').toLowerCase().replace(' ', '-');

                    reqItem.innerHTML = `
                        <div class="report-header">
                            <div>
                                <span class="company-name">${req.empresa || 'Empresa Desconocida'}</span>
                                <span class="client-name">${req.nombre || req.mail || 'Cliente'}</span>
                            </div>
                            <span class="badge" style="background-color: ${urgColor}22; color: ${urgColor}">${req.urgencia || 'Normal'}</span>
                        </div>
                        <p class="report-desc">${req.informe || 'Sin detalles en el informe.'}</p>
                        <div class="report-footer">
                            <span>📞 ${req.telefono || '-'}</span>
                            <span>Estado: <span class="status ${estadoClass}">${req.estado || 'Pendiente'}</span></span>
                        </div>
                    `;
                    reqList.appendChild(reqItem);
                });
                
                tecCard.appendChild(reqList);
                tecGrid.appendChild(tecCard);
            }
            
            catSection.appendChild(tecGrid);
            container.appendChild(catSection);
        }
    };

    const showStatusMessage = (msg, color) => {
        statusMsg.textContent = msg;
        statusMsg.style.color = color;
        statusMsg.classList.remove('hidden');
        statusMsg.style.opacity = '1';
        statusMsg.style.transform = 'translateY(0)';
        
        setTimeout(() => {
            statusMsg.classList.add('hidden');
            statusMsg.style.opacity = '0';
            statusMsg.style.transform = 'translateY(10px)';
        }, 3000);
    };

    refreshBtn.addEventListener('click', fetchData);

    // Carga inicial
    fetchData();
});
