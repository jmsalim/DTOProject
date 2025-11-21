// ============================ CONFIG & GLOBALS ============================
let boids = []; // Array with all particles
let NUM_BOIDS = 250; // Default starting number of dots for the swarm
const MIN_BOIDS = 100; // Minimum allowed dots
const MAX_BOIDS = 2500; // Maximum allowed dots

// High-detail toggle (bigger off-screen buffer + smaller dots)
let highDetailMode = false; // false = standard detail, true = high detail

// UI buttons for adding/removing boids
let addButton;   // "+ Dots" button
let removeButton; // "- Dots" button

// UI visibility master toggle
let uiVisible = true; // Whether UI elements (buttons/labels/help) are shown - GPT

// Discrete rainbow hues (red → violet) for cleaner rainbow bands
const RAINBOW_HUES = [0, 30, 60, 120, 180, 240, 300]; // HSB hue degrees used for dots

// Re-usable palettes
const CAMO_SWATCHES = [ // Camouflage greens/browns palette
  [35, 50, 50],  // Tan
  [90, 60, 45],  // Olive green
  [110, 55, 35], // Dark green
  [25, 65, 35]   // Brown
]; //

const OC_SWATCHES = [ // Orlando City SC (purple/gold/white)
  [275, 80, 95],  // Purple
  [45, 100, 95],  // Gold
  [0, 0, 100]     // White
]; //

const MAGIC_SWATCHES = [ // Orlando Magic (blue/black/silver/white)
  [210, 100, 100], // Bright blue
  [0, 0, 0],       // Black
  [210, 20, 90],   // Silver-ish blue
  [0, 0, 100]      // White
]; //

// Orlando-themed words kept as labels (not rendered now, but stored per boid)
const WORDS = [
  'DTO',  // Downtown Orlando
  'ART',  // Arts scene
  'TECH', // Tech scene
  'ORL',  // Orlando abbreviation
  'UCF',  // University of Central Florida
  'MAGIC',// Orlando Magic
  'EOLA', // Lake Eola
  'LAKE', // Lakes around Orlando
  'LYNX', // LYNX bus system
  'SUN',  // Sunshine State vibe
  '407'   // Area code
]; // Orlando-relevant labels for the swarm

// Words / icons that the swarm will form as big dot shapes
const SHAPES = [
  '407',
  'LOVE',
  'EOLA',
  'DTO',
  'UCF',       // UCF word with black-gold-white palette
  'EPIC',      // Epic Universe nod
  'PRIDE',     // PRIDE word with per-letter colors
  'VALOR',     // Valor with camo scheme
  'VAMOS',     // Vamos (Orlando City)
  'ORLANDO',
  'MAGIC',     // Orlando Magic logo-style icon + palette
  'LAKE',
  'SUNRAIL',
  'MICKEY',    // Mickey three-circle icon
  'UNIVERSAL', // Universal Studios globe icon
  'FLAG',      // USA flag silhouette (auto USA colors)
  'CASTLE',    // Cinderella’s Castle silhouette
  'EPCOT',     // Epcot ball silhouette
  'EYE'        // Orlando Eye wheel silhouette
]; // Sequence of shapes
let currentShapeIndex = 0; // Index in SHAPES for current formation
let currentShapeText = SHAPES[0]; // Currently active word/shape token

// Shape geometry and targets
let buildingCenter; // Center of current shape silhouette
let buildingSize;   // Width/height of current shape silhouette
let buildingSlots = []; // Target positions that make up the current shape
let buildingSlotColors = []; // Per-slot hue overrides (e.g., for PRIDE letters)

// Mode timing: roam vs form shape
let buildingMode = false; // Whether particles are forming the shape now
let prevBuildingMode = false; // Track transitions to reassign targets
const CYCLE_DURATION = 30000; // 30s total per cycle for slower pacing
const ROAM_DURATION = 10000;  // 10s of roaming before forming each word/shape

// Automatic vs manual shape cycling
let autoCycle = true; // If true use time-based cycle, if false arrow keys control shapes

// Noise-based flow parameters (for lightweight "flocking")
const NOISE_SCALE = 0.0008; // Spatial scale of flow field noise
const NOISE_SPEED = 0.0005; // Temporal speed of noise evolution

// Visual palette (rainbow on dark background)
const BG_BRIGHTNESS = 7; // Dark background brightness (HSB)

// Color test mode override: 'auto'|'midnight'|'dawn'|'noon'|'dusk'|'camo'
let colorSchemeOverride = 'auto'; // Default: use real local time-of-day colors

// Help overlay toggle
let showHelp = false; // Whether to draw the legend overlay

// Transition system: random effects between shapes
let transitionMode = 'none'; // 'none'|'fireworks'|'school'|'schoolWide'|'explosion'|'swan'
let transitionStartTime = 0; // When the current transition began
const TRANSITION_DURATION = 5000; // How long a transition lasts (ms)

let fireworkCenters = []; // Burst centers used in fireworks mode
let schoolDirection;      // Global heading used in tight fish-school mode
let schoolDirectionWide;  // Global heading used in wide separated school mode


