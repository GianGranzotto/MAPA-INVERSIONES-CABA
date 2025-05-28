// Crear el mapa y centrarlo en Buenos Aires
const map = L.map('map').setView([-34.61315, -58.37723], 11);

// Añadir el fondo del mapa (como un plano de calles)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Objetos para guardar datos
let inversionesPorComuna = {};
let inversionesPorBarrio = {};
let sectores = new Set();
let datosRaw = [];
let totalInversionesCount = 0;
let sectoresCount = {};
let comunasBarrios = {};

let comunaLayer = null;
let barrioLayer = null;
let currentLayer = null;

let info = L.control();

info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info');
    this.update();
    return this._div;
};

info.update = function (props) {
    if (!props) {
        this._div.innerHTML = '<h4>Inversiones en CABA</h4>Pase el mouse sobre una comuna o barrio';
        return;
    }
    const isComunaView = document.getElementById('barrioFilter').value === 'todos';
    const key = isComunaView ? 'comuna' : 'BARRIO';
    const inversiones = isComunaView ? inversionesPorComuna : inversionesPorBarrio;
    const name = isComunaView ? `Comuna ${props.comuna}` : props.BARRIO;
    const selectedSector = document.getElementById('sectorFilter').value;
    const selectedInjerencia = document.getElementById('injerenciaFilter').value;
    let total = 0;
    let sectoresText = '';
    let injerenciaText = '';

    if (inversiones[props[key]]) {
        if (selectedSector === 'todos') {
            total = inversiones[props[key]].total;
            sectoresText = Object.entries(inversiones[props[key]].sectores)
                .map(([sector, monto]) => `${sector}: USD ${(monto / 1000000).toFixed(2)} MM`)
                .join('<br>');
        } else if (inversiones[props[key]].sectores[selectedSector]) {
            total = inversiones[props[key]].sectores[selectedSector];
            sectoresText = `${selectedSector}: USD ${(total / 1000000).toFixed(2)} MM`;
        }
    }

    // Calcular datos de Injerencia GCBA
    if (!isComunaView) { // Vista de barrios
        const inversionesBarrio = datosRaw.filter(row => String(row.Barrio).trim() === props.BARRIO);
        const injerenciaSi = inversionesBarrio.filter(row => String(row['Injerencia GCBA']).trim() === 'SÍ').length;
        const injerenciaNo = inversionesBarrio.filter(row => String(row['Injerencia GCBA']).trim() === 'NO').length;
        if (selectedInjerencia === 'todos') {
            injerenciaText = `Injerencia GCBA:<br>SÍ: ${injerenciaSi}<br>NO: ${injerenciaNo}`;
        } else {
            const count = selectedInjerencia === 'SÍ' ? injerenciaSi : injerenciaNo;
            injerenciaText = `Injerencia GCBA (${selectedInjerencia}): ${count}`;
        }
    } else { // Vista de comunas
        const barriosComuna = comunasBarrios[props.comuna] || [];
        const inversionesComuna = datosRaw.filter(row => barriosComuna.includes(String(row.Barrio).trim()));
        const injerenciaSi = inversionesComuna.filter(row => String(row['Injerencia GCBA']).trim() === 'SÍ').length;
        const injerenciaNo = inversionesComuna.filter(row => String(row['Injerencia GCBA']).trim() === 'NO').length;
        if (selectedInjerencia === 'todos') {
            injerenciaText = `Injerencia GCBA (barrios):<br>SÍ: ${injerenciaSi}<br>NO: ${injerenciaNo}`;
        } else {
            const count = selectedInjerencia === 'SÍ' ? injerenciaSi : injerenciaNo;
            injerenciaText = `Injerencia GCBA (${selectedInjerencia}): ${count}`;
        }
    }

    this._div.innerHTML = '<h4>Inversiones en CABA</h4>' + (total > 0 ?
        `<b>${name}</b><br>Total: USD ${(total / 1000000).toFixed(2)} MM<br>` +
        sectoresText +
        (injerenciaText ? `<br>${injerenciaText}` : '')
        : `Sin datos para ${name}`);
};

info.addTo(map);

let legend = L.control({ position: 'bottomright' });

legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'legend');
    const grades = [0, 100000, 1000000, 5000000, 10000000, 50000000, 100000000, 500000000, 1000000000];
    
    const title = document.createElement('strong');
    title.textContent = 'Inversiones (millones USD)';
    div.appendChild(title);
    
    // Entrada para "Sin datos"
    const noDataItem = document.createElement('div');
    const noDataColorBox = document.createElement('i');
    noDataColorBox.style.background = '#F5F5F5';
    const noDataText = document.createElement('span');
    noDataText.textContent = 'Sin datos';
    noDataItem.appendChild(noDataColorBox);
    noDataItem.appendChild(noDataText);
    div.appendChild(noDataItem);
    
    // Resto de los rangos
    for (let i = 0; i < grades.length; i++) {
        const item = document.createElement('div');
        const colorBox = document.createElement('i');
        const valueToColor = i === 0 ? 1 : grades[i] + 1;
        colorBox.style.background = getColor(valueToColor);
        
        const text = document.createElement('span');
        text.textContent = (grades[i] / 1000000).toLocaleString() + (grades[i + 1] ? '–' + (grades[i + 1] / 1000000).toLocaleString() : '+');
        
        item.appendChild(colorBox);
        item.appendChild(text);
        div.appendChild(item);
    }
    
    return div;
};

legend.addTo(map);

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
                            '#F5F5F5';
}

