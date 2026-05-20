const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = __dirname;
const DEFAULT_DOWNLOADS_DIR = path.join(ROOT, 'data', 'downloads');
const DEFAULT_SUMMARY_PATH = path.join(DEFAULT_DOWNLOADS_DIR, 'summary_stats.json');

const GROUP_ORDER = ['haEWAS-specific', 'Common', 'EWAS-specific'];
const DRIVER_ORDER = ['CHALM', 'CAMDA', 'Both'];
const REGION_ORDER = ['Body', 'TSS1500', "5'UTR", 'TSS200', '1stExon', "3'UTR", 'ExonBnd'];

function normalizeGroup(value) {
  let clean = String(value || '').trim();
  if (!clean) return null;

  clean = clean.replace('Beta-specific', 'EWAS-specific');
  clean = clean.replace(/-only$/i, '-specific');

  const normalized = clean.toLowerCase();
  if (normalized === 'common') return 'Common';
  if (normalized === 'haewas-specific') return 'haEWAS-specific';
  if (normalized === 'ewas-specific') return 'EWAS-specific';
  return clean;
}

function normalizeDriver(value) {
  const clean = String(value || '').trim();
  if (!clean) return null;

  const normalized = clean.toUpperCase();
  if (normalized.includes('CHALM') && normalized.includes('CAMDA')) return 'Both';
  if (normalized === 'BOTH') return 'Both';
  if (normalized.includes('CHALM')) return 'CHALM';
  if (normalized.includes('CAMDA')) return 'CAMDA';
  return clean;
}

function parseRegions(value) {
  const seen = new Set();
  const tokens = [];

  for (const raw of String(value || '').split(/\s*;\s*/)) {
    const token = raw.trim();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function increment(counter, key) {
  if (!key) return;
  counter[key] = (counter[key] || 0) + 1;
}

function orderedCounter(counter, preferredOrder) {
  const ordered = {};

  for (const key of preferredOrder) {
    if (counter[key]) ordered[key] = counter[key];
  }

  for (const key of Object.keys(counter).sort()) {
    if (!ordered[key] && counter[key]) ordered[key] = counter[key];
  }

  return ordered;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

async function processCsvFile(filePath, groups, driversByGroup, regionsByGroup) {
  const phenotypeName = path.basename(filePath, '.csv');
  const phenoGroups = {};
  const phenoDrivers = {};
  let total = 0;
  let headers = null;

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const rawLine of rl) {
    if (!headers) {
      headers = parseCsvLine(rawLine.replace(/^\uFEFF/, ''));
      continue;
    }

    if (!rawLine.trim()) continue;

    const values = parseCsvLine(rawLine);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));

    total += 1;

    const group = normalizeGroup(row.Group || row.group);
    if (group) {
      increment(groups, group);
      increment(phenoGroups, group);
    }

    const driver = normalizeDriver(
      row.haEWAS_Driver || row.haewas_driver || row.Driver || row.driver,
    );
    if (driver) {
      increment(phenoDrivers, driver);
      if (group) {
        driversByGroup[group] ||= {};
        increment(driversByGroup[group], driver);
      }
    }

    const regions = parseRegions(row.gene_region || row.Gene_region);
    if (group && regions.length) {
      regionsByGroup[group] ||= {};
      for (const region of regions) {
        increment(regionsByGroup[group], region);
      }
    }
  }

  const orderedDrivers = orderedCounter(phenoDrivers, DRIVER_ORDER);
  return [
    phenotypeName,
    {
      total,
      groups: orderedCounter(phenoGroups, GROUP_ORDER),
      drivers: orderedDrivers,
      haewas_drivers: orderedDrivers,
    },
  ];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const downloadsDir = options.input;
  const summaryPath = options.output;

  if (!fs.existsSync(downloadsDir)) {
    throw new Error(`Downloads directory not found: ${downloadsDir}`);
  }

  const files = fs.readdirSync(downloadsDir)
    .filter((name) => name.toLowerCase().endsWith('.csv'))
    .sort((a, b) => a.localeCompare(b));

  const groups = {};
  const driversByGroup = {};
  const regionsByGroup = {};
  const phenotypesRaw = [];

  for (const fileName of files) {
    const result = await processCsvFile(
      path.join(downloadsDir, fileName),
      groups,
      driversByGroup,
      regionsByGroup,
    );
    phenotypesRaw.push(result);
  }

  phenotypesRaw.sort((a, b) => {
    if (b[1].total !== a[1].total) return b[1].total - a[1].total;
    return a[0].localeCompare(b[0]);
  });

  const allDriverGroups = [...GROUP_ORDER, ...Object.keys(driversByGroup).filter((key) => !GROUP_ORDER.includes(key)).sort()];
  const allRegionGroups = [...GROUP_ORDER, ...Object.keys(regionsByGroup).filter((key) => !GROUP_ORDER.includes(key)).sort()];

  const orderedDriversByGroup = {};
  for (const group of allDriverGroups) {
    if (driversByGroup[group] && Object.keys(driversByGroup[group]).length) {
      orderedDriversByGroup[group] = orderedCounter(driversByGroup[group], DRIVER_ORDER);
    }
  }

  const orderedRegionsByGroup = {};
  for (const group of allRegionGroups) {
    if (regionsByGroup[group] && Object.keys(regionsByGroup[group]).length) {
      orderedRegionsByGroup[group] = orderedCounter(regionsByGroup[group], REGION_ORDER);
    }
  }

  const summary = {
    phenotypes: Object.fromEntries(phenotypesRaw),
    groups: orderedCounter(groups, GROUP_ORDER),
    drivers: orderedDriversByGroup,
    haewas_drivers: orderedDriversByGroup,
    regions: orderedRegionsByGroup,
  };

  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${summaryPath}`);
  console.log(`Processed ${phenotypesRaw.length} phenotype files`);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exitCode = 1;
});
function parseArgs(argv) {
  const options = {
    input: DEFAULT_DOWNLOADS_DIR,
    output: DEFAULT_SUMMARY_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' && argv[i + 1]) {
      options.input = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--output' && argv[i + 1]) {
      options.output = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
  }

  return options;
}