// =========================== TIME-BASED COLOR SCHEMES =====================
function getSchemeColor(baseHue) { // Compute HSB color based on time-of-day and overrides
  // SPECIAL: USA palette when FLAG shape is active
  if (currentShapeText === 'FLAG') { // Apply USA flag colors when flag shape is active
    let h, s, b;
    if (baseHue <= 60) {
      h = 0;   s = 100; b = 96;   // Red
    } else if (baseHue <= 240) {
      h = 220; s = 100; b = 92;   // Blue
    } else {
      h = 0;   s = 0;   b = 100;  // White
    }
    return [h, s, b];
  }

  // SPECIAL: UCF palette whenever UCF shape is active
  if (currentShapeText === 'UCF') {
    let h, s, b;
    const region = floor(map(baseHue, 0, 360, 0, 3)); // 0,1,2 → black/gold/white
    if (region === 0) { // Black
      h = 0; s = 0; b = 0;
    } else if (region === 1) { // Gold
      h = 45; s = 100; b = 100;
    } else { // White
      h = 0; s = 0; b = 100;
    }
    return [h, s, b];
  }

  // SPECIAL: VALOR → use camo palette
  if (currentShapeText === 'VALOR') {
    const idx = floor(map(baseHue, 0, 360, 0, CAMO_SWATCHES.length)) % CAMO_SWATCHES.length;
    const sw = CAMO_SWATCHES[idx];
    return [sw[0], sw[1], sw[2]];
  }

  // SPECIAL: VAMOS → Orlando City SC palette
  if (currentShapeText === 'VAMOS') {
    const idx = floor(map(baseHue, 0, 360, 0, OC_SWATCHES.length)) % OC_SWATCHES.length;
    const sw = OC_SWATCHES[idx];
    return [sw[0], sw[1], sw[2]];
  }

  // SPECIAL: MAGIC → Orlando Magic palette
  if (currentShapeText === 'MAGIC') {
    const idx = floor(map(baseHue, 0, 360, 0, MAGIC_SWATCHES.length)) % MAGIC_SWATCHES.length;
    const sw = MAGIC_SWATCHES[idx];
    return [sw[0], sw[1], sw[2]];
  }

  // Explicit CAMO override (deterministic, no flicker)
  if (colorSchemeOverride === 'camo') {
    const idx = floor(map(baseHue, 0, 360, 0, CAMO_SWATCHES.length)) % CAMO_SWATCHES.length;
    const sw = CAMO_SWATCHES[idx];
    return [sw[0], sw[1], sw[2]];
  }

  // Time-of-day palettes (or override test modes)
  let hNow;
  if (colorSchemeOverride === 'midnight')      hNow = 0;
  else if (colorSchemeOverride === 'dawn')     hNow = 5;
  else if (colorSchemeOverride === 'noon')     hNow = 12;
  else if (colorSchemeOverride === 'dusk')     hNow = 18;
  else                                         hNow = hour();

  let h = baseHue;
  let s = 100;
  let b = 96;

  if (hNow === 0 || hNow === 1) { // Midnight — cool neon blues/violets
    h = lerp(baseHue, 230, 0.7);
    s = 100;
    b = 92;
  } else if (hNow === 5 || hNow === 6) { // Dawn — warm pastel oranges/pinks
    h = lerp(baseHue, 35, 0.75);
    s = 70;
    b = 98;
  } else if (hNow === 12 || hNow === 13) { // Noon — intense full-spectrum
    h = baseHue;
    s = 100;
    b = 100;
  } else if (hNow === 18 || hNow === 19) { // Dusk — magenta/violet blend
    h = lerp(baseHue, 310, 0.6);
    s = 90;
    b = 88;
  } else {
    h = baseHue;
    s = 90;
    b = 96;
  }

  return [h, s, b];
} //


// ========================= RESPONSIVE SIZE HELPERS ========================
function updateBuildingSize() { // Compute shape bounds based on current window
  const minDim = min(width, height);      // Use smaller dimension for consistent scaling
  const w = minDim * 0.95;               // Let shapes use ~95% of the smaller dimension
  const h = w * 0.55;                    // Slightly taller for detailed icons/logos
  buildingSize.set(w, h);                // Store updated size
} //


