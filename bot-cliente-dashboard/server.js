const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 3000;

// URL de Webhook de n8n para sincronización inversa (Sheets Update)
const N8N_SYNC_WEBHOOK = process.env.N8N_WEBHOOK_URL || '';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());

let currentReports = [];

let sseClients = [];
const broadcastUpdate = () => {
    sseClients.forEach(client => {
        client.res.write('data: ' + JSON.stringify({ type: 'update' }) + '\n\n');
    });
};

// Base de datos simulada
const validUsers = {
    'admin': 'admin123',
    'luciano': '1234',
    'franco': '1234',
    'jacome': '1234',
    'german': '1234',
    'sebastian': '1234',
    'mailen': '1234',
    'florencia': '1234',
    'hugo': 'admin',
    'natalia': '1234',
    'octavio': '1234'
};
const allTechnicians = ['Sin Asignar', 'luciano', 'franco', 'jacome', 'german', 'sebastian', 'octavio', 'hugo'];

// Auth middleware
const checkAuth = (req, res, next) => {
    const user = req.cookies.auth_user;
    if (user && validUsers[user]) {
        req.user = user;
        next();
    } else {
        res.status(401).json({ status: 'error', message: 'No autorizado' });
    }
};

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (validUsers[username] && validUsers[username] === password) {
        res.cookie('auth_user', username, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 });
        res.json({ status: 'success', username });
    } else {
        res.status(401).json({ status: 'error', message: 'Credenciales inválidas' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('auth_user');
    res.json({ status: 'success' });
});

app.get('/api/check-auth', (req, res) => {
    const user = req.cookies.auth_user;
    if (user && validUsers[user]) {
        res.json({ status: 'success', username: user });
    } else {
        res.status(401).json({ status: 'error' });
    }
});

app.get('/api/events', checkAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    const client = { id: req.user + '_' + Date.now(), res };
    sseClients.push(client);
    
    req.on('close', () => {
        sseClients = sseClients.filter(c => c.id !== client.id);
    });
});

app.post('/webhook/n8n-data', (req, res) => {
    let incoming = [];
    if (req.body.reports && Array.isArray(req.body.reports)) {
        incoming = req.body.reports; 
    } else if (req.body.report) {
        incoming = [req.body.report];
    } else if (Array.isArray(req.body)) {
        incoming = req.body;
    } else {
        incoming = [req.body];
    }
    
    incoming.forEach(item => {
        let data = item.report || item;
        
        let customId = data.TICKET || data.ticket || data.Ticket || data.id || data.ID || data.Id || data['ID TICKET'] || data['ID DE TICKET'];
        if (!customId) {
            customId = data.row_number ? String(data.row_number) : crypto.randomUUID();
        }
        data.id = String(customId);

        const getHuella = (obj) => {
            return (obj.EMPRESA || obj.empresa || '') + '|' + 
                   (obj['FEHCA Y HORA'] || obj.fecha || '') + '|' + 
                   (obj['DESCRIPCION SUCESO'] || obj.informe || '');
        };
        const huella = getHuella(data);
        
        const existe = currentReports.find(r => {
            if (r.id === data.id && data.row_number) return true;
            return getHuella(r) === huella && huella !== '||';
        });

        const limpiarEstado = (e) => {
            if(!e) return 'Pendiente';
            const lowerE = String(e).toLowerCase();
            if(lowerE === 'abierto') return 'Pendiente';
            if(lowerE === 'hecho') return 'Cerrado';
            if(lowerE === 'pendiente') return 'Pendiente';
            if(lowerE === 'en curso') return 'En Curso';
            if(lowerE === 'facturación' || lowerE === 'facturacion') return 'Facturación';
            if(lowerE === 'cerrado') return 'Cerrado';
            return String(e); 
        }
        
        // V7 Data Helper
        const extractHistoryToArray = (text) => {
            if(!text) return [];
            // Assuming we receive a string with linebreaks from sheets "\\n"
            return text.split('\\n').filter(t => t.trim().length > 0);
        };

        if (!existe) {
            const tecFieldKeys = ['Técnico', 'Tecnico', 'TECNICO', 'tecnico'];
            for(let key of tecFieldKeys) {
                if(data[key]) { data.tecnico_normalizado = data[key]; break; }
            }
            data.notas_internas = data.notas || data.Notas || data.NOTAS || data.notas_internas || '';
            const rawEstado = data.estado || data.Estado || data['ESTADO DE TICKET'] || data['ESTADO TICKET'] || 'Pendiente';
            data.estado_normalizado = limpiarEstado(rawEstado);
            
            // V7 History Array
            const historyStr = data.historial_actualizaciones || data.ultima_actualizacion_log || data['Log Auditoria'] || '';
            data.history_array = Array.isArray(historyStr) ? historyStr : extractHistoryToArray(historyStr);

            if (!data.createdAt) data.createdAt = Date.now(); // V9 SLA
            currentReports.push(data);
        } else {
            // Update existiendo row_number
            if (data.row_number) {
                 const index = currentReports.findIndex(r => r.id === data.id);
                 if(index >= 0) {
                     const repLocal = currentReports[index];
                     const notasLocales = repLocal.notas_internas;
                     const estadoLocal = repLocal.estado_normalizado; 
                     const arrayLocal = repLocal.history_array || []; 
                     
                     data.notas_internas = notasLocales || data.notas || data.Notas || data.NOTAS || '';
                     const sheetEstado = data.estado || data.Estado || data['ESTADO DE TICKET'] || data['ESTADO TICKET'];
                     
                     data.estado_normalizado = limpiarEstado(sheetEstado || estadoLocal || 'Pendiente');
                     
                     // V7 History Merge (Preferimos el array local porque puede que n8n no haya respondido aun)
                     const sheetHistoryStr = data.historial_actualizaciones || data.ultima_actualizacion_log || data['Log Auditoria'] || '';
                     const sheetArray = extractHistoryToArray(sheetHistoryStr);
                     
                     // Si el local tiene mas elementos, gana local. Si no, gana sheets.
                     data.history_array = arrayLocal.length >= sheetArray.length ? arrayLocal : sheetArray;

                     const tecFieldKeys = ['Técnico', 'Tecnico', 'TECNICO', 'tecnico'];
                     for(let key of tecFieldKeys) {
                        if(data[key]) { data.tecnico_normalizado = data[key]; break; }
                     }
                     currentReports[index] = data;
                 }
            }
        }
    });
    
    console.log(`📥 Datos recibidos. Total en memoria: ${currentReports.length}`);
    broadcastUpdate(); // V9 SSE Trigger
    res.json({ status: "success", received: true, total: currentReports.length });
});

