// Sections
//   1. Settings              6. Card artwork
//   2. State                 7. Jester
//   3. p5 template           8. People (posed mannequins)
//   4. Dealing a year        9. Saving an image
//   5. Trophy geometry      10. AR mode (camera, touch, hand tracking)
//                           11. Interface

//=============
// 1. SETTINGS
//=============

// The deck: 4 suits x 13 ranks.
const SUIT_COUNT = 4;
const RANK_NAMES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const JACK = 10, QUEEN = 11, KING = 12;
const WEEK_COUNT = SUIT_COUNT * RANK_NAMES.length;  // one card per week

// The four feelings a week can be dealt: colour on the card, deep shade for the artwork
const FEELINGS = [
  { name: 'JOY', meaning: 'a good week', color: [245, 197, 40], deep: [196, 140, 10] },
  { name: 'SADNESS', meaning: 'a heavy week', color: [74, 128, 214], deep: [38, 78, 158] },
  { name: 'ANGER', meaning: 'a frustrating week', color: [216, 62, 46], deep: [168, 36, 26] },
  { name: 'FEAR', meaning: 'an anxious week', color: [142, 98, 198], deep: [96, 58, 150] },
];
const JOY = 0, SADNESS = 1, ANGER = 2, FEAR = 3;   // a card's `mood` is an index into FEELINGS
const IVORY = [244, 238, 224];

// The trophy (world units; 1 unit = 10 cm when printed): identical parallelogram cards
// wound in a helix around an hourglass column
const CARDS_PER_TURN = 13;                         // one season of weeks per turn
const TURN_COUNT = 4;                              // four seasons
const ANGLE_PER_CARD = Math.PI * 2 / CARDS_PER_TURN;
const ROW_HEIGHT = 0.46;                           // the height of every card
const HELIX_HEIGHT = (TURN_COUNT + 1) * ROW_HEIGHT;  // the helix climbs one extra card over the year
const WAIST_RADIUS = 0.40;                         // the hourglass: narrowest at the waist
const WAIST_HEIGHT = 1.10;
const WAIST_CURVE = 1.0;                           // how quickly it flares toward the ends
const TWIST = 0.42;                                // the column turns slightly as it rises
const CARD_SHEAR = -1;                             // a card's sides lean one card width over its height;
// negative = against the helix's climb (the foundation relies on it)
const CARD_TILT = 0.04;                            // how far each card's right edge stands out (the ridge)
const CARD_SEAM = 0.006;                           // the fine gap around every card
const CORE_INSET = 0.006;                          // the dark core sits just behind the cards
const CARD_MIN_THICKNESS = 0.016;                  // an Ace
const CARD_EXTRA_THICKNESS = 0.064;                // added from Ace up to King
const FOUNDATION_DEPTH = 0.035;                    // the stone foundation under the first turn
const FOUNDATION_TITLE_SIZE = 0.035;               // the engraved title's capital letters (3.5 mm)
const FOUNDATION_ENGRAVE_DEPTH = 0.008;            // cut 0.8 mm deep so it prints
const DOME_EDGE_HEIGHT = TURN_COUNT * ROW_HEIGHT;  // the mound sits level, at the lowest point of the rim
const DOME_PEAK_HEIGHT = DOME_EDGE_HEIGHT + 0.2;   // the top of the mound
const JESTER_HILL_HEIGHT = 0.1;                    // a rock hill that grips the jester's foot
const JESTER_HILL_RADIUS = 0.11;

// Rough stone: the base and the dome are rocky ground for the crowd to clamber over
const BASE_ROCK_HEIGHT = 0.12;                     // up to 12 mm of rock on the base
const DOME_ROCK_HEIGHT = 0.12;                     // and on the jester's mound
const FOUNDATION_ROUGHNESS = 0.004;                // the incline is the same stone, only flatter
const STONE_COLOR = [104, 92, 80];
const STONE_GRIT = 0.005;                          // fine bumps (±0.25 mm) modelled into the surface
const STONE_CRACK_DEPTH = 0.006;                   // cracks cut 0.6 mm deep, so they print
const ROCK_EMBED = 0.03;                           // how far a body may sink into the rock (3 mm)
const BASE_RADIUS = columnRadius(0) + 0.2;         // a 2 cm border around the column
const BASE_HEIGHT = 0.08;
const ENGRAVE_DEPTH = 0.015;                       // lettering cut into the underside
const JESTER_SCALE = 1.3;

// The studio view: how far the camera looks down, and how high the statue sits on screen
const STUDIO_TILT = -0.2;
const STUDIO_LIFT = 1.75;

// The engraving under the base: this year is one of 52! possible orders of the deck
const UNDERSIDE_TEXT = '1 OUT OF 52!';
const LETTERING_FONT = "'DIN Condensed', 'Bahnschrift', 'Avenir Next Condensed', 'Arial Narrow', sans-serif";


//=============
// 2. STATE
//=============

var mainCanvas;
var viewScale;                                     // pixels per world unit
var autoSpin = 0;                                  // slow turntable rotation in the studio view
var studioView = { tilt: STUDIO_TILT, lift: STUDIO_LIFT, underside: false };

var yearsDealt = 0;                                // counts shuffles, so each year's shapes get new names
var weekTiles = [];                                // 52 { card, front, walls }

var baseGeometry, baseTexture;
var foundationGeometry, foundationTexture;
var coreGeometry, domeGeometry, baseRockGeometry;
var domeEdgeRadius = 0;                            // where the dome's level edge meets the column
var crowdGeometry;                                 // people that stay the same every year
var yearCrowdGeometry;                             // people dealt again with every year

var jesterModel = null;
var jesterBaseY = 0;                               // where the jester stands (world y)
var jesterToe = { x: 0, z: 0 };                    // the point where he touches the dome


//===============
// 3. P5 TEMPLATE
//===============

function preload() {
  jesterModel = loadModel('assets/jester.stl', false, () => { }, () => { jesterModel = null; });
  loadMannequinPoses();
}

function setup() {
  loadHandModel();
  mainCanvas = createCanvas(windowWidth, windowHeight, WEBGL);
  setAttributes('antialias', true);
  mainCanvas.style('position', 'relative');
  mainCanvas.style('z-index', '1');
  document.title = 'Pillar of Weeks';
  viewScale = fitScale();

  randomSeed(52);                                  // the fixed parts are the same every visit
  noiseSeed(52);
  const edge = columnPoint(0, DOME_EDGE_HEIGHT, -CORE_INSET);
  domeEdgeRadius = Math.hypot(edge.x, edge.z);
  coreGeometry = makeCore();
  foundationGeometry = makeFoundation();
  baseGeometry = makeBase(makeEngraving());
  baseRockGeometry = makeBaseRock();
  seatJester();                                    // first, so the dome's hill can rise round his foot
  domeGeometry = makeDome();
  prepareMannequinPoses();
  crowdGeometry = makeStaticCrowd();

  buildInterface();
  watchDeviceOrientation();
  dealNewYear();
}

function draw() {
  if (arView.on) {
    clear();                                       // the camera image shows through
    camera();
    updateHandControl();
    applyArPlacement();
  } else {
    background(18, 17, 21);
    orbitControl(1, 1, 0.15);
  }

  ambientLight(70, 68, 74);
  directionalLight(255, 238, 215, 0.45, 0.75, -0.55);
  directionalLight(115, 130, 170, -0.7, 0.15, 0.7);
  directionalLight(120, 110, 96, 0, -1, 0.2);
  pointLight(255, 225, 180, 0, -3.6 * viewScale, 2.2 * viewScale);

  if (arView.on) {
    rotateY(arView.yaw);
    scale(viewScale * arView.scale);
    translate(0, -BASE_HEIGHT, 0);
  } else {
    // the U key turns the statue over to read the engraving underneath
    studioView.tilt = lerp(studioView.tilt, studioView.underside ? HALF_PI - 0.12 : STUDIO_TILT, 0.08);
    studioView.lift = lerp(studioView.lift, studioView.underside ? 0.3 : STUDIO_LIFT, 0.08);
    if (studioView.underside) autoSpin = lerp(autoSpin, Math.round(autoSpin / TWO_PI) * TWO_PI, 0.08);
    else if (!mouseIsPressed) autoSpin += 0.0018;
    rotateX(studioView.tilt);
    rotateY(autoSpin);
    scale(viewScale);
    translate(0, studioView.lift, 0);
  }
  noStroke();
  drawStatue();
  if (arView.on) drawHandMarkers();
}

function drawStatue() {
  if (arView.on) {                                 // a soft contact shadow on the real floor
    push();
    translate(0, BASE_HEIGHT + 0.004, 0);
    rotateX(HALF_PI);
    fill(0, 0, 0, 70);
    ellipse(0, 0, BASE_RADIUS * 2.7, BASE_RADIUS * 2.7, 48);
    pop();
  }

  push();
  texture(baseTexture);
  specularMaterial(70); shininess(16);
  model(baseGeometry);
  fill(...STONE_COLOR);                            // the stone's texture is real relief, lit by the scene
  specularMaterial(40); shininess(8);
  model(baseRockGeometry);
  model(domeGeometry);
  pop();

  push();
  fill(34, 33, 40); specularMaterial(120); shininess(30);
  model(coreGeometry);
  pop();

  push();
  texture(foundationTexture);                      // the same stone as the base, with the title
  specularMaterial(60); shininess(14);
  model(foundationGeometry);
  pop();

  for (const tile of weekTiles) {
    push();
    fill(...FEELINGS[tile.card.mood].color);       // the edge matches the card's symbols
    specularMaterial(140); shininess(30);
    model(tile.walls);
    texture(tile.card.texture);
    specularMaterial(tile.card.rank >= JACK ? 200 : 140); shininess(30);
    model(tile.front);
    pop();
  }

  push();
  fill(236, 232, 224); specularMaterial(70); shininess(14);
  model(crowdGeometry);
  model(yearCrowdGeometry);
  pop();

  if (jesterModel) {
    push();
    translate(0, jesterBaseY, 0);
    fill(205, 165, 70); specularMaterial(255, 225, 150); shininess(45);
    rotateY(PI);
    rotateX(HALF_PI);                              // the STL is Z-up
    scale(JESTER_SCALE);
    model(jesterModel);
    pop();
  }
}

// How large the statue is drawn for this window
function fitScale() { return min(windowHeight / 5.6, windowWidth / 3.4); }

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  viewScale = fitScale();
}

function keyPressed() {
  if (key === 's' || key === 'S') saveImage();
  if (key === ' ') dealNewYear();
  if ((key === 'u' || key === 'U') && !arView.on) studioView.underside = !studioView.underside;
}


//===============
// 4. DEALING A YEAR
//===============

// Shuffle a real deck, deal a feeling to every week, build one tile per week,
// then deal the people who climb this particular year
function dealNewYear() {
  yearsDealt++;
  randomSeed(Math.random() * 1e9);                 // a fresh, unrepeatable shuffle every time

  const deck = [];
  for (var suit = 0; suit < SUIT_COUNT; suit++)
    for (var rank = 0; rank < RANK_NAMES.length; rank++) deck.push({ suit, rank });
  fisherYatesShuffle(deck);

  for (const tile of weekTiles) {
    freeGeometry(tile.front);
    freeGeometry(tile.walls);
    freeCardTexture(tile.card.texture);
  }
  weekTiles = deck.map((dealt, week) => {
    const card = {
      rank: dealt.rank,
      mood: floor(random(FEELINGS.length)),       // the feeling of this week
      thickness: CARD_MIN_THICKNESS + CARD_EXTRA_THICKNESS * dealt.rank / KING,
    };
    card.texture = makeCardTexture(card);
    return { card, ...buildWeekTile(card, week) };
  });

  if (yearCrowdGeometry) freeGeometry(yearCrowdGeometry);
  yearCrowdGeometry = makeYearCrowd();
}

