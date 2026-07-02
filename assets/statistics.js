// assets/statistics.js — Render global comparative dashboard charts

const PROJECT_SLUG = 'hetero-ewas-explorer'; 
const DATA_VERSION = window.HAEWAS_CONFIG?.DATA_VERSION || 'dev';
function detectBasePrefix() {
  const p = location.pathname;
  const marker = `/${PROJECT_SLUG}/`;
  const i = p.indexOf(marker);
  if (i >= 0) return p.slice(0, i + marker.length); 
  return p.endsWith('/') ? p : p.replace(/[^/]+$/, '');
}
const BASE_PATH = detectBasePrefix();                  
const BASE_URL  = new URL(BASE_PATH, location.origin); 
const STATS_URL = new URL(`data/downloads/summary_stats.json?v=${encodeURIComponent(DATA_VERSION)}`, BASE_URL).href;

const layoutBase = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  colorway: ['#99bdd5', '#e9898c', '#a4cfa3'],
  font: { family: 'inherit' },
  hoverlabel: {
    bgcolor: 'rgba(255,255,255,0.96)',
    bordercolor: 'rgba(48,72,95,0.18)',
    font: { family: 'Arial, Helvetica, sans-serif', size: 12, color: '#30485f' }
  },
  margin: { t: 60, l: 50, r: 30, b: 50 } 
};

const colorMap = {
  'haEWAS-specific': '#CC79A7',
  'Common': '#009E73',
  'common': '#009E73',
  'EWAS-specific': '#0072B2'
};

const drawOrder = ['haEWAS-specific', 'Common', 'EWAS-specific']; 

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch(STATS_URL);
    if (!res.ok) throw new Error('Failed to load JSON');
    const data = await res.json();

    renderGroupsChart(data.groups);
    renderDriversChart(getDriverOverlapData(data));
    renderRegionsChart(data.regions);
    renderPhenotypesChart(data.phenotypes);

    window.addEventListener('resize', () => {
      Plotly.Plots.resize('chart-groups');
      Plotly.Plots.resize('chart-drivers');
      Plotly.Plots.resize('chart-regions');
      Plotly.Plots.resize('chart-phenos');
      Plotly.Plots.resize('chart-pheno-pie');
      Plotly.Plots.resize('chart-pheno-drivers');
    });

  } catch (err) {
    document.querySelector('.portal-grid').innerHTML = 
      `<p style="color:red;">Failed to load data: ${err.message}. Ensure generate_stats.py has been executed.</p>`;
  }
});

function getDriverOverlapData(data) {
  return data.driver_overlap || computeLegacyDriverOverlap(data.drivers || {}, data.groups || {});
}

function renderGroupsChart(groupsData) {
  const labels = [];
  const values = [];
  drawOrder.forEach(grp => {
    if(groupsData[grp] !== undefined) {
      labels.push(grp);
      values.push(groupsData[grp]);
    }
  });
  const colors = labels.map(lbl => colorMap[lbl] || '#999');

  const trace = {
    labels: labels, values: values, type: 'pie', hole: 0.4,
    sort: false,
    marker: { colors: colors }, textinfo: 'label+percent', hoverinfo: 'label+value',
    textfont: { size: 14 }
  };

  const layout = {
    ...layoutBase,
    margin: { t: 60, l: 50, r: 30, b: 80 },
    title: { text: 'Phenotype-associated loci', font: { size: 20 } },
    showlegend: true, legend: { orientation: 'h', y: -0.25, xanchor: 'center', x: 0.5, font: { size: 14 } }
  };
  Plotly.newPlot('chart-groups', [trace], layout, { displayModeBar: false, responsive: true });
}