app.get('/api/bot-data', checkAuth, (req, res) => {
    res.json({ status: "success", data: currentReports, technicians: allTechnicians });
});

// V7: Guardado de Auditoria en Array Endpoints
app.post('/api/reassign', checkAuth, (req, res) => {
    const { reportId, newTechnician, auditLog } = req.body;
    const report = currentReports.find(r => r.id === reportId);
    if (report) {
        report.tecnico = newTechnician;
        report.tecnico_normalizado = newTechnician;
        delete report.Tecnico; delete report['Técnico'];
        
        if (!report.history_array) report.history_array = [];
        if (auditLog) report.history_array.unshift(auditLog); // V7: Push to start of array

        res.json({ status: "success", report });
        syncToN8n(report);
        broadcastUpdate(); // V9 SSE Trigger
    } else {
        res.status(404).json({ status: "error", message: "Reporte no encontrado" });
    }
});

app.post('/api/update-ticket', checkAuth, (req, res) => {
    const { reportId, estado, notas, auditLog } = req.body;
    const report = currentReports.find(r => r.id === reportId);
    if (!report) return res.status(404).json({ status: "error", message: "Ticket no encontrado" });

    if (estado !== undefined) {
        report.estado = estado;
        report.estado_normalizado = estado;
        delete report.Estado; delete report['ESTADO DE TICKET']; delete report['ESTADO TICKET'];
    }
    if (notas !== undefined) report.notas_internas = notas;
    
    if (!report.history_array) report.history_array = [];
    if (auditLog) report.history_array.unshift(auditLog); // V7: Push to start of array

    res.json({ status: "success", report });
    syncToN8n(report);
    broadcastUpdate(); // V9 SSE Trigger
});

async function syncToN8n(report) {
    if (N8N_SYNC_WEBHOOK) {
        try {
            // Unimos el array con saltos de linea puros para Sheets
            const historyStringBlock = (report.history_array || []).join('\\n');
            await fetch(N8N_SYNC_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: report.id,
                    row_number: report.row_number || '', 
                    estado: report.estado_normalizado || report.estado || '',
                    notas: report.notas_internas || '',
                    log_auditoria: historyStringBlock // V7 String Block
                })
            });
            console.log(`⏫ Sincronizado ticket ${report.id} a n8n`);
        } catch (error) {
            console.error(`⚠️ Error al sincronizar ticket:`, error.message);
        }
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor V7 iniciado en http://0.0.0.0:${PORT}`);
    process.on('SIGTERM', () => {
        console.log('Recibida señal SIGTERM, apagando...');
        process.exit(0);
    });
});