// ============================== ICON DRAWERS ==============================
function drawCastleShape(pg, w, h) { // Cinderella-style castle silhouette
  pg.push();
  pg.background(0);
  pg.fill(255);
  pg.noStroke();

  const cx = w * 0.5;
  const baseY = h * 0.82;
  const unit = min(w, h) * 0.09;

  pg.rectMode(CENTER);
  pg.rect(cx, baseY - unit * 1.0, unit * 7.0, unit * 2.0);

  const sideOffset = unit * 3.0;
  for (let side = -1; side <= 1; side += 2) {
    const tx = cx + side * sideOffset;
    pg.rect(tx, baseY - unit * 2.1, unit * 1.6, unit * 3.2);
    pg.triangle(
      tx - unit * 1.0, baseY - unit * 3.7,
      tx + unit * 1.0, baseY - unit * 3.7,
      tx, baseY - unit * 4.9
    );
    pg.rect(tx, baseY - unit * 4.4, unit * 0.9, unit * 1.3);
    pg.triangle(
      tx - unit * 0.7, baseY - unit * 5.0,
      tx + unit * 0.7, baseY - unit * 5.0,
      tx, baseY - unit * 5.9
    );
  }

  pg.rect(cx, baseY - unit * 2.9, unit * 2.3, unit * 4.6);
  pg.triangle(
    cx - unit * 1.5, baseY - unit * 5.0,
    cx + unit * 1.5, baseY - unit * 5.0,
    cx, baseY - unit * 6.8
  );

  pg.rect(cx, baseY - unit * 7.3, unit * 0.55, unit * 1.7);
  pg.triangle(
    cx - unit * 0.5, baseY - unit * 8.0,
    cx + unit * 0.5, baseY - unit * 8.0,
    cx, baseY - unit * 9.1
  );

  const miniOffset = unit * 1.8;
  for (let side = -1; side <= 1; side += 2) {
    const sx = cx + side * miniOffset;
    pg.rect(sx, baseY - unit * 4.8, unit * 0.6, unit * 1.4);
    pg.triangle(
      sx - unit * 0.5, baseY - unit * 5.5,
      sx + unit * 0.5, baseY - unit * 5.5,
      sx, baseY - unit * 6.3
    );
  }

  pg.fill(255);
  pg.quad(
    cx, baseY - unit * 9.1,
    cx + unit * 1.0, baseY - unit * 8.8,
    cx + unit * 0.2, baseY - unit * 8.4,
    cx, baseY - unit * 8.4
  );

  pg.rectMode(CORNER);
  const frontW = unit * 6.0;
  const frontH = unit * 1.6;
  const frontX = cx - frontW / 2;
  const frontY = baseY - frontH;
  pg.rect(frontX, frontY, frontW, frontH);

  const toothW = unit * 0.6;
  const toothH = unit * 0.8;
  const toothCount = 8;
  for (let i = 0; i < toothCount; i++) {
    const bx = frontX + i * (frontW / (toothCount - 1));
    pg.rect(bx - toothW * 0.5, frontY - toothH, toothW, toothH);
  }

  pg.fill(0);
  pg.rectMode(CENTER);
  pg.rect(cx, baseY - unit * 0.8, unit * 1.6, unit * 2.2);

  pg.rect(cx, baseY - unit * 3.3, unit * 0.7, unit * 1.1);
  pg.rect(cx, baseY - unit * 4.3, unit * 0.5, unit * 0.9);

  const sideOffsetLocal = unit * 3.0;
  for (let side = -1; side <= 1; side += 2) {
    const wx = cx + side * sideOffsetLocal;
    pg.rect(wx, baseY - unit * 2.3, unit * 0.4, unit * 0.9);
  }

  pg.pop();
} //


function drawEpcotShape(pg, w, h) { // Epcot ball on a base
  pg.push();
  pg.background(0);
  pg.fill(255);
  pg.stroke(255);
  pg.strokeWeight(2);

  const cx = w * 0.5;
  const cy = h * 0.5;
  const r = min(w, h) * 0.31;

  pg.ellipse(cx, cy, r * 2, r * 2);

  const rings = 6;
  for (let i = 1; i <= rings; i++) {
    const rr = (r * i) / rings;
    pg.noFill();
    pg.ellipse(cx, cy, rr * 2, rr * 2);
  }

  const diagSteps = 24;
  for (let i = 0; i < diagSteps; i++) {
    const ang = (TWO_PI * i) / diagSteps;
    const xOuter = cx + cos(ang) * r;
    const yOuter = cy + sin(ang) * r;
    const xInner = cx + cos(ang + 0.5) * (r * 0.25);
    const yInner = cy + sin(ang + 0.5) * (r * 0.25);
    pg.line(xInner, yInner, xOuter, yOuter);
  }

  pg.noStroke();
  const legYTop = cy + r * 0.6;
  const legYBottom = cy + r * 1.25;

  pg.quad(
    cx - r * 0.6, legYTop,
    cx - r * 0.25, legYTop,
    cx - r * 0.05, legYBottom,
    cx - r * 0.8, legYBottom
  );

  pg.quad(
    cx + r * 0.6, legYTop,
    cx + r * 0.25, legYTop,
    cx + r * 0.8, legYBottom,
    cx + r * 0.05, legYBottom
  );

  const baseW = r * 2.0;
  const baseH = r * 0.35;
  pg.rectMode(CENTER);
  pg.rect(cx, legYBottom + baseH * 0.35, baseW, baseH);

  pg.pop();
} //


function drawEyeShape(pg, w, h) { // Orlando Eye ferris wheel silhouette
  pg.push();
  pg.background(0);
  pg.fill(255);
  pg.stroke(255);
  pg.strokeWeight(3);

  const cx = w * 0.5;
  const cy = h * 0.53;
  const outerR = min(w, h) * 0.33;
  const innerR = outerR * 0.72;

  pg.noFill();
  pg.ellipse(cx, cy, outerR * 2, outerR * 2);

  const numSpokes = 24;
  for (let i = 0; i < numSpokes; i++) {
    const angle = (TWO_PI * i) / numSpokes;
    const xOuter = cx + cos(angle) * outerR;
    const yOuter = cy + sin(angle) * outerR;
    const xInner = cx + cos(angle) * innerR;
    const yInner = cy + sin(angle) * innerR;
    pg.line(xInner, yInner, xOuter, yOuter);
  }

  pg.noStroke();
  const gondolaCount = 24;
  for (let i = 0; i < gondolaCount; i++) {
    const angle = (TWO_PI * i) / gondolaCount;
    const gx = cx + cos(angle) * (outerR + 8);
    const gy = cy + sin(angle) * (outerR + 8);
    const gw = outerR * 0.08;
    const gh = outerR * 0.11;
    pg.rectMode(CENTER);
    pg.rect(gx, gy, gw, gh);
  }

  pg.fill(255);
  pg.ellipse(cx, cy, innerR * 1.3, innerR * 1.3);

  pg.rectMode(CENTER);
  const baseY = cy + outerR * 1.05;
  const baseW = outerR * 1.8;
  const baseH = outerR * 0.24;
  pg.rect(cx, baseY + baseH * 0.45, baseW, baseH);

  pg.triangle(
    cx - outerR * 0.5, baseY,
    cx - outerR * 0.15, baseY,
    cx - outerR * 0.75, baseY + baseH * 1.6
  );

  pg.triangle(
    cx + outerR * 0.5, baseY,
    cx + outerR * 0.15, baseY,
    cx + outerR * 0.75, baseY + baseH * 1.6
  );

  pg.pop();
} //


