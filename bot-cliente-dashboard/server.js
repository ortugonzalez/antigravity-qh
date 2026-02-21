const express = require('express');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Almacén en memoria para los reportes enviados por n8n
let currentReports = [];

// Endpoint para que n8n envíe (Push) los datos al dashboard
// Soporta recibir un array en req.body.reports, o un solo objeto en req.body.report
app.post('/webhook/n8n-data', (req, res) => {
    if (req.body.reports && Array.isArray(req.body.reports)) {
        // Reemplaza o agrega, dependiendo de la lógica que prefieras. 
        // Por defecto, reemplazaremos para que n8n sea la fuente de verdad.
        currentReports = req.body.reports; 
    } else if (req.body.report) {
        currentReports.push(req.body.report);
    } else if (Array.isArray(req.body)) {
        currentReports = req.body;
    } else {
        currentReports.push(req.body); // Fallback: asume que mandaron un informe suelto sin wrapper
    }
    
    console.log(`📥 Datos recibidos de n8n. Total de informes en memoria: ${currentReports.length}`);
    res.json({ status: "success", received: true, total: currentReports.length });
});

// Endpoint para que el Frontend consuma los últimos datos guardados
app.get('/api/bot-data', (req, res) => {
    res.json({
        status: "success",
        data: currentReports
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor del cliente iniciado en http://0.0.0.0:${PORT}`);
    
    // Captura las señales de Easypanel para apagado limpio (evita npm error code 1)
    process.on('SIGTERM', () => {
        console.log('Recibida señal SIGTERM, apagando servidor...');
        process.exit(0);
    });
});