function renderDriversChart(driverOverlapData) {
  const overlap = driverOverlapData || {};
  const driverPanels = [
    { key: 'CAMDA', title: 'haEWAS (CAMDA) vs EWAS', color: 'rgba(184,64,32,0.7)', labelColor: '#b84020', centerX: 0.25 },
    { key: 'CHALM', title: 'haEWAS (CHALM) vs EWAS', color: 'rgba(111,64,112,0.7)', labelColor: '#6f4070', centerX: 0.75 }
  ];
  const ewasColor = 'rgba(45,90,128,0.7)';
  const overlapColor = 'rgba(120,120,120,0.7)';

  const circles = [];
  const annotations = [];
  const points = [];
  const totals = [];

  driverPanels.forEach((panel) => {
    const panelData = overlap[panel.key] || { 'haEWAS-specific': 0, Common: 0, 'EWAS-specific': 0 };
    totals.push(
      (panelData['haEWAS-specific'] || 0) + (panelData.Common || 0),
      (panelData['EWAS-specific'] || 0) + (panelData.Common || 0)
    );
  });
  const minTotal = Math.min.apply(null, totals.filter((v) => v > 0));
  const maxTotal = Math.max.apply(null, totals);

  driverPanels.forEach((panel) => {
    const panelData = overlap[panel.key] || { 'haEWAS-specific': 0, Common: 0, 'EWAS-specific': 0 };
    const leftTotal = (panelData['haEWAS-specific'] || 0) + (panelData.Common || 0);
    const rightTotal = (panelData['EWAS-specific'] || 0) + (panelData.Common || 0);
    const leftR = scaleVennRadius(leftTotal, minTotal, maxTotal);
    const rightR = scaleVennRadius(rightTotal, minTotal, maxTotal);
    const leftCx = panel.centerX - 0.08;
    const rightCx = panel.centerX + 0.08;
    const cy = 0.53;

    circles.push(
      {
        type: 'circle',
        xref: 'paper',
        yref: 'paper',
        x0: leftCx - leftR,
        x1: leftCx + leftR,
        y0: cy - leftR,
        y1: cy + leftR,
        fillcolor: panel.color,
        line: { color: 'rgba(54, 69, 84, 0.20)', width: 1.1 }
      },
      {
        type: 'circle',
        xref: 'paper',
        yref: 'paper',
        x0: rightCx - rightR,
        x1: rightCx + rightR,
        y0: cy - rightR,
        y1: cy + rightR,
        fillcolor: ewasColor,
        line: { color: 'rgba(54, 69, 84, 0.20)', width: 1.1 }
      }
    );

    annotations.push(
      { x: leftCx, y: 0.81, text: `haEWAS<br>(${panel.key})<br><span style="font-size:13px;">n = ${formatInteger(leftTotal)}</span>`, size: 14, color: panel.labelColor },
      { x: rightCx, y: 0.81, text: `EWAS<br><span style="font-size:13px;">n = ${formatInteger(rightTotal)}</span>`, size: 14, color: '#355f7c' }
    );

    const overlapX = (leftCx + rightCx) / 2;
    const haCount = panelData['haEWAS-specific'] || 0;
    const commonCount = panelData.Common || 0;
    const ewasCount = panelData['EWAS-specific'] || 0;
    
    annotations.push(
      { x: leftCx - leftR * 0.35, y: cy, text: `<span style="font-size:14px;">${formatInteger(haCount)}</span>`, size: 14, color: 'white', showarrow: false },
      { x: overlapX, y: cy, text: `<span style="font-size:14px;">${formatInteger(commonCount)}</span>`, size: 14, color: 'white', showarrow: false },
      { x: rightCx + rightR * 0.35, y: cy, text: `<span style="font-size:14px;">${formatInteger(ewasCount)}</span>`, size: 14, color: 'white', showarrow: false }
    );
    points.push(
      {
        x: leftCx - leftR * 0.35,
        y: cy,
        color: panel.color,
        title: `haEWAS (${panel.key})-specific`,
        count: panelData['haEWAS-specific'] || 0,
        description: null
      },
      {
        x: overlapX,
        y: cy,
        color: overlapColor,
        title: 'Common',
        count: panelData.Common || 0,
        description: null
      },
      {
        x: rightCx + rightR * 0.35,
        y: cy,
        color: ewasColor,
        title: 'EWAS-specific',
        count: panelData['EWAS-specific'] || 0,
        description: null
      }
    );
  });

  const layout = {
    ...layoutBase,
    margin: { t: 52, l: 8, r: 8, b: 16 },
    title: { text: 'haEWAS driver overlap with EWAS', font: { size: 20, color: '#30485f' } },
    xaxis: { visible: false },
    yaxis: { visible: false },
    shapes: circles,
    annotations: annotations.map((anno) => ({
      xref: 'paper',
      yref: 'paper',
      showarrow: false,
      xanchor: 'center',
      yanchor: 'middle',
      align: 'center',
      font: { size: anno.size, color: anno.color, family: 'inherit' },
      ...anno
    })),
    showlegend: false
  };

  const totalCount = points.reduce((sum, point) => sum + point.count, 0);
  const trace = {
    x: points.map((point) => point.x),
    y: points.map((point) => point.y),
    mode: 'markers',
    type: 'scatter',
    marker: {
      size: 34,
      color: points.map((point) => point.color),
      line: {
        color: 'rgba(54, 69, 84, 0.14)',
        width: 1
      },
      opacity: 0.01
    },
    customdata: points.map((point) => {
      const pct = totalCount > 0 ? ((point.count / totalCount) * 100).toFixed(1) : 0;
      return [point.title, point.count, pct];
    }),
    hovertemplate: '<b>%{customdata[0]}</b>: %{customdata[1]:,} (%{customdata[2]}%)<extra></extra>',
    showlegend: false
  };

  Plotly.newPlot('chart-drivers', [trace], layout, { displayModeBar: false, responsive: true }).then(() => {
    const chart = document.getElementById('chart-drivers');
    if (!chart || chart._driverClickBound) return;
    chart.on('plotly_click', (eventData) => {
      const point = eventData && eventData.points && eventData.points[0];
      if (!point) return;
      Plotly.Fx.hover(chart, [{ curveNumber: point.curveNumber, pointNumber: point.pointNumber }]);
    });
    chart._driverClickBound = true;
  });
}

