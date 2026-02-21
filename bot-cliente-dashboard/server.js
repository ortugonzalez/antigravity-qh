const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const path = require('path');
const crypto = require('crypto');
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());

let currentReports = [];

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
        
        // Evitar duplicados: Unimos campos clave estrictos (Empresa + Fecha + Descripcion)
        const getHuella = (obj) => {
            return (obj.EMPRESA || obj.empresa || '') + '|' + 
                   (obj['FEHCA Y HORA'] || obj.fecha || '') + '|' + 
                   (obj['DESCRIPCION SUCESO'] || obj.informe || '');
        };
        const huella = getHuella(data);
        
        const existe = currentReports.find(r => getHuella(r) === huella && huella !== '||');

        if (!existe) {
            if (!data.id) {
                data.id = crypto.randomUUID();
            }
            // Mapeo forzado para categorías si vienen con llaves raras
            const catFieldKeys = ['TIPO DE SERVICIO', 'TIPO_DE_SERVICIO', 'Categoria', 'CATEGORIA', 'categoria'];
            for(let key of catFieldKeys) {
                if(data[key]) { data.categoria_normalizada = data[key]; break; }
            }
            
            const tecFieldKeys = ['Técnico', 'Tecnico', 'TECNICO', 'tecnico'];
            for(let key of tecFieldKeys) {
                if(data[key]) { data.tecnico_normalizado = data[key]; break; }
            }

            currentReports.push(data);
        }
    });
    
    console.log(`📥 Datos recibidos. Total en memoria: ${currentReports.length}`);
    res.json({ status: "success", received: true, total: currentReports.length });
});

app.get('/api/bot-data', checkAuth, (req, res) => {
    res.json({ status: "success", data: currentReports, technicians: allTechnicians });
});

app.post('/api/reassign', checkAuth, (req, res) => {
    const { reportId, newTechnician } = req.body;
    const report = currentReports.find(r => r.id === reportId);
    if (report) {
        report.tecnico = newTechnician;
        report.tecnico_normalizado = newTechnician;
        // Limpiamos llaves antiguas si existen
        delete report.Tecnico;
        delete report['Técnico'];
        res.json({ status: "success", report });
    } else {
        res.status(404).json({ status: "error", message: "Reporte no encontrado" });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor V2 iniciado en http://0.0.0.0:${PORT}`);
    process.on('SIGTERM', () => {
        console.log('Recibida señal SIGTERM, apagando...');
        process.exit(0);
    });
});