function fisherYatesShuffle(list) {
  for (var i = list.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}


//===============
// 5. TROPHY GEOMETRY
//===============

// Heights are measured upward from the top of the base; p5's y axis points down, so a
// height h is drawn at y = -h. Angles go around the column.

// The hourglass: its radius and how steeply that radius changes at each height
function columnRadius(height) { return WAIST_RADIUS * Math.sqrt(1 + ((height - WAIST_HEIGHT) / WAIST_CURVE) ** 2); }
function columnSlope(height) { return WAIST_RADIUS ** 2 * (height - WAIST_HEIGHT) / (WAIST_CURVE ** 2 * columnRadius(height)); }
function twistAt(height) { return TWIST * height / HELIX_HEIGHT; }

// A point on the column at an angle and height, pushed out along the surface by `offset`
function columnNormal(angle, height) {
  const turned = angle + twistAt(height);
  return createVector(cos(turned), columnSlope(height), sin(turned)).normalize();
}
function columnPoint(angle, height, offset) {
  const turned = angle + twistAt(height), r = columnRadius(height);
  return createVector(r * cos(turned), -height, r * sin(turned)).add(columnNormal(angle, height).mult(offset));
}

// --- The helix of cards ---
// The 52 cards lie side by side on one long band wound four times around the column.
// `bandAngle` keeps growing past 2π along the band; every full turn rises one card height,
// and `v` (0..1) is how far up the band a point is.
function bandHeight(bandAngle, v) { return ROW_HEIGHT * (bandAngle / TWO_PI + v); }

// Each card is a parallelogram on the band: its sides lean by CARD_SHEAR card widths over
// its height, so the edges of all 52 cards join into continuous diagonal ridges.
function cardAngle(index, u, v) { return (index + u + CARD_SHEAR * v) * ANGLE_PER_CARD; }

// The reverse: which card covers a point of the column, and where on that card (u, v)
function cardCoordinates(angle, height) {
  const turnsAlong = height / ROW_HEIGHT - angle / TWO_PI;
  const turn = Math.floor(turnsAlong), v = turnsAlong - turn;
  const along = (angle + TWO_PI * turn) / ANGLE_PER_CARD - CARD_SHEAR * v;
  const index = Math.floor(along);
  return { index, u: along - index, v };
}

// The foundation fills the incline below the first turn of cards, and the rim is the top of
// the last turn.
const LEAN_ANGLE = Math.abs(CARD_SHEAR) * ANGLE_PER_CARD;

function foundationTop(angle) {
  const alongBand = ROW_HEIGHT * angle / TWO_PI;
  const alongFirstCardEdge = ROW_HEIGHT * (TWO_PI - angle) * (1 / LEAN_ANGLE - 1 / TWO_PI);
  return Math.min(alongBand, alongFirstCardEdge);
}
function rimHeight(angle) { return TURN_COUNT * ROW_HEIGHT + foundationTop(angle); }

// Where a point (u across, v up, both 0..1) of week `index` sits. Every card's face is flat
// and tilted outward toward its right edge by the same amount: that raised edge is the ridge.
function tileLayout(card, index) {
  const thicknessAt = u => 0.5 * card.thickness + CARD_TILT * u;
  const pointAt = (u, v, offset) => {
    const angle = cardAngle(index, u, v);
    return columnPoint(angle, bandHeight(angle, v), offset);
  };
  return { thicknessAt, pointAt };
}

// One week = a sharp parallelogram card with a printed front, coloured edges
function buildWeekTile(card, index) {
  const { thicknessAt, pointAt } = tileLayout(card, index);
  const outline = cardOutline(CARD_SEAM, 8);
  const pointCount = outline.length, RINGS = 4;

  // a fan of rings from the card's centre to its outline, at the given depth
  const makeFace = depthAt => new p5.Geometry(1, 1, function () {
    this.vertices.push(pointAt(0.5, 0.5, depthAt(0.5)));
    this.uvs.push(0.5, 0.5);
    for (var ring = 1; ring <= RINGS; ring++)
      for (const [ou, ov] of outline) {
        const u = 0.5 + (ou - 0.5) * ring / RINGS, v = 0.5 + (ov - 0.5) * ring / RINGS;
        this.vertices.push(pointAt(u, v, depthAt(u)));
        this.uvs.push(1 - u, 1 - v);
      }
    const id = (ring, m) => 1 + (ring - 1) * pointCount + (m % pointCount);
    const triangle = (a, b, c) => this.faces.push([a, b, c]);
    for (var m = 0; m < pointCount; m++) {
      triangle(0, id(1, m), id(1, m + 1));
      for (var ring2 = 2; ring2 <= RINGS; ring2++) {
        triangle(id(ring2 - 1, m), id(ring2, m), id(ring2, m + 1));
        triangle(id(ring2 - 1, m), id(ring2, m + 1), id(ring2 - 1, m + 1));
      }
    }
    this.computeNormals();
  });

  const front = makeFace(thicknessAt);
  front.gid = `week-front-${yearsDealt}-${index}`;

  const walls = new p5.Geometry(1, 1, function () {
    for (const [u, v] of outline) {
      this.vertices.push(pointAt(u, v, thicknessAt(u)), pointAt(u, v, -0.004));
      this.uvs.push(0, 0, 0, 1);
    }
    for (var m = 0; m < pointCount; m++) {
      const top = 2 * m, next = 2 * ((m + 1) % pointCount);
      this.faces.push([top, top + 1, next], [next, top + 1, next + 1]);
    }
    this.computeNormals();
  });
  walls.gid = `week-walls-${yearsDealt}-${index}`;

  return { front, walls };
}

// The card's sharp outline in card space (0..1), inset so neighbours leave a fine seam,
// with `perEdge` points along each edge so it bends with the column
function cardOutline(inset, perEdge) {
  const corners = [[1 - inset, 1 - inset], [inset, 1 - inset], [inset, inset], [1 - inset, inset]];
  const points = [];
  for (var c = 0; c < 4; c++) {
    const [u0, v0] = corners[c], [u1, v1] = corners[(c + 1) % 4];
    for (var step = 0; step < perEdge; step++) points.push([lerp(u0, u1, step / perEdge), lerp(v0, v1, step / perEdge)]);
  }
  return points;
}

// The dark column behind the cards, seen through the seams, up to the rim
function makeCore() {
  const geometry = new p5.Geometry(78, 32, function () {
    for (var j = 0; j <= this.detailY; j++)
      for (var i = 0; i <= this.detailX; i++) {
        const angle = TWO_PI * i / this.detailX;
        this.vertices.push(columnPoint(angle, rimHeight(angle) * j / this.detailY, -CORE_INSET));
        this.uvs.push(i / this.detailX, j / this.detailY);
      }
    addGridFaces(this, this.detailX, this.detailY);
    this.computeNormals();
  });
  geometry.gid = 'pillar-core';
  return geometry;
}

// --- Stone ---
// Layered noise: broad mounds, smaller lumps, and grit (about 0..1)
function rockNoise(x, z) {
  const mounds = noise(x * 6.5 + 11, z * 6.5 + 7);
  const lumps = noise(x * 16 + 3, z * 16 + 19);
  const grit = noise(x * 40 + 5, z * 40 + 2);
  const outcrops = Math.pow(smoothStep(0.25, 0.7, mounds), 1.2);     // sharp-shouldered boulders
  return (outcrops * 1.3 + 0.3 * lumps * mounds + 0.08 * grit) / 1.5;
}

function smoothStep(edge0, edge1, x) {
  const t = constrain((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// The rock on the base: piled highest against the column, easing down to a clean rim.
// Figures are placed on the broad shape; the printed surface adds the fine stone detail.
function baseRockHeight(x, z) {
  const across = constrain((Math.hypot(x, z) - columnRadius(0)) / (BASE_RADIUS - columnRadius(0)), 0, 1);
  const pile = 0.45 + 0.55 * (1 - across), rim = 1 - smoothStep(0.8, 0.97, across);
  return 0.001 + BASE_ROCK_HEIGHT * pile * rim * rockNoise(x, z);
}
function baseRockSurface(x, z) {
  const across = constrain((Math.hypot(x, z) - columnRadius(0)) / (BASE_RADIUS - columnRadius(0)), 0, 1);
  return Math.max(0.0005, baseRockHeight(x, z) + stoneDetail(x, z) * (1 - smoothStep(0.85, 0.97, across)));
}

// The stone's surface texture, modelled as relief (world units): fine grit, and cracks cut
// in as grooves. (u, v) is a position across the surface.
function stoneDetail(u, v) {
  const grit = (noise(u * 55 + 7, v * 55 + 3) - 0.5) * 2 * STONE_GRIT;
  const crackLine = Math.abs(noise(u * 9 + 40, v * 9 + 40) - 0.5);
  const crack = crackLine < 0.04 ? -STONE_CRACK_DEPTH * smoothStep(0.04, 0, crackLine) : 0;
  return grit + crack;
}

// The rocky ground on top of the base, from inside the column out to the rim
function makeBaseRock() {
  const RINGS = 64, SEGMENTS = 960, inner = columnRadius(0) - 0.02;   // about 4 mm apart, fine enough for the cracks
  const geometry = new p5.Geometry(SEGMENTS, RINGS, function () {
    for (var j = 0; j <= RINGS; j++)
      for (var i = 0; i <= SEGMENTS; i++) {
        const r = lerp(inner, BASE_RADIUS, j / RINGS), angle = TWO_PI * i / SEGMENTS;
        const x = r * cos(angle), z = r * sin(angle);
        this.vertices.push(createVector(x, -baseRockSurface(x, z), z));
        this.uvs.push(0, 0);
      }
    addGridFaces(this, SEGMENTS, RINGS);
    this.computeNormals();
  });
  geometry.gid = 'pillar-base-rock';
  return geometry;
}

// --- The foundation ---
// The incline under the first turn: the base's stone, nearly smooth, with the title cut into
// its tallest side.
const TITLE_CENTRE_ANGLE = 9.6 * ANGLE_PER_CARD;   // where the incline is tall enough
const TITLE_CENTRE_HEIGHT = 0.225;                 // above the heads of the crowd
const TITLE_AREA_WIDTH = 0.62, TITLE_AREA_HEIGHT = 0.08;  // world units around the title
const TITLE_PIXELS_PER_UNIT = 2600;                // the engraving's depth map
const FOUNDATION_PIXELS_PER_UNIT = 1300;           // the stone texture of the whole incline

// "PILLAR of WEEKS" in the interface's lettering, centred on (x, y)
function drawFoundationTitle(ctx, x0, y, pixelsPerUnit, color) {
  const capPixels = FOUNDATION_TITLE_SIZE * pixelsPerUnit;
  const fontPixels = capPixels / 0.72, ofPixels = fontPixels * 0.62;
  const titleFont = `bold ${fontPixels}px ${LETTERING_FONT}`, ofFont = `italic ${ofPixels}px 'Times New Roman', Times, serif`;
  ctx.font = titleFont;
  const pillarWidth = ctx.measureText('PILLAR').width, weeksWidth = ctx.measureText('WEEKS').width;
  ctx.font = ofFont;
  const ofWidth = ctx.measureText('of').width;
  const gapBefore = 0.22 * ofPixels, gapAfter = 0.62 * ofPixels;
  var x = x0 - (pillarWidth + gapBefore + ofWidth + gapAfter + weeksWidth) / 2;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = titleFont; ctx.fillText('PILLAR', x, y); x += pillarWidth + gapBefore;
  ctx.font = ofFont; ctx.fillText('of', x, y - fontPixels * 0.05); x += ofWidth + gapAfter;
  ctx.font = titleFont; ctx.fillText('WEEKS', x, y);
}

function makeFoundation() {
  // the depth map of the title, at high resolution so the letters are cut cleanly
  const W = Math.round(TITLE_AREA_WIDTH * TITLE_PIXELS_PER_UNIT), H = Math.round(TITLE_AREA_HEIGHT * TITLE_PIXELS_PER_UNIT);
  const mask = createGraphics(W, H);
  mask.pixelDensity(1);
  mask.background(0);
  drawFoundationTitle(mask.drawingContext, W / 2, H / 2, TITLE_PIXELS_PER_UNIT, '#fff');
  mask.loadPixels();
  const titleDepth = new Float32Array(W * H);
  for (var p = 0; p < W * H; p++) titleDepth[p] = mask.pixels[4 * p] / 255;
  mask.remove();

  // the title area, measured around the outside of the foundation
  const radius = columnRadius(TITLE_CENTRE_HEIGHT) + FOUNDATION_DEPTH;
  const angleSpan = TITLE_AREA_WIDTH / radius;
  const angle0 = TITLE_CENTRE_ANGLE - angleSpan / 2, angle1 = TITLE_CENTRE_ANGLE + angleSpan / 2;
  const height0 = TITLE_CENTRE_HEIGHT - TITLE_AREA_HEIGHT / 2, height1 = TITLE_CENTRE_HEIGHT + TITLE_AREA_HEIGHT / 2;
  // position (0..1) in the title's depth map; read from the right so it faces outward
  const titleUV = (angle, height) => [constrain((angle1 - angle) / (angle1 - angle0), 0, 1), constrain((height1 - height) / (height1 - height0), 0, 1)];

  // the incline's colour, with the title in gold where it is cut
  var tallest = 0;
  for (var t = 0; t <= 200; t++) tallest = Math.max(tallest, foundationTop(TWO_PI * t / 200));
  const textureW = Math.round(TWO_PI * radius * FOUNDATION_PIXELS_PER_UNIT), textureH = Math.round(tallest * FOUNDATION_PIXELS_PER_UNIT);
  foundationTexture = createGraphics(textureW, textureH);
  foundationTexture.pixelDensity(1);
  foundationTexture.background(...STONE_COLOR);
  const surfaceUV = (angle, height) => [1 - angle / TWO_PI, 1 - height / tallest];
  const [titleU, titleV] = surfaceUV(TITLE_CENTRE_ANGLE, TITLE_CENTRE_HEIGHT);
  drawFoundationTitle(foundationTexture.drawingContext, titleU * textureW, titleV * textureH, FOUNDATION_PIXELS_PER_UNIT, 'rgb(212, 172, 78)');
  const titleDepthAt = (angle, height) => {
    const [u, v] = titleUV(angle, height), x = u * (W - 1), y = v * (H - 1);
    const i = floor(x), j = floor(y), fx = x - i, fy = y - j;
    const at = (a, b) => titleDepth[constrain(b, 0, H - 1) * W + constrain(a, 0, W - 1)];
    return lerp(lerp(at(i, j), at(i + 1, j), fx), lerp(at(i, j + 1), at(i + 1, j + 1), fx), fy);
  };

  // a grid fine enough for the stone relief (4 mm) and finer across the title (2.5 mm)
  const angles = [], heights = [];
  const addSteps = (list, from, to, step) => { for (var x = from; x < to; x += step) list.push(x); };
  addSteps(angles, 0, angle0, 0.004 / radius);
  addSteps(angles, angle0, angle1, 0.0025 / radius);
  addSteps(angles, angle1, TWO_PI, 0.004 / radius);
  angles.push(TWO_PI);
  addSteps(heights, 0, height0, 0.004);
  addSteps(heights, height0, height1, 0.002);
  addSteps(heights, height1, tallest, 0.004);
  heights.push(tallest);

  const geometry = new p5.Geometry(1, 1, function () {
    // the outer face, clipped to the incline and cut where the title is
    for (const level of heights)
      for (const angle of angles) {
        const height = constrain(level, 0, foundationTop(angle));
        const inTitle = height > height0 && height < height1 && angle > angle0 && angle < angle1;
        const cut = inTitle ? titleDepthAt(angle, height) : 0;
        // the same stone, flatter: gentle swells plus the fine grit and cracks, kept smooth
        // behind the title so the letters read cleanly
        const relief = inTitle ? 0 : FOUNDATION_ROUGHNESS * (noise(angle * 9, height * 14) - 0.5) * 2 + 0.6 * stoneDetail(angle * radius, height);
        this.vertices.push(columnPoint(angle, height, FOUNDATION_DEPTH + relief - FOUNDATION_ENGRAVE_DEPTH * smoothStep(0, 1, cut)));
        this.uvs.push(...surfaceUV(angle, height));
      }
    addGridFaces(this, angles.length - 1, heights.length - 1);
    for (const face of this.faces) face.reverse();  // the grid runs the other way round: face outward

    // the sloping top under the cards and the flat floor, each running from the outer face
    // back to the core
    const addEdgeStrip = (heightAt, flip) => {
      const start = this.vertices.length;
      for (const angle of angles) {
        const height = heightAt(angle);
        this.vertices.push(columnPoint(angle, height, FOUNDATION_DEPTH), columnPoint(angle, height, -CORE_INSET));
        this.uvs.push(...surfaceUV(angle, height), ...surfaceUV(angle, height));
      }
      for (var k = 0; k < angles.length - 1; k++) {
        const outer = start + 2 * k, next = outer + 2;
        if (flip) this.faces.push([outer, next, outer + 1], [next, next + 1, outer + 1]);
        else this.faces.push([outer, outer + 1, next], [next, outer + 1, next + 1]);
      }
    };
    addEdgeStrip(foundationTop, false);
    addEdgeStrip(() => 0, true);
    dropFlatFaces(this);
    this.computeNormals();
  });
  geometry.gid = 'pillar-foundation';
  return geometry;
}

// The mound on top of the column. It sits level, its edge meeting the inside of the column
// all round, with rock over it and a hill of rock rising around the jester's foot.
// Height above (x, z), or null outside the dome; `reach` runs from 0 at the peak to 1 at the edge.
function domeHeightAt(x, z, withHill = true) {
  const reach = Math.min(1, Math.hypot(x, z) / domeEdgeRadius);
  if (Math.hypot(x, z) > domeEdgeRadius * 1.0001) return null;   // (a little tolerance for the edge itself)
  var height = lerp(DOME_PEAK_HEIGHT, DOME_EDGE_HEIGHT, reach * reach) + DOME_ROCK_HEIGHT * (1 - reach ** 3) * rockNoise(x, z);
  if (withHill) {
    const fromFoot = Math.hypot(x - jesterToe.x, z - jesterToe.z) / JESTER_HILL_RADIUS;
    height += JESTER_HILL_HEIGHT * Math.exp(-fromFoot * fromFoot * 1.6) * (1 - reach ** 4);
  }
  return height;
}

function domePoint(angle, reach) {
  const x = domeEdgeRadius * reach * cos(angle), z = domeEdgeRadius * reach * sin(angle);
  const detail = stoneDetail(x * 1.1 + 5, z * 1.1 + 5) * (1 - reach ** 4);   // fine relief, fading at the edge
  return createVector(x, -(domeHeightAt(x, z) + detail), z);
}

function makeDome() {
  const geometry = new p5.Geometry(720, 110, function () {   // about 4 mm apart at the edge
    for (var j = 0; j <= this.detailY; j++)
      for (var i = 0; i <= this.detailX; i++) {
        this.vertices.push(domePoint(TWO_PI * i / this.detailX, j / this.detailY));
        this.uvs.push(0, 0);
      }
    addGridFaces(this, this.detailX, this.detailY);
    dropFlatFaces(this);
    this.computeNormals();
  });
  geometry.gid = 'pillar-dome';
  return geometry;
}

// Remove triangles with no area (where a grid meets a point or is squeezed flat)
function dropFlatFaces(geometry) {
  geometry.faces = geometry.faces.filter(([a, b, c]) => {
    const A = geometry.vertices[a], B = geometry.vertices[b], C = geometry.vertices[c];
    return p5.Vector.sub(B, A).cross(p5.Vector.sub(C, A)).magSq() > 1e-14;
  });
}

// Two triangles for every cell of a (columns x rows) vertex grid
function addGridFaces(geometry, columns, rows) {
  const rowLength = columns + 1;
  for (var j = 0; j < rows; j++)
    for (var i = 0; i < columns; i++) {
      const a = j * rowLength + i, b = a + 1, c = a + rowLength, d = c + 1;
      geometry.faces.push([a, c, b], [b, c, d]);
    }
}

// --- The base, with '1 OUT OF 52!' engraved into its underside ---
// The lettering is drawn twice from one layout: a crisp image for the screen, and a
// white-on-black depth map that carves the printable geometry.
function drawLettering(ctx, size, color) {
  const half = size / 2;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `bold ${0.16 * half}px ${LETTERING_FONT}`;
  ctx.fillText(UNDERSIDE_TEXT, half, half);
}

// Draws the screen texture and returns depthAt(x, z): 0 = surface, 1 = fully engraved
function makeEngraving() {
  const size = 2048;
  baseTexture = createGraphics(size, size);
  baseTexture.pixelDensity(1);
  baseTexture.background(...STONE_COLOR);
  drawLettering(baseTexture.drawingContext, size, 'rgb(212, 172, 78)');

  const mask = createGraphics(size, size);
  mask.pixelDensity(1);
  mask.background(0);
  drawLettering(mask.drawingContext, size, '#fff');
  mask.loadPixels();
  const depth = new Float32Array(size * size);
  for (var p = 0; p < size * size; p++) depth[p] = mask.pixels[4 * p] / 255;
  mask.remove();

  // sampled bilinearly so the carved edges are smooth, not stepped
  const at = (i, j) => depth[constrain(j, 0, size - 1) * size + constrain(i, 0, size - 1)];
  return (x, z) => {
    const u = (x * 0.5 + 0.5) * (size - 1), v = (-z * 0.5 + 0.5) * (size - 1);
    const i = floor(u), j = floor(v), fu = u - i, fv = v - j;
    return lerp(lerp(at(i, j), at(i + 1, j), fu), lerp(at(i, j + 1), at(i + 1, j + 1), fu), fv);
  };
}

// A solid disc: flat top, round side, and an underside grid that dips where the letters are
function makeBase(depthAt) {
  const N = 440;
  const geometry = new p5.Geometry(N, N, function () {
    const id = (i, j) => j * (N + 1) + i;
    for (var j = 0; j <= N; j++)
      for (var i = 0; i <= N; i++) {
        // a square grid squeezed into a disc
        const a = 2 * i / N - 1, b = 2 * j / N - 1;
        const x = a * sqrt(1 - b * b / 2), z = b * sqrt(1 - a * a / 2);
        const d = depthAt(x, z), smooth = d * d * (3 - 2 * d);
        this.vertices.push(createVector(x * BASE_RADIUS, BASE_HEIGHT - ENGRAVE_DEPTH * smooth, z * BASE_RADIUS));
        this.uvs.push(x * 0.5 + 0.5, -z * 0.5 + 0.5);
      }
    for (var row = 0; row < N; row++)
      for (var col = 0; col < N; col++) {
        this.faces.push([id(col, row), id(col, row + 1), id(col + 1, row)]);
        this.faces.push([id(col + 1, row), id(col, row + 1), id(col + 1, row + 1)]);
      }

    // the rim of the grid, walked once around
    const rim = [];
    for (var s1 = 0; s1 < N; s1++) rim.push(id(s1, 0));
    for (var s2 = 0; s2 < N; s2++) rim.push(id(N, s2));
    for (var s3 = N; s3 > 0; s3--) rim.push(id(s3, N));
    for (var s4 = N; s4 > 0; s4--) rim.push(id(0, s4));

    // side wall and top, with their own plain-stone texture coordinates
    const rimCount = rim.length, sideStart = this.vertices.length;
    for (const k of rim) { const v = this.vertices[k]; this.vertices.push(createVector(v.x, v.y, v.z)); this.uvs.push(0.004, 0.004); }
    const topStart = this.vertices.length;
    for (const k of rim) { const v = this.vertices[k]; this.vertices.push(createVector(v.x, 0, v.z)); this.uvs.push(0.004, 0.004); }
    const centre = this.vertices.length;
    this.vertices.push(createVector(0, 0, 0));
    this.uvs.push(0.004, 0.004);

    for (var k = 0; k < rimCount; k++) {
      const k2 = (k + 1) % rimCount;
      const bottom1 = sideStart + k, bottom2 = sideStart + k2, top1 = topStart + k, top2 = topStart + k2;
      this.faces.push([bottom1, bottom2, top1], [bottom2, top2, top1]);
      this.faces.push([centre, top1, top2]);
    }
    this.computeNormals();
  });
  geometry.gid = 'pillar-base';
  return geometry;
}


//===============
// 6. CARD ARTWORK
//===============

// Every card is drawn into its own canvas and used as the tile's texture.

function makeCardTexture(card) {
  return card.rank >= JACK ? makeFaceCard(card) : makeNumberCard(card);
}

// Release a card canvas and its GPU texture when a new year is dealt
function freeCardTexture(graphics) {
  if (!graphics) return;
  const renderer = _renderer, glTexture = renderer.textures && renderer.textures.get && renderer.textures.get(graphics);
  if (glTexture) {
    if (glTexture.glTex) renderer.GL.deleteTexture(glTexture.glTex);
    renderer.textures.delete(graphics);
  }
  graphics.remove();
}

function mix(a, b, t) { return a.map((v, k) => lerp(v, b[k], t)); }

// The three inks of the artwork: the feeling's colour, a darker shade, and cream line work
function feelingPalette(mood) {
  const feeling = FEELINGS[mood];
  return { main: feeling.color, shade: mix(feeling.deep, [24, 18, 20], 0.55), cream: mix(IVORY, feeling.color, 0.07) };
}

// Shorthands for flat artwork: fill a shape, or stroke a line, in one colour
function penFor(g) {
  return {
    fillWith: col => { g.noStroke(); g.fill(...col); },
    strokeWith: (col, w) => { g.noFill(); g.stroke(...col); g.strokeWeight(w); },
  };
}

// The card's paper: ivory tinted by its feeling (face cards only lightly)
function cardPaper(card) { return mix(IVORY, FEELINGS[card.mood].color, card.rank >= JACK ? 0.07 : 0.3); }

// The frame every card shares: tinted paper, colour bands, border, and the corner index
// (rank + the feeling's symbol in place of a suit sign) in the feeling's deep shade, repeated upside down
function drawCardFrame(g, card) {
  const W = g.width, H = g.height, feeling = FEELINGS[card.mood];
  const ink = feeling.deep;
  g.background(...cardPaper(card));
  g.noStroke(); g.fill(...feeling.color, 90);
  g.rect(0, 0, W, 10); g.rect(0, H - 10, W, 10);
  g.noFill(); g.stroke(ink[0], ink[1], ink[2], 70); g.strokeWeight(2);
  g.rect(14, 14, W - 28, H - 28, 20);

  g.textAlign(CENTER, CENTER); g.textFont('Georgia'); g.textStyle(BOLD); g.textSize(26);
  for (const upsideDown of [false, true]) {
    g.push();
    if (upsideDown) { g.translate(W, H); g.rotate(PI); }
    g.noStroke(); g.fill(...ink);
    g.text(RANK_NAMES[card.rank], 34, 40);
    drawFeelingSymbol(g, card.mood, 34, 68, 26);
    g.pop();
  }
}

// Number cards: rows of the week's drawn symbol, sized by rank (Ace biggest, 10 smallest),
// spaced with an even gap of about 40% of the symbol's size
const PIP_ROWS = {
  1: [1], 2: [1, 1], 3: [1, 1, 1], 4: [2, 2], 5: [2, 1, 2], 6: [2, 2, 2],
  7: [2, 1, 2, 2], 8: [2, 2, 2, 2], 9: [3, 3, 3], 10: [3, 2, 2, 3]
};
const PIP_SIZE = [112, 74, 62, 56, 50, 46, 42, 40, 37, 34];

function pipPositions(n) {
  const rows = PIP_ROWS[n], size = PIP_SIZE[n - 1], pitchY = size * 1.42, pitchX = size * 1.4;
  const top = 190 - (rows.length - 1) * pitchY / 2;
  return rows.flatMap((count, ri) =>
    Array.from({ length: count }, (_, ci) => [100 + (ci - (count - 1) / 2) * pitchX, top + ri * pitchY]));
}

function makeNumberCard(card) {
  const g = createGraphics(200, 380);
  g.pixelDensity(1.5);
  drawCardFrame(g, card);
  const n = card.rank + 1;
  for (const [x, y] of pipPositions(n)) drawFeelingSymbol(g, card.mood, x, y, PIP_SIZE[n - 1]);
  return g;
}

// A feeling's symbol (joy: sun, sadness: water drop, anger: fire, fear: tornado), centred
// on (x, y) and about `size` pixels across
function drawFeelingSymbol(g, mood, x, y, size) {
  const { main, shade, cream } = feelingPalette(mood);
  const { fillWith, strokeWith } = penFor(g);
  g.push();
  g.translate(x, y);
  g.strokeJoin(ROUND); g.strokeCap(ROUND);

  if (mood === JOY) {
    // sun: eight pointed rays in the deep shade around a bright disc
    fillWith(shade);
    for (var q = 0; q < 8; q++) {
      const a = TWO_PI * q / 8 - HALF_PI, w = 0.16;
      g.triangle(cos(a - w) * 0.3 * size, sin(a - w) * 0.3 * size, cos(a + w) * 0.3 * size, sin(a + w) * 0.3 * size,
        cos(a) * 0.5 * size, sin(a) * 0.5 * size);
    }
    fillWith(main); g.circle(0, 0, 0.6 * size);
    strokeWith(cream, max(0.8, 0.03 * size)); g.circle(0, 0, 0.44 * size);
    fillWith(cream); for (var k = 0; k < 8; k++) { const a = TWO_PI * k / 8 + PI / 8; g.circle(cos(a) * 0.26 * size, sin(a) * 0.26 * size, 0.035 * size); }
    fillWith(shade); g.circle(0, 0, 0.12 * size);
  } else if (mood === SADNESS) {
    // water drop: a teardrop with its right side in the deep shade and a cream highlight
    fillWith(main);
    g.beginShape();
    g.vertex(0, -0.5 * size);
    g.bezierVertex(0.1 * size, -0.28 * size, 0.34 * size, -0.02 * size, 0.34 * size, 0.17 * size);
    g.bezierVertex(0.34 * size, 0.38 * size, 0.18 * size, 0.5 * size, 0, 0.5 * size);
    g.bezierVertex(-0.18 * size, 0.5 * size, -0.34 * size, 0.38 * size, -0.34 * size, 0.17 * size);
    g.bezierVertex(-0.34 * size, -0.02 * size, -0.1 * size, -0.28 * size, 0, -0.5 * size);
    g.endShape(CLOSE);
    fillWith(shade);
    g.beginShape();
    g.vertex(0, -0.5 * size);
    g.bezierVertex(0.1 * size, -0.28 * size, 0.34 * size, -0.02 * size, 0.34 * size, 0.17 * size);
    g.bezierVertex(0.34 * size, 0.38 * size, 0.18 * size, 0.5 * size, 0, 0.5 * size);
    g.bezierVertex(0.14 * size, 0.4 * size, 0.21 * size, 0.28 * size, 0.2 * size, 0.15 * size);
    g.bezierVertex(0.19 * size, -0.04 * size, 0.06 * size, -0.26 * size, 0, -0.5 * size);
    g.endShape(CLOSE);
    strokeWith(cream, max(0.9, 0.045 * size)); g.bezier(-0.2 * size, 0.06 * size, -0.22 * size, 0.18 * size, -0.18 * size, 0.28 * size, -0.08 * size, 0.34 * size);
    fillWith(cream); g.circle(-0.18 * size, -0.06 * size, 0.05 * size);
  } else if (mood === ANGER) {
    // fire: an outer flame in the deep shade, the main flame inside it, a cream core
    const flame = (sc, dy) => {
      g.beginShape();
      g.vertex(0, (0.48 * sc + dy) * size);
      g.bezierVertex(-0.36 * sc * size, (0.48 * sc + dy) * size, -0.44 * sc * size, (0.12 * sc + dy) * size, -0.24 * sc * size, (-0.12 * sc + dy) * size);
      g.bezierVertex(-0.14 * sc * size, (-0.24 * sc + dy) * size, -0.18 * sc * size, (-0.36 * sc + dy) * size, -0.08 * sc * size, (-0.52 * sc + dy) * size);
      g.bezierVertex(-0.02 * sc * size, (-0.32 * sc + dy) * size, 0.08 * sc * size, (-0.3 * sc + dy) * size, 0.12 * sc * size, (-0.2 * sc + dy) * size);
      g.bezierVertex(0.18 * sc * size, (-0.34 * sc + dy) * size, 0.16 * sc * size, (-0.42 * sc + dy) * size, 0.2 * sc * size, (-0.5 * sc + dy) * size);
      g.bezierVertex(0.46 * sc * size, (-0.2 * sc + dy) * size, 0.44 * sc * size, (0.2 * sc + dy) * size, 0.3 * sc * size, (0.36 * sc + dy) * size);
      g.bezierVertex(0.22 * sc * size, (0.46 * sc + dy) * size, 0.12 * sc * size, (0.48 * sc + dy) * size, 0, (0.48 * sc + dy) * size);
      g.endShape(CLOSE);
    };
    fillWith(shade); flame(1, 0);
    fillWith(main); flame(0.68, 0.14);
    fillWith(cream); flame(0.32, 0.3);
    strokeWith(cream, max(0.8, 0.03 * size)); g.bezier(-0.3 * size, 0.12 * size, -0.34 * size, 0.28 * size, -0.24 * size, 0.4 * size, -0.12 * size, 0.44 * size);
  } else if (mood === FEAR) {
    // tornado: stacked bands that swirl and narrow into a curling tail
    g.translate(0, -0.03 * size);
    const bands = 5;
    var lx = 0, ly = 0;
    for (var q = 0; q < bands; q++) {
      const t = q / (bands - 1);
      const by = lerp(-0.36, 0.22, t) * size, bw = lerp(0.96, 0.24, t) * size, bh = lerp(0.2, 0.12, t) * size;
      const bx = Math.sin(t * 2.4) * 0.07 * size;
      fillWith(q % 2 ? shade : main); g.rect(bx - bw / 2, by - bh / 2, bw, bh, bh / 2);
      strokeWith(cream, max(0.7, 0.026 * size)); g.line(bx - bw * 0.34, by - bh * 0.12, bx + bw * 0.3, by - bh * 0.12);
      lx = bx; ly = by + bh / 2;
    }
    strokeWith(shade, max(1.2, 0.07 * size));
    g.bezier(lx, ly - 0.02 * size, lx + 0.08 * size, ly + 0.08 * size, lx - 0.08 * size, ly + 0.16 * size, lx + 0.03 * size, ly + 0.24 * size);
  }
  g.pop();
}

// Face cards: a two-tone court figure in the feeling's inks, mirrored top and bottom
function makeFaceCard(card) {
  const g = createGraphics(200, 380);
  g.pixelDensity(2.5);
  drawCardFrame(g, card);
  for (const flip of [false, true]) {
    g.push();
    g.translate(100, 190);
    if (flip) g.rotate(PI);
    g.scale(0.86);
    drawCourtHalf(g, card);
    g.pop();
  }
  return g;
}

// One half of a court figure, drawn upward from the card's centre line (y = 0)
function drawCourtHalf(g, card) {
  const rank = card.rank, { main, shade, cream } = feelingPalette(card.mood);
  const { fillWith, strokeWith } = penFor(g);
  g.strokeJoin(ROUND); g.strokeCap(ROUND);

  courtWeapon(g, rank, main, shade, cream);

  // skirt of armour plates below the belt
  fillWith(shade);
  g.beginShape(); g.vertex(-46, -30); g.bezierVertex(-49, -18, -51, -8, -54, 0); g.vertex(54, 0);
  g.bezierVertex(51, -8, 49, -18, 46, -30); g.endShape(CLOSE);
  for (const x of [-33, -11, 11, 33]) {
    fillWith(main);
    g.beginShape(); g.vertex(x - 9, -27); g.vertex(x + 9, -27); g.bezierVertex(x + 10, -16, x + 10, -8, x + 9, -2);
    g.bezierVertex(x + 3, 0, x - 3, 0, x - 9, -2); g.bezierVertex(x - 10, -8, x - 10, -16, x - 9, -27); g.endShape(CLOSE);
    strokeWith(cream, 0.8); g.line(x - 6, -23, x + 6, -23); g.line(x, -20, x, -6);
    g.line(x - 4, -12, x, -7); g.line(x + 4, -12, x, -7);
  }

  // belt with studs
  fillWith(shade); g.rect(-48, -37, 96, 9, 3);
  fillWith(cream); for (var k = -4; k <= 4; k++) g.circle(k * 10, -32.5, 2.4);
  strokeWith(cream, 0.7); g.line(-46, -36, 46, -36); g.line(-46, -29, 46, -29);

  // torso: deep-toned body with rounded shoulders
  fillWith(shade);
  g.beginShape(); g.vertex(-44, -37); g.bezierVertex(-50, -58, -56, -76, -44, -88);
  g.bezierVertex(-28, -98, 28, -98, 44, -88); g.bezierVertex(56, -76, 50, -58, 44, -37); g.endShape(CLOSE);
  strokeWith(cream, 0.8);
  for (const sx of [-1, 1]) {
    g.bezier(sx * 38, -84, sx * 42, -70, sx * 40, -54, sx * 36, -42);
    for (var y = -78; y <= -46; y += 8) { g.point(sx * 44, y); g.line(sx * 41, y + 3, sx * 43, y + 5); }
  }

  // chest plate: a shield shape with an inset cream line and chevrons
  const shield = (k) => {
    g.beginShape(); g.vertex(-28 * k, -86 + 24 * (1 - k)); g.bezierVertex(-10 * k, -92 + 26 * (1 - k), 10 * k, -92 + 26 * (1 - k), 28 * k, -86 + 24 * (1 - k));
    g.bezierVertex(32 * k, -62, 24 * k, -46 + 6 * (1 - k), 0, -38 - 4 * (1 - k)); g.bezierVertex(-24 * k, -46 + 6 * (1 - k), -32 * k, -62, -28 * k, -86 + 24 * (1 - k));
    g.endShape(CLOSE);
  };
  fillWith(main); shield(1);
  strokeWith(cream, 1); shield(0.84);
  strokeWith(shade, 1.4); g.line(-16, -46, 0, -40); g.line(16, -46, 0, -40);

  // the feeling as an emblem on the chest
  fillWith(shade); g.circle(0, -66, 31);
  fillWith(cream); g.circle(0, -66, 25);
  drawFeelingSymbol(g, card.mood, 0, -66, 19.5);

  // pauldrons in layered plates
  for (const sx of [-1, 1]) {
    fillWith(main); g.ellipse(sx * 48, -83, 32, 24);
    strokeWith(cream, 0.9); g.arc(sx * 48, -80, 24, 15, PI, TWO_PI); g.arc(sx * 48, -76, 16, 9, PI, TWO_PI);
    fillWith(shade); g.circle(sx * 48, -88, 4);
  }

  // weapon arm (right) and the arm across the chest (left)
  strokeWith(shade, 14); g.line(50, -76, 58, -58);
  strokeWith(main, 12); g.line(58, -58, 56, -42);
  strokeWith(cream, 0.8); g.line(52, -52, 62, -50); g.line(51, -46, 61, -44);
  strokeWith(shade, 14); g.line(-50, -76, -54, -58);
  strokeWith(main, 12); g.line(-54, -58, -26, -48);
  strokeWith(cream, 0.8); g.line(-46, -60, -42, -50); g.line(-38, -57, -34, -48);
  for (const [x, y] of [[56, -38], [-22, -47]]) {
    fillWith(main); g.ellipse(x, y, 15, 13);
    strokeWith(shade, 0.9); g.line(x - 4, y - 2, x + 4, y - 3); g.line(x - 4, y + 1, x + 4, y);
  }

  // neck
  fillWith(shade); g.rect(-8, -102, 16, 12, 2);

  // hair behind the head
  fillWith(shade);
  if (rank === QUEEN) {
    g.beginShape(); g.vertex(-21, -130); g.bezierVertex(-38, -112, -36, -84, -28, -70); g.vertex(-16, -76);
    g.bezierVertex(-18, -96, -18, -112, -16, -122); g.endShape(CLOSE);
    g.beginShape(); g.vertex(21, -130); g.bezierVertex(38, -112, 36, -84, 28, -70); g.vertex(16, -76);
    g.bezierVertex(18, -96, 18, -112, 16, -122); g.endShape(CLOSE);
    strokeWith(cream, 0.7);
    for (const sx of [-1, 1]) { g.bezier(sx * 24, -118, sx * 30, -104, sx * 30, -90, sx * 26, -78); g.bezier(sx * 20, -116, sx * 25, -102, sx * 24, -90, sx * 21, -80); }
  }

  // face
  fillWith(main); g.ellipse(0, -116, 36, 44);
  fillWith(shade); g.ellipse(-18, -114, 6, 10); g.ellipse(18, -114, 6, 10);
  strokeWith(shade, 1); g.line(0, -116, -2, -106); g.line(-2, -106, 1, -105);

  if (rank === KING) {
    // full beard with cream hatching and a moustache
    fillWith(shade);
    g.beginShape(); g.vertex(-18, -116); g.bezierVertex(-19, -96, -10, -82, 0, -80);
    g.bezierVertex(10, -82, 19, -96, 18, -116); g.vertex(13, -104); g.bezierVertex(6, -98, -6, -98, -13, -104); g.endShape(CLOSE);
    strokeWith(cream, 0.7);
    for (const x of [-12, -6, 0, 6, 12]) g.bezier(x, -98, x * 1.05 - 1, -92, x * 0.9 + 1, -88, x * 0.6, -83);
    fillWith(shade); g.beginShape(); g.vertex(-11, -103); g.bezierVertex(-6, -107, 6, -107, 11, -103); g.bezierVertex(6, -104, -6, -104, -11, -103); g.endShape(CLOSE);
  }

  // hair on top and headwear
  fillWith(shade); g.arc(0, -128, 40, 24, PI, TWO_PI);
  strokeWith(cream, 0.7); g.arc(0, -128, 30, 16, PI + 0.3, TWO_PI - 0.3);
  if (rank === KING) {
    fillWith(main);
    g.beginShape();
    g.vertex(-22, -134); g.vertex(-25, -160); g.vertex(-13, -146); g.vertex(-6, -164); g.vertex(0, -148);
    g.vertex(6, -164); g.vertex(13, -146); g.vertex(25, -160); g.vertex(22, -134);
    g.endShape(CLOSE);
    fillWith(shade); g.rect(-23, -139, 46, 7, 2);
    fillWith(cream); for (const kx of [-14, -5, 5, 14]) g.circle(kx, -135.5, 2.6);
    for (const [kx, ky] of [[-25, -161], [-6, -165], [6, -165], [25, -161]]) g.circle(kx, ky, 3);
    strokeWith(cream, 0.7); g.line(-12, -144, -8, -152); g.line(12, -144, 8, -152); g.line(0, -146, 0, -154);
  } else if (rank === QUEEN) {
    fillWith(main);
    g.beginShape(); g.vertex(-16, -136); g.vertex(-14, -152); g.vertex(-6, -142); g.vertex(0, -158); g.vertex(6, -142); g.vertex(14, -152); g.vertex(16, -136); g.endShape(CLOSE);
    fillWith(shade); g.rect(-16, -139, 32, 5, 2);
    fillWith(cream); g.circle(0, -146, 4); g.circle(-14, -152, 2.6); g.circle(14, -152, 2.6);
  } else {
    fillWith(shade);
    g.beginShape(); g.vertex(-23, -134); g.bezierVertex(-26, -152, -8, -160, 6, -158);
    g.bezierVertex(18, -156, 26, -148, 23, -134); g.endShape(CLOSE);
    fillWith(main); g.rect(-24, -138, 48, 7, 3);
    strokeWith(cream, 0.8); g.line(-20, -134.5, 20, -134.5);
    strokeWith(cream, 1.2); g.bezier(10, -154, 22, -166, 32, -168, 40, -178);
    strokeWith(cream, 0.6); for (var t = 0.2; t < 1; t += 0.16) { const x = bezierPoint(10, 22, 32, 40, t), y = bezierPoint(-154, -166, -168, -178, t); g.line(x, y, x + 4, y + 3); }
  }

  courtFace(g, card.mood, rank === KING, cream, shade);
}

// The weapon or emblem each figure carries: sword (K), halberd (J), flower sceptre (Q)
function courtWeapon(g, rank, main, shade, cream) {
  const { fillWith, strokeWith } = penFor(g);
  if (rank === KING) {
    fillWith(main);
    g.beginShape(); g.vertex(53, -40); g.vertex(53, -150); g.vertex(56, -162); g.vertex(59, -150); g.vertex(59, -40); g.endShape(CLOSE);
    strokeWith(cream, 0.9); g.line(56, -154, 56, -46);
    fillWith(shade);
    g.beginShape(); g.vertex(42, -40); g.bezierVertex(48, -44, 64, -44, 70, -40); g.vertex(70, -36); g.bezierVertex(64, -38, 48, -38, 42, -36); g.endShape(CLOSE);
    g.circle(42, -38, 5); g.circle(70, -38, 5);
  } else if (rank === JACK) {
    fillWith(shade); g.rect(54, -138, 4, 136, 2);
    strokeWith(cream, 0.8); for (var y = -120; y < -10; y += 14) g.line(54, y, 58, y + 3);
    fillWith(main);
    g.beginShape(); g.vertex(56, -168); g.bezierVertex(62, -156, 62, -146, 56, -138); g.bezierVertex(50, -146, 50, -156, 56, -168); g.endShape(CLOSE);
    g.beginShape(); g.vertex(58, -134); g.bezierVertex(74, -138, 76, -116, 66, -110); g.bezierVertex(64, -118, 62, -124, 58, -124); g.endShape(CLOSE);
    strokeWith(cream, 0.8); g.line(56, -164, 56, -142); g.bezier(60, -130, 68, -130, 70, -120, 67, -114);
  } else {
    strokeWith(shade, 3); g.bezier(56, -10, 50, -60, 64, -100, 58, -132);
    fillWith(main);
    for (const [lx, ly, a] of [[54, -78, -0.6], [62, -104, 0.7]]) {
      g.push(); g.translate(lx, ly); g.rotate(a); g.ellipse(7, 0, 16, 6); g.pop();
    }
    for (var q = 0; q < 8; q++) {
      const a = TWO_PI * q / 8;
      g.push(); g.translate(58 + 8 * cos(a), -142 + 8 * sin(a)); g.rotate(a); fillWith(main); g.ellipse(0, 0, 12, 7);
      strokeWith(cream, 0.6); g.line(-3, 0, 3, 0); g.pop();
    }
    fillWith(shade); g.circle(58, -142, 9); fillWith(cream); g.circle(58, -142, 3);
  }
}

// A bold, flat face: cream eyes and mouth, deep-toned brows and pupils
function courtFace(g, mood, bearded, cream, shade) {
  const ey = -118, my = bearded ? -100 : -104;
  g.strokeCap(ROUND);
  if (mood === JOY) {                       // joy: smiling eyes, a wide grin
    g.noFill(); g.stroke(...cream); g.strokeWeight(3);
    g.arc(-8, ey + 2, 10, 8, PI, TWO_PI); g.arc(8, ey + 2, 10, 8, PI, TWO_PI);
    g.stroke(...shade); g.strokeWeight(2.2);
    g.arc(-8, ey - 7, 11, 6, PI, TWO_PI); g.arc(8, ey - 7, 11, 6, PI, TWO_PI);
    g.noStroke(); g.fill(...cream); g.arc(0, my - 2, 18, 13, 0, PI, CHORD);
    g.fill(...shade); g.rect(-8, my - 2, 16, 2);
  } else if (mood === SADNESS) {                // sadness: drooping eyes, a tear, a frown
    g.stroke(...shade); g.strokeWeight(2.2);
    g.line(-14, ey - 5, -4, ey - 10); g.line(14, ey - 5, 4, ey - 10);
    g.noStroke(); g.fill(...cream);
    g.arc(-8, ey, 11, 9, 0, PI, CHORD); g.arc(8, ey, 11, 9, 0, PI, CHORD);
    g.fill(...shade); g.circle(-8, ey + 2.5, 3.2); g.circle(8, ey + 2.5, 3.2);
    g.fill(...cream); g.ellipse(-10, ey + 10, 4, 7); g.triangle(-12, ey + 9, -8, ey + 9, -10, ey + 4);
    g.noFill(); g.stroke(...cream); g.strokeWeight(2.4); g.arc(0, my + 4, 14, 9, PI + 0.3, TWO_PI - 0.3);
  } else if (mood === ANGER) {                // anger: hard V brows, narrowed eyes, clenched teeth
    g.stroke(...shade); g.strokeWeight(3.2);
    g.line(-15, ey - 10, -3, ey - 4); g.line(15, ey - 10, 3, ey - 4);
    g.noStroke(); g.fill(...cream);
    g.quad(-14, ey - 1, -3, ey + 1, -5, ey + 4, -13, ey + 3);
    g.quad(14, ey - 1, 3, ey + 1, 5, ey + 4, 13, ey + 3);
    g.rect(-9, my - 4, 18, 8, 1.5);
    g.stroke(...shade); g.strokeWeight(0.9);
    g.line(-9, my, 9, my); for (const x of [-4.5, 0, 4.5]) g.line(x, my - 4, x, my + 4);
  } else if (mood === FEAR) {             // fear: wide eyes, tiny pupils, open mouth, sweat
    g.stroke(...shade); g.strokeWeight(2.2); g.noFill();
    g.arc(-8, ey - 9, 11, 7, PI, TWO_PI); g.arc(8, ey - 9, 11, 7, PI, TWO_PI);
    g.noStroke(); g.fill(...cream); g.circle(-8, ey, 11); g.circle(8, ey, 11);
    g.fill(...shade); g.circle(-8, ey, 2.6); g.circle(8, ey, 2.6);
    g.fill(...cream); g.ellipse(0, my + 1, 9, 12);
    g.ellipse(17, ey - 6, 4, 7); g.triangle(15, ey - 7, 19, ey - 7, 17, ey - 12);
  }
  g.noStroke();
}



//===============
// 7. JESTER
//===============

// Lower the jester until his lowest point just sinks into the dome (before its hill is
// added), so he is attached for printing; the hill then rises round that foot and grips it
function seatJester() {
  if (!jesterModel) { jesterBaseY = -DOME_PEAK_HEIGHT; return; }
  var lowest = Infinity, toe = null;
  for (const v of jesterModel.vertices) {
    const x = -v.x * JESTER_SCALE, z = -v.y * JESTER_SCALE, surface = domeHeightAt(x, z, false);
    if (surface === null) continue;
    const needed = -surface + v.z * JESTER_SCALE;
    if (needed < lowest) { lowest = needed; toe = { x, z }; }
  }
  jesterToe = toe || { x: 0, z: 0 };
  jesterBaseY = lowest + 0.004;
}

// The jester in world space (used for the crowd's collision check)
function jesterToWorld(v) {
  return createVector(-v.x * JESTER_SCALE, jesterBaseY - v.z * JESTER_SCALE, -v.y * JESTER_SCALE);
}


//===============
/// 8. PEOPLE (POSED MANNEQUINS)
//===============

const POSE_NAMES = ['reachUp', 'reachOne', 'clawUp', 'writhe', 'drown', 'drownWild', 'kneelPlead',
  'despair', 'cower', 'sitReach', 'crawl', 'dangle', 'climb', 'punch', 'shove', 'grapple', 'trampled',
  'duoPunch', 'duoShove', 'duoGrapple', 'duoPullDown', 'duoTrample', 'duoStepUp',
  'sprawl', 'slopeClimb', 'fallBack',
  'emergeWaist', 'emergeChest', 'emergeWrithe', 'emergeOne', 'armsUp', 'armsWild'];
const STANDING_POSES = ['reachUp', 'reachOne', 'clawUp', 'writhe', 'drown', 'drownWild', 'punch', 'shove', 'grapple', 'fallBack', 'slopeClimb'];
const LOW_POSES = ['kneelPlead', 'despair', 'cower', 'sitReach', 'crawl', 'trampled', 'sprawl'];
const FIGHT_POSES = ['duoPunch', 'duoShove', 'duoGrapple', 'duoPullDown', 'duoTrample', 'duoStepUp'];
const SUNK_POSES = ['emergeWaist', 'emergeChest', 'emergeWrithe', 'emergeOne', 'armsUp', 'armsWild'];
const ARMS_ONLY_POSES = ['armsUp', 'armsWild'];
const LONG_POSES = LOW_POSES.concat(FIGHT_POSES);  // these lie along the narrow ring of the base

const PERSON_HEIGHT = 0.13;                        // 13 mm printed
const BODY_GAP = 0.005;                            // closest two bodies may come (0.5 mm printed)
const YEAR_RING_RADIUS = columnRadius(0) + 0.14;   // inside this ring the people change every year
const DANGLE_SEAT = 0.252;                         // seat height of the 'dangle' pose (figure units)
const DANGLE_EDGE = 0.06;                          // how far in front of the seat the rim edge sits

var poseSources = {};                              // the loaded STLs
var poses = {};                                    // prepared: vertices, normals, faces, samples
var staticBodies = null;                           // collision grid of the fixed crowd and the jester
var meshInProgress = null;                         // the crowd mesh buildCrowdMesh is filling

function loadMannequinPoses() {
  POSE_NAMES.forEach(name => {
    poseSources[name] = loadModel(`assets/poses/${name}.stl`, false, () => { }, () => { poseSources[name] = null; });
  });
}

// Weld each STL's loose triangles, turn Blender's Z-up into figure space (y up, facing +z),
// compute smooth normals, and keep one collision sample per 4 cm voxel (core first)
function prepareMannequinPoses() {
  for (const name of POSE_NAMES) {
    const source = poseSources[name];
    if (!source) continue;
    const index = new Map(), vertices = [], faces = [];
    const weld = p => {
      const key = `${Math.round(p.x * 2e4)}|${Math.round(p.y * 2e4)}|${Math.round(p.z * 2e4)}`;
      var i = index.get(key);
      if (i === undefined) { i = vertices.length; index.set(key, i); vertices.push([p.x, p.z, -p.y]); }
      return i;
    };
    for (const [a, b, c] of source.faces) {
      const A = weld(source.vertices[a]), B = weld(source.vertices[b]), C = weld(source.vertices[c]);
      if (A !== B && B !== C && A !== C) faces.push([A, B, C]);
    }

    const normals = vertices.map(() => [0, 0, 0]);
    for (const [a, b, c] of faces) {
      const faceNormal = vec3.cross(vec3.sub(vertices[b], vertices[a]), vec3.sub(vertices[c], vertices[a]));
      for (const k of [a, b, c]) { normals[k][0] += faceNormal[0]; normals[k][1] += faceNormal[1]; normals[k][2] += faceNormal[2]; }
    }
    for (var n = 0; n < normals.length; n++) normals[n] = vec3.normalize(normals[n]);

    var top = 0, centreY = 0;
    for (const p of vertices) { top = Math.max(top, p[1]); centreY += p[1] / vertices.length; }
    const voxels = new Map();
    for (const p of vertices) {
      const key = `${Math.floor(p[0] / 0.04)}|${Math.floor(p[1] / 0.04)}|${Math.floor(p[2] / 0.04)}`;
      if (!voxels.has(key)) voxels.set(key, p);
    }
    const fromCentre = p => p[0] * p[0] + (p[1] - centreY) ** 2 + p[2] * p[2];
    const samples = [...voxels.values()].sort((p, q) => fromCentre(p) - fromCentre(q));

    poses[name] = { vertices, normals, faces, samples, top };
    freeGeometry(source);
  }
}

// --- Small vector helpers on [x, y, z] arrays (fast for hundreds of thousands of points) ---
const vec3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  normalize: a => { const length = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / length, a[1] / length, a[2] / length]; },
};

function randomPersonSize(scaleFactor = 1) { return PERSON_HEIGHT * scaleFactor * random(0.9, 1.07); }

// How far below the ground a figure is set, so no foot hangs in the air on sloping rock
function groundSink(name, slope) {
  return SUNK_POSES.includes(name) ? 0.0045 + slope * 0.016 : 0.0015 + slope * 0.01;
}

// Steepness of a height function at (x, z)
function slopeAt(heightAt, x, z) {
  const step = 0.004, here = heightAt(x, z);
  const dx = (heightAt(x + step, z) ?? here) - here, dz = (heightAt(x, z + step) ?? here) - here;
  return Math.hypot(dx, dz) / step;
}

function rotateAroundY(direction, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return createVector(direction.x * c - direction.z * s, 0, direction.x * s + direction.z * c);
}

// --- Collision grid: a spatial hash of every placed body's sample points ---
// A year grid also looks into the static grid it was made from.
function makeBodyGrid(parent = null) { return { cells: new Map(), parent }; }

function gridCellKey(ix, iy, iz) { return ((ix + 4096) * 8192 + (iy + 4096)) * 8192 + (iz + 4096); }

function gridHasBodyNear(grid, x, y, z) {
  const ix = Math.floor(x / BODY_GAP), iy = Math.floor(y / BODY_GAP), iz = Math.floor(z / BODY_GAP);
  for (var dx = -1; dx <= 1; dx++)
    for (var dy = -1; dy <= 1; dy++)
      for (var dz = -1; dz <= 1; dz++) {
        const cell = grid.cells.get(gridCellKey(ix + dx, iy + dy, iz + dz));
        if (!cell) continue;
        for (var k = 0; k < cell.length; k += 3)
          if ((cell[k] - x) ** 2 + (cell[k + 1] - y) ** 2 + (cell[k + 2] - z) ** 2 < BODY_GAP * BODY_GAP) return true;
      }
  return grid.parent ? gridHasBodyNear(grid.parent, x, y, z) : false;
}

function gridAddPoints(grid, points) {
  for (const [x, y, z] of points) {
    const key = gridCellKey(Math.floor(x / BODY_GAP), Math.floor(y / BODY_GAP), Math.floor(z / BODY_GAP));
    var cell = grid.cells.get(key);
    if (!cell) { cell = []; grid.cells.set(key, cell); }
    cell.push(x, y, z);
  }
}

// --- Placing a figure ---
// A frame stands a figure at `position`, its head toward `up` and its front toward `forward`.
// The figure-to-world map mirrors y (p5's y points down), so triangles are flipped on output.
function figureFrame(position, up, forward, size) {
  const down = p5.Vector.mult(up, -1).normalize();
  const front = p5.Vector.sub(forward, p5.Vector.mult(down, forward.dot(down))).normalize();
  const side = p5.Vector.cross(down, front);
  return { origin: [position.x, position.y, position.z], size, side: [side.x, side.y, side.z], down: [down.x, down.y, down.z], front: [front.x, front.y, front.z] };
}
function figureDirection(frame, p) {
  const { side, down, front } = frame;
  return [side[0] * p[0] - down[0] * p[1] + front[0] * p[2],
  side[1] * p[0] - down[1] * p[1] + front[1] * p[2],
  side[2] * p[0] - down[2] * p[1] + front[2] * p[2]];
}
function figurePoint(frame, p) {
  const d = figureDirection(frame, p);
  return [frame.origin[0] + frame.size * d[0], frame.origin[1] + frame.size * d[1], frame.origin[2] + frame.size * d[2]];
}

// Would this pose fit here? `allowed(point)` is the place's own rule (stay on the base, out of the cards…)
function poseFits(grid, name, position, up, forward, size, allowed) {
  const pose = poses[name];
  if (!pose) return false;
  const frame = figureFrame(position, up, forward, size);
  for (const sample of pose.samples) {
    const p = figurePoint(frame, sample);
    if (allowed && !allowed(p)) return false;
    if (grid && gridHasBodyNear(grid, p[0], p[1], p[2])) return false;
  }
  return true;
}

// Place the pose if it fits: its samples join the grid and its triangles join the mesh
function placePose(grid, name, position, up, forward, size, allowed) {
  if (!meshInProgress || !poseFits(grid, name, position, up, forward, size, allowed)) return false;
  const pose = poses[name], frame = figureFrame(position, up, forward, size);
  gridAddPoints(grid, pose.samples.map(s => figurePoint(frame, s)));
  const first = meshInProgress.vertices.length;
  for (var i = 0; i < pose.vertices.length; i++) {
    meshInProgress.vertices.push(figurePoint(frame, pose.vertices[i]));
    meshInProgress.normals.push(figureDirection(frame, pose.normals[i]));
  }
  for (const [a, b, c] of pose.faces) meshInProgress.faces.push([first + a, first + c, first + b]);
  return true;
}

// Every placed figure is written into one mesh, then turned into a single p5.Geometry
function buildCrowdMesh(id, placeEveryone) {
  meshInProgress = { vertices: [], normals: [], faces: [] };
  placeEveryone();
  const mesh = meshInProgress;
  meshInProgress = null;
  const geometry = new p5.Geometry(1, 1);
  for (var i = 0; i < mesh.vertices.length; i++) {
    const [x, y, z] = mesh.vertices[i], [nx, ny, nz] = mesh.normals[i];
    geometry.vertices.push(createVector(x, y, z));
    geometry.vertexNormals.push(createVector(nx, ny, nz));
    geometry.uvs.push(0, 0);
  }
  geometry.faces = mesh.faces;
  geometry.gid = id;
  return geometry;
}

// --- The fixed crowd: sitters on the rim, the bodies heaped over the rocks of the base,
//     and the swarm on the rocky dome ---
function makeStaticCrowd() {
  const up = createVector(0, -1, 0);
  staticBodies = makeBodyGrid();

  // the jester is an obstacle: the crowd presses around his leg but never through it
  if (jesterModel) {
    const jesterPoints = [];
    for (var i = 0; i < jesterModel.vertices.length; i += 5) {
      const v = jesterModel.vertices[i];
      if (v.z * JESTER_SCALE < 0.6) { const p = jesterToWorld(v); jesterPoints.push([p.x, p.y, p.z]); }
    }
    gridAddPoints(staticBodies, jesterPoints);
  }

  const crowd = buildCrowdMesh('pillar-crowd', () => {
    // 1. the rim: people sitting on the edge, legs hanging over the side
    const SITTERS = 40;
    for (var seat = 0; seat < SITTERS; seat++) {
      for (var attempt = 0; attempt < 4; attempt++) {
        const angle = TWO_PI * (seat + random(-0.25, 0.25)) / SITTERS, size = randomPersonSize(0.97);
        const r = BASE_RADIUS - DANGLE_EDGE * size;
        const position = createVector(r * cos(angle), DANGLE_SEAT * size - 0.001, r * sin(angle));
        const outward = rotateAroundY(createVector(cos(angle), 0, sin(angle)), random(-0.25, 0.25));
        const legsOverEdge = p => {
          const distance = Math.hypot(p[0], p[2]), height = -p[1];
          return height < -0.003 ? distance > BASE_RADIUS + 0.002 : distance < BASE_RADIUS + 0.08;
        };
        if (placePose(staticBodies, 'dangle', position, up, outward, size, legsOverEdge)) break;
      }
    }

    // 2. the base, largest poses first so they still find room: fights and low bodies,
    //    then standing figures, then bodies sunk to the waist, and last the arms
    const onBase = p => {
      const distance = Math.hypot(p[0], p[2]), height = -p[1];
      if (distance > BASE_RADIUS - 0.004 || height < baseRockHeight(p[0], p[2]) - ROCK_EMBED) return false;  // not deep in the rock
      return distance > columnRadius(Math.max(0, height)) + 0.11 && clearOfTitle(p);  // clear of the thickest card
    };
    const fillBase = (names, tries, sizeFactor) => {
      for (var t = 0; t < tries; t++) {
        const angle = random(TWO_PI), distance = sqrt(random(sq(YEAR_RING_RADIUS), sq(BASE_RADIUS - 0.012)));
        const x = distance * cos(angle), z = distance * sin(angle), name = random(names);
        const ground = baseRockHeight(x, z) - groundSink(name, slopeAt(baseRockHeight, x, z));
        const turn = LONG_POSES.includes(name) ? random([-1, 1]) * random(1.1, 1.9) : random(-0.9, 0.9);
        const facing = rotateAroundY(createVector(-cos(angle), 0, -sin(angle)), turn);
        placePose(staticBodies, name, createVector(x, -ground, z), up, facing, randomPersonSize(sizeFactor), onBase);
      }
    };
    fillBase(FIGHT_POSES, 1400, 1);
    fillBase(LOW_POSES, 700, 1);
    fillBase(STANDING_POSES, 1600, 1);
    fillBase(SUNK_POSES, 2600, 1);
    fillBase(ARMS_ONLY_POSES.concat(['emergeChest']), 2500, 0.92);
    fillBase(ARMS_ONLY_POSES, 2000, 0.72);

    // 3. the dome: hands closing in on the jester's leg, the pile of bodies behind them,
    //    all kept inside the rim and above the rock
    const insideRim = p => {
      const height = -p[1], angle = unTwistedAngle(p[0], p[2], height), rock = domeHeightAt(p[0], p[2]);
      if (rock !== null && height < rock - ROCK_EMBED) return false;
      return height > rimHeight(angle) || Math.hypot(p[0], p[2]) < columnRadius(height) - CORE_INSET - 0.003;
    };
    const fillDome = (names, tries, sizeFactor, nearJester) => {
      for (var t = 0; t < tries; t++) {
        const angle = random(TWO_PI);
        var x, z;
        if (nearJester) {
          const r = random(0.01, nearJester);
          x = jesterToe.x + r * cos(angle); z = jesterToe.z + r * sin(angle);
        } else {
          const p = domePoint(angle, 0.97 * sqrt(random()));
          x = p.x; z = p.z;
        }
        const surface = domeHeightAt(x, z);
        if (surface === null) continue;
        const name = random(names), sink = groundSink(name, slopeAt(domeHeightAt, x, z));
        var facing = createVector(jesterToe.x - x, 0, jesterToe.z - z);
        if (facing.mag() < 1e-3) facing = createVector(1, 0, 0);
        facing = rotateAroundY(facing.normalize(), random(-0.5, 0.5));
        placePose(staticBodies, name, createVector(x, -surface + sink, z), up, facing, randomPersonSize(sizeFactor), insideRim);
      }
    };
    fillDome(['reachUp', 'clawUp', 'climb', 'reachOne', 'drown', 'duoPullDown', 'duoStepUp'], 900, 1, 0.13);
    fillDome(FIGHT_POSES, 1200, 1);
    fillDome(LOW_POSES, 500, 1);
    fillDome(STANDING_POSES.concat(['kneelPlead', 'climb']), 1800, 1);
    fillDome(SUNK_POSES, 1800, 1);
    fillDome(ARMS_ONLY_POSES.concat(['emergeChest']), 2000, 0.92);
    fillDome(ARMS_ONLY_POSES, 2000, 0.72);
  });
  crowd.clearColors();
  return crowd;
}

// --- The engraved title stays visible: no body may stand in front of it ---
function clearOfTitle(p) {
  const height = -p[1], angle = unTwistedAngle(p[0], p[2], height);
  const halfSpan = TITLE_AREA_WIDTH / (2 * (columnRadius(TITLE_CENTRE_HEIGHT) + FOUNDATION_DEPTH)) + 0.03;
  const inFront = Math.abs(angle - TITLE_CENTRE_ANGLE) < halfSpan && Math.abs(height - TITLE_CENTRE_HEIGHT) < TITLE_AREA_HEIGHT / 2 + 0.012;
  return !inFront;                                 // anywhere in front of it, near or far
}

// --- The cards as obstacles ---
function unTwistedAngle(x, z, height) { return ((Math.atan2(z, x) - twistAt(height)) % TWO_PI + TWO_PI) % TWO_PI; }

// Which week covers a point of the column (null on the foundation or above the cards)
function weekAt(x, z, height) {
  const { index, u, v } = cardCoordinates(unTwistedAngle(x, z, height), height);
  const tile = weekTiles[index];
  return tile ? { tile, u, v } : null;
}

// How far from the axis the surface really is at a point: a card's tilted face, the dark
// core in a seam, or the foundation (offsets run along the slanted surface, so they are
// divided by `tilt` to measure them flat)
function cardSurfaceRadius(x, z, height) {
  const angle = unTwistedAngle(x, z, height);
  const base = columnRadius(height), tilt = Math.sqrt(1 + columnSlope(height) ** 2);
  const { index, u, v } = cardCoordinates(angle, height);
  if (index < 0) return base + FOUNDATION_DEPTH / tilt;                 // the foundation
  if (index >= WEEK_COUNT) return height > rimHeight(angle) ? 0 : base - CORE_INSET / tilt;  // past the last card
  if (u < CARD_SEAM || u > 1 - CARD_SEAM || v < CARD_SEAM || v > 1 - CARD_SEAM) return base - CORE_INSET / tilt;
  return base + (0.5 * weekTiles[index].card.thickness + CARD_TILT * u) / tilt;
}

// --- The people dealt with each year: the ring at the foot of the column, pressed up
//     against this year's cards (only low figures in front of a face card) ---
function makeYearCrowd() {
  const up = createVector(0, -1, 0);
  const yearBodies = makeBodyGrid(staticBodies);

  // a body stays above the rock, out of the cards and the foundation, clear of the title...
  const outsideCards = p => {
    const height = -p[1];
    return height >= baseRockHeight(p[0], p[2]) - ROCK_EMBED && clearOfTitle(p) &&
      Math.hypot(p[0], p[2]) >= cardSurfaceRadius(p[0], p[2], Math.max(0, height));
  };
  // ...and never stands tall in front of a face card, so the court artwork stays visible
  const clearOfCards = p => {
    if (!outsideCards(p)) return false;
    const height = -p[1], hit = weekAt(p[0], p[2], Math.max(0, height));
    if (!hit || hit.tile.card.rank < JACK) return true;
    return height <= 0.034 || Math.hypot(p[0], p[2]) >= cardSurfaceRadius(p[0], p[2], height) + 0.2;
  };

  const yearCrowd = buildCrowdMesh(`pillar-year-${yearsDealt}`, () => {
    const fillRing = (names, tries, sizeFactor) => {
      for (var t = 0; t < tries; t++) {
        const angle = random(TWO_PI), distance = random(columnRadius(0) + 0.03, YEAR_RING_RADIUS + 0.01);
        const x = distance * cos(angle), z = distance * sin(angle), name = random(names);
        const ground = baseRockHeight(x, z) - groundSink(name, slopeAt(baseRockHeight, x, z));
        const facing = rotateAroundY(createVector(-cos(angle), 0, -sin(angle)), random(-0.6, 0.6));
        placePose(yearBodies, name, createVector(x, -ground, z), up, facing, randomPersonSize(sizeFactor), clearOfCards);
      }
    };
    fillRing(['reachUp', 'clawUp', 'kneelPlead', 'reachOne', 'punch', 'shove', 'grapple', 'fallBack', 'slopeClimb'], 900, 1);
    fillRing(LOW_POSES.concat(SUNK_POSES), 900, 1);
    fillRing(ARMS_ONLY_POSES, 1500, 0.85);
    fillRing(ARMS_ONLY_POSES, 1200, 0.7);
  });
  yearCrowd.clearColors();
  return yearCrowd;
}



//====================
// 9. SAVING AN IMAGE
//====================
// Saved with p5's saveCanvas(). In AR the canvas is see-through, so the camera frame and the
// statue are first combined on a p5 graphics layer, the camera cropped and mirrored exactly
// as it appears on screen.
const IMAGE_NAME = 'PillarOfWeeks';

function saveImage() {
  if (arView.on && arView.video) {
    const layer = createGraphics(width, height);
    layer.pixelDensity(pixelDensity());
    drawCameraFrame(layer);
    layer.image(mainCanvas, 0, 0, width, height);
    saveCanvas(layer, IMAGE_NAME, 'png');
    layer.remove();
  } else {
    saveCanvas(mainCanvas, IMAGE_NAME, 'png');
  }
  showToast(`Saved ${IMAGE_NAME}.png`);
}

// The camera image as the screen shows it: scaled to cover the layer, centred, and
// mirrored for a front camera
function drawCameraFrame(layer) {
  const videoW = arView.video.elt.videoWidth, videoH = arView.video.elt.videoHeight;
  if (!videoW) return;
  const k = max(layer.width / videoW, layer.height / videoH);
  layer.push();
  if (arView.mirrored) { layer.translate(layer.width, 0); layer.scale(-1, 1); }
  layer.image(arView.video, (layer.width - videoW * k) / 2, (layer.height - videoH * k) / 2, videoW * k, videoH * k);
  layer.pop();
}


//===============
// 10. AR MODE
//===============
// The live camera plays behind a transparent canvas. The statue is anchored to a point on
// screen and controlled by touch, by mouse, or by pinching in the air (ml5 handPose).

var arView = { on: false, video: null, stream: null, mirrored: false, x: 0, y: 0, yaw: 0, tilt: -0.35, scale: 0.55 };
var gyro = { available: false, alpha: 0, beta: 0, anchorAlpha: null, anchorBeta: null };

function enterAR() {
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('AR needs the camera: open this page over https (or localhost) in a modern browser.');
    return;
  }
  requestOrientationPermission();
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  }).then(stream => {
    arView.stream = stream;
    arView.video = createElement('video');
    const video = arView.video.elt;
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.muted = true;
    video.srcObject = stream;
    video.play();
    arView.mirrored = (stream.getVideoTracks()[0].getSettings() || {}).facingMode !== 'environment';
    arView.video.class('ar-video');
    arView.video.style('transform', arView.mirrored ? 'scaleX(-1)' : 'none');
    video.addEventListener('loadeddata', () => { syncVideoSize(); startHandTracking(); }, { once: true });
    video.addEventListener('resize', syncVideoSize);

    Object.assign(arView, { on: true, x: width / 2, y: height * 0.8, yaw: 0, tilt: -0.35, scale: 0.55 });
    resetGyroAnchor();
    setInterfaceMode();
    showToast(handTracking.ready ? 'Pinch in the air to grab the statue · or use touch' : 'Camera on · touch works straight away');
  }).catch(err => {
    showToast(`Camera unavailable (${err.name}). Allow camera access and try again.`);
  });
}