function drawFlagShape(pg, w, h) { // USA flag silhouette
  pg.push();
  pg.background(0);
  pg.fill(255);
  pg.noStroke();

  const flagH = h * 0.65;
  const flagW = flagH * 1.9;
  const fx = (w - flagW) * 0.5;
  const fy = (h - flagH) * 0.5;

  const stripeCount = 13;
  const stripeH = flagH / stripeCount;

  for (let i = 0; i < stripeCount; i++) {
    if (i % 2 === 0) {
      const sy = fy + i * stripeH;
      pg.rect(fx, sy, flagW, stripeH * 0.9);
    }
  }

  const cantonW = flagW * 0.4;
  const cantonH = stripeH * 7;
  pg.rect(fx, fy, cantonW, cantonH);

  pg.pop();
} //


function drawMickeyShape(pg, w, h) { // Three-circle Mickey silhouette
  pg.push();
  pg.background(0);
  pg.fill(255);
  pg.noStroke();

  const cx = w * 0.5;
  const cy = h * 0.5;
  const headR = min(w, h) * 0.22;
  const earR = headR * 0.55;
  const earOffsetX = headR * 0.9;
  const earOffsetY = headR * 0.85;

  pg.ellipse(cx, cy, headR * 2, headR * 2);
  pg.ellipse(cx - earOffsetX, cy - earOffsetY, earR * 2, earR * 2);
  pg.ellipse(cx + earOffsetX, cy - earOffsetY, earR * 2, earR * 2);

  pg.pop();
} //


function drawUniversalShape(pg, w, h) { // Universal Studios style globe + base
  pg.push();
  pg.background(0);
  pg.fill(255);
  pg.stroke(255);
  pg.strokeWeight(2);

  const cx = w * 0.5;
  const cy = h * 0.45;
  const r = min(w, h) * 0.26;

  pg.ellipse(cx, cy, r * 2, r * 2);

  const latCount = 4;
  for (let i = 1; i <= latCount; i++) {
    const yy = map(i, 0, latCount + 1, cy - r * 0.8, cy + r * 0.8);
    const rx = r * sqrt(1 - sq((yy - cy) / r));
    pg.ellipse(cx, yy, rx * 2, (r * 0.12));
  }

  const longCount = 5;
  for (let i = 0; i < longCount; i++) {
    const ang = map(i, 0, longCount - 1, -PI / 3, PI / 3);
    const x1 = cx + cos(ang) * r;
    const y1 = cy - sin(ang) * r;
    const x2 = cx - cos(ang) * r;
    const y2 = cy + sin(ang) * r;
    pg.line(x1, y1, x2, y2);
  }

  pg.noStroke();
  const baseW = r * 2.4;
  const baseH = r * 0.35;
  const baseY = cy + r * 1.05;
  pg.rectMode(CENTER);
  pg.rect(cx, baseY, baseW, baseH);

  const archH = r * 0.3;
  pg.rect(cx, baseY - archH * 0.9, baseW * 0.7, archH);

  pg.pop();
} //


function drawMagicShape(pg, w, h) { // Simple Orlando Magic-like logo: ball + streaks
  pg.push();
  pg.background(0);
  pg.fill(255);
  pg.stroke(255);
  pg.strokeWeight(3);

  const cx = w * 0.45;
  const cy = h * 0.5;
  const r = min(w, h) * 0.22;

  pg.ellipse(cx, cy, r * 2, r * 2);

  pg.noFill();
  pg.ellipse(cx, cy, r * 1.5, r * 1.5);
  pg.ellipse(cx, cy, r * 1.0, r * 1.0);

  const streakCount = 5;
  for (let i = 0; i < streakCount; i++) {
    const offsetY = map(i, 0, streakCount - 1, -r * 0.6, r * 0.6);
    pg.bezier(
      cx - r * 1.2, cy + offsetY,
      cx - r * 0.4, cy + offsetY * 0.2,
      cx + r * 0.4, cy + offsetY * 0.6,
      cx + r * 1.4, cy + offsetY * 0.4
    );
  }

  pg.noStroke();
  const starX = cx + r * 1.15;
  const starY = cy - r * 0.6;
  const starR = r * 0.25;
  pg.push();
  pg.translate(starX, starY);
  pg.beginShape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const angle = (PI / points) * i;
    const rad = (i % 2 === 0) ? starR : starR * 0.45;
    const sx = cos(angle) * rad;
    const sy = sin(angle) * rad;
    pg.vertex(sx, sy);
  }
  pg.endShape(CLOSE);
  pg.pop();

  pg.pop();
} //


// =============================== SETUP ====================================
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  textAlign(CENTER, CENTER);
  textSize(14);
  noStroke();

  buildingCenter = createVector(width * 0.5, height * 0.5);
  buildingSize = createVector(0, 0);
  updateBuildingSize();

  computeBuildingSlots();

  for (let i = 0; i < NUM_BOIDS; i++) {
    const x = random(width);
    const y = random(height);
    const word = random(WORDS);
    const hueChoice = random(RAINBOW_HUES);
    boids.push(new TextBoid(x, y, word, hueChoice));
  }

  addButton = createButton('+ Dots');
  addButton.position(10, 30);
  addButton.mousePressed(increaseBoids);

  removeButton = createButton('- Dots');
  removeButton.position(90, 30);
  removeButton.mousePressed(decreaseBoids);
} //


