// Manual Planner
(async function(){
  // Load the main recipe database. Use the full complete DB only.
  let data = null;
    // Load the main recipe database. Try underscore filename first (uploaded file), then hyphen variant.
    const candidates = ['satisfactory_complete_recipes.json','satisfactory-recipes-complete.json'];
    for (const u of candidates) {
      try {
        const r = await fetch(u);
        if (!r.ok) continue;
        data = await r.json();
        break;
      } catch (e) { continue; }
    }
    if (!data) {
      document.getElementById('recipes-list').innerText = 'No recipe DB found (tried complete recipes filenames).';
      return;
  }

  // Normalize simple map of recipes from groups
  const groups = ['smeltingRecipes','foundryRecipes','constructorRecipes','assemblerRecipes','manufacturerRecipes','refineryRecipes','blenderRecipes','particleAcceleratorRecipes','quantumEncoderRecipes','converterRecipes','fuelRecipes','packagerRecipes'];
  const recipesMap = {};
  groups.forEach(g => {
    const grp = data[g] || {};
    Object.entries(grp).forEach(([k,r]) => {
      const time = r.time || 1;
      const outputItem = r.output?.item || k;
      const outputAmount = r.output?.amount || 1;
      const outputRate = (outputAmount*60)/time;
      const inputs = (r.inputs||[]).map(inp=>({item:inp.item,rate:(inp.amount*60)/time}));
      const byproduct = r.byproduct ? {item:r.byproduct.item, rate:(r.byproduct.amount*60)/time} : null;
      recipesMap[outputItem] = recipesMap[outputItem] || [];
      recipesMap[outputItem].push({name:k, building:r.building, inputs, output:{item:outputItem,rate:outputRate}, power:r.powerUsage||r.power||0, byproduct});
    });
  });
  // also include any pre-existing data.recipes that match structure
  if (data.recipes) {
    // If recipes is an object map (legacy), use keys
    if (!Array.isArray(data.recipes)) {
      Object.entries(data.recipes).forEach(([k,v])=>{
        if (v && v.output && typeof v.output.rate==='number') {
          recipesMap[k] = recipesMap[k] || [];
          recipesMap[k].push({name:k, building:v.building||'', inputs:(v.inputs||[]).map(i=>({item:i.item, rate:i.rate})), output:v.output, power:v.power||0, byproduct:v.byproduct?{item:v.byproduct.item,rate:v.byproduct.rate}:null});
        }
      });
    } else {
      // data.recipes is an array (complete DB export) - normalize entries
      data.recipes.forEach(r => {
        if (!r || !r.output) return;
        const time = r.time || 1;
        const outputItem = r.output?.item || r.name;
        const outputAmount = r.output?.amount || 1;
        const outputRate = (outputAmount * 60) / time;
        const inputs = (r.inputs||[]).map(inp=>({item: inp.item, rate: (inp.amount*60)/time}));
        const byproduct = r.byproduct ? { item: r.byproduct.item, rate: (r.byproduct.amount*60)/time } : null;
        recipesMap[outputItem] = recipesMap[outputItem] || [];
        recipesMap[outputItem].push({ name: r.name || outputItem, building: r.building || '', inputs, output: { item: outputItem, rate: outputRate }, power: r.power || r.powerUsage || 0, byproduct });
      });
    }
  }

  // Diagnostic: if we built no recipes, show helpful info to user
  if (Object.keys(recipesMap).length === 0) {
    const listEl = document.getElementById('recipes-list');
    if (listEl) {
      listEl.innerText = 'No recipes found in the loaded JSON. Top-level keys: ' + Object.keys(data).join(', ');
    }
    console.error('Loaded recipe DB but no recipes parsed. Data keys:', Object.keys(data));
    return;
  }

  // Extractor mapping
  const extractors = {};
  const types = data.extractors || {};
  const rawList = Array.isArray(data.rawResources) ? data.rawResources : [];
  const pickExtractor = (res) => {
    if (/oil/i.test(res)) return 'Oil Extractor';
    if (/water/i.test(res)) return 'Water Extractor';
    if (/gas|nitrogen/i.test(res)) return 'Resource Well Pressurizer';
    return 'Miner Mk.1';
  };
  if (rawList.length>0) {
    rawList.forEach(r=>{
      const chosen = pickExtractor(r);
      const def = types[chosen] || Object.values(types)[0] || { baseRate:0, power:0 };
      const rate = def.baseRate ?? def.rate ?? 0;
      const power = def.power ?? 0;
      extractors[r] = { type: chosen, rate, power };
      // add extractor as a recipe: consumes a 'Node' and outputs the raw resource
      recipesMap[r] = recipesMap[r] || [];
      recipesMap[r].push({
        name: chosen,
        building: chosen,
        inputs: [{ item: 'Node', rate: 1 }],
        output: { item: r, rate: rate },
        power: power,
        byproduct: null
      });
    });
  }

  // NOTE: extractor MK expansion removed — use recipes as provided in DB

  // UI elements
  const listEl = document.getElementById('recipes-list');
  const filterEl = document.getElementById('filter');
  const nodesEl = document.getElementById('nodes');
  const missingEl = document.getElementById('missing');
  const workspace = document.getElementById('workspace');
  const totalEnergyEl = document.getElementById('total-energy');
  const buildingsCountEl = document.getElementById('buildings-count');
  const buildingsListEl = document.getElementById('buildings-list');
  // Inline SVG icon templates (converted from provided React components)
  const SVG = {
    Download: (size=18, color='currentColor') => `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>`,
    Zap: (size=18, color='currentColor') => `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>`
  };
  // track current missing map so the recipe list can highlight and sort
  let currentMissing = {};

  // Build recipe list
  const recipeKeys = Object.keys(recipesMap).sort();
  function renderList(filter=''){
    listEl.innerHTML = '';
    // build visible list and sort missing items to the top
    const visible = recipeKeys.filter(k=>k.toLowerCase().includes(filter.toLowerCase()));
    visible.sort((a,b)=>{
      const ma = currentMissing[a] ? 0 : 1;
      const mb = currentMissing[b] ? 0 : 1;
      if (ma!==mb) return ma-mb; // missing first
      return a.localeCompare(b);
    });
    const tpl = document.getElementById('tpl-recipe-item');
    visible.forEach(k=>{
      const variants = recipesMap[k];
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.item = k;
      const nameEl = node.querySelector('[data-bind="recipe-name"]') || node.querySelector('.ri-name');
      const varEl = node.querySelector('[data-bind="recipe-variants"]') || node.querySelector('.ri-variants');
      if (nameEl) nameEl.textContent = k;
      if (varEl) varEl.textContent = `${variants.length} recipe${variants.length>1?'s':''}`;
      if (currentMissing[k]) node.classList.add('missing');
      node.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', k); });
      // double-click (or double-tap) to add the recipe quickly
      node.addEventListener('dblclick', ()=>{ addNodeForItem(k); });
      // touch double-tap support
      (function(el, item){
        let _lastTouch = 0;
        el.addEventListener('touchend', (ev)=>{
          const now = Date.now();
          if (now - _lastTouch <= 350) {
            ev.preventDefault();
            addNodeForItem(item);
            _lastTouch = 0;
          } else _lastTouch = now;
        });
      })(node, k);
      listEl.appendChild(node);
    });
  }
  renderList('');
  filterEl.addEventListener('input', ()=>renderList(filterEl.value));

  // Drag/drop handlers
  workspace.addEventListener('dragover', e=>{ e.preventDefault(); workspace.classList.add('dragover'); });
  workspace.addEventListener('dragleave', e=>{ workspace.classList.remove('dragover'); });
  workspace.addEventListener('drop', e=>{
    e.preventDefault(); workspace.classList.remove('dragover');
    const item = e.dataTransfer.getData('text/plain');
    if (!item) return;
    addNodeForItem(item);
  });

  let nodeIdCounter = 1;
  const nodes = [];

  function addNodeForItem(item, opts = {}){
    const variants = recipesMap[item] || [];
    const chosen = variants[0] || {name:item, building:'', inputs:[], output:{item,rate:0}, power:0};
    const node = {
      id: nodeIdCounter++,
      item,
      variantIndex:0,
      variants,
      building: chosen.building,
      count: opts.count || 1,
      perOutput: chosen.output.rate,
      inputs: chosen.inputs,
      byproduct: chosen.byproduct || null,
      power: chosen.power
    };
    nodes.push(node);
    renderNodes();
    recompute();
  }

  function renderNodes(){
    // preserve open/closed state for inputs details from existing DOM
    try {
      const existingCards = nodesEl.querySelectorAll('.node-card');
      existingCards.forEach(card => {
        const id = Number(card.dataset.id);
        const nodeObj = nodes.find(x=>x.id===id);
        if (!nodeObj) return;
        const detailsEl = card.querySelector('details.io') || card.querySelector('[data-bind="io"]');
        if (detailsEl) nodeObj.ioOpen = !!detailsEl.open;
      });
    } catch (e) {
      // ignore if nodesEl isn't yet in the DOM or other minor issues
    }
    nodesEl.innerHTML = '';
    const tpl = document.getElementById('tpl-node-card');
    nodes.forEach(n=>{
      const card = tpl.content.firstElementChild.cloneNode(true);
      card.dataset.id = n.id;
      const nameEl = card.querySelector('[data-bind="name"]') || card.querySelector('.nc-name');
      if (nameEl) nameEl.textContent = n.item;

      // controls: count, variant select. remove button lives in header (top-right) so it's always visible
      const controls = card.querySelector('[data-bind="controls"]') || card.querySelector('.node-controls');
      controls.innerHTML = '';
      const countInput = document.createElement('input');
      countInput.type = 'number'; countInput.value = n.count; countInput.min = 0;
      countInput.className = 'node-count';
      countInput.addEventListener('change', ()=>{ n.count = Number(countInput.value)||0; recompute(); });

      // Custom dropdown (replaces native select) so the open overlay can be themed
      const variantWrapper = document.createElement('div');
      variantWrapper.className = 'node-variant-wrapper';
      const variantButton = document.createElement('button');
      variantButton.type = 'button';
      variantButton.className = 'node-variant-button';
      // build label for current variant
      const curVar = n.variants[n.variantIndex] || {};
      const curLabel = ((curVar.building || curVar.name || '').trim()) || ((curVar.output && curVar.output.rate) ? `${curVar.output.rate.toFixed(2)}/min` : '');
      variantButton.textContent = curLabel;
      const variantList = document.createElement('div');
      variantList.className = 'node-variant-list';
      n.variants.forEach((v, idx) => {
        const opt = document.createElement('div');
        opt.className = 'node-variant-option';
        opt.dataset.index = idx;
        const label = (v.building || v.name || '').trim();
        const rate = (v.output && v.output.rate) ? v.output.rate.toFixed(2) : '0';
        opt.textContent = label ? `${label} — ${rate}/min` : `${rate}/min`;
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          n.variantIndex = Number(opt.dataset.index);
          const sel = n.variants[n.variantIndex];
          if (sel) { n.building = sel.building; n.perOutput = sel.output.rate; n.inputs = sel.inputs; n.power = sel.power; n.byproduct = sel.byproduct || null; }
          closeAllVariantLists();
          recompute(); renderNodes();
        });
        variantList.appendChild(opt);
      });
      variantWrapper.appendChild(variantButton);
      variantWrapper.appendChild(variantList);
      // toggle list
      variantButton.addEventListener('click', (e) => { e.stopPropagation(); closeAllVariantLists(); variantWrapper.classList.toggle('open'); });
      // helper to close all open lists
      function closeAllVariantLists() {
        document.querySelectorAll('.node-variant-wrapper.open').forEach(w => w.classList.remove('open'));
      }
      // close on outside click (global)
      if (!document._planner_variant_global) {
        document._planner_variant_global = true;
        document.addEventListener('click', ()=>{ document.querySelectorAll('.node-variant-wrapper.open').forEach(w=>w.classList.remove('open')); });
      }

      controls.appendChild(countInput);
      controls.appendChild(variantWrapper);
      // wire header remove button
      const headerRemove = card.querySelector('[data-bind="remove"]') || card.querySelector('.node-remove');
      if (headerRemove) {
        headerRemove.addEventListener('click', ()=>{ const i = nodes.findIndex(x=>x.id===n.id); if (i>=0) nodes.splice(i,1); renderNodes(); recompute(); });
      }

      // detailed inputs (inside collapsible) and always-visible outputs
      const ioBody = card.querySelector('[data-bind="io-body"]');
      if (ioBody) {
        ioBody.innerHTML = '';
        // inputs only inside the collapsible
        (n.inputs||[]).forEach(inp=>{
          const tr = document.createElement('tr');
          tr.innerHTML = `<td style="padding:0.25rem 0.5rem;">${inp.item}</td><td style="padding:0.25rem 0.5rem; text-align:right;">${inp.rate.toFixed(2)}</td>`;
          ioBody.appendChild(tr);
        });
      }
      // restore details open state and keep it in sync with node object
      const detailsEl = card.querySelector('details.io') || card.querySelector('[data-bind="io"]');
      if (detailsEl) {
        detailsEl.open = !!n.ioOpen;
        detailsEl.addEventListener('toggle', ()=>{ n.ioOpen = !!detailsEl.open; });
      }
      // populate always-visible output/residual elements
      const outItemEl = card.querySelector('[data-bind="io-output-item"]');
      const outRateEl = card.querySelector('[data-bind="io-output-rate"]');
      if (outItemEl) outItemEl.textContent = n.item || '';
      if (outRateEl) outRateEl.textContent = (n.perOutput||0).toFixed(2) + '/min';
      const resRow = card.querySelector('[data-bind="io-residual-row"]');
      const resItemEl = card.querySelector('[data-bind="io-residual-item"]');
      const resRateEl = card.querySelector('[data-bind="io-residual-rate"]');
      if (n.byproduct && n.byproduct.item) {
        if (resRow) resRow.style.display = '';
        if (resItemEl) resItemEl.textContent = n.byproduct.item;
        if (resRateEl) resRateEl.textContent = (n.byproduct.rate||0).toFixed(2) + '/min';
      } else {
        if (resRow) resRow.style.display = 'none';
      }
      nodesEl.appendChild(card);
    });
  }

  // extractor UI removed — extractors are available via recipes sidebar

  // Export CSV / HTML table: include per-unit and total-per-building columns for each item
  function buildTableAndCsv(useFormulas = false, opts = {}) {
    const itemsSet = new Set();
    nodes.forEach(n => {
      if (n.item) itemsSet.add(n.item);
      (n.inputs||[]).forEach(i=>itemsSet.add(i.item));
      if (n.byproduct && n.byproduct.item) itemsSet.add(n.byproduct.item);
    });
    const items = Array.from(itemsSet).sort();

    // headers: Multi, Building, Item, for each item -> [item per, item total], Energy
    const headers = ['Multi','Building'];
    items.forEach(it=>{ headers.push(`${it}`); headers.push(`total`); });
    headers.push('Energy');

    const rows = [];
    nodes.forEach(n=>{
      const multiplier = n.count || 0;
      const buildingLabel = n.building ? `${n.item} ${n.building}` : '';
      const row = [multiplier, buildingLabel];
      items.forEach(it =>{
        let perUnit = 0;
        if (it === n.item) perUnit = n.perOutput || 0;
        else if (n.byproduct && n.byproduct.item === it) perUnit = n.byproduct.rate || 0;
        else {
          const inp = (n.inputs||[]).find(x=>x.item===it);
          if (inp) perUnit = - (inp.rate || 0);
        }
        const total = perUnit * multiplier;
        if (useFormulas) {
          row.push(Number(perUnit.toFixed(2)));
          row.push(null);
        } else {
          row.push(Number(perUnit.toFixed(2)));
          row.push(Number(total.toFixed(2)));
        }
      });
      const energy = (n.power||0) * multiplier;
      if (useFormulas) {
        // store power so we can emit a per-row formula later when we know row number
        row.push({ __isEnergy: true, power: (n.power||0) });
      } else {
        row.push(Number(energy.toFixed(2)));
      }
      rows.push(row);
    });

    // SUM row (must align with leading columns: Multi, Building, Item)
    const sumRow = ['','SUM'];
    items.forEach(it=>{
      sumRow.push('');
      let total = 0;
      nodes.forEach(n=>{
        const multiplier = n.count || 0;
        let perUnit = 0;
        if (it === n.item) perUnit = n.perOutput || 0;
        else if (n.byproduct && n.byproduct.item === it) perUnit = n.byproduct.rate || 0;
        else {
          const inp = (n.inputs||[]).find(x=>x.item===it);
          if (inp) perUnit = - (inp.rate || 0);
        }
        total += perUnit * multiplier;
      });
      sumRow.push(Number(total.toFixed(2)));
    });
    let totalEnergy = 0; nodes.forEach(n=>{ totalEnergy += (n.power||0) * (n.count||0); });
    if (useFormulas) {
      // placeholder; will replace with SUM(...) formula below when we know endRow
      sumRow.push(null);
    } else {
      sumRow.push(Number(totalEnergy.toFixed(2)));
    }
    rows.push(sumRow);

    function colLetter(n) {
      let s = '';
      let num = n + 1;
      while (num > 0) {
        const rem = (num - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        num = Math.floor((num - 1) / 26);
      }
      return s;
    }

    const escapeCell = v => typeof v === 'string' && (v.includes(',')||v.includes('\n')) ? '"'+v.replace(/"/g,'""')+'"' : String(v);
    const csvHeader = headers.map(h => escapeCell(h === '' || h == null ? '-' : h)).join(',');
    // If formulas are enabled, ensure SUM row references the correct total columns
    if (useFormulas) {
      // total columns are at indices: 2 + (i*2) + 1 -> 3,5,7...
      items.forEach((it, idx) => {
        const totalColIndex = 2 + (idx * 2) + 1;
        // rows.length is dataRows + 1 (because sumRow was pushed), so endRow for SUM is rows.length
        const endRow = rows.length;
        const col = colLetter(totalColIndex);
        const sumFormula = `=SUM(${col}2:${col}${endRow})`;
        // place formula string into the sumRow position
        rows[rows.length - 1][totalColIndex] = sumFormula;
      });
      // set SUM for the energy column at the end
      const energyColIndex = 2 + (items.length * 2); // after all item per/total pairs
      const energyCol = colLetter(energyColIndex);
      const endRow = rows.length;
      rows[rows.length - 1][energyColIndex] = `=SUM(${energyCol}2:${energyCol}${endRow})`;
    
    }

    const energyColIndex = headers.length - 1;
    const csvRows = rows.map((r, ridx)=>{
      const rowNum = ridx + 2;
      return r.map((c, ci)=>{
        if (useFormulas && c === null) {
          // for a total cell, reference the previous per-unit column
          const perCol = colLetter(ci - 1);
          const mulCol = colLetter(0);
          const formula = `=IF(${perCol}${rowNum}=0,"",${perCol}${rowNum}*${mulCol}${rowNum})`;
          return escapeCell(formula);
        }
        // per-row energy formula placeholder
        if (useFormulas && c && typeof c === 'object' && c.__isEnergy) {
          const mulCol = colLetter(0);
          const formula = `=IF(${mulCol}${rowNum}=0,"",${mulCol}${rowNum}*${Number(c.power)})`;
          return escapeCell(formula);
        }
        // Optionally strip zero values for cleaner copy/paste CSVs
        if (opts.stripZeros) {
          // keep formulas (strings starting with '=') intact
          if (typeof c === 'number' && c === 0) return '';
          if (typeof c === 'string' && c.trim() !== '' && !c.startsWith('=') && !isNaN(Number(c)) && Number(c) === 0) return '';
          if (c === '' || c == null) return '';
        }
        return escapeCell((c=== '' || c==null) ? '-' : c);
      }).join(',');
    }).join('\n');
    const csv = csvHeader + '\n' + csvRows + '\n';

    let html = '<table><thead><tr>' + headers.map(h=>`<th>${h=== ''||h==null?'-':String(h)}</th>`).join('') + '</tr></thead><tbody>';
    rows.forEach((r, ridx)=>{
      const rowNum = ridx + 2;
      html += '<tr>' + r.map((c, ci)=>{
        if (useFormulas && c === null) {
          const perCol = colLetter(ci - 1);
          const mulCol = colLetter(0);
          const formula = `=IF(${perCol}${rowNum}=0,"",${perCol}${rowNum}*${mulCol}${rowNum})`;
          return `<td>${formula}</td>`;
        }
        if (useFormulas && c && typeof c === 'object' && c.__isEnergy) {
          const mulCol = colLetter(0);
          const formula = `=IF(${mulCol}${rowNum}=0,"",${mulCol}${rowNum}*${Number(c.power)})`;
          return `<td>${formula}</td>`;
        }
        // Optionally strip zeros for copy HTML
        if (opts.stripZeros) {
          if (typeof c === 'number' && c === 0) return `<td></td>`;
          if (typeof c === 'string' && c.trim() !== '' && !c.startsWith('=') && !isNaN(Number(c)) && Number(c) === 0) return `<td></td>`;
          if (c === '' || c == null) return `<td></td>`;
        }
        return `<td>${(c=== ''||c==null)?'-':String(c)}</td>`;
      }).join('') + '</tr>';
    });
    html += '</tbody></table>';

    return { csv, html };
  }

  function exportCsv(){
    const out = buildTableAndCsv();
    const blob = new Blob([out.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'factory-export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // wire Export button and add download icon
  const expBtn = document.getElementById('export-csv');
  if (expBtn) {
    expBtn.innerHTML = SVG.Download(16,'#0a0e17') + '<span style="margin-left:8px; font-weight:700;">Export CSV</span>';
    expBtn.addEventListener('click', exportCsv);
  }
  // wire Copy button
  const copyBtn = document.getElementById('copy-csv');
  if (copyBtn) {
    copyBtn.innerHTML = '<span style="font-weight:700;">Copy CSV</span>';
    // shared CSV builder used by export and copy
    function buildCsvString() {
      const itemsSet = new Set();
      nodes.forEach(n => {
        if (n.item) itemsSet.add(n.item);
        (n.inputs||[]).forEach(i=>itemsSet.add(i.item));
        if (n.byproduct && n.byproduct.item) itemsSet.add(n.byproduct.item);
      });
      const items = Array.from(itemsSet).sort();
      const headers = ['MULTIPLIER','NAME', ...items, 'ENERGY'];
      const rows = [];
      nodes.forEach(n=>{
        const row = [];
        const multiplier = n.count || 0;
        row.push(multiplier);
        row.push(n.building || n.item || '');
        items.forEach(it=>{
          let perUnit = 0;
          if (it === n.item) perUnit = n.perOutput || 0;
          else if (n.byproduct && n.byproduct.item === it) perUnit = n.byproduct.rate || 0;
          else {
            const inp = (n.inputs||[]).find(x=>x.item===it);
            if (inp) perUnit = - (inp.rate || 0);
          }
          const total = perUnit * multiplier;
          row.push(Number(total.toFixed(2)));
        });
        const energy = (n.power||0) * multiplier;
        row.push(Number(energy.toFixed(2)));
        rows.push(row);
      });
      const sumRow = ['','SUM'];
      items.forEach(it=>{
        let total = 0;
        nodes.forEach(n=>{
          const multiplier = n.count || 0;
          let perUnit = 0;
          if (it === n.item) perUnit = n.perOutput || 0;
          else if (n.byproduct && n.byproduct.item === it) perUnit = n.byproduct.rate || 0;
          else {
            const inp = (n.inputs||[]).find(x=>x.item===it);
            if (inp) perUnit = - (inp.rate || 0);
          }
          total += perUnit * multiplier;
        });
        sumRow.push(Number(total.toFixed(2)));
      });
      let totalEnergy = 0; nodes.forEach(n=>{ totalEnergy += (n.power||0) * (n.count||0); });
      sumRow.push(Number(totalEnergy.toFixed(2)));
      rows.push(sumRow);
      const escapeCell = v => typeof v === 'string' && (v.includes(',')||v.includes('\n')) ? '"'+v.replace(/"/g,'""')+'"' : String(v);
      let csv = headers.map(h => escapeCell(h === '' || h == null ? '-' : h)).join(',') + '\n';
      rows.forEach(r=>{ csv += r.map(c => escapeCell(c === '' || c == null ? '-' : c)).join(',') + '\n'; });
      return csv;
    }

    async function doCopyCsvFeedback() {
      try {
        const out = buildTableAndCsv(true, { stripZeros: true }); // produce spreadsheet formulas for totals and strip zeros for copy
        // prefer rich clipboard (text/html) when available
        if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
            // provide a full HTML document to improve Excel/Sheets paste behavior
            const fullHtml = '<!doctype html><html><head><meta http-equiv="content-type" content="text/html; charset=utf-8"></head><body>' + out.html + '</body></html>';
            const blobHtml = new Blob([fullHtml], { type: 'text/html' });
            const blobText = new Blob([out.csv], { type: 'text/plain' });
            try {
              // try including Excel MIME; some browsers reject unknown types
              const blobHtmlExcel = new Blob([fullHtml], { type: 'application/vnd.ms-excel' });
              const item = new ClipboardItem({ 'text/html': blobHtml, 'application/vnd.ms-excel': blobHtmlExcel, 'text/plain': blobText });
              await navigator.clipboard.write([item]);
            } catch (err) {
              // fallback to a safer set of types
              const item = new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText });
              await navigator.clipboard.write([item]);
            }
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          // fallback to plain text CSV
          await navigator.clipboard.writeText(out.csv);
        } else {
          throw new Error('Clipboard API not available');
        }
        const old = copyBtn.innerHTML;
        copyBtn.innerHTML = 'Copied';
        setTimeout(()=> copyBtn.innerHTML = old, 1500);
      } catch (e) {
        alert('Copy failed: '+(e && e.message ? e.message : String(e)));
      }
    }

    // click handler (existing)
    copyBtn.addEventListener('click', doCopyCsvFeedback);
    // dblclick handler
    copyBtn.addEventListener('dblclick', doCopyCsvFeedback);
    // touch double-tap handler for mobile: detect two taps within 350ms
    let _lastTouch = 0;
    copyBtn.addEventListener('touchend', (ev)=>{
      const now = Date.now();
      if (now - _lastTouch <= 350) {
        ev.preventDefault();
        doCopyCsvFeedback();
        _lastTouch = 0;
      } else _lastTouch = now;
    });
  }
  function recompute(){
    // totals
    const totalProduced = {};
    const totalRequired = {};
    let totalEnergy = 0;
    let totalBuildingCount = 0;
    const buildingCounts = {};
    nodes.forEach(n=>{
      const produced = (n.perOutput||0) * (n.count||0);
      totalProduced[n.item] = (totalProduced[n.item]||0) + produced;
      // include byproduct/residual outputs in produced totals
      if (n.byproduct && n.byproduct.item) {
        const bpAmount = (n.byproduct.rate||0) * (n.count||0);
        totalProduced[n.byproduct.item] = (totalProduced[n.byproduct.item]||0) + bpAmount;
      }
      (n.inputs||[]).forEach(inp=>{
        totalRequired[inp.item] = (totalRequired[inp.item]||0) + inp.rate * (n.count||0);
      });
      // energy and building counts
      const cnt = n.count || 0;
      totalEnergy += (n.power||0) * cnt;
      totalBuildingCount += cnt;
      const bname = n.building || 'Raw';
      buildingCounts[bname] = (buildingCounts[bname]||0) + cnt;
    });

    // compute missing: binary detection — item is missing only if there are no producers at all
    const missing = {};
    Object.entries(totalRequired).forEach(([item, req])=>{
      const producedAmt = totalProduced[item]||0;
      // mark missing only if produced amount is zero (no producers placed)
      if (producedAmt === 0) missing[item] = true;
    });
    // store missing set and update the recipe list so missing items are highlighted and sorted
    currentMissing = missing;
    // hide or clear the old missing area (we don't render the table anymore)
    if (missingEl) missingEl.innerHTML = '';
    // re-render list (preserves current filter)
    renderList(filterEl.value);

    // update right-column totals (icon + number; energy uses MW)
    if (totalEnergyEl) totalEnergyEl.innerHTML = SVG.Zap(16,'var(--yellow)') + '<span style="margin-left:8px; font-weight:700;">' + Number(totalEnergy.toFixed(2)) + ' MW</span>';
    if (buildingsCountEl) buildingsCountEl.innerHTML = Number(totalBuildingCount.toFixed(0)) + ' Buildings needed';
    if (buildingsListEl) {
      buildingsListEl.innerHTML = '';
      Object.keys(buildingCounts).sort().forEach(k=>{
        const div = document.createElement('div'); div.className='building-entry';
        const nspan = document.createElement('div'); nspan.className='b-name'; nspan.textContent = k;
        const cspan = document.createElement('div'); cspan.className='b-count'; cspan.textContent = Number(buildingCounts[k].toFixed(0));
        div.appendChild(nspan); div.appendChild(cspan);
        buildingsListEl.appendChild(div);
      });
    }
  }

  // initial render
  renderNodes(); recompute();
})();