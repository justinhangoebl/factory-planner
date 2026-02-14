const { useState, useEffect } = React;

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

  const nodeWidth = 220;
  const nodeHeight = 80;
  const horizontalSpacing = 280;
  const verticalSpacing = 120;

  // Calculate positions for tree layout
  const calculateLayout = (node, depth = 0, index = 0, parentWidth = 1) => {
    const children = node.children || [];
    const byproducts = node.byproducts || [];
    const totalChildren = children.length + byproducts.length || 1;
    
    let positions = [];
    let currentIndex = index;

    // Add current node
    const y = depth * verticalSpacing + 50;
    const x = (currentIndex + parentWidth / 2) * horizontalSpacing;
    
    positions.push({
      ...node,
      x,
      y,
      depth
    });

    // Add children (inputs)
    children.forEach((child, i) => {
      const childPositions = calculateLayout(
        child,
        depth + 1,
        currentIndex,
        1
      );
      positions = positions.concat(childPositions);
      currentIndex += 1;
    });

    // Add byproducts (outputs) - position to the right
    byproducts.forEach((byproduct, i) => {
      positions.push({
        ...byproduct,
        x: x + nodeWidth + 100,
        y: y,
        depth: depth
      });
    });

    return positions;
  };

  const nodes = calculateLayout(productionChain);
  
  // Calculate SVG dimensions
  const maxX = Math.max(...nodes.map(n => n.x)) + nodeWidth + 50;
  const maxY = Math.max(...nodes.map(n => n.y)) + nodeHeight + 50;

  // Create links between nodes
  const links = [];
  nodes.forEach(node => {
    // Links to inputs (children)
    if (node.children) {
      node.children.forEach(child => {
        const childNode = nodes.find(n => n.item === child.item && n.depth === node.depth + 1);
        if (childNode) {
          links.push({
            x1: node.x + nodeWidth / 2,
            y1: node.y + nodeHeight,
            x2: childNode.x + nodeWidth / 2,
            y2: childNode.y,
            type: 'input'
          });
        }
      });
    }
    
    // Links to byproducts (outputs to the side)
    if (node.byproducts) {
      node.byproducts.forEach(byproduct => {
        const byproductNode = nodes.find(n => n.item === byproduct.item && n.isByproduct && n.depth === node.depth);
        if (byproductNode) {
          links.push({
            x1: node.x + nodeWidth,
            y1: node.y + nodeHeight / 2,
            x2: byproductNode.x,
            y2: byproductNode.y + nodeHeight / 2,
            type: 'byproduct'
          });
        }
      });
    }
  });

  return (
    React.createElement('svg', { className: 'graph-svg', viewBox: `0 0 ${maxX} ${maxY}`, preserveAspectRatio: 'xMidYMid meet' },
      // Links
      links.map((link, i) => 
        link.type === 'byproduct' 
          ? React.createElement('path', {
              key: `link-${i}`,
              className: 'graph-link byproduct',
              d: `M ${link.x1} ${link.y1} L ${link.x2} ${link.y2}`,
              style: { stroke: 'rgba(255, 152, 0, 0.5)', strokeDasharray: '5,5' }
            })
          : React.createElement('path', {
              key: `link-${i}`,
              className: 'graph-link',
              d: `M ${link.x1} ${link.y1} 
                  C ${link.x1} ${link.y1 + 40}, 
                    ${link.x2} ${link.y2 - 40}, 
                    ${link.x2} ${link.y2}`
            })
      ),
      // Nodes
      nodes.map((node, i) => 
        React.createElement('g', {
          key: `node-${i}`,
          className: 'graph-node',
          transform: `translate(${node.x}, ${node.y})`
        },
          // Background
          React.createElement('rect', {
            className: `node-bg ${node.isByproduct ? 'byproduct' : node.isRaw ? 'raw' : 'processed'}`,
            width: nodeWidth,
            height: nodeHeight
          }),
          // Item name
          React.createElement('text', {
            className: 'node-text',
            x: nodeWidth / 2,
            y: 25,
            textAnchor: 'middle'
          }, node.isByproduct ? `${node.item} (Byproduct)` : node.item),
          // Rate
          React.createElement('text', {
            className: 'node-detail',
            x: nodeWidth / 2,
            y: 42,
            textAnchor: 'middle'
          }, `${node.rate.toFixed(2)}/min`),
          // Building/Extractor (only for non-byproducts)
          !node.isByproduct && React.createElement('text', {
            className: 'node-detail',
            x: nodeWidth / 2,
            y: 56,
            textAnchor: 'middle'
          }, node.building || node.extractor || 'Raw Resource'),
          // Count and Power (only for non-byproducts)
          !node.isByproduct && React.createElement('text', {
            className: 'node-detail',
            x: nodeWidth / 2,
            y: 70,
            textAnchor: 'middle'
          }, 
            node.buildingCount 
              ? `${node.buildingCount.toFixed(1)}x • ${node.power.toFixed(1)} MW`
              : node.extractorCount > 0
              ? `${node.extractorCount}x • ${node.power.toFixed(1)} MW`
              : ''
          )
        )
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
    fetch('recipes.json')
      .then(response => response.json())
      .then(data => {
        setRecipeData(data);
      })
      .catch(error => {
        console.error('Error loading recipes:', error);
      });
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
      // Header
      React.createElement('div', { className: 'header' },
        React.createElement('h1', null, 'SATISFACTORY'),
        React.createElement('p', null, 'PRODUCTION CHAIN CALCULATOR')
      ),

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
          React.createElement('label', null, 'PRODUCTION RATE (per minute)'),
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
            React.createElement('span', { className: 'stat-label' }, 'TOTAL POWER')
          ),
          React.createElement('div', { className: 'stat-value power' },
            `${totals.power.toFixed(2)} MW`
          )
        ),
        React.createElement('div', { className: 'stat-card buildings' },
          React.createElement('div', { className: 'stat-header' },
            React.createElement(Settings, { size: 24, color: '#2196f3' }),
            React.createElement('span', { className: 'stat-label' }, 'TOTAL BUILDINGS')
          ),
          React.createElement('div', { className: 'stat-value buildings' },
            Object.values({...totals.buildings, ...totals.extractors})
              .reduce((a, b) => a + b, 0)
              .toFixed(0)
          )
        ),
        React.createElement('div', { className: 'stat-card output' },
          React.createElement('div', { className: 'stat-header' },
            React.createElement(TrendingUp, { size: 24, color: '#4caf50' }),
            React.createElement('span', { className: 'stat-label' }, 'OUTPUT')
          ),
          React.createElement('div', { className: 'stat-value output' },
            `${targetRate}/min`
          )
        )
      ),

      // Building Requirements
      Object.keys(totals.buildings).length > 0 && React.createElement('div', { className: 'building-requirements' },
        React.createElement('h3', { className: 'section-title' }, 'BUILDING REQUIREMENTS'),
        React.createElement('div', { className: 'building-grid' },
          Object.entries(totals.buildings).map(([building, count]) =>
            React.createElement('div', { key: building, className: 'building-item building' },
              React.createElement('div', { className: 'building-name' }, building),
              React.createElement('div', { className: 'building-count building' },
                Math.ceil(count)
              )
            )
          ),
          Object.entries(totals.extractors).map(([extractor, count]) =>
            React.createElement('div', { key: extractor, className: 'building-item extractor' },
              React.createElement('div', { className: 'building-name' }, extractor),
              React.createElement('div', { className: 'building-count extractor' },
                Math.ceil(count)
              )
            )
          )
        )
      ),

      // Production Graph
      React.createElement('div', { className: 'graph-container' },
        React.createElement('h3', { className: 'section-title' }, 'PRODUCTION GRAPH'),
        React.createElement(ProductionGraph, { productionChain })
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