function style(feature) {
    const isComunaView = document.getElementById('barrioFilter').value === 'todos';
    const key = isComunaView ? feature.properties.comuna : feature.properties.BARRIO;
    const inversiones = isComunaView ? inversionesPorComuna : inversionesPorBarrio;
    const selectedSector = document.getElementById('sectorFilter').value;
    let monto = 0;
    if (inversiones[key]) {
        if (selectedSector === 'todos') {
            monto = inversiones[key].total;
        } else if (inversiones[key].sectores[selectedSector]) {
            monto = inversiones[key].sectores[selectedSector];
        }
    }
    return {
        fillColor: getColor(monto),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
    const isComunaView = document.getElementById('barrioFilter').value === 'todos';
    const key = isComunaView ? feature.properties.comuna : feature.properties.BARRIO;
    const inversiones = isComunaView ? inversionesPorComuna : inversionesPorBarrio;
    const name = isComunaView ? `Comuna ${feature.properties.comuna}` : feature.properties.BARRIO;
    const selectedSector = document.getElementById('sectorFilter').value;
    const selectedInjerencia = document.getElementById('injerenciaFilter').value;
    let total = 0;
    let sectoresText = '';
    let injerenciaText = '';

    if (inversiones[key]) {
        if (selectedSector === 'todos') {
            total = inversiones[key].total;
            sectoresText = Object.entries(inversiones[key].sectores)
                .map(([sector, monto]) => `${sector}: USD ${(monto / 1000000).toFixed(2)} MM`)
                .join('<br>');
        } else if (inversiones[key].sectores[selectedSector]) {
            total = inversiones[key].sectores[selectedSector];
            sectoresText = `${selectedSector}: USD ${(total / 1000000).toFixed(2)} MM`;
        }
    }

    // Calcular datos de Injerencia GCBA
    if (!isComunaView) { // Vista de barrios
        const inversionesBarrio = datosRaw.filter(row => String(row.Barrio).trim() === key);
        const injerenciaSi = inversionesBarrio.filter(row => String(row['Injerencia GCBA']).trim() === 'SÍ').length;
        const injerenciaNo = inversionesBarrio.filter(row => String(row['Injerencia GCBA']).trim() === 'NO').length;
        if (selectedInjerencia === 'todos') {
            injerenciaText = `Injerencia GCBA:<br>SÍ: ${injerenciaSi}<br>NO: ${injerenciaNo}`;
        } else {
            const count = selectedInjerencia === 'SÍ' ? injerenciaSi : injerenciaNo;
            injerenciaText = `Injerencia GCBA (${selectedInjerencia}): ${count}`;
        }
    } else { // Vista de comunas
        const barriosComuna = comunasBarrios[key] || [];
        const inversionesComuna = datosRaw.filter(row => barriosComuna.includes(String(row.Barrio).trim()));
        const injerenciaSi = inversionesComuna.filter(row => String(row['Injerencia GCBA']).trim() === 'SÍ').length;
        const injerenciaNo = inversionesComuna.filter(row => String(row['Injerencia GCBA']).trim() === 'NO').length;
        if (selectedInjerencia === 'todos') {
            injerenciaText = `Injerencia GCBA (barrios):<br>SÍ: ${injerenciaSi}<br>NO: ${injerenciaNo}`;
        } else {
            const count = selectedInjerencia === 'SÍ' ? injerenciaSi : injerenciaNo;
            injerenciaText = `Injerencia GCBA (${selectedInjerencia}): ${count}`;
        }
    }

    layer.bindTooltip(
        `${name}<br>` +
        (total > 0 ?
            `Total: USD ${(total / 1000000).toFixed(2)} MM<br>` +
            sectoresText +
            (injerenciaText ? `<br>${injerenciaText}` : '')
            : 'Sin datos'),
        { sticky: true }
    );
}

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

function resetHighlight(e) {
    e.target.setStyle(style(e.target.feature));
    info.update();
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

fetch('comunas.geojson')
    .then(response => response.json())
    .then(data => {
        comunaLayer = L.geoJSON(data, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);
        currentLayer = comunaLayer;
    });

fetch('barrios.geojson')
    .then(response => response.json())
    .then(data => {
        barrioLayer = L.geoJSON(data, {
            style: style,
            onEachFeature: onEachFeature
        });
        data.features.forEach(feature => {
            const comuna = String(feature.properties.COMUNA).split('.')[0];
            const barrio = feature.properties.BARRIO;
            if (!comunasBarrios[comuna]) {
                comunasBarrios[comuna] = [];
            }
            comunasBarrios[comuna].push(barrio);
        });
        const comunaSelect = document.getElementById('comunaFilter');
        Object.keys(comunasBarrios).sort((a, b) => parseInt(a) - parseInt(b)).forEach(comuna => {
            const option = document.createElement('option');
            option.value = comuna;
            option.textContent = `Comuna ${comuna}`;
            comunaSelect.appendChild(option);
        });
    });

Papa.parse('https://docs.google.com/spreadsheets/d/e/2PACX-1vQfBbnuqOnTu-7RvNDzsz02SJtxXV3K489cTMq__K0JiGCtWYCo08TPgsAEGgjsjZVT7-8piA6vbYMd/pub?gid=0&single=true&output=csv', {
    download: true,
    header: true,
    complete: function(results) {
        datosRaw = results.data;
        results.data.forEach(row => {
            const comuna = row.Comuna ? String(row.Comuna).trim() : null;
            const barrio = row.Barrio ? String(row.Barrio).trim() : null;
            let monto = 0;
            const montoRaw = row['Monto Inversión'] ? String(row['Monto Inversión']).trim() : '0';
            if (montoRaw) {
                const match = montoRaw.match(/^USD\s*(\d*\.?\d*)\s*(MM|K)$/i);
                if (match) {
                    const valor = parseFloat(match[1]);
                    const unidad = match[2].toUpperCase();
                    if (!isNaN(valor)) {
                        if (unidad === 'MM') {
                            monto = valor * 1000000;
                        } else if (unidad === 'K') {
                            monto = valor * 1000;
                        }
                    }
                }
            }
            const sector = row['Rubro/Sector'] ? String(row['Rubro/Sector']).trim() : 'Sin sector';
            if (comuna && barrio && !isNaN(monto)) {
                if (!inversionesPorComuna[comuna]) {
                    inversionesPorComuna[comuna] = { total: 0, sectores: {}, count: 0 };
                }
                inversionesPorComuna[comuna].total += monto;
                inversionesPorComuna[comuna].sectores[sector] = (inversionesPorComuna[comuna].sectores[sector] || 0) + monto;
                inversionesPorComuna[comuna].count += 1;

                if (!inversionesPorBarrio[barrio]) {
                    inversionesPorBarrio[barrio] = { total: 0, sectores: {}, count: 0 };
                }
                inversionesPorBarrio[barrio].total += monto;
                inversionesPorBarrio[barrio].sectores[sector] = (inversionesPorBarrio[barrio].sectores[sector] || 0) + monto;
                inversionesPorBarrio[barrio].count += 1;

                totalInversionesCount += 1;
                sectoresCount[sector] = (sectoresCount[sector] || 0) + 1;

                sectores.add(sector);
            }
        });
        console.log('Datos procesados (por comuna):', inversionesPorComuna);
        console.log('Datos procesados (por barrio):', inversionesPorBarrio);
        populateSectorFilter();
        updateMap();
        updateSidebar();
    },
    error: function(error) {
        console.error('Error al cargar el CSV:', error);
    }
});

function updateBarrios() {
    const comuna = document.getElementById('comunaFilter').value;
    const barrioSelect = document.getElementById('barrioFilter');
    barrioSelect.innerHTML = '<option value="todos">Todos los barrios</option>';
    barrioSelect.disabled = comuna === 'todos';

    if (comuna !== 'todos') {
        const barrios = comunasBarrios[comuna].sort();
        barrios.forEach(barrio => {
            const option = document.createElement('option');
            option.value = barrio;
            option.textContent = barrio;
            barrioSelect.appendChild(option);
        });
    }
    filterData();
}

function filterData() {
    const selectedComuna = document.getElementById('comunaFilter').value;
    const selectedBarrio = document.getElementById('barrioFilter').value;
    const selectedSector = document.getElementById('sectorFilter').value;
    const selectedInjerencia = document.getElementById('injerenciaFilter').value;

    let datosFiltrados = datosRaw;
    if (selectedComuna !== 'todos') {
        datosFiltrados = datosFiltrados.filter(row => String(row.Comuna).trim() === selectedComuna);
    }
    if (selectedBarrio !== 'todos') {
        datosFiltrados = datosFiltrados.filter(row => String(row.Barrio).trim() === selectedBarrio);
    }
    if (selectedInjerencia !== 'todos') {
        datosFiltrados = datosFiltrados.filter(row => String(row['Injerencia GCBA']).trim() === selectedInjerencia);
    }

    inversionesPorComuna = {};
    inversionesPorBarrio = {};
    totalInversionesCount = 0;
    sectoresCount = {};

    datosFiltrados.forEach(row => {
        const comuna = row.Comuna ? String(row.Comuna).trim() : null;
        const barrio = row.Barrio ? String(row.Barrio).trim() : null;
        let monto = 0;
        const montoRaw = row['Monto Inversión'] ? String(row['Monto Inversión']).trim() : '0';
        if (montoRaw) {
            const match = montoRaw.match(/^USD\s*(\d*\.?\d*)\s*(MM|K)$/i);
            if (match) {
                const valor = parseFloat(match[1]);
                const unidad = match[2].toUpperCase();
                if (!isNaN(valor)) {
                    if (unidad === 'MM') {
                        monto = valor * 1000000;
                    } else if (unidad === 'K') {
                        monto = valor * 1000;
                    }
                }
            }
        }
        const sector = row['Rubro/Sector'] ? String(row['Rubro/Sector']).trim() : 'Sin sector';
        if (comuna && barrio && !isNaN(monto) && (selectedSector === 'todos' || sector === selectedSector)) {
            if (!inversionesPorComuna[comuna]) {
                inversionesPorComuna[comuna] = { total: 0, sectores: {}, count: 0 };
            }
            inversionesPorComuna[comuna].total += monto;
            inversionesPorComuna[comuna].sectores[sector] = (inversionesPorComuna[comuna].sectores[sector] || 0) + monto;
            inversionesPorComuna[comuna].count += 1;

            if (!inversionesPorBarrio[barrio]) {
                inversionesPorBarrio[barrio] = { total: 0, sectores: {}, count: 0 };
            }
            inversionesPorBarrio[barrio].total += monto;
            inversionesPorBarrio[barrio].sectores[sector] = (inversionesPorBarrio[barrio].sectores[sector] || 0) + monto;
            inversionesPorBarrio[barrio].count += 1;

            totalInversionesCount += 1;
            sectoresCount[sector] = (sectoresCount[sector] || 0) + 1;
        }
    });

    const isComunaView = selectedBarrio === 'todos';
    map.eachLayer(layer => {
        if (layer !== map._layers[Object.keys(map._layers)[0]]) {
            map.removeLayer(layer);
        }
    });
    if (isComunaView) {
        comunaLayer.addTo(map);
        currentLayer = comunaLayer;
    } else {
        barrioLayer.addTo(map);
        currentLayer = barrioLayer;
    }
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    updateMap();
    updateSidebar();
    info.update();
}

function updateMap() {
    map.eachLayer(layer => {
        if (layer.feature) {
            layer.setStyle(style(layer.feature));
            const isComunaView = document.getElementById('barrioFilter').value === 'todos';
            const key = isComunaView ? layer.feature.properties.comuna : layer.feature.properties.BARRIO;
            const inversiones = isComunaView ? inversionesPorComuna : inversionesPorBarrio;
            const name = isComunaView ? `Comuna ${layer.feature.properties.comuna}` : layer.feature.properties.BARRIO;
            const selectedSector = document.getElementById('sectorFilter').value;
            let total = 0;
            let sectoresText = '';
            if (inversiones[key]) {
                if (selectedSector === 'todos') {
                    total = inversiones[key].total;
                    sectoresText = Object.entries(inversiones[key].sectores)
                        .map(([sector, monto]) => `${sector}: USD ${(monto / 1000000).toFixed(2)} MM`)
                        .join('<br>');
                } else if (inversiones[key].sectores[selectedSector]) {
                    total = inversiones[key].sectores[selectedSector];
                    sectoresText = `${selectedSector}: USD ${(total / 1000000).toFixed(2)} MM`;
                }
            }
            layer.bindTooltip(
                `${name}<br>` +
                (total > 0 ?
                    `Total: USD ${(total / 1000000).toFixed(2)} MM<br>` + sectoresText
                    : 'Sin datos'),
                { sticky: true }
            );
        }
    });
}

function updateSidebar() {
    const isComunaView = document.getElementById('barrioFilter').value === 'todos';
    const inversiones = isComunaView ? inversionesPorComuna : inversionesPorBarrio;
    const totalInversiones = Object.values(inversiones).reduce((sum, item) => sum + item.total, 0);
    document.getElementById('totalInversiones').textContent = `USD ${(totalInversiones / 1000000).toFixed(2)} MM (${totalInversionesCount}*)`;

    const maxMinStats = document.getElementById('maxMinStats');
    if (!isComunaView) {
        maxMinStats.classList.add('hidden');
    } else {
        maxMinStats.classList.remove('hidden');
        let maxItem = { name: 'N/A', total: 0, count: 0 };
        let minItem = { name: 'N/A', total: Infinity, count: 0 };
        for (const [key, data] of Object.entries(inversiones)) {
            if (data.total > maxItem.total) {
                maxItem = { name: key, total: data.total, count: data.count };
            }
            if (data.total < minItem.total && data.total > 0) {
                minItem = { name: key, total: data.total, count: data.count };
            }
        }
        document.getElementById('comunaMax').textContent = maxItem.name !== 'N/A'
            ? `Comuna ${maxItem.name}: USD ${(maxItem.total / 1000000).toFixed(2)} MM (${maxItem.count}*)`
            : 'N/A';
        document.getElementById('comunaMin').textContent = minItem.name !== 'N/A'
            ? `Comuna ${minItem.name}: USD ${(minItem.total / 1000000).toFixed(2)} MM (${minItem.count}*)`
            : 'N/A';
    }

    const sectoresList = document.getElementById('rubrosList');
    sectoresList.innerHTML = '';
    const sectoresTotal = {};
    for (const item of Object.values(inversiones)) {
        for (const [sector, monto] of Object.entries(item.sectores)) {
            sectoresTotal[sector] = (sectoresTotal[sector] || 0) + monto;
        }
    }
    for (const [sector, total] of Object.entries(sectoresTotal)) {
        const li = document.createElement('li');
        li.textContent = `${sector}: USD ${(total / 1000000).toFixed(2)} MM (${sectoresCount[sector] || 0}*)`;
        sectoresList.appendChild(li);
    }
}

function populateSectorFilter() {
    const select = document.getElementById('sectorFilter');
    sectores.forEach(sector => {
        const option = document.createElement('option');
        option.value = sector;
        option.textContent = sector;
        select.appendChild(option);
    });
}

function exportMapAsImage() {
    html2canvas(document.getElementById('map')).then(canvas => {
        const link = document.createElement('a');
        link.download = 'mapa_inversiones_caba.png';
        link.href = canvas.toDataDataURL('image/png');
        link.click();
    });
}

function exportDataAsCSV() {
    const csv = Papa.unparse(datosRaw);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'inversiones_caba.csv';
    link.click();
}