// =============================== DRAW LOOP =================================
function draw() {
  background(0, 0, BG_BRIGHTNESS);

  if (autoCycle) {
    const t = millis() % CYCLE_DURATION;
    buildingMode = t > ROAM_DURATION;
  }

  let inTransition = false;
  if (transitionMode !== 'none') {
    const elapsed = millis() - transitionStartTime;
    if (elapsed < TRANSITION_DURATION) {
      inTransition = true;
    } else {
      transitionMode = 'none';
    }
  }

  if (buildingMode !== prevBuildingMode) {
    const leavingShape = (!buildingMode && prevBuildingMode);

    if (buildingMode) {
      if (autoCycle) {
        currentShapeIndex = (currentShapeIndex + 1) % SHAPES.length;
        currentShapeText = SHAPES[currentShapeIndex];
        computeBuildingSlots();
      }
    }

    assignBuildingTargets(buildingMode && !inTransition);

    if (leavingShape && autoCycle) {
      startRandomTransition();
    }

    prevBuildingMode = buildingMode;
  }

  for (let b of boids) {
    if (inTransition) {
      b.applyTransition(transitionMode);
    } else {
      b.flow();
    }
    b.moveToTarget(buildingMode && !inTransition);
    b.update();
    b.edges();
    b.show();
  }

  if (uiVisible) { // Only draw UI when visible - GPT
    drawSchemeLabel(); // Top status line - GPT
    if (showHelp) { // Help only when UI visible - GPT
      drawHelpOverlay(); // Help overlay - GPT
    } // - GPT
  } // - GPT
} //


// ============================ WINDOW RESIZE ===============================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildingCenter.set(width * 0.5, height * 0.5);
  updateBuildingSize();
  computeBuildingSlots();
  assignBuildingTargets(buildingMode && transitionMode === 'none');
} //


// ========================== COLOR SCHEME LABEL ============================
function drawSchemeLabel() {
  push();
  textAlign(LEFT, TOP);
  textSize(14);
  fill(0, 0, 80);

  let label = 'Mode: AUTO';
  if (colorSchemeOverride === 'midnight') label = 'Mode: MIDNIGHT';
  else if (colorSchemeOverride === 'dawn') label = 'Mode: DAWN';
  else if (colorSchemeOverride === 'noon') label = 'Mode: NOON';
  else if (colorSchemeOverride === 'dusk') label = 'Mode: DUSK';
  else if (colorSchemeOverride === 'camo') label = 'Mode: CAMO';

  label += ' | Dots: ' + boids.length;
  label += highDetailMode ? ' | Detail: HIGH' : ' | Detail: STANDARD';

  if (!autoCycle) label += ' | SHAPES: MANUAL';

  label += ' | Shape: ' + currentShapeText;

  if (currentShapeText === 'FLAG') {
    label += ' | FLAG: USA colors';
  } else if (currentShapeText === 'UCF') {
    label += ' | UCF: black–gold–white';
  } else if (currentShapeText === 'VAMOS') {
    label += ' | VAMOS: Orlando City colors';
  } else if (currentShapeText === 'MAGIC') {
    label += ' | MAGIC: team colors';
  } else if (currentShapeText === 'VALOR') {
    label += ' | VALOR: Camouflage';
  } else if (currentShapeText === 'PRIDE') {
    label += ' | PRIDE: per-letter rainbow';
  } else {
    label += ' | Palette: time-of-day rainbow';
  }

  text(label, 10, 10);
  pop();
} //


// =========================== HELP / LEGEND OVERLAY ========================
function drawHelpOverlay() {
  push();
  const panelW = min(width * 0.6, 480);
  const panelH = min(height * 0.6, 320);
  const x = width * 0.5 - panelW * 0.5;
  const y = height * 0.5 - panelH * 0.5;

  rectMode(CORNER);
  noStroke();
  fill(0, 0, 0, 180);
  rect(x, y, panelW, panelH, 16);

  fill(0, 0, 95);
  textAlign(LEFT, TOP);
  textSize(16);

  let lineY = y + 16;
  const marginX = x + 18;
  text('Controls & Color Schemes', marginX, lineY);

  textSize(13);
  lineY += 28;

  const lines = [
    'H – toggle UI (buttons, label, help)',
    'LEFT / RIGHT – cycle shapes manually (auto off)',
    'A – return to AUTO mode (time-of-day colors + auto shapes)',
    '1 – force MIDNIGHT palette',
    '2 – force DAWN palette',
    '3 – force NOON palette',
    '4 – force DUSK palette',
    '6 – force CAMO palette',
    '5 – toggle DETAIL mode (Standard / High)',
    '',
    '+ Dots / - Dots – adjust particle count (100–2500)',
    '',
    'Shape notes:',
    '• FLAG: USA red/white/blue stripes.',
    '• UCF: black–gold–white university colors.',
    '• VAMOS: Orlando City purple/gold/white.',
    '• MAGIC: team palette + logo silhouette.',
    '• VALOR: dedicated camouflage palette.',
    '• PRIDE: each letter is a solid rainbow color.',
    '• EOLA: triggers a swan-like glide transition.',
    '',
    'High detail mode uses a larger internal canvas',
    'and slightly smaller dots for more defined shapes.'
  ];

  for (let line of lines) {
    text(line, marginX, lineY);
    lineY += 18;
  }

  pop();
} //


