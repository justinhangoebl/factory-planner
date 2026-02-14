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

  // Expand extractor recipe variants only with MK tiers (Mk1 = base, Mk2 = 2x rate, Mk3 = 4x rate)
  const extractorKeys = new Set(Object.keys(extractors));
  Object.keys(recipesMap).forEach(key => {
    const original = recipesMap[key];
    // determine if this recipe represents an extractor/miner: either it's in extractor list,
    // or it consumes 'Node' (we injected extractors earlier), or building name hints at miner/extractor
    const shouldExpand = extractorKeys.has(key) || original.some(v => (v.inputs||[]).some(i=>i.item === 'Node')) || original.some(v=>/extractor|miner|node/i.test(v.building||''));
    if (!shouldExpand) return; // skip expansion for non-extractor recipes
    const expanded = [];
    original.forEach(v => {
      const base = Object.assign({}, v, { building: v.building || '' });
      expanded.push(base);
      const mk2 = JSON.parse(JSON.stringify(v));
      mk2.name = (v.name || key) + ' Mk.2';
      mk2.building = (v.building ? v.building + ' Mk.2' : 'Mk.2');
      if (mk2.output && typeof mk2.output.rate === 'number') mk2.output.rate = mk2.output.rate * 2;
      mk2.power = (mk2.power||0) * 2;
      expanded.push(mk2);
      const mk3 = JSON.parse(JSON.stringify(v));
      mk3.name = (v.name || key) + ' Mk.3';
      mk3.building = (v.building ? v.building + ' Mk.3' : 'Mk.3');
      if (mk3.output && typeof mk3.output.rate === 'number') mk3.output.rate = mk3.output.rate * 4;
      mk3.power = (mk3.power||0) * 4;
      expanded.push(mk3);
    });
    recipesMap[key] = expanded;
  });

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
    nodesEl.innerHTML = '';
    const tpl = document.getElementById('tpl-node-card');
    nodes.forEach(n=>{
      const card = tpl.content.firstElementChild.cloneNode(true);
      card.dataset.id = n.id;
      const nameEl = card.querySelector('[data-bind="name"]') || card.querySelector('.nc-name');
      const buildingEl = card.querySelector('[data-bind="building"]') || card.querySelector('.nc-building');
      if (nameEl) nameEl.textContent = n.item;

      // controls: count, variant select. remove button lives in header (top-right) so it's always visible
      const controls = card.querySelector('[data-bind="controls"]') || card.querySelector('.node-controls');
      controls.innerHTML = '';
      const countInput = document.createElement('input');
      countInput.type = 'number'; countInput.value = n.count; countInput.min = 0;
      countInput.style.cssText = 'width:5rem; padding:0.5rem; border-radius:4px; background:rgba(255,255,255,0.05); border:1px solid var(--yellow-15); color:inherit;';
      countInput.addEventListener('change', ()=>{ n.count = Number(countInput.value)||0; recompute(); });

      const variantSelect = document.createElement('select');
      variantSelect.style.cssText = 'padding:0.5rem; border-radius:4px; background:rgba(255,255,255,0.03); border:1px solid var(--yellow-12); color:inherit;';
      n.variants.forEach((v,idx)=>{
        const opt = document.createElement('option'); opt.value = idx;
        // include building/name and rate in dropdown
        const label = (v.building || v.name || '').trim();
        const rate = (v.output && v.output.rate) ? v.output.rate.toFixed(2) : '0';
        opt.text = label ? `${label} — ${rate}/min` : `${rate}/min`;
        variantSelect.appendChild(opt);
      });
      variantSelect.value = n.variantIndex;
      variantSelect.addEventListener('change', ()=>{
        n.variantIndex = Number(variantSelect.value);
        const v = n.variants[n.variantIndex];
        if (v) { n.building = v.building; n.perOutput = v.output.rate; n.inputs = v.inputs; n.power = v.power; n.byproduct = v.byproduct || null; }
        recompute(); renderNodes();
      });

      // small building label shown next to controls (not in header)
      const buildingLabel = document.createElement('div'); buildingLabel.className = 'small'; buildingLabel.style.marginLeft = '0.5rem'; buildingLabel.textContent = n.building || 'Raw';

      controls.appendChild(countInput);
      controls.appendChild(variantSelect);

      // wire header remove button
      const headerRemove = card.querySelector('[data-bind="remove"]') || card.querySelector('.node-remove');
      if (headerRemove) {
        headerRemove.addEventListener('click', ()=>{ const i = nodes.findIndex(x=>x.id===n.id); if (i>=0) nodes.splice(i,1); renderNodes(); recompute(); });
      }

      // detailed inputs/outputs
      // populate collapsible IO table
      const ioBody = card.querySelector('[data-bind="io-body"]');
      if (ioBody) {
        ioBody.innerHTML = '';
        // inputs
        (n.inputs||[]).forEach(inp=>{
          const tr = document.createElement('tr');
          tr.innerHTML = `<td style="padding:0.25rem 0.5rem; color:#8b95a5;">Input</td><td style="padding:0.25rem 0.5rem;">${inp.item}</td><td style="padding:0.25rem 0.5rem; text-align:right;">${inp.rate.toFixed(2)}</td>`;
          ioBody.appendChild(tr);
        });
        // output
        const otr = document.createElement('tr');
        otr.innerHTML = `<td style="padding:0.25rem 0.5rem; color:#8b95a5;">Output</td><td style="padding:0.25rem 0.5rem;">${n.item}</td><td style="padding:0.25rem 0.5rem; text-align:right;">${(n.perOutput||0).toFixed(2)}</td>`;
        ioBody.appendChild(otr);
        // byproduct / residual output (if any)
        if (n.byproduct && n.byproduct.item) {
          const btr = document.createElement('tr');
          btr.innerHTML = `<td style="padding:0.25rem 0.5rem; color:#8b95a5;">Residual</td><td style="padding:0.25rem 0.5rem;">${n.byproduct.item}</td><td style="padding:0.25rem 0.5rem; text-align:right;">${(n.byproduct.rate||0).toFixed(2)}</td>`;
          ioBody.appendChild(btr);
        }
      }
      nodesEl.appendChild(card);
    });
  }

  // extractor UI removed — extractors are available via recipes sidebar

  // Export CSV: builds per-building per-item rows and a SUM row
  function exportCsv() {
    // collect items
    const itemsSet = new Set();
    nodes.forEach(n => {
      if (n.item) itemsSet.add(n.item);
      (n.inputs||[]).forEach(i=>itemsSet.add(i.item));
      if (n.byproduct && n.byproduct.item) itemsSet.add(n.byproduct.item);
    });
    const items = Array.from(itemsSet).sort();

    // headers: Multiplier, Building, Item, [item, TOTAL PER BUILDING]*
    const headers = ['Multiplier','Building','Item'];
    items.forEach(it => { headers.push(it); headers.push('TOTAL PER BUILDING'); });

    const rows = [];
    // per-node rows
    nodes.forEach(n=>{
      const row = [];
      const multiplier = n.count || 0;
      row.push(multiplier);
      row.push(n.building || '');
      row.push(n.item || '');
      items.forEach(it=>{
        let perUnit = 0;
        if (it === n.item) perUnit = n.perOutput || 0;
        else if (n.byproduct && n.byproduct.item === it) perUnit = n.byproduct.rate || 0;
        else {
          const inp = (n.inputs||[]).find(x=>x.item===it);
          if (inp) perUnit = - (inp.rate || 0);
        }
        const totalPerBuilding = perUnit * multiplier;
        row.push(Number(perUnit.toFixed(2)));
        row.push(Number(totalPerBuilding.toFixed(2)));
      });
      rows.push(row);
    });

    // SUM row: blanks for Multiplier/Building/Item, then per-item blank and total sum
    const sumRow = ['','','SUM'];
    items.forEach(it=>{
      // per-unit SUM left empty
      const colIndex = 3; // starting index for items in row
      // compute sum of total-per-building for this item across nodes
      let sum = 0;
      rows.forEach(r=>{
        // each item contributes at positions: base + (itemIndex*2) and base+(itemIndex*2)+1
      });
      // easier: recompute directly
      let total = 0;
      nodes.forEach(n=>{
        const multiplier = n.count || 0;
        let perUnit = 0;
        if (n.item === it) perUnit = n.perOutput || 0;
        else {
          const inp = (n.inputs||[]).find(x=>x.item===it);
          if (inp) perUnit = - (inp.rate || 0);
        }
        total += perUnit * multiplier;
      });
      sumRow.push('');
      sumRow.push(Number(total.toFixed(2)));
    });
    rows.push(sumRow);

    // build CSV string
    const escapeCell = v => typeof v === 'string' && (v.includes(',')||v.includes('\n')) ? '"'+v.replace(/"/g,'""')+'"' : String(v);
    let csv = headers.map(escapeCell).join(',') + '\n';
    rows.forEach(r=>{
      csv += r.map(escapeCell).join(',') + '\n';
    });

    // download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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