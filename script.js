// Crear el mapa y centrarlo en Buenos Aires
const map = L.map('map').setView([-34.61315, -58.37723], 11);

// Añadir el fondo del mapa (como un plano de calles)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Objetos para guardar datos
let inversiones = {};
let rubros = new Set();
let datosRaw = [];

// Crear el panel de información (esquina superior derecha)
let info = L.control();

info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info');
    this.update();
    return this._div;
};

info.update = function (props) {
    this._div.innerHTML = '<h4>Inversiones en CABA</h4>' + (props && inversiones[props.comuna] ?
        `<b>Comuna ${props.comuna}</b><br>Total: USD ${(inversiones[props.comuna].total / 1000000).toFixed(2)} MM<br>` +
        Object.entries(inversiones[props.comuna].rubros)
            .map(([rubro, monto]) => `${rubro}: USD ${(monto / 1000000).toFixed(2)} MM`)
            .join('<br>')
        : 'Pase el mouse sobre una comuna');
};

info.addTo(map);

// Crear la leyenda (esquina inferior derecha)
let legend = L.control({ position: 'bottomright' });

legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'legend');
    const grades = [0, 100000, 1000000, 5000000, 10000000, 50000000, 100000000, 500000000, 1000000000];
    div.innerHTML = '<strong>Inversiones (millones USD)</strong><br>';
    for (let i = 0; i < grades.length; i++) {
        div.innerHTML +=
            '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
            (grades[i] / 1000000).toLocaleString() + (grades[i + 1] ? '–' + (grades[i + 1] / 1000000).toLocaleString() + '<br>' : '+');
    }
    return div;
};

legend.addTo(map);

// Cargar los límites de las comunas desde el archivo GeoJSON
fetch('comunas.geojson')
    .then(response => response.json())
    .then(data => {
        L.geoJSON(data, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);
    });

// Definir los colores de las comunas según el monto
function getColor(d) {
    return d > 1000000000 ? '#2F0047' :
           d > 500000000  ? '#4B0082' :
           d > 100000000  ? '#800026' :
           d > 50000000   ? '#BD0026' :
           d > 10000000   ? '#E31A1C' :
           d > 5000000    ? '#FC4E2A' :
           d > 1000000    ? '#FD8D3C' :
           d > 100000     ? '#FEB24C' :
           d > 0          ? '#FFEDA0' :
                            '#FFEDA0';
}

// Estilo de las comunas
function style(feature) {
    return {
        fillColor: getColor(inversiones[feature.properties.comuna]?.total || 0),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

// Interactividad de cada comuna
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
    // Añadir tooltip
    layer.bindTooltip(
        `Comuna ${feature.properties.comuna}<br>` +
        (inversiones[feature.properties.comuna] ?
            `Total: USD ${(inversiones[feature.properties.comuna].total / 1000000).toFixed(2)} MM<br>` +
            Object.entries(inversiones[feature.properties.comuna].rubros)
                .map(([rubro, monto]) => `${rubro}: USD ${(monto / 1000000).toFixed(2)} MM`)
                .join('<br>')
            : 'Sin datos'),
        { sticky: true }
    );
}

// Resaltar comuna al pasar el mouse
function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
        weight: 5,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.7
    });
    layer.bringToFront();
    info.update(layer.feature.properties);
}

// Restaurar estilo al quitar el mouse
function resetHighlight(e) {
    e.target.setStyle(style(e.target.feature));
    info.update();
}

// Zoom al hacer clic
function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

// Cargar datos desde el CSV
Papa.parse('https://docs.google.com/spreadsheets/d/e/2PACX-1vQfBbnuqOnTu-7RvNDzsz02SJtxXV3K489cTMq__K0JiGCtWYCo08TPgsAEGgjsjZVT7-8piA6vbYMd/pub?output=csv', {
    download: true,
    header: true,
    complete: function(results) {
        datosRaw = results.data;
        results.data.forEach(row => {
            const comuna = row.Comuna ? String(row.Comuna).trim() : null;
            let monto = 0;
            const montoRaw = row['Monto Inversión'] ? String(row['Monto Inversión']).trim() : '0';
            if (montoRaw) {
                // Eliminar "USD" y extraer el número y el sufijo (MM o K)
                const match = montoRaw.match(/^USD\s*(\d*\.?\d*)\s*(MM|K)$/i);
                if (match) {
                    const valor = parseFloat(match[1]); // Extraer el número (ej. 21, 500)
                    const unidad = match[2].toUpperCase(); // Extraer MM o K
                    if (!isNaN(valor)) {
                        if (unidad === 'MM') {
                            monto = valor * 1000000; // Convertir millones a dólares
                        } else if (unidad === 'K') {
                            monto = valor * 1000; // Convertir miles a dólares
                        }
                    }
                }
            }
            const rubro = row['Rubro/Sector'] ? String(row['Rubro/Sector']).trim() : 'Sin rubro';
            if (comuna && !isNaN(monto)) {
                if (!inversiones[comuna]) {
                    inversiones[comuna] = { total: 0, rubros: {} };
                }
                inversiones[comuna].total += monto;
                inversiones[comuna].rubros[rubro] = (inversiones[comuna].rubros[rubro] || 0) + monto;
                rubros.add(rubro);
            }
        });
        console.log('Datos procesados:', inversiones);
        updateMap();
        updateSidebar();
        populateRubroFilter();
    },
    error: function(error) {
        console.error('Error al cargar el CSV:', error);
    }
});