function exitAR() {
  stopHandTracking();
  if (arView.stream) arView.stream.getTracks().forEach(track => track.stop());
  if (arView.video) arView.video.remove();
  Object.assign(arView, { on: false, video: null, stream: null });
  setInterfaceMode();
}

// Move the statue to its screen anchor; on a phone held upright the gyroscope shifts it
// as the phone turns, so it seems to stay in place in the room
function applyArPlacement() {
  var shiftX = 0, shiftY = 0;
  if (gyro.available && gyro.anchorAlpha !== null && windowHeight > windowWidth) {
    const pixelsPerRadian = height * 0.85;
    shiftX = radians(wrap180(gyro.alpha - gyro.anchorAlpha)) * pixelsPerRadian;
    shiftY = radians(gyro.beta - gyro.anchorBeta) * pixelsPerRadian;
  }
  translate(arView.x + shiftX - width / 2, arView.y + shiftY - height / 2, 0);
  rotateX(arView.tilt);
}

function placeStatueAt(x, y) {
  arView.x = x;
  arView.y = y;
  resetGyroAnchor();
}

// --- Gyroscope ---
function watchDeviceOrientation() {
  window.addEventListener('deviceorientation', e => {
    if (e.alpha === null || e.beta === null) return;
    gyro.available = true;
    gyro.alpha = e.alpha;
    gyro.beta = e.beta;
    if (gyro.anchorAlpha === null) resetGyroAnchor();
  });
}

function requestOrientationPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().catch(() => { });
  }
}

function resetGyroAnchor() {
  gyro.anchorAlpha = gyro.available ? gyro.alpha : null;
  gyro.anchorBeta = gyro.available ? gyro.beta : null;
}

function wrap180(degrees) { return ((degrees + 540) % 360) - 180; }

// --- Hand tracking (ml5 handPose) ---
// One pinching hand rotates and tilts; two pinching hands zoom and move. Letting go leaves
// the statue exactly where it is.
const PINCH_CLOSE = 0.35;                          // fingers closer than this share of the hand's size start a pinch,
const PINCH_OPEN = 0.55;                           // and must open past this to let go, so a pinch never flickers
const RELEASE_DELAY = 200;                         // ms a pinch may vanish (a missed camera frame) and still be held

var handTracking = { model: null, ready: false, wanted: false, failed: false };
var detectedHands = [];                            // raw ml5 results
var handPoints = [];                               // fingertips in screen pixels
var handGrab = { mode: null, lastSeen: 0 };        // what the pinch is currently doing

// Create the hand model as soon as the page opens (ml5 itself is loaded by index.html) and
// run it once on a blank image, so the first real frame in AR is fast. Without ml5 (offline),
// AR still works by touch.
function loadHandModel() {
  if (typeof ml5 === 'undefined') { handTracking.failed = true; return; }
  handTracking.model = ml5.handPose({ maxHands: 2, flipped: false }, () => {
    const blank = document.createElement('canvas');
    blank.width = blank.height = 160;
    var warmedUp = false;
    const markReady = () => {
      if (warmedUp) return;
      warmedUp = true;
      handTracking.ready = true;
      if (handTracking.wanted) beginHandDetection();
    };
    try { handTracking.model.detect(blank, markReady); } catch (e) { markReady(); }
    setTimeout(markReady, 4000);
  });
}

