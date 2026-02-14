const { useState, useEffect, useRef, useCallback } = React;

// SVG Icons
const Download = ({ size = 24, color = "currentColor" }) => (
  React.createElement('svg', { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
    React.createElement('path', { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
    React.createElement('polyline', { points: "7 10 12 15 17 10" }),
    React.createElement('line', { x1: "12", y1: "15", x2: "12", y2: "3" })
  )
);

const Zap = ({ size = 24, color = "currentColor" }) => (
  React.createElement('svg', { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
    React.createElement('polygon', { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" })
  )
);

const Settings = ({ size = 24, color = "currentColor" }) => (
  React.createElement('svg', { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
    React.createElement('circle', { cx: "12", cy: "12", r: "3" }),
    React.createElement('path', { d: "M12 1v6m0 6v6m5.66-13.66L15 8m-6 6l-2.66 2.66M23 12h-6m-6 0H1m18.66 5.66L17 15m-6-6l-2.66-2.66" })
  )
);

const TrendingUp = ({ size = 24, color = "currentColor" }) => (
  React.createElement('svg', { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
    React.createElement('polyline', { points: "23 6 13.5 15.5 8.5 10.5 1 18" }),
    React.createElement('polyline', { points: "17 6 23 6 23 12" })
  )
);

// Production Graph Visualizer Component
const ProductionGraph = ({ productionChain }) => {
  if (!productionChain) return null;

  // Smaller default node sizing for denser graphs
  const nodeWidth = 160;
  const nodeHeight = 60;
  const horizontalSpacing = 200;
  const verticalSpacing = 90;

  // Layout calculation (unchanged logic, adapted to new sizes)
  const calculateLayout = (node, depth = 0, index = 0, parentWidth = 1) => {
    const children = node.children || [];
    const byproducts = node.byproducts || [];
    let positions = [];
    let currentIndex = index;

    const y = depth * verticalSpacing + 30;
    const x = (currentIndex + parentWidth / 2) * horizontalSpacing;

    positions.push({ ...node, x, y, depth });

    children.forEach(child => {
      const childPositions = calculateLayout(child, depth + 1, currentIndex, 1);
      positions = positions.concat(childPositions);
      currentIndex += 1;
    });

    byproducts.forEach(byproduct => {
      positions.push({ ...byproduct, x: x + nodeWidth + 60, y, depth });
    });

    return positions;
  };

  const nodes = calculateLayout(productionChain);
  const maxX = Math.max(...nodes.map(n => n.x)) + nodeWidth + 50;
  const maxY = Math.max(...nodes.map(n => n.y)) + nodeHeight + 50;

  // Build links
  const links = [];
  nodes.forEach(node => {
    if (node.children) {
      node.children.forEach(child => {
        const childNode = nodes.find(n => n.item === child.item && n.depth === node.depth + 1);
        if (childNode) {
          links.push({ x1: node.x + nodeWidth / 2, y1: node.y + nodeHeight, x2: childNode.x + nodeWidth / 2, y2: childNode.y, type: 'input' });
        }
      });
    }

    if (node.byproducts) {
      node.byproducts.forEach(byproduct => {
        const byproductNode = nodes.find(n => n.item === byproduct.item && n.isByproduct && n.depth === node.depth);
        if (byproductNode) {
          links.push({ x1: node.x + nodeWidth, y1: node.y + nodeHeight / 2, x2: byproductNode.x, y2: byproductNode.y + nodeHeight / 2, type: 'byproduct' });
        }
      });
    }
  });

  // Zoom & pan state
  const svgRef = useRef(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const transformStart = useRef({ x: 0, y: 0, k: 1 });
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 0.9 });

  // Helper: screen point -> svg coords (SVGPoint)
  const clientToSvgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const inv = ctm.inverse();
    const svgP = pt.matrixTransform(inv);
    return { x: svgP.x, y: svgP.y };
  }, []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const scaleFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const clientX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
    const clientY = e.clientY ?? e.nativeEvent?.clientY ?? 0;
    const before = clientToSvgPoint(clientX, clientY);

    setTransform(prev => {
      const newK = Math.max(0.2, Math.min(4, prev.k * scaleFactor));
      const newX = before.x - (before.x - prev.x) * (newK / prev.k);
      const newY = before.y - (before.y - prev.y) * (newK / prev.k);
      return { x: newX, y: newY, k: newK };
    });
  }, [clientToSvgPoint]);

  // Attach non-passive wheel listener so preventDefault actually stops page scroll
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onMouseDown = (e) => {
    e.preventDefault();
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    transformStart.current = { ...transform };
  };

  const onMouseMove = (e) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;

    // Convert pixel delta to SVG coordinate delta using current scale
    const svg = svgRef.current;
    if (!svg) return;
    const startSvg = clientToSvgPoint(panStart.current.x, panStart.current.y);
    const nowSvg = clientToSvgPoint(e.clientX, e.clientY);
    const svgDx = nowSvg.x - startSvg.x;
    const svgDy = nowSvg.y - startSvg.y;

    setTransform({ x: transformStart.current.x + svgDx, y: transformStart.current.y + svgDy, k: transformStart.current.k });
  };

  const endPan = () => {
    isPanning.current = false;
  };

  // Ensure we stop panning if mouse leaves window
  useEffect(() => {
    window.addEventListener('mouseup', endPan);
    return () => window.removeEventListener('mouseup', endPan);
  }, []);

  // Render SVG with interactive handlers; apply transform to a root <g>
  return (
    React.createElement('svg', {
      ref: svgRef,
      className: 'graph-svg',
      viewBox: `0 0 ${maxX} ${maxY}`,
      preserveAspectRatio: 'xMidYMid meet',
      onMouseDown: onMouseDown,
      onMouseMove: onMouseMove,
      onMouseUp: endPan,
      onMouseLeave: endPan
    },
      // Transform group for zoom/pan
      React.createElement('g', { transform: `translate(${transform.x}, ${transform.y}) scale(${transform.k})` },
        // Links
        links.map((link, i) => (
          link.type === 'byproduct'
            ? React.createElement('path', { key: `link-${i}`, className: 'graph-link byproduct', d: `M ${link.x1} ${link.y1} L ${link.x2} ${link.y2}`, style: { stroke: 'rgba(255, 152, 0, 0.5)', strokeDasharray: '5,5' } })
            : React.createElement('path', { key: `link-${i}`, className: 'graph-link', d: `M ${link.x1} ${link.y1} C ${link.x1} ${link.y1 + 30}, ${link.x2} ${link.y2 - 30}, ${link.x2} ${link.y2}` })
        )),

        // Nodes
        nodes.map((node, i) => (
          React.createElement('g', { key: `node-${i}`, className: 'graph-node', transform: `translate(${node.x}, ${node.y})` },
            React.createElement('rect', { className: `node-bg ${node.isByproduct ? 'byproduct' : node.isRaw ? 'raw' : 'processed'}`, width: nodeWidth, height: nodeHeight }),
            React.createElement('text', { className: 'node-text', x: nodeWidth / 2, y: 20, textAnchor: 'middle' }, node.isByproduct ? `${node.item} (Byproduct)` : node.item),
            React.createElement('text', { className: 'node-detail', x: nodeWidth / 2, y: 36, textAnchor: 'middle' }, `${node.rate.toFixed(2)}/min`),
            !node.isByproduct && React.createElement('text', { className: 'node-detail', x: nodeWidth / 2, y: 50, textAnchor: 'middle' }, node.building || node.extractor || 'Raw Resource'),
            !node.isByproduct && React.createElement('text', { className: 'node-detail', x: nodeWidth / 2, y: 62, textAnchor: 'middle' }, node.buildingCount ? `${node.buildingCount.toFixed(1)}x • ${node.power.toFixed(1)} MW` : node.extractorCount > 0 ? `${node.extractorCount}x • ${node.power.toFixed(1)} MW` : '')
          )
        ))
      )
    )
  );
};

// Main App Component
const SatisfactoryPlanner = () => {
  const [recipeData, setRecipeData] = useState(null);
  const [selectedItem, setSelectedItem] = useState('Iron Plate');
  const [targetRate, setTargetRate] = useState(60);
  const [productionChain, setProductionChain] = useState(null);

  // Load recipe data
  useEffect(() => {
    // Load the complete recipe DB only
    const tryLoad = async () => {
      try {
        let loaded = null;
        const candidates = ['satisfactory_complete_recipes.json','satisfactory-recipes-complete.json'];
        for (const u of candidates) {
          try {
            const res = await fetch(u);
            if (!res.ok) continue;
            loaded = await res.json();
            break;
          } catch (e) { continue; }
        }
        if (!loaded) throw new Error('No recipe DB found (tried complete recipes filenames)');

        // Normalize various recipe group shapes into expected `recipes` map
        const normalize = (data) => {
          const groups = [
            'smeltingRecipes','foundryRecipes','constructorRecipes','assemblerRecipes',
            'manufacturerRecipes','refineryRecipes','blenderRecipes','particleAcceleratorRecipes',
            'quantumEncoderRecipes','converterRecipes','fuelRecipes','packagerRecipes'
          ];

          const out = { recipes: {}, extractors: {} };

          groups.forEach(g => {
            const group = data[g] || {};
            Object.entries(group).forEach(([key, r]) => {
              const time = r.time || 1; // seconds
              const outputAmount = r.output?.amount || 1;
              const outputItem = r.output?.item || key;
              const outputRate = (outputAmount * 60) / time; // per minute

              const inputs = (r.inputs || []).map(inp => ({
                item: inp.item,
                rate: (inp.amount * 60) / time
              }));

              const byp = r.byproduct ? { item: r.byproduct.item, rate: (r.byproduct.amount * 60) / time } : undefined;

              out.recipes[outputItem] = {
                building: r.building || null,
                inputs,
                output: { item: outputItem, rate: outputRate },
                power: r.powerUsage || r.power || 0,
                byproduct: byp
              };
            });
          });

          // If data already has a `recipes` array (complete DB export), normalize it
          if (Array.isArray(data.recipes)) {
            data.recipes.forEach(r => {
              if (!r || !r.output) return;
              const time = r.time || 1;
              const outputItem = r.output?.item || r.name;
              const outputAmount = r.output?.amount || 1;
              const outputRate = (outputAmount * 60) / time;
              const inputs = (r.inputs || []).map(inp => ({ item: inp.item, rate: (inp.amount * 60) / time }));
              const byp = r.byproduct ? { item: r.byproduct.item, rate: (r.byproduct.amount * 60) / time } : undefined;
              out.recipes[outputItem] = {
                building: r.building || null,
                inputs,
                output: { item: outputItem, rate: outputRate },
                power: r.power || r.powerUsage || 0,
                byproduct: byp
              };
            });
          } else if (data.recipes && typeof data.recipes === 'object') {
            Object.entries(data.recipes).forEach(([k, v]) => {
              // skip comments
              if (k.startsWith('_')) return;
              // if v.output.rate exists, use directly, else attempt to normalize
              if (v.output && typeof v.output.rate === 'number') {
                out.recipes[k] = v;
              }
            });
          }

          // Map extractor types to raw resources (best-effort)
          if (data.extractors && typeof data.extractors === 'object') {
            const types = data.extractors;
            // Helper to pick extractor type for a resource name
            const pickExtractor = (res) => {
              if (/oil/i.test(res)) return 'Oil Extractor';
              if (/water/i.test(res)) return 'Water Extractor';
              if (/gas|nitrogen/i.test(res)) return 'Resource Well Pressurizer';
              if (/s\.a\.m|sam/i.test(res)) return 'Resource Well Extractor';
              return 'Miner Mk.1';
            };

            // If rawResources array exists, map those; otherwise attempt to map common names
            const rawList = Array.isArray(data.rawResources) ? data.rawResources : [];
            if (rawList.length > 0) {
              rawList.forEach(r => {
                const chosen = pickExtractor(r);
                const def = types[chosen] || Object.values(types)[0] || { baseRate: 0, power: 0 };
                const rate = def.baseRate ?? def.rate ?? 0;
                const power = def.power ?? 0;
                out.extractors[r] = { type: chosen, rate, power };
              });
            } else {
              // no raw list: as fallback, expose extractor types by name
              Object.entries(types).forEach(([k, v]) => {
                const rate = v.baseRate ?? v.rate ?? 0;
                const power = v.power ?? 0;
                out.extractors[k] = { type: k, rate, power };
              });
            }
          }

          return out;
        };

        const normalized = normalize(loaded);
        setRecipeData(normalized);
      } catch (error) {
        console.error('Error loading recipes:', error);
      }
    };

    tryLoad();
  }, []);

  // Calculate production chain recursively
  const calculateChain = (item, requiredRate) => {
    if (!recipeData) return null;

    const recipe = recipeData.recipes[item];
    
    if (!recipe) {
      // Raw resource
      const extractor = recipeData.extractors[item];
      return {
        item,
        rate: requiredRate,
        isRaw: true,
        extractor: extractor?.type || 'Manual',
        extractorCount: extractor ? Math.ceil(requiredRate / extractor.rate) : 0,
        power: extractor ? (Math.ceil(requiredRate / extractor.rate) * extractor.power) : 0,
        children: [],
        byproducts: []
      };
    }

    // Calculate how many buildings needed
    const buildingCount = requiredRate / recipe.output.rate;
    const totalPower = buildingCount * recipe.power;

    // Calculate input requirements
    const children = recipe.inputs.map(input => {
      const inputRate = (input.rate / recipe.output.rate) * requiredRate;
      return calculateChain(input.item, inputRate);
    });

    // Calculate byproduct production
    const byproducts = [];
    if (recipe.byproduct) {
      const byproductRate = (recipe.byproduct.rate / recipe.output.rate) * requiredRate;
      byproducts.push({
        item: recipe.byproduct.item,
        rate: byproductRate,
        isByproduct: true
      });
    }

    return {
      item,
      rate: requiredRate,
      building: recipe.building,
      buildingCount: Math.ceil(buildingCount * 100) / 100,
      power: totalPower,
      actualOutput: Math.ceil(buildingCount) * recipe.output.rate,
      overproduction: (Math.ceil(buildingCount) * recipe.output.rate) - requiredRate,
      children,
      byproducts
    };
  };

  useEffect(() => {
    if (recipeData) {
      const chain = calculateChain(selectedItem, targetRate);
      setProductionChain(chain);
    }
  }, [selectedItem, targetRate, recipeData]);

  // Flatten chain for table view
  const flattenChain = (node, depth = 0, result = []) => {
    result.push({ ...node, depth });
    node.children.forEach(child => flattenChain(child, depth + 1, result));
    // Add byproducts at same depth but marked
    if (node.byproducts) {
      node.byproducts.forEach(byproduct => {
        result.push({ 
          ...byproduct, 
          depth, 
          building: `${node.building} (Byproduct)`,
          buildingCount: 0,
          power: 0,
          overproduction: 0
        });
      });
    }
    return result;
  };

  // Calculate totals
  const calculateTotals = () => {
    if (!productionChain) return { power: 0, buildings: {}, extractors: {} };
    
    const flat = flattenChain(productionChain);
    const totals = {
      power: 0,
      buildings: {},
      extractors: {}
    };

    flat.forEach(node => {
      totals.power += node.power || 0;
      
      if (node.building) {
        totals.buildings[node.building] = (totals.buildings[node.building] || 0) + node.buildingCount;
      }
      
      if (node.extractor && node.extractorCount > 0) {
        totals.extractors[node.extractor] = (totals.extractors[node.extractor] || 0) + node.extractorCount;
      }
    });

    return totals;
  };

  // Compute producers map keyed by produced item. Each producer summarizes per-building and totals.
  const computeMatrix = (root) => {
    if (!root) return [];
    const flat = flattenChain(root);

    const producers = {}; // item -> aggregated producer info

    flat.forEach(node => {
      // consider node.item as produced by its building (if it has a building) or extractor
      const item = node.item;
      const buildingName = node.building || node.extractor || (node.isRaw ? `Raw: ${item}` : null);
      const count = node.buildingCount || node.extractorCount || 0;
      const power = node.power || 0;

      if (!producers[item]) {
        producers[item] = {
          item,
          buildingNames: new Set(),
          perBuildingOutputs: {},
          perBuildingInputs: {},
          totalBuildings: 0,
          totalPower: 0,
          totalProduced: {},
          totalInputs: {}
        };
      }

      const p = producers[item];
      if (buildingName) p.buildingNames.add(buildingName);
      p.totalBuildings += count || 0;
      p.totalPower += power;

      // per-building output estimate
      if (node.building) {
        const recipe = recipeData?.recipes?.[item];
        const perB = recipe ? recipe.output.rate : (node.rate || 0) / Math.max(1, node.buildingCount || 1);
        p.perBuildingOutputs[item] = perB;
        p.totalProduced[item] = (p.totalProduced[item] || 0) + (perB * (node.buildingCount || 0));

        if (recipe) {
          recipe.inputs.forEach(inp => {
            p.perBuildingInputs[inp.item] = inp.rate;
            p.totalInputs[inp.item] = (p.totalInputs[inp.item] || 0) + (inp.rate * (node.buildingCount || 0));
          });
        }
      }

      // extractor/raw
      if (node.isRaw && node.extractor) {
        const perB = recipeData?.extractors?.[item]?.rate || node.rate || 0;
        p.perBuildingOutputs[item] = perB;
        p.totalProduced[item] = (p.totalProduced[item] || 0) + (perB * (node.extractorCount || 0));
      }
    });

    return producers; // return map
  };

  const producersMap = productionChain ? computeMatrix(productionChain) : {};

  // Build full item list from flattened chain (ensure all items appear as rows/cols)
  const flatAll = productionChain ? flattenChain(productionChain) : [];
  const allItemsSet = new Set();
  flatAll.forEach(n => { if (n && n.item) allItemsSet.add(n.item); if (n && n.byproducts) n.byproducts.forEach(b => allItemsSet.add(b.item)); });
  const matrixItems = Array.from(allItemsSet).sort();

  // compute column sums (net produced - consumed across all producers)
  const matrixSums = {};
  matrixItems.forEach(it => matrixSums[it] = 0);
  Object.values(producersMap).forEach(p => {
    matrixItems.forEach(it => {
      const produced = p.totalProduced?.[it] || 0;
      const consumed = p.totalInputs?.[it] || 0;
      const net = produced - consumed;
      matrixSums[it] = (matrixSums[it] || 0) + net;
    });
  });

  

  // Export to CSV
  const exportToCSV = () => {
    if (!productionChain) return;
    
    const flat = flattenChain(productionChain);
    const headers = ['Item', 'Type', 'Rate/min', 'Building', 'Count', 'Power (MW)', 'Overproduction', 'Level'];
    
    const rows = flat.map(node => [
      node.item,
      node.isByproduct ? 'Byproduct' : node.isRaw ? 'Raw' : 'Processed',
      node.rate.toFixed(2),
      node.building || node.extractor || 'Raw',
      node.buildingCount?.toFixed(2) || node.extractorCount || '-',
      (node.power || 0).toFixed(2),
      (node.overproduction || 0).toFixed(2),
      node.depth
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `satisfactory-${selectedItem.replace(/\s/g, '-')}-${targetRate}.csv`;
    a.click();
  };

  if (!recipeData) {
    return React.createElement('div', { className: 'app-container' },
      React.createElement('div', { style: { textAlign: 'center', padding: '4rem' } },
        'Loading recipe database...'
      )
    );
  }

  const totals = calculateTotals();
  const flatChain = productionChain ? flattenChain(productionChain) : [];

  return (
    React.createElement('div', { className: 'app-container' },

      // Controls
      React.createElement('div', { className: 'controls' },
        React.createElement('div', { className: 'control-group' },
          React.createElement('label', null, 'TARGET ITEM'),
          React.createElement('select', {
            value: selectedItem,
            onChange: (e) => setSelectedItem(e.target.value)
          },
            Object.keys(recipeData.recipes).sort().map(item =>
              React.createElement('option', { key: item, value: item }, item)
            )
          )
        ),
        React.createElement('div', { className: 'control-group' },
          React.createElement('label', null, 'PRODUCTION/MINUTE'),
          React.createElement('input', {
            type: 'number',
            value: targetRate,
            onChange: (e) => setTargetRate(Number(e.target.value)),
            min: '1',
            step: '1'
          })
        ),
        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-end' } },
          React.createElement('button', {
            className: 'export-btn',
            onClick: exportToCSV
          },
            React.createElement(Download, { size: 18 }),
            'EXPORT CSV'
          )
        )
      ),

      // Stats Summary
      React.createElement('div', { className: 'stats-grid' },
        React.createElement('div', { className: 'stat-card power' },
          React.createElement('div', { className: 'stat-header' },
            React.createElement(Zap, { size: 24, color: '#ffc107' }),
            React.createElement('div', { className: 'stat-value power' },
              `${totals.power.toFixed(2)} MW`
            )
          ),
        ),
        React.createElement('div', { className: 'stat-card buildings' },
          React.createElement('div', { className: 'stat-header' },
            React.createElement(Settings, { size: 24, color: '#2196f3' }),
            React.createElement('div', { className: 'stat-value buildings' },
              `${Object.values({ ...totals.buildings, ...totals.extractors })
                .reduce((a, b) => a + b, 0)
                .toFixed(0)} Buildings`
            )
          ),
        ),
        React.createElement('div', { className: 'stat-card output' },
          React.createElement('div', { className: 'stat-header' },
            React.createElement(TrendingUp, { size: 24, color: '#4caf50' }),
            React.createElement('div', { className: 'stat-value output' },
              `${targetRate}/min`
            )
          ),
        )
      ),

      // Building Requirements
      Object.keys(totals.buildings).length > 0 && React.createElement('div', { className: 'building-requirements' },
        React.createElement('div', { className: 'building-grid' },
          Object.entries(totals.buildings).map(([building, count]) =>
            React.createElement('div', { key: building, className: 'building-item building' },
              React.createElement('p', { className: 'building-count building' },
                Math.ceil(count)
              ),
              React.createElement('p', { className: 'building-name' }, building)
            )
          ),
          Object.entries(totals.extractors).map(([extractor, count]) =>
            React.createElement('div', { key: extractor, className: 'building-item extractor' },
              React.createElement('p', { className: 'building-count extractor' },
                Math.ceil(count)
              ),
              React.createElement('p', { className: 'building-name' }, extractor)
            )
          )
        )
      ),

      // Inputs/Outputs Matrix (items × items)
      React.createElement('div', { className: 'matrix-container' },
        React.createElement('table', { className: 'matrix-table' },
          React.createElement('thead', null,
            React.createElement('tr', null,
              React.createElement('th', null, 'MULTIPLIER'),
              React.createElement('th', { style: { borderLeft: '1px solid rgba(255,255,255,0.06)' } }, 'NAME'),
              matrixItems.map((it, idx) => React.createElement('th', { key: `h-${idx}`, style: { borderLeft: '1px solid rgba(255,255,255,0.06)' } }, it))
            )
          ),
          React.createElement('tbody', null,
            // Rows are items
            matrixItems.map((rowItem, ri) => {
              // find producer for this item
              const prod = producersMap[rowItem];
              const multiplierText = prod ? `${Math.ceil(prod.totalBuildings)}x ${Array.from(prod.buildingNames).join(', ')}` : '';

              return React.createElement('tr', { key: `itemrow-${ri}` },
                React.createElement('td', { style: { textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap'} }, multiplierText),
                React.createElement('td', {style: {borderLeft: '1px solid rgba(255,255,255,0.06)' }}, rowItem),
                matrixItems.map((colItem, ci) => {
                  if (!prod) return React.createElement('td', { key: `cell-${ri}-${ci}`, style: { textAlign: 'right' } }, '-');
                  const perB = (prod.perBuildingOutputs?.[colItem] || 0) - (prod.perBuildingInputs?.[colItem] || 0);
                  const total = perB * prod.totalBuildings;
                  const text = (perB === 0 && total === 0) ? '' : `${perB >= 0 ? '+' : ''}${perB.toFixed(2)} (${total >= 0 ? '+' : ''}${total.toFixed(2)})`;
                  return React.createElement('td', { key: `cell-${ri}-${ci}`, style: { whiteSpace: 'pre-wrap', textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.06)'  } }, text);
                })
              );
            }),

            // SUM row
            React.createElement('tr', { style: { borderTop: '2px solid rgba(255,255,255,0.06)' } },
              React.createElement('td', { style: { fontWeight: 900 } }, ''),
              React.createElement('td', { style: { fontWeight: 900, borderLeft: '1px solid rgba(255,255,255,0.06)' } }, 'SUM'),
              matrixItems.map((it, k) => React.createElement('td', { key: `s-${k}`, style: { textAlign: 'right', fontWeight: 900, borderLeft: '1px solid rgba(255,255,255,0.06)' } }, `${matrixSums[it] >= 0 ? '+' : ''}${matrixSums[it].toFixed(2)}`))
            )
          )
        )
      ),

      // Data Table
      React.createElement('div', { className: 'table-container' },
        React.createElement('h3', { className: 'section-title' }, 'DETAILED TABLE'),
        React.createElement('table', null,
          React.createElement('thead', null,
            React.createElement('tr', null,
              React.createElement('th', null, 'ITEM'),
              React.createElement('th', { className: 'align-right' }, 'RATE/MIN'),
              React.createElement('th', null, 'BUILDING'),
              React.createElement('th', { className: 'align-right' }, 'COUNT'),
              React.createElement('th', { className: 'align-right' }, 'POWER (MW)'),
              React.createElement('th', { className: 'align-right' }, 'SURPLUS')
            )
          ),
          React.createElement('tbody', null,
            flatChain.map((node, index) =>
              React.createElement('tr', { 
                key: index,
                style: node.isByproduct ? { background: 'rgba(255, 152, 0, 0.1)' } : {}
              },
                React.createElement('td', { style: { paddingLeft: `${node.depth * 2 + 0.75}rem` } },
                  node.isByproduct ? `↳ ${node.item} (Byproduct)` : node.item
                ),
                React.createElement('td', { className: node.isByproduct ? 'surplus' : 'rate', style: { textAlign: 'right' } },
                  node.rate.toFixed(2)
                ),
                React.createElement('td', { className: 'building-type' },
                  node.building || node.extractor || 'Raw'
                ),
                React.createElement('td', { className: 'count', style: { textAlign: 'right' } },
                  node.buildingCount?.toFixed(2) || node.extractorCount || '-'
                ),
                React.createElement('td', { className: 'power', style: { textAlign: 'right' } },
                  (node.power || 0).toFixed(2)
                ),
                React.createElement('td', { className: 'surplus', style: { textAlign: 'right' } },
                  node.overproduction > 0 ? `+${node.overproduction.toFixed(2)}` : '-'
                )
              )
            )
          )
        )
      )
    )
  );
};

// Render the app
ReactDOM.render(
  React.createElement(SatisfactoryPlanner),
  document.getElementById('root')
);
