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
            // El usuario podría enviar r directo o dentro de r.report dependiendo de n8n
            const data = r.report || r;
            
            const cat = data.categoria || data.CATEGORIA || data.Categoria || 'Sin Categoría';
            const tec = data.tecnico || data['Técnico'] || data.Tecnico || 'Sin Asignar';
            
            if (!byCategory[cat]) byCategory[cat] = {};
            if (!byCategory[cat][tec]) byCategory[cat][tec] = [];
            
            byCategory[cat][tec].push(data);
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
                    const urg = (req.urgencia || req.Urgencia || req['PRIORIDAD DE RESPUESTA'] || 'Normal').toLowerCase();
                    let urgColor = '#00f5d4'; // Baja
                    let borderColor = '#00f5d4';
                    
                    if (urg.includes('alta')) { urgColor = '#ff3366'; borderColor = '#ff3366'; }
                    else if (urg.includes('media')) { urgColor = '#ffcc00'; borderColor = '#ffcc00'; }

                    const reqItem = document.createElement('div');
                    reqItem.className = 'report-item';
                    reqItem.style.borderLeftColor = borderColor;
                    
                    const estado = req.estado || req.Estado || req['ESTADO DE TICKET'] || 'Pendiente';
                    const estadoClass = estado.toLowerCase().replace(' ', '-');

                    reqItem.innerHTML = `
                        <div class="report-header">
                            <div>
                                <span class="company-name">${req.empresa || req.Empresa || req.EMPRESA || 'Empresa Desconocida'}</span>
                                <span class="client-name">${req.nombre || req.Nombre || req['NOMBRE DE CLIENTE'] || req.mail || req.Email || req.EMAIL || 'Cliente'}</span>
                            </div>
                            <span class="badge" style="background-color: ${urgColor}22; color: ${urgColor}">${urg.toUpperCase()}</span>
                        </div>
                        <p class="report-desc">${req.informe || req.Informe || req['DESCRIPCION SUCESO'] || 'Sin detalles en el informe.'}</p>
                        <div class="report-footer">
                            <span>📞 ${req.telefono || req['Número'] || req['NUMERO DE CONTACTO'] || '-'}</span>
                            <span>Estado: <span class="status ${estadoClass}">${estado}</span></span>
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