function startHandTracking() {
  handTracking.wanted = true;
  if (handTracking.ready) return beginHandDetection();
  ui.hint.html(handTracking.failed ? TEXT.arHintTouchOnly : TEXT.arHintLoading);
}

function beginHandDetection() {
  if (!arView.on || !arView.video || !handTracking.wanted) return;
  syncVideoSize();
  handTracking.model.detectStart(arView.video.elt, results => { detectedHands = results || []; });
  ui.hint.html(TEXT.arHint);
}

function stopHandTracking() {
  handTracking.wanted = false;
  if (handTracking.model && handTracking.model.detectStop) handTracking.model.detectStop();
  detectedHands = []; handPoints = []; handGrab = { mode: null, lastSeen: 0 };
  drawHandMarkers();
}

// Copy the camera's size to where each library reads it: ml5 reads the video element's
// width/height attributes (without them every point is NaN), and p5's image() reads the
// p5 element's width/height (without them nothing is drawn when saving an image)
function syncVideoSize() {
  if (!arView.video) return;
  const video = arView.video.elt;
  if (!video.videoWidth) return;
  video.width = arView.video.width = video.videoWidth;
  video.height = arView.video.height = video.videoHeight;
}

// Camera pixel -> screen pixel (the video fills the screen with object-fit: cover)
function videoToScreen(p) {
  const video = arView.video.elt, videoW = video.videoWidth || 1, videoH = video.videoHeight || 1;
  const box = video.getBoundingClientRect();
  const k = max(box.width / videoW, box.height / videoH);
  var x = (box.width - videoW * k) / 2 + p.x * k;
  const y = box.top + (box.height - videoH * k) / 2 + p.y * k;
  if (arView.mirrored) x = box.width - x;
  return { x: box.left + x, y };
}