function computeLegacyDriverOverlap(driversData, groupsData) {
  const common = driversData.Common || {};
  const haSpecific = driversData['haEWAS-specific'] || {};
  const ewasSpecific = groupsData['EWAS-specific'] || 0;
  const commonTotal = groupsData.Common || 0;
  const haSpecificTotal = groupsData['haEWAS-specific'] || 0;

  return {
    CHALM: {
      'haEWAS-specific': (haSpecific.CHALM || 0) + (haSpecific.Both || 0),
      Common: (common.CHALM || 0) + (common.Both || 0),
      'EWAS-specific': ewasSpecific + (common.CAMDA || 0)
    },
    CAMDA: {
      'haEWAS-specific': (haSpecific.CAMDA || 0) + (haSpecific.Both || 0),
      Common: (common.CAMDA || 0) + (common.Both || 0),
      'EWAS-specific': ewasSpecific + (common.CHALM || 0)
    },
    _totals: {
      'haEWAS-specific': haSpecificTotal,
      Common: commonTotal,
      'EWAS-specific': ewasSpecific
    }
  };
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString();
}

function scaleVennRadius(total, minTotal, maxTotal) {
  if (!total || total <= 0 || !isFinite(total)) return 0.075;
  if (!isFinite(minTotal) || !isFinite(maxTotal) || maxTotal <= minTotal) return 0.125;
  const ratio = (Math.sqrt(total) - Math.sqrt(minTotal)) / (Math.sqrt(maxTotal) - Math.sqrt(minTotal));
  return 0.105 + ratio * 0.055;
}

function renderRegionsChart(regionsData) {
  const allRegions = new Set();
  Object.values(regionsData).forEach(g => Object.keys(g).forEach(r => allRegions.add(r)));
  const xLabels = Array.from(allRegions);

  const traces = [];
  drawOrder.forEach(grp => {
    if(!regionsData[grp]) return;
    const yVals = xLabels.map(r => regionsData[grp][r] || 0);
    traces.push({
      x: xLabels, y: yVals, name: grp, type: 'bar',
      marker: { color: colorMap[grp] }
    });
  });

  const layout = {
    ...layoutBase,
    barmode: 'group',
    title: { text: 'Genomic annotation distribution', font: { size: 20 } },
    xaxis: { tickangle: -45, tickfont: { size: 12 } },
    yaxis: { title: 'Number of CpGs', titlefont: { size: 13 }, tickfont: { size: 12 } },
    margin: { t: 60, l: 60, r: 30, b: 100 },
    legend: { orientation: 'h', x: 0, xanchor: 'left', y: 0.95, yanchor: 'bottom', font: { size: 14 } }
  };
  Plotly.newPlot('chart-regions', traces, layout, { displayModeBar: false, responsive: true });
}