// ============================== KEY CONTROLS ==============================
function keyPressed() {
  if (keyCode === LEFT_ARROW) {
    autoCycle = false;
    transitionMode = 'none';
    currentShapeIndex = (currentShapeIndex - 1 + SHAPES.length) % SHAPES.length;
    currentShapeText = SHAPES[currentShapeIndex];
    computeBuildingSlots();
    buildingMode = true;
    prevBuildingMode = true;
    assignBuildingTargets(true);
    return;
  }

  if (keyCode === RIGHT_ARROW) {
    autoCycle = false;
    transitionMode = 'none';
    currentShapeIndex = (currentShapeIndex + 1) % SHAPES.length;
    currentShapeText = SHAPES[currentShapeIndex];
    computeBuildingSlots();
    buildingMode = true;
    prevBuildingMode = true;
    assignBuildingTargets(true);
    return;
  }

  if (key === 'h' || key === 'H') {
    uiVisible = !uiVisible; // Toggle overall UI visibility - GPT
    if (!uiVisible) { // When hiding UI, also ensure help is off - GPT
      showHelp = false; // Hide help overlay with UI - GPT
      if (addButton) addButton.style('display', 'none'); // Hide + Dots button - GPT
      if (removeButton) removeButton.style('display', 'none'); // Hide - Dots button - GPT
    } else { // When showing UI, restore buttons - GPT
      if (addButton) addButton.style('display', 'block'); // Show + Dots button - GPT
      if (removeButton) removeButton.style('display', 'block'); // Show - Dots button - GPT
      showHelp = true; // Bring help back on first reveal - GPT
    } // - GPT
    return; // Stop other key handling - GPT
  }

  if (key === 'A' || key === 'a') {
    colorSchemeOverride = 'auto';
    autoCycle = true;
  } else if (key === '1') {
    colorSchemeOverride = 'midnight';
  } else if (key === '2') {
    colorSchemeOverride = 'dawn';
  } else if (key === '3') {
    colorSchemeOverride = 'noon';
  } else if (key === '4') {
    colorSchemeOverride = 'dusk';
  } else if (key === '6') {
    colorSchemeOverride = 'camo';
  } else if (key === '5') {
    highDetailMode = !highDetailMode;        // Toggle high detail mode
    computeBuildingSlots();                  // Rebuild slots at new resolution
    assignBuildingTargets(buildingMode && transitionMode === 'none'); // Refresh targets
  }
} //


// ==================== BUTTON HANDLERS (ADD/REMOVE BOIDS) ==================
function increaseBoids() {
  const step = 100;
  const current = boids.length;
  const target = constrain(current + step, MIN_BOIDS, MAX_BOIDS);
  const toAdd = target - current;
  if (toAdd <= 0) return;

  for (let i = 0; i < toAdd; i++) {
    const x = random(width);
    const y = random(height);
    const word = random(WORDS);
    const hueChoice = random(RAINBOW_HUES);
    boids.push(new TextBoid(x, y, word, hueChoice));
  }

  NUM_BOIDS = target;
  assignBuildingTargets(buildingMode && transitionMode === 'none');
} //


function decreaseBoids() {
  const step = 100;
  const current = boids.length;
  const target = constrain(current - step, MIN_BOIDS, MAX_BOIDS);
  const toRemove = current - target;
  if (toRemove <= 0) return;

  boids.splice(current - toRemove, toRemove);

  NUM_BOIDS = target;
  assignBuildingTargets(buildingMode && transitionMode === 'none');
} //