// Hands are followed by the middle knuckle, which stays still while the fingers open and
// close, so letting go of a pinch does not nudge the statue
function updateHandControl() {
  const hands = arView.video ? detectedHands : [];
  handPoints = hands.filter(h => h.thumb_tip && h.index_finger_tip).map(h => {
    const thumb = videoToScreen(h.thumb_tip), index = videoToScreen(h.index_finger_tip);
    const wrist = videoToScreen(h.wrist), knuckle = videoToScreen(h.middle_finger_mcp);
    const handSize = max(20, dist(wrist.x, wrist.y, knuckle.x, knuckle.y));
    const fingerGap = dist(thumb.x, thumb.y, index.x, index.y) / handSize;
    return {
      thumb, index, x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2, anchor: knuckle,
      pinching: fingerGap < (handGrab.mode ? PINCH_OPEN : PINCH_CLOSE),
    };
  });
  const pinches = handPoints.filter(h => h.pinching).sort((a, b) => a.anchor.x - b.anchor.x);

  if (pinches.length === 0) {
    // hold the grab through a missed frame; after that, let go and leave the statue where it is
    if (handGrab.mode && millis() - handGrab.lastSeen > RELEASE_DELAY) handGrab = { mode: null, lastSeen: 0 };
    return;
  }

  if (pinches.length >= 2) {
    const a = pinches[0].anchor, b = pinches[1].anchor;
    const spread = dist(a.x, a.y, b.x, b.y), midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
    if (handGrab.mode !== 'two') handGrab = { mode: 'two', spread, scale: arView.scale, midX, midY, startX: arView.x, startY: arView.y };
    arView.scale = lerp(arView.scale, constrain(handGrab.scale * spread / handGrab.spread, 0.15, 3), 0.35);
    arView.x = lerp(arView.x, handGrab.startX + midX - handGrab.midX, 0.35);
    arView.y = lerp(arView.y, handGrab.startY + midY - handGrab.midY, 0.35);
  } else {
    const p = pinches[0].anchor;
    if (handGrab.mode !== 'one') handGrab = { mode: 'one', x: p.x, y: p.y, yaw: arView.yaw, tilt: arView.tilt };
    arView.yaw = lerp(arView.yaw, handGrab.yaw + (p.x - handGrab.x) * 0.01, 0.35);
    arView.tilt = lerp(arView.tilt, constrain(handGrab.tilt + (p.y - handGrab.y) * 0.005, -1.3, 0.5), 0.35);
  }
  handGrab.lastSeen = millis();
}