function renderPhenotypesChart(phenosData) {
  const entries = Object.entries(phenosData);
  entries.sort((a, b) => a[1].total - b[1].total); 

  const yLabels = entries.map(e => e[0]);
  const traces = [];

  drawOrder.forEach(grp => {
    const xVals = entries.map(e => {
      const val = e[1].groups[grp] || 0;
      return val > 0 ? val : null; 
    });

    traces.push({
      y: yLabels, x: xVals, name: grp, type: 'bar', orientation: 'h',
      marker: { color: colorMap[grp] },
      text: xVals.map(v => v ? String(v) : ''), 
      textposition: 'outside', hoverinfo: 'name+x'
    });
  });

  const dynamicHeight = Math.max(500, entries.length * 45);

  const layout = {
    ...layoutBase,
    height: dynamicHeight, 
    barmode: 'group', 
    title: null,
    xaxis: { title: 'Number of CpGs (Log)', type: 'log', dtick: 1, titlefont: { size: 13 }, tickfont: { size: 12 } },
    yaxis: { automargin: true, tickmode: 'linear', dtick: 1, tickfont: { size: 12 } },
    margin: { t: 30, l: 10, r: 60, b: 20 },
    legend: { 
      orientation: 'h', 
      x: -0.15, 
      xanchor: 'left', 
      y: 1.01, 
      yanchor: 'bottom', 
      font: { size: 14 }, 
      itemwidth: 30 
    }
  };

  Plotly.newPlot('chart-phenos', traces, layout, { displayModeBar: false, responsive: true });

  if (entries.length > 0) {
    const largestPheno = entries[entries.length - 1][0]; 
    const phenoInfo = phenosData[largestPheno];
    setTimeout(() => {
      renderPhenoDetails(largestPheno, phenoInfo);
    }, 500);
  }

  const phenoChart = document.getElementById('chart-phenos');
  phenoChart.on('plotly_click', function(data) {
    if (data.points.length > 0) {
      const clickedPheno = data.points[0].y;
      const phenoInfo = phenosData[clickedPheno];
      if (phenoInfo) {
        renderPhenoDetails(clickedPheno, phenoInfo);
      }
    }
  });
}

function renderPhenoDetails(phenoName, phenoInfo) {
  document.getElementById('pheno-placeholder').style.display = 'none';
  const pieWrapper = document.getElementById('pie-wrapper');
  const driverWrapper = document.getElementById('driver-wrapper');
  
  pieWrapper.style.display = 'block';
  document.getElementById('pie-title').textContent = phenoName;

  const gLabels = [];
  const gValues = [];
  drawOrder.forEach(grp => {
    if (phenoInfo.groups[grp] !== undefined) {
      gLabels.push(grp);
      gValues.push(phenoInfo.groups[grp]);
    }
  });
  const gColors = gLabels.map(lbl => colorMap[lbl] || '#999');

  const traceGroups = {
    labels: gLabels, values: gValues, type: 'pie', hole: 0.4,
    sort: false,
    marker: { colors: gColors }, textinfo: 'percent', hoverinfo: 'label+value',
    textfont: { size: 13 }
  };
  
  const layoutGroups = {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    title: null, 
    margin: { t: 10, l: 20, r: 20, b: 20 },
    showlegend: true, legend: { orientation: 'h', y: -0.05, xanchor: 'center', x: 0.5, font: { size: 13 } }
  };
  Plotly.newPlot('chart-pheno-pie', [traceGroups], layoutGroups, { displayModeBar: false, responsive: true });

  const preferredDriverOrder = ['CHALM', 'CAMDA', 'Both'];
  const rawDrivers = phenoInfo.drivers || {};
  
  const dLabels = Object.keys(rawDrivers).sort((a, b) => {
    let idxA = preferredDriverOrder.indexOf(a);
    let idxB = preferredDriverOrder.indexOf(b);
    if(idxA === -1) idxA = 99;
    if(idxB === -1) idxB = 99;
    return idxA - idxB;
  });
  const dValues = dLabels.map(lbl => rawDrivers[lbl]);
  
  const dColors = dLabels.map(lbl => 
    lbl.toUpperCase().includes('CHALM') ? '#6f4070' : 
    lbl.toUpperCase().includes('CAMDA') ? '#b84020' : 
    '#2d5a80'
  );

  if (dLabels.length > 0) {
    driverWrapper.style.display = 'block';
    const traceDrivers = {
      labels: dLabels, values: dValues, type: 'pie', hole: 0.5,
      sort: false,
      marker: { colors: dColors }, textinfo: 'percent', hoverinfo: 'label+value',
      textfont: { size: 13 }
    };
    const layoutDrivers = {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      title: null, 
      margin: { t: 10, l: 20, r: 20, b: 20 },
      showlegend: true, legend: { orientation: 'h', y: -0.05, xanchor: 'center', x: 0.5, font: { size: 13 } }
    };
    Plotly.newPlot('chart-pheno-drivers', [traceDrivers], layoutDrivers, { displayModeBar: false, responsive: true });
  } else {
    driverWrapper.style.display = 'none';
    Plotly.purge('chart-pheno-drivers');
  }
}