// ======================== SHAPE TARGET MANAGEMENT =========================
function computeBuildingSlots() {
  buildingSlots = [];
  buildingSlotColors = [];

  // Off-screen buffer size: larger when high-detail mode is ON
  const pgW = highDetailMode ? 1280 : 640;
  const pgH = highDetailMode ? 400  : 200;

  const pg = createGraphics(pgW, pgH);
  pg.pixelDensity(1);

  const iconToken = currentShapeText;
  if (iconToken === 'CASTLE') {
    drawCastleShape(pg, pgW, pgH);
  } else if (iconToken === 'EPCOT') {
    drawEpcotShape(pg, pgW, pgH);
  } else if (iconToken === 'EYE') {
    drawEyeShape(pg, pgW, pgH);
  } else if (iconToken === 'FLAG') {
    drawFlagShape(pg, pgW, pgH);
  } else if (iconToken === 'MICKEY') {
    drawMickeyShape(pg, pgW, pgH);
  } else if (iconToken === 'UNIVERSAL') {
    drawUniversalShape(pg, pgW, pgH);
  } else if (iconToken === 'MAGIC') {
    drawMagicShape(pg, pgW, pgH);
  } else {
    pg.background(0);
    pg.fill(255);
    pg.textAlign(CENTER, CENTER);

    const len = currentShapeText.length;
    const sizeFactor = map(len, 1, 12, 0.9, 0.45, true); // Shrink for longer words
    pg.textSize(pgH * sizeFactor);
    pg.text(currentShapeText, pgW * 0.5, pgH * 0.65);
  }

  pg.loadPixels();

  const basePts = [];
  for (let y = 0; y < pgH; y++) {
    for (let x = 0; x < pgW; x++) {
      const idx = 4 * (y * pgW + x);
      const r = pg.pixels[idx];
      if (r > 128) basePts.push(createVector(x, y));
    }
  }

  if (basePts.length === 0) return;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (let p of basePts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const contentW = max(1, maxX - minX);
  const contentH = max(1, maxY - minY);

  const activeCount = max(NUM_BOIDS, boids.length || 0);
  const nChars = max(1, currentShapeText.length);
  const buckets = [];
  for (let i = 0; i < nChars; i++) buckets.push([]);

  for (let p of basePts) {
    const norm = (p.x - minX) / contentW;
    let idx = floor(norm * nChars);
    idx = constrain(idx, 0, nChars - 1);
    buckets[idx].push(p);
  }

  const targetTotal = min(activeCount, basePts.length);
  const basePer = floor(targetTotal / nChars);
  let remainder = targetTotal - basePer * nChars;

  const isPride = (currentShapeText === 'PRIDE');
  const prideHues = [0, 30, 60, 120, 240]; // R, O, Y, G, B-ish

  let selectedPts = [];
  let selectedColors = [];

  for (let i = 0; i < nChars; i++) {
    const bucket = buckets[i];
    let need = basePer;
    if (remainder > 0) { need += 1; remainder -= 1; }

    if (bucket.length === 0) continue;

    const letterHue = isPride ? prideHues[i % prideHues.length] : null;

    if (bucket.length >= need) {
      const usedLocal = new Set();
      while (usedLocal.size < need) {
        const idx = floor(random(bucket.length));
        if (!usedLocal.has(idx)) {
          usedLocal.add(idx);
          const p = bucket[idx];
          selectedPts.push(p);
          selectedColors.push(letterHue);
        }
      }
    } else {
      for (let p of bucket) {
        selectedPts.push(p);
        selectedColors.push(letterHue);
      }
      let extraNeeded = need - bucket.length;
      while (extraNeeded > 0) {
        const idx = floor(random(bucket.length));
        const src = bucket[idx];
        selectedPts.push(src.copy());
        selectedColors.push(letterHue);
        extraNeeded--;
      }
    }
  }

  while (selectedPts.length < targetTotal) {
    const idx = floor(random(basePts.length));
    const src = basePts[idx];
    selectedPts.push(src.copy());

    if (isPride) {
      const norm = (src.x - minX) / contentW;
      let letterIdx = floor(norm * nChars);
      letterIdx = constrain(letterIdx, 0, nChars - 1);
      selectedColors.push(prideHues[letterIdx % prideHues.length]);
    } else {
      selectedColors.push(null);
    }
  }

  const scaleFactor = min(
    buildingSize.x / contentW,
    buildingSize.y / contentH
  );

  for (let i = 0; i < selectedPts.length; i++) {
    const p = selectedPts[i];
    const hueOverride = selectedColors[i];

    const offsetX = p.x - (minX + contentW * 0.5);
    const offsetY = p.y - (minY + contentH * 0.5);
    const worldX = buildingCenter.x + offsetX * scaleFactor;
    const worldY = buildingCenter.y + offsetY * scaleFactor;

    buildingSlots.push(createVector(worldX, worldY));
    buildingSlotColors.push(hueOverride);
  }
} //


function assignBuildingTargets(enable) {
  if (enable) {
    if (buildingSlots.length === 0) return;

    const indices = [];
    for (let i = 0; i < buildingSlots.length; i++) indices.push(i);
    shuffle(indices, true);

    const usable = indices.length;
    for (let i = 0; i < boids.length; i++) {
      const idx = indices[i % usable];
      boids[i].setTarget(buildingSlots[idx], buildingSlotColors[idx]);
    }
  } else {
    for (let b of boids) b.setTarget(null, null);
  }
} //


// =========================== TRANSITION MANAGEMENT ========================
function startRandomTransition() {
  transitionStartTime = millis();

  let forcedMode = null;
  if (currentShapeText === 'CASTLE') forcedMode = 'fireworks';
  else if (currentShapeText === 'MICKEY') forcedMode = 'school';
  else if (currentShapeText === 'UNIVERSAL') forcedMode = 'schoolWide';
  else if (currentShapeText === 'EPIC') forcedMode = 'explosion';
  else if (currentShapeText === 'EOLA') forcedMode = 'swan';

  if (forcedMode) {
    transitionMode = forcedMode;
  } else {
    const modes = ['none', 'fireworks', 'school', 'schoolWide', 'explosion', 'swan'];
    transitionMode = random(modes);
  }

  fireworkCenters = [];
  schoolDirection = null;
  schoolDirectionWide = null;

  if (transitionMode === 'fireworks') {
    const numCenters = 4;
    for (let i = 0; i < numCenters; i++) {
      const cx = random(width * 0.2, width * 0.8);
      const cy = random(height * 0.2, height * 0.8);
      const t0 = transitionStartTime + i * (TRANSITION_DURATION / numCenters);
      fireworkCenters.push({ pos: createVector(cx, cy), start: t0 });
    }
  } else if (transitionMode === 'school') {
    const angle = random(-PI / 6, PI / 6);
    schoolDirection = p5.Vector.fromAngle(angle).normalize();
  } else if (transitionMode === 'schoolWide') {
    const angle = random(-PI / 4, PI / 4);
    schoolDirectionWide = p5.Vector.fromAngle(angle).normalize();
  } else if (transitionMode === 'explosion') {
    for (let b of boids) {
      const dir = p5.Vector.sub(b.pos, buildingCenter);
      if (dir.mag() < 10) dir.set(random(-1, 1), random(-1, 1));
      b.vel = dir.normalize().mult(random(4, 7));
    }
  }
} //


// =============================== TEXT BOID ================================
class TextBoid {
  constructor(x, y, word, hue) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.4, 1.2));
    this.acc = createVector(0, 0);

    this.maxSpeed = 2.0;
    this.maxForce = 0.04;
    this.targetForce = 0.07;

    this.word = word;
    this.hue = hue;
    this.target = null;
    this.targetHue = null;

    this.baseSize = 11;
  } //

  applyForce(f) {
    this.acc.add(f);
  } //

  setTarget(targetVec, targetHue) {
    this.target = targetVec ? targetVec.copy() : null;
    this.targetHue = (targetVec && targetHue != null) ? targetHue : null;
  } //

  flow() {
    const nx = this.pos.x * NOISE_SCALE;
    const ny = this.pos.y * NOISE_SCALE;
    const nz = frameCount * NOISE_SPEED;

    const angle = noise(nx, ny, nz) * TWO_PI * 2.0;
    const desired = p5.Vector.fromAngle(angle).mult(this.maxSpeed);
    const steer = p5.Vector.sub(desired, this.vel);
    steer.limit(this.maxForce);
    this.applyForce(steer);
  } //

  applyTransition(mode) {
    if (mode === 'fireworks') {
      const now = millis();
      const burstRadius = 130;
      const impulseStrength = 0.28;
      for (let c of fireworkCenters) {
        const dt = now - c.start;
        if (dt < 0 || dt > 900) continue;
        const toBoid = p5.Vector.sub(this.pos, c.pos);
        const d = toBoid.mag();
        if (d < burstRadius && d > 2) {
          toBoid.normalize().mult(impulseStrength * (1 - d / burstRadius));
          this.applyForce(toBoid);
        }
      }
      this.flow();

    } else if (mode === 'school' && schoolDirection) {
      const desired = p5.Vector.mult(schoolDirection, this.maxSpeed * 0.9);
      const steer = p5.Vector.sub(desired, this.vel);
      steer.limit(this.maxForce * 1.6);
      this.applyForce(steer);
      const wobble = sin(frameCount * 0.06 + this.pos.x * 0.01) * 0.06;
      this.applyForce(createVector(0, wobble));

    } else if (mode === 'schoolWide' && schoolDirectionWide) {
      const desired = p5.Vector.mult(schoolDirectionWide, this.maxSpeed * 0.9);
      const steerAlign = p5.Vector.sub(desired, this.vel);
      steerAlign.limit(this.maxForce * 1.3);
      this.applyForce(steerAlign);

      const desiredSpacing = 40;
      const separation = createVector(0, 0);
      let count = 0;

      for (let other of boids) {
        if (other === this) continue;
        const d = p5.Vector.dist(this.pos, other.pos);
        if (d > 0 && d < desiredSpacing) {
          const diff = p5.Vector.sub(this.pos, other.pos);
          diff.normalize().div(d);
          separation.add(diff);
          count++;
        }
      }

      if (count > 0) {
        separation.div(count);
        separation.setMag(this.maxSpeed);
        const steerSep = p5.Vector.sub(separation, this.vel);
        steerSep.limit(this.maxForce * 1.9);
        this.applyForce(steerSep);
      }

      const wobble = sin(frameCount * 0.04 + this.pos.y * 0.008) * 0.05;
      this.applyForce(createVector(0, wobble));

    } else if (mode === 'explosion') {
      this.flow();

    } else if (mode === 'swan') {
      const toCenter = p5.Vector.sub(buildingCenter, this.pos);
      const dist = toCenter.mag();
      if (dist > 0) {
        const orbit = createVector(-toCenter.y, toCenter.x).normalize();
        const desired = orbit.mult(this.maxSpeed * 0.6);
        const steerOrbit = p5.Vector.sub(desired, this.vel);
        steerOrbit.limit(this.maxForce * 1.5);
        this.applyForce(steerOrbit);

        const centerStrength = map(dist, 0, max(width, height), 0.06, 0.02);
        const steerCenter = toCenter.normalize().mult(centerStrength);
        this.applyForce(steerCenter);

        const bob = sin(frameCount * 0.05 + this.pos.x * 0.01) * 0.03;
        this.applyForce(createVector(0, bob));
      }

    } else {
      this.flow();
    }
  } //

  moveToTarget(enabled) {
    if (!enabled || !this.target) return;

    const desired = p5.Vector.sub(this.target, this.pos);
    const d = desired.mag();
    if (d < 3) return;

    let speed = this.maxSpeed * 0.9;
    if (d < 80) speed = map(d, 0, 80, this.maxSpeed * 0.2, this.maxSpeed * 0.9);

    desired.setMag(speed);
    const steer = p5.Vector.sub(desired, this.vel);
    steer.limit(this.targetForce);
    this.applyForce(steer);
  } //

  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
  } //

  edges() {
    const margin = 40;
    if (this.pos.x < -margin) this.pos.x = width + margin;
    if (this.pos.x > width + margin) this.pos.x = -margin;
    if (this.pos.y < -margin) this.pos.y = height + margin;
    if (this.pos.y > height + margin) this.pos.y = -margin;
  } //

  show() {
    const speedFactor = map(this.vel.mag(), 0, this.maxSpeed, 0.8, 1.4);
    const baseDotSize = highDetailMode ? 9 : 11;
    const size = baseDotSize * speedFactor;

    const baseHue = (this.targetHue != null) ? this.targetHue : this.hue;
    const scheme = getSchemeColor(baseHue); // Ensure scheme array exists - GPT
    const h = scheme[0]; // Hue from scheme - GPT
    const s = scheme[1]; // Saturation from scheme - GPT
    const bBase = scheme[2]; // Brightness base from scheme - GPT

    const flicker = bBase + 6 * sin(frameCount * 0.05 + baseHue * 0.01);
    const finalB = constrain(flicker, 0, 100);

    push();
    translate(this.pos.x, this.pos.y);
    noStroke();
    ellipseMode(CENTER);
    fill(h, s, finalB);
    ellipse(0, 0, size, size);
    pop();
  } //
} //