// Fingertip dots over the camera image; a gold ring shows a pinch
var handMarkers = [];
function handMarker(i) {
  if (!handMarkers[i]) handMarkers[i] = createDiv('').class(i % 3 === 2 ? 'hand-ring' : 'hand-dot');
  return handMarkers[i];
}

function drawHandMarkers() {
  var used = 0;
  const show = (x, y) => {
    const marker = handMarker(used++);
    marker.style('display', 'block');
    marker.style('transform', `translate(${x}px, ${y}px)`);
  };
  for (const hand of handPoints) {
    show(hand.thumb.x, hand.thumb.y);
    show(hand.index.x, hand.index.y);
    if (hand.pinching) show(hand.x, hand.y); else used++;
  }
  for (var i = used; i < handMarkers.length; i++) handMarkers[i].style('display', 'none');
}

// --- Touch and mouse in AR ---
// One finger rotates and tilts (tap to place); two fingers pinch, twist and move.
// Mouse: drag rotates and tilts, shift-drag moves, scroll zooms, click places.
var gesture = null;

function onCanvas(e) { return e && e.target === mainCanvas.elt; }

function startTwoFingerGesture() {
  const [a, b] = touches;
  gesture = {
    type: 'two', spread: dist(a.x, a.y, b.x, b.y), angle: atan2(b.y - a.y, b.x - a.x),
    scale: arView.scale, yaw: arView.yaw, midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, startX: arView.x, startY: arView.y,
  };
}

