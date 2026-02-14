# Satisfactory Production Planner

A comprehensive production chain calculator for the game Satisfactory, designed to run on Cloudflare Workers (free tier).

## Features

✅ **Production Chain Calculation** - Automatically calculates all required buildings and resources  
✅ **Interactive SVG Graph** - Visual tree diagram of the entire production chain  
✅ **Power Consumption** - Total MW required for your factory  
✅ **Building Requirements** - Exact count of each building type needed  
✅ **Overproduction Display** - See surplus production for efficiency planning  
✅ **CSV Export** - Export your production plan to spreadsheet  
✅ **Comprehensive Recipe Database** - 40+ recipes from basic to advanced items (JSON format)  
✅ **Industrial UI Design** - Dark theme with technical aesthetic
✅ **Modular Architecture** - Clean separation of HTML, CSS, JS, and data

## File Structure

```
satisfactory-planner/
├── index.html          # Main HTML file
├── styles.css          # All styling
├── app.js              # React application logic
└── recipes.json        # Recipe database
```

## Recipe Database Includes

### Basic Resources
- Iron, Copper, Steel ingots
- Caterium, Aluminum ingots
- Coal, Limestone, Quartz processing

### Basic Parts
- Iron Plates, Rods, Screws
- Copper Wire, Cable, Sheets
- Steel Beams, Pipes
- Concrete

### Assembled Parts
- Reinforced Iron Plates
- Rotors, Stators, Motors
- Modular Frames
- Smart Plating
- Heavy Modular Frames
- Encased Industrial Beams

### Electronics
- Circuit Boards
- AI Limiters
- High-Speed Connectors
- Computers
- Supercomputers

### Refined Materials
- Plastic, Rubber
- Quickwire
- Silica
- Battery
- Radio Control Units

## Cloudflare Workers Deployment

### Method 1: Quick Deploy (Easiest)

1. **Go to Cloudflare Dashboard**
   - Visit: https://dash.cloudflare.com
   - Sign up/login (free account works!)

2. **Create a Pages Project**
   - Navigate to "Workers & Pages"
   - Click "Create Application" → "Pages" → "Upload assets"

3. **Upload ALL files**
   - Select all 4 files: `index.html`, `styles.css`, `app.js`, `recipes.json`
   - Click "Deploy site"

4. **Done!**
   - Your app will be live at `https://[your-project].pages.dev`
   - Works on the free tier forever!

### Method 2: Wrangler CLI (Advanced)

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create project directory
mkdir satisfactory-planner
cd satisfactory-planner

# Copy all files
cp path/to/index.html .
cp path/to/styles.css .
cp path/to/app.js .
cp path/to/recipes.json .

# Deploy
npx wrangler pages deploy . --project-name=satisfactory-planner
```

### Method 3: GitHub Pages (Alternative)

If you prefer GitHub Pages instead:

```bash
# Create a repository
git init

# Add all files
git add index.html styles.css app.js recipes.json
git commit -m "Initial commit"

# Push to GitHub
git remote add origin https://github.com/yourusername/satisfactory-planner.git
git push -u origin main

# Enable GitHub Pages in repository settings
# Your site will be at: https://yourusername.github.io/satisfactory-planner/
```

## Usage

1. **Select Target Item**  
   Choose what you want to produce from the dropdown (40+ items available)

2. **Set Production Rate**  
   Enter desired items per minute

3. **View Results**  
   - Total power consumption
   - Building requirements
   - Visual production chain
   - Detailed table with all dependencies

4. **Export to CSV**  
   Click "Export CSV" to download spreadsheet-ready data

## How It Works

### Production Chain Algorithm

The app recursively calculates:
1. Required input resources and rates
2. Number of buildings needed (rounded up)
3. Power consumption per tier
4. Overproduction from rounding
5. Raw resource extraction requirements

### Example Calculation

**Goal:** 60 Iron Plates/min

```
Iron Plate (60/min)
└─ Iron Ingot (90/min)
   └─ Iron Ore (90/min)
      └─ Miner Mk.1 x 2
```

**Results:**
- 3 Constructors (60/min ÷ 20/min each)
- 3 Smelters (90/min ÷ 30/min each)  
- 2 Miner Mk.1 (90/min ÷ 60/min each)
- Total Power: 26 MW
- Overproduction: 0/min (perfect efficiency)

## CSV Export Format

The exported CSV includes:
- Item name
- Production rate (per minute)
- Building type
- Building count
- Power consumption (MW)
- Overproduction/surplus
- Dependency level

Import into Google Sheets or Excel for further planning!

## Tech Stack

- **React 18** - UI framework (CDN)
- **Vanilla CSS** - Custom styling with CSS variables
- **SVG** - Interactive graph visualization
- **JSON** - Structured recipe database
- **Pure JavaScript** - No build tools required
- **Modular Architecture** - Separated concerns (HTML/CSS/JS/Data)

## Graph Visualization

The production graph uses SVG to create an interactive tree diagram:
- **Nodes** represent items with production info
- **Links** show dependencies between items
- **Color coding** differentiates raw resources (green) from processed items (blue)
- **Hover effects** for better interactivity
- **Responsive** and zoomable layout

## Browser Support

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers ✅

## Performance

- **Instant calculations** - No backend needed
- **Lightweight** - Total size < 150KB (all files combined)
- **Cached JSON** - Recipe database loaded once
- **No API calls** - Everything runs client-side
- **Free hosting** - Cloudflare Workers free tier (100k requests/day)
- **Modular loading** - Separate files for better caching

## Customization

Want to add more recipes? Edit the `recipes.json` file:

```json
{
  "recipes": {
    "Your New Item": {
      "building": "Manufacturer",
      "inputs": [
        { "item": "Component A", "rate": 30 },
        { "item": "Component B", "rate": 15 }
      ],
      "output": { "item": "Your New Item", "rate": 10 },
      "power": 55,
      "cycleTime": 24
    }
  }
}
```

### File Customization Guide

- **recipes.json** - Add/modify recipes and resources
- **styles.css** - Change colors, fonts, and layout
- **app.js** - Modify calculation logic or add features
- **index.html** - Update metadata or structure

## Known Limitations

- Uses default recipes only (no alternates yet)
- Miner Mk.1 stats only (not Mk.2/Mk.3)
- No overclock calculations
- No alternate recipe comparisons

## Future Features (Planned)

- [ ] Alternate recipes toggle
- [ ] Overclock calculator
- [ ] Building upgrade tiers (Mk.2, Mk.3)
- [ ] Resource node purity (normal/pure/impure)
- [ ] Interactive graph visualization
- [ ] Save/load production plans
- [ ] Multi-factory planning
- [ ] Belt/pipe throughput calculator

## License

Free to use, modify, and deploy!

## Support

Issues? Questions? The code is self-contained and well-commented. Check the HTML file for all logic!

## Credits

Built for Satisfactory players who love optimizing their factories 🏭

---

**Enjoy your efficient factory planning!** 🔧⚡