// Actualizar el mapa después de cargar datos
function updateMap() {
    map.eachLayer(layer => {
        if (layer.feature) {
            layer.setStyle(style(layer.feature));
            layer.bindTooltip(
                `Comuna ${layer.feature.properties.comuna}<br>` +
                (inversiones[layer.feature.properties.comuna] ?
                    `Total: USD ${(inversiones[layer.feature.properties.comuna].total / 1000000).toFixed(2)} MM<br>` +
                    Object.entries(inversiones[layer.feature.properties.comuna].rubros)
                        .map(([rubro, monto]) => `${rubro}: USD ${(monto / 1000000).toFixed(2)} MM`)
                        .join('<br>')
                    : 'Sin datos'),
                { sticky: true }
            );
        }
    });
}

// Actualizar el panel lateral
function updateSidebar() {
    const totalInversiones = Object.values(inversiones).reduce((sum, comuna) => sum + comuna.total, 0);
    document.getElementById('totalInversiones').textContent = `USD ${(totalInversiones / 1000000).toFixed(2)} MM`;

    let maxComuna = { comuna: 'N/A', total: 0 };
    let minComuna = { comuna: 'N/A', total: Infinity };
    for (const [comuna, data] of Object.entries(inversiones)) {
        if (data.total > maxComuna.total) {
            maxComuna = { comuna, total: data.total };
        }
        if (data.total < minComuna.total && data.total > 0) {
            minComuna = { comuna, total: data.total };
        }
    }
    document.getElementById('comunaMax').textContent = maxComuna.comuna !== 'N/A'
        ? `Comuna ${maxComuna.comuna}: USD ${(maxComuna.total / 1000000).toFixed(2)} MM`
        : 'N/A';
    document.getElementById('comunaMin').textContent = minComuna.comuna !== 'N/A'
        ? `Comuna ${minComuna.comuna}: USD ${(minComuna.total / 1000000).toFixed(2)} MM`
        : 'N/A';

    const rubrosList = document.getElementById('rubrosList');
    rubrosList.innerHTML = '';
    const rubrosTotal = {};
    for (const comuna of Object.values(inversiones)) {
        for (const [rubro, monto] of Object.entries(comuna.rubros)) {
            rubrosTotal[rubro] = (rubrosTotal[rubro] || 0) + monto;
        }
    }
    for (const [rubro, total] of Object.entries(rubrosTotal)) {
        const li = document.createElement('li');
        li.textContent = `${rubro}: USD ${(total / 1000000).toFixed(2)} MM`;
        rubrosList.appendChild(li);
    }
}

// Llenar el filtro de rubros
function populateRubroFilter() {
    const select = document.getElementById('rubroFilter');
    rubros.forEach(rubro => {
        const option = document.createElement('option');
        option.value = rubro;
        option.textContent = rubro;
        select.appendChild(option);
    });
}

// Filtrar por rubro
function filterByRubro() {
    const selectedRubro = document.getElementById('rubroFilter').value;
    map.eachLayer(layer => {
        if (layer.feature) {
            const comuna = layer.feature.properties.comuna;
            if (selectedRubro === 'todos') {
                layer.setStyle({ fillOpacity: 0.7 });
            } else if (inversiones[comuna]?.rubros[selectedRubro]) {
                layer.setStyle({ fillOpacity: 0.7 });
            } else {
                layer.setStyle({ fillOpacity: 0.1 });
            }
        }
    });
}

// Exportar mapa como imagen
function exportMapAsImage() {
    html2canvas(document.getElementById('map')).then(canvas => {
        const link = document.createElement('a');
        link.download = 'mapa_inversiones_caba.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

// Exportar datos como CSV
function exportDataAsCSV() {
    const csv = Papa.unparse(datosRaw);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'inversiones_caba.csv';
    link.click();
}