function touchStarted(e) {
  if (!arView.on || !onCanvas(e)) return;
  if (touches.length === 1) {
    gesture = { type: 'one', x: touches[0].x, y: touches[0].y, yaw: arView.yaw, tilt: arView.tilt, time: millis(), moved: false };
  } else if (touches.length >= 2) {
    startTwoFingerGesture();
  }
  return false;
}

function touchMoved() {
  if (!arView.on || !gesture) return;
  if (gesture.type === 'one' && touches.length === 1) {
    const dx = touches[0].x - gesture.x, dy = touches[0].y - gesture.y;
    if (abs(dx) > 8 || abs(dy) > 8) gesture.moved = true;
    arView.yaw = gesture.yaw + dx * 0.012;
    arView.tilt = constrain(gesture.tilt + dy * 0.006, -1.3, 0.5);
  } else if (touches.length >= 2) {
    if (gesture.type !== 'two') startTwoFingerGesture();
    const [a, b] = touches;
    arView.scale = constrain(gesture.scale * dist(a.x, a.y, b.x, b.y) / gesture.spread, 0.15, 3);
    arView.yaw = gesture.yaw + (atan2(b.y - a.y, b.x - a.x) - gesture.angle);
    arView.x = gesture.startX + (a.x + b.x) / 2 - gesture.midX;
    arView.y = gesture.startY + (a.y + b.y) / 2 - gesture.midY;
  }
  return false;
}

function touchEnded() {
  if (!arView.on || !gesture) return;
  if (gesture.type === 'one' && !gesture.moved && millis() - gesture.time < 350 && touches.length === 0) {
    placeStatueAt(gesture.x, gesture.y);
  }
  if (touches.length === 0) gesture = null;
  return false;
}

function mousePressed(e) {
  if (!arView.on || !onCanvas(e)) return;
  gesture = { type: 'one', x: mouseX, y: mouseY, yaw: arView.yaw, tilt: arView.tilt, startX: arView.x, startY: arView.y, moved: false };
}

function mouseDragged() {
  if (!arView.on || !gesture) return;
  const dx = mouseX - gesture.x, dy = mouseY - gesture.y;
  if (abs(dx) > 4 || abs(dy) > 4) gesture.moved = true;
  if (keyIsDown(SHIFT)) {
    arView.x = gesture.startX + dx;
    arView.y = gesture.startY + dy;
  } else {
    arView.yaw = gesture.yaw + dx * 0.012;
    arView.tilt = constrain(gesture.tilt + dy * 0.006, -1.3, 0.5);
  }
}

function mouseReleased() {
  if (!arView.on || !gesture) return;
  if (!gesture.moved) placeStatueAt(mouseX, mouseY);
  gesture = null;
}

function mouseWheel(e) {
  if (!arView.on) return;
  arView.scale = constrain(arView.scale * (e.delta > 0 ? 0.92 : 1.08), 0.15, 3);
  return false;
}

//===============
// 11. INTERFACE
//===============

// p5 DOM elements styled by one stylesheet written here (index.html and style.css are
// left as they are). body.ar switches to AR mode; the media queries handle phones.

const TEXT = {
  subtitle: 'what you dealt deserve to stand',
  controls: 'DRAG TO ROTATE · SCROLL TO ZOOM',
  arHint: 'PINCH THE AIR TO ROTATE · TWO HANDS TO ZOOM · OR TOUCH',
  arHintLoading: 'PREPARING HAND CONTROL… TOUCH WORKS MEANWHILE',
  arHintTouchOnly: 'DRAG TO ROTATE · PINCH TO ZOOM · TAP TO PLACE',
  shuffle: 'SHUFFLE THE YEAR',
  arOn: 'AR MODE',
  arOff: 'EXIT AR',
  save: 'SAVE AS IMAGE',
};

const INTERFACE_CSS = `
body { margin: 0; overflow: hidden; touch-action: none; background: #121115; color: #efe6d2;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; }
body.ar { background: #000; }
.ui { position: fixed; z-index: 2; pointer-events: none; text-shadow: 0 1px 8px rgba(0,0,0,0.7); }
.ui-center { left: 50%; transform: translateX(-50%); white-space: nowrap; }
.ui-title { top: 22px; font: 700 min(56px, 11.8vw)/1 'DIN Condensed', 'Bahnschrift', 'Avenir Next Condensed', 'Arial Narrow', sans-serif;
  font-stretch: condensed; letter-spacing: 0.08em; }
.ui-title i { font: italic 400 0.62em 'Times New Roman', Times, serif; letter-spacing: 0; margin: 0 0.62em 0 0.22em; position: relative; top: -0.08em; }
.ui-sub { top: 76px; font-size: 13px; letter-spacing: 0.04em; color: rgba(239, 230, 210, 0.62); }
.ui-info { left: 32px; bottom: 30px; }
.ui-key { font-size: 13px; line-height: 1.75; color: rgba(239, 230, 210, 0.62); }
.ui-key div { white-space: nowrap; }
.ui-key b { color: #efe6d2; letter-spacing: 0.06em; }
.ui-hint { bottom: 84px; font-size: 10px; letter-spacing: 0.2em; color: rgba(239, 230, 210, 0.75); }
body.ar .ui-hint { color: #efe6d2; text-shadow: 0 1px 6px rgba(0,0,0,0.9); }
.ui-bar { bottom: 26px; display: flex; gap: 10px; align-items: center; pointer-events: auto; }
.ui-btn { background: rgba(18, 17, 21, 0.35); color: #efe6d2; border: 1px solid rgba(201, 168, 90, 0.55); border-radius: 999px;
  padding: 10px 20px 8px; min-width: 150px; font: 700 14px 'DIN Condensed', 'Bahnschrift', 'Arial Narrow', sans-serif;
  letter-spacing: 0.2em; cursor: pointer; backdrop-filter: blur(4px); transition: background 0.25s, color 0.25s; }
.ui-btn.primary { background: rgba(18, 17, 21, 0.6); border-color: #c9a85a; padding: 12px 30px 10px; min-width: 0; font-size: 17px; }
.ui-btn:hover { background: #c9a85a; color: #121115; }
.ui-toast { top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 3; background: rgba(18, 17, 21, 0.85);
  border: 1px solid #c9a85a; border-radius: 14px; padding: 14px 20px; font-size: 13px; max-width: 80vw; text-align: center;
  display: none; }
.ui-toast.show { display: block; }
body.ar .ui-info { display: none; }
.ar-video { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; background: #000; }
.hand-dot, .hand-ring { position: fixed; left: 0; top: 0; z-index: 2; pointer-events: none; border-radius: 50%; display: none; box-sizing: border-box; }
.hand-dot { width: 12px; height: 12px; margin: -6px 0 0 -6px; background: rgba(255, 246, 225, 0.9); border: 1px solid rgba(0,0,0,0.4); }
.hand-ring { width: 38px; height: 38px; margin: -19px 0 0 -19px; border: 3px solid #c9a85a; }
@media (max-width: 1150px) { .ui-info { bottom: 132px; } }
@media (max-width: 600px) {
  .ui-sub { top: 62px; }
  .ui-info { top: 92px; bottom: auto; left: 50%; transform: translateX(-50%); text-align: center; }
  .ui-key { font-size: 10.5px; line-height: 1.5; display: grid; grid-template-columns: auto auto; column-gap: 14px; text-align: left; }
  .ui-bar { width: 92vw; flex-wrap: wrap; justify-content: center; }
  .ui-btn { min-width: 140px; }
  .ui-btn.primary { order: 3; }
  .ui-hint { bottom: 126px; font-size: 9px; letter-spacing: 0.14em; }
}`;

var ui = {};

// Title, caption, colour key, instruction line, the three buttons, and a toast message
function buildInterface() {
  createElement('style', INTERFACE_CSS);
  createDiv('PILLAR<i>of</i>WEEKS').class('ui ui-center ui-title');
  createDiv(TEXT.subtitle).class('ui ui-center ui-sub');
  const colourKey = FEELINGS.map(f => `<div><span style="color:rgb(${f.color})">●</span> <b>${f.name}</b> — ${f.meaning}</div>`).join('');
  createDiv(`<div class="ui-key">${colourKey}</div>`).class('ui ui-info');
  ui.hint = createDiv(TEXT.controls).class('ui ui-center ui-hint');
  ui.buttonBar = createDiv('').class('ui ui-center ui-bar');
  ui.arButton = makeButton(TEXT.arOn, '', () => (arView.on ? exitAR() : enterAR()));
  makeButton(TEXT.shuffle, 'primary', () => dealNewYear());
  makeButton(TEXT.save, '', () => saveImage());
  ui.toast = createDiv('').class('ui ui-toast');
}

function makeButton(label, kind, action) {
  const button = createButton(label).class(`ui-btn ${kind}`).parent(ui.buttonBar);
  button.elt.addEventListener('click', action);
  return button;
}

function showToast(message) {
  ui.toast.html(message);
  ui.toast.addClass('show');
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => ui.toast.removeClass('show'), 3200);
}

// Switch the interface between the studio view and AR
function setInterfaceMode() {
  if (arView.on) studioView.underside = false;
  document.body.classList.toggle('ar', arView.on);
  ui.arButton.html(arView.on ? TEXT.arOff : TEXT.arOn);
  ui.hint.html(arView.on ? TEXT.arHint : TEXT.controls);
}
