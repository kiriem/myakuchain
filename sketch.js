// ぷよぷよゲーム - p5.js実装（ポップデザイン版）

// ゲーム設定
const COLS = 6;
const ROWS = 12;
const HIDDEN_ROWS = 1;
const TOTAL_ROWS = ROWS + HIDDEN_ROWS;
const CELL_SIZE = 40;
const NUM_COLORS = 4;

// ゲーム状態
const STATE_PLAYING = 0;
const STATE_DROPPING = 1;
const STATE_CHECKING = 2;
const STATE_ERASING = 3;
const STATE_CHAIN_DROPPING = 4;
const STATE_GAMEOVER = 5;

// 色の定義
const COLOR_NAMES = [null, 'red', 'green', 'blue', 'yellow'];
const SHADOW_COLORS = [
    null,
    [180, 40, 60],    // 赤の影
    [30, 160, 90],    // 緑の影
    [40, 100, 200],   // 青の影
    [200, 150, 20],   // 黄の影
];

// ゲーム変数
let field;
let currentPuyo;
let nextPuyo;
let nextNextPuyo;
let gameState;
let dropTimer;
let dropInterval;
let score;
let chainCount;
let eraseTimer;
let erasingPuyos;
let puyoImages = {};
let puyoStates = {};

// アニメーション用
let globalTime = 0;
let particles = [];
let chainPopups = [];

// キャンバスサイズ
let canvasWidth;
let canvasHeight;
let fieldOffsetX;
let fieldOffsetY;

function preload() {
    puyoImages['red'] = loadImage('svg/puyo_red.svg');
    puyoImages['green'] = loadImage('svg/puyo_green.svg');
    puyoImages['blue'] = loadImage('svg/puyo_blue.svg');
    puyoImages['yellow'] = loadImage('svg/puyo_yellow.svg');
}

function setup() {
    canvasWidth = CELL_SIZE * COLS + 200;
    canvasHeight = CELL_SIZE * ROWS + 60;
    fieldOffsetX = 20;
    fieldOffsetY = 50;

    let canvas = createCanvas(canvasWidth, canvasHeight);
    canvas.parent('game-container');

    initGame();
}

function initGame() {
    field = [];
    for (let y = 0; y < TOTAL_ROWS; y++) {
        field[y] = [];
        for (let x = 0; x < COLS; x++) {
            field[y][x] = 0;
        }
    }

    gameState = STATE_PLAYING;
    dropTimer = 0;
    dropInterval = 30;
    score = 0;
    chainCount = 0;
    eraseTimer = 0;
    erasingPuyos = [];
    puyoStates = {};
    particles = [];
    chainPopups = [];

    nextPuyo = createPuyoPair();
    nextNextPuyo = createPuyoPair();
    spawnPuyo();
}

function createPuyoPair() {
    return {
        color1: floor(random(1, NUM_COLORS + 1)),
        color2: floor(random(1, NUM_COLORS + 1))
    };
}

function spawnPuyo() {
    currentPuyo = {
        x: 2,
        y: 1,
        color1: nextPuyo.color1,
        color2: nextPuyo.color2,
        rotation: 0
    };

    nextPuyo = nextNextPuyo;
    nextNextPuyo = createPuyoPair();

    if (!canPlace(currentPuyo.x, currentPuyo.y, currentPuyo.rotation)) {
        gameState = STATE_GAMEOVER;
    }
}

function getSecondPuyoOffset(rotation) {
    switch (rotation) {
        case 0: return { dx: 0, dy: -1 };
        case 1: return { dx: 1, dy: 0 };
        case 2: return { dx: 0, dy: 1 };
        case 3: return { dx: -1, dy: 0 };
    }
}

function canPlace(x, y, rotation) {
    let offset = getSecondPuyoOffset(rotation);
    let x2 = x + offset.dx;
    let y2 = y + offset.dy;

    if (x < 0 || x >= COLS || y < 0 || y >= TOTAL_ROWS) return false;
    if (x2 < 0 || x2 >= COLS || y2 < 0 || y2 >= TOTAL_ROWS) return false;
    if (field[y][x] !== 0) return false;
    if (field[y2][x2] !== 0) return false;

    return true;
}

function moveLeft() {
    if (canPlace(currentPuyo.x - 1, currentPuyo.y, currentPuyo.rotation)) {
        currentPuyo.x--;
    }
}

function moveRight() {
    if (canPlace(currentPuyo.x + 1, currentPuyo.y, currentPuyo.rotation)) {
        currentPuyo.x++;
    }
}

function rotateLeft() {
    let newRotation = (currentPuyo.rotation + 3) % 4;
    if (canPlace(currentPuyo.x, currentPuyo.y, newRotation)) {
        currentPuyo.rotation = newRotation;
    } else if (canPlace(currentPuyo.x + 1, currentPuyo.y, newRotation)) {
        currentPuyo.x++;
        currentPuyo.rotation = newRotation;
    } else if (canPlace(currentPuyo.x - 1, currentPuyo.y, newRotation)) {
        currentPuyo.x--;
        currentPuyo.rotation = newRotation;
    }
}

function rotateRight() {
    let newRotation = (currentPuyo.rotation + 1) % 4;
    if (canPlace(currentPuyo.x, currentPuyo.y, newRotation)) {
        currentPuyo.rotation = newRotation;
    } else if (canPlace(currentPuyo.x + 1, currentPuyo.y, newRotation)) {
        currentPuyo.x++;
        currentPuyo.rotation = newRotation;
    } else if (canPlace(currentPuyo.x - 1, currentPuyo.y, newRotation)) {
        currentPuyo.x--;
        currentPuyo.rotation = newRotation;
    }
}

function canDrop() {
    let offset = getSecondPuyoOffset(currentPuyo.rotation);
    let x1 = currentPuyo.x;
    let y1 = currentPuyo.y + 1;
    let x2 = currentPuyo.x + offset.dx;
    let y2 = currentPuyo.y + offset.dy + 1;

    if (y1 >= TOTAL_ROWS || y2 >= TOTAL_ROWS) return false;
    if (field[y1][x1] !== 0 || field[y2][x2] !== 0) return false;

    return true;
}

function placePuyo() {
    let offset = getSecondPuyoOffset(currentPuyo.rotation);
    let x1 = currentPuyo.x;
    let y1 = currentPuyo.y;
    let x2 = currentPuyo.x + offset.dx;
    let y2 = currentPuyo.y + offset.dy;

    if (y1 >= 0 && y1 < TOTAL_ROWS) {
        field[y1][x1] = currentPuyo.color1;
        initPuyoState(x1, y1);
    }
    if (y2 >= 0 && y2 < TOTAL_ROWS) {
        field[y2][x2] = currentPuyo.color2;
        initPuyoState(x2, y2);
    }

    gameState = STATE_DROPPING;
}

function initPuyoState(x, y) {
    let key = x + ',' + y;
    puyoStates[key] = {
        blinking: false,
        blinkFrame: 0,
        nextBlink: floor(random(60, 300)),
        rotation: floor(random(0, 360)),
        wobbleOffset: random(0, TWO_PI),  // ゆらゆらのオフセット
        scale: 1.2,  // 着地時の拡大（アニメーション用）
        bounceY: -5   // バウンス用
    };
}

function updatePuyoStates() {
    for (let y = 0; y < TOTAL_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (field[y][x] !== 0) {
                let key = x + ',' + y;
                if (!puyoStates[key]) {
                    initPuyoState(x, y);
                }

                let state = puyoStates[key];

                // スケールを徐々に1に戻す
                state.scale = lerp(state.scale, 1, 0.15);
                // バウンスを徐々に0に戻す
                state.bounceY = lerp(state.bounceY, 0, 0.2);

                if (state.blinking) {
                    state.blinkFrame++;
                    if (state.blinkFrame >= 8) {
                        state.blinking = false;
                        state.blinkFrame = 0;
                        state.nextBlink = floor(random(60, 300));
                    }
                } else {
                    state.nextBlink--;
                    if (state.nextBlink <= 0) {
                        state.blinking = true;
                        state.blinkFrame = 0;
                    }
                }
            }
        }
    }
}

function getPuyoState(x, y) {
    let key = x + ',' + y;
    return puyoStates[key] || { blinking: false, blinkFrame: 0, rotation: 0, wobbleOffset: 0, scale: 1, bounceY: 0 };
}

function dropFieldPuyos() {
    let dropped = false;

    for (let x = 0; x < COLS; x++) {
        for (let y = TOTAL_ROWS - 2; y >= 0; y--) {
            if (field[y][x] !== 0 && field[y + 1][x] === 0) {
                field[y + 1][x] = field[y][x];
                field[y][x] = 0;

                let oldKey = x + ',' + y;
                let newKey = x + ',' + (y + 1);
                if (puyoStates[oldKey]) {
                    puyoStates[newKey] = puyoStates[oldKey];
                    puyoStates[newKey].bounceY = -3;  // 落下時のバウンス
                    delete puyoStates[oldKey];
                }

                dropped = true;
            }
        }
    }

    return dropped;
}

function checkAndErase() {
    let toErase = [];
    let checked = [];

    for (let y = 0; y < TOTAL_ROWS; y++) {
        checked[y] = [];
        for (let x = 0; x < COLS; x++) {
            checked[y][x] = false;
        }
    }

    for (let y = 0; y < TOTAL_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (field[y][x] !== 0 && !checked[y][x]) {
                let connected = [];
                findConnected(x, y, field[y][x], checked, connected);

                if (connected.length >= 4) {
                    toErase = toErase.concat(connected);
                }
            }
        }
    }

    return toErase;
}

function findConnected(x, y, color, checked, connected) {
    if (x < 0 || x >= COLS || y < 0 || y >= TOTAL_ROWS) return;
    if (checked[y][x]) return;
    if (field[y][x] !== color) return;

    checked[y][x] = true;
    connected.push({ x: x, y: y, color: color });

    findConnected(x - 1, y, color, checked, connected);
    findConnected(x + 1, y, color, checked, connected);
    findConnected(x, y - 1, color, checked, connected);
    findConnected(x, y + 1, color, checked, connected);
}

function erasePuyos(puyoList) {
    let erasedCount = puyoList.length;
    let chainBonus = Math.pow(2, chainCount);
    score += erasedCount * 10 * chainBonus;

    // パーティクル生成
    for (let puyo of puyoList) {
        let px = fieldOffsetX + puyo.x * CELL_SIZE + CELL_SIZE / 2;
        let py = fieldOffsetY + (puyo.y - HIDDEN_ROWS) * CELL_SIZE + CELL_SIZE / 2;
        createParticles(px, py, puyo.color);

        field[puyo.y][puyo.x] = 0;
        let key = puyo.x + ',' + puyo.y;
        delete puyoStates[key];
    }

    // 連鎖ポップアップ
    if (chainCount > 0) {
        chainPopups.push({
            text: chainCount + ' Chain!',
            x: fieldOffsetX + CELL_SIZE * COLS / 2,
            y: fieldOffsetY + CELL_SIZE * ROWS / 2,
            life: 60,
            maxLife: 60
        });
    }
}

function createParticles(x, y, colorIndex) {
    let shadowCol = SHADOW_COLORS[colorIndex] || [200, 200, 200];
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            vx: random(-5, 5),
            vy: random(-8, -2),
            size: random(8, 15),
            color: shadowCol,
            life: 40
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;  // 重力
        p.life--;
        p.size *= 0.95;

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    noStroke();
    for (let p of particles) {
        let alpha = map(p.life, 0, 40, 0, 255);
        fill(p.color[0], p.color[1], p.color[2], alpha);
        ellipse(p.x, p.y, p.size, p.size);
    }
}

function updateChainPopups() {
    for (let i = chainPopups.length - 1; i >= 0; i--) {
        let popup = chainPopups[i];
        popup.life--;
        popup.y -= 1;

        if (popup.life <= 0) {
            chainPopups.splice(i, 1);
        }
    }
}

function drawChainPopups() {
    for (let popup of chainPopups) {
        let alpha = map(popup.life, 0, popup.maxLife, 0, 255);
        let scale = map(popup.life, popup.maxLife, 0, 1.5, 1);

        push();
        translate(popup.x, popup.y);
        scale = constrain(scale, 1, 1.5);
        textAlign(CENTER, CENTER);
        textSize(28 * scale);

        // 影
        fill(0, 0, 0, alpha * 0.3);
        text(popup.text, 3, 3);

        // メインテキスト
        fill(255, 220, 50, alpha);
        stroke(255, 100, 50, alpha);
        strokeWeight(3);
        text(popup.text, 0, 0);
        pop();
    }
}

function checkGameOver() {
    if (field[0][2] !== 0 || field[0][3] !== 0) {
        return true;
    }
    return false;
}

function draw() {
    globalTime += 0.05;

    // グラデーション背景
    drawBackground();

    updatePuyoStates();
    updateParticles();
    updateChainPopups();

    switch (gameState) {
        case STATE_PLAYING:
            updatePlaying();
            break;
        case STATE_DROPPING:
            updateDropping();
            break;
        case STATE_CHECKING:
            updateChecking();
            break;
        case STATE_ERASING:
            updateErasing();
            break;
        case STATE_CHAIN_DROPPING:
            updateChainDropping();
            break;
    }

    drawField();
    drawCurrentPuyo();
    drawParticles();
    drawNextPuyo();
    drawScore();
    drawChainPopups();

    if (gameState === STATE_GAMEOVER) {
        drawGameOver();
    }
}

function drawBackground() {
    // メイン背景
    let c1 = color(240, 245, 255);
    let c2 = color(220, 230, 250);
    for (let y = 0; y < height; y++) {
        let inter = map(y, 0, height, 0, 1);
        let c = lerpColor(c1, c2, inter);
        stroke(c);
        line(0, y, width, y);
    }

    // 装飾的な円
    noStroke();
    fill(255, 100, 100, 20);
    ellipse(width * 0.8, height * 0.2, 150 + sin(globalTime) * 20, 150 + sin(globalTime) * 20);
    fill(100, 100, 255, 20);
    ellipse(width * 0.2, height * 0.8, 120 + cos(globalTime) * 15, 120 + cos(globalTime) * 15);
}

function updatePlaying() {
    dropTimer++;

    if (dropTimer >= dropInterval) {
        dropTimer = 0;
        if (canDrop()) {
            currentPuyo.y++;
        } else {
            placePuyo();
        }
    }
}

function updateDropping() {
    if (!dropFieldPuyos()) {
        gameState = STATE_CHECKING;
    }
}

function updateChecking() {
    erasingPuyos = checkAndErase();

    if (erasingPuyos.length > 0) {
        chainCount++;
        eraseTimer = 0;
        gameState = STATE_ERASING;
    } else {
        chainCount = 0;

        if (checkGameOver()) {
            gameState = STATE_GAMEOVER;
        } else {
            spawnPuyo();
            gameState = STATE_PLAYING;
        }
    }
}

function updateErasing() {
    eraseTimer++;

    if (eraseTimer >= 20) {
        erasePuyos(erasingPuyos);
        erasingPuyos = [];
        gameState = STATE_CHAIN_DROPPING;
    }
}

function updateChainDropping() {
    if (!dropFieldPuyos()) {
        gameState = STATE_CHECKING;
    }
}

function drawField() {
    // フィールド背景（角丸）
    fill(255, 255, 255, 200);
    stroke(200, 210, 230);
    strokeWeight(3);
    rect(fieldOffsetX - 5, fieldOffsetY - 5, CELL_SIZE * COLS + 10, CELL_SIZE * ROWS + 10, 15);

    // グリッド
    stroke(230, 235, 245);
    strokeWeight(1);
    for (let x = 1; x < COLS; x++) {
        line(fieldOffsetX + x * CELL_SIZE, fieldOffsetY,
             fieldOffsetX + x * CELL_SIZE, fieldOffsetY + CELL_SIZE * ROWS);
    }
    for (let y = 1; y < ROWS; y++) {
        line(fieldOffsetX, fieldOffsetY + y * CELL_SIZE,
             fieldOffsetX + CELL_SIZE * COLS, fieldOffsetY + y * CELL_SIZE);
    }

    // ぷよを描画
    for (let y = HIDDEN_ROWS; y < TOTAL_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (field[y][x] !== 0) {
                let isErasing = erasingPuyos.some(p => p.x === x && p.y === y);
                let puyoState = getPuyoState(x, y);
                drawPuyo(x, y - HIDDEN_ROWS, field[y][x], isErasing, puyoState);
            }
        }
    }

    // 窒息マーク
    drawDeathMark();
}

function drawPuyo(gridX, gridY, colorIndex, isErasing = false, puyoState = null) {
    let x = fieldOffsetX + gridX * CELL_SIZE + CELL_SIZE / 2;
    let y = fieldOffsetY + gridY * CELL_SIZE + CELL_SIZE / 2;
    let size = CELL_SIZE * 0.85;

    let colorName = COLOR_NAMES[colorIndex];
    if (!colorName || !puyoImages[colorName]) return;

    let rotation = puyoState ? puyoState.rotation : 0;
    let wobbleOffset = puyoState ? puyoState.wobbleOffset : 0;
    let puyoScale = puyoState ? puyoState.scale : 1;
    let bounceY = puyoState ? puyoState.bounceY : 0;

    // ゆらゆらアニメーション
    let wobble = sin(globalTime * 2 + wobbleOffset) * 2;
    let scaleWobble = 1 + sin(globalTime * 3 + wobbleOffset) * 0.03;

    // 消去中は点滅と揺れ
    if (isErasing) {
        if (frameCount % 4 < 2) {
            size *= 1.1;
        }
        wobble = sin(globalTime * 20) * 5;
    }

    // 本体
    push();
    imageMode(CENTER);
    translate(x, y + bounceY + wobble);
    rotate(radians(rotation));
    let finalScale = puyoScale * scaleWobble;
    image(puyoImages[colorName], 0, 0, size * finalScale, size * finalScale);
    pop();

    // 目
    if (!isErasing) {
        drawEye(x, y + bounceY + wobble, size * puyoScale * scaleWobble, puyoState);
    }
}

function drawEye(x, y, size, puyoState) {
    let eyeOffsetX = size * 0.12;
    let eyeOffsetY = -size * 0.10;
    let eyeRadius = size * 0.18;
    let pupilRadius = size * 0.09;

    let isBlinking = puyoState && puyoState.blinking;
    let blinkProgress = isBlinking ? puyoState.blinkFrame / 8 : 0;
    let puyoRotation = puyoState ? puyoState.rotation : 0;

    let closedness = 0;
    if (isBlinking) {
        if (blinkProgress < 0.5) {
            closedness = blinkProgress * 2;
        } else {
            closedness = (1 - blinkProgress) * 2;
        }
    }

    let rotRad = radians(puyoRotation);
    let rotatedEyeX = eyeOffsetX * cos(rotRad) - eyeOffsetY * sin(rotRad);
    let rotatedEyeY = eyeOffsetX * sin(rotRad) + eyeOffsetY * cos(rotRad);

    push();
    translate(x + rotatedEyeX, y + rotatedEyeY);

    // 白目
    fill(255);
    noStroke();
    let currentEyeHeight = eyeRadius * 2 * (1 - closedness * 0.9);
    ellipse(0, 0, eyeRadius * 2, currentEyeHeight);

    // 瞳
    if (closedness < 0.7) {
        fill(59, 130, 246);
        let currentPupilRadius = pupilRadius * (1 - closedness);
        let pupilAngle = radians(-45) + rotRad;
        let pupilDistance = eyeRadius - currentPupilRadius * 0.8;
        let pupilX = cos(pupilAngle) * pupilDistance;
        let pupilY = sin(pupilAngle) * pupilDistance * (1 - closedness * 0.9);
        ellipse(pupilX, pupilY, currentPupilRadius * 2, currentPupilRadius * 2 * (1 - closedness * 0.5));
    }

    pop();
}

function drawCurrentPuyo() {
    if (gameState !== STATE_PLAYING || !currentPuyo) return;

    let offset = getSecondPuyoOffset(currentPuyo.rotation);
    let y1 = currentPuyo.y - HIDDEN_ROWS;
    let y2 = currentPuyo.y + offset.dy - HIDDEN_ROWS;

    let openState = { blinking: false, blinkFrame: 0, rotation: 0, wobbleOffset: 0, scale: 1, bounceY: 0 };

    if (y1 >= 0) {
        drawPuyo(currentPuyo.x, y1, currentPuyo.color1, false, openState);
    }
    if (y2 >= 0) {
        drawPuyo(currentPuyo.x + offset.dx, y2, currentPuyo.color2, false, openState);
    }

    drawGhost();
}

function drawGhost() {
    let ghostY = currentPuyo.y;

    while (true) {
        let offset = getSecondPuyoOffset(currentPuyo.rotation);
        let y1 = ghostY + 1;
        let y2 = ghostY + offset.dy + 1;
        let x1 = currentPuyo.x;
        let x2 = currentPuyo.x + offset.dx;

        if (y1 >= TOTAL_ROWS || y2 >= TOTAL_ROWS) break;
        if (field[y1][x1] !== 0 || field[y2][x2] !== 0) break;

        ghostY++;
    }

    if (ghostY === currentPuyo.y) return;

    let offset = getSecondPuyoOffset(currentPuyo.rotation);
    let gy1 = ghostY - HIDDEN_ROWS;
    let gy2 = ghostY + offset.dy - HIDDEN_ROWS;

    if (gy1 >= 0) drawGhostPuyo(currentPuyo.x, gy1, currentPuyo.color1);
    if (gy2 >= 0) drawGhostPuyo(currentPuyo.x + offset.dx, gy2, currentPuyo.color2);
}

function drawGhostPuyo(gridX, gridY, colorIndex) {
    let x = fieldOffsetX + gridX * CELL_SIZE + CELL_SIZE / 2;
    let y = fieldOffsetY + gridY * CELL_SIZE + CELL_SIZE / 2;
    let size = CELL_SIZE * 0.85;

    let colorName = COLOR_NAMES[colorIndex];
    if (!colorName || !puyoImages[colorName]) return;

    push();
    imageMode(CENTER);
    tint(255, 60);
    image(puyoImages[colorName], x, y, size, size);
    pop();
}

function drawNextPuyo() {
    let nextX = fieldOffsetX + CELL_SIZE * COLS + 25;
    let nextY = fieldOffsetY;
    let boxWidth = 90;
    let boxHeight1 = 130;
    let boxHeight2 = 100;

    // NEXT ボックス
    fill(255, 255, 255, 230);
    stroke(200, 210, 230);
    strokeWeight(2);
    rect(nextX, nextY, boxWidth, boxHeight1, 15);

    // NEXT ラベル
    fill(232, 52, 78);
    noStroke();
    textSize(16);
    textStyle(BOLD);
    textAlign(CENTER, TOP);
    text('NEXT', nextX + boxWidth / 2, nextY + 10);

    // NEXTぷよ
    drawSmallPuyo(nextX + boxWidth / 2, nextY + 55, nextPuyo.color2, 1.2);
    drawSmallPuyo(nextX + boxWidth / 2, nextY + 100, nextPuyo.color1, 1.2);

    // NEXT NEXT ボックス
    let nextNextY = nextY + boxHeight1 + 15;
    fill(255, 255, 255, 180);
    stroke(200, 210, 230);
    strokeWeight(2);
    rect(nextX, nextNextY, boxWidth, boxHeight2, 15);

    fill(150, 160, 180);
    noStroke();
    textSize(12);
    text('NEXT', nextX + boxWidth / 2, nextNextY + 8);

    drawSmallPuyo(nextX + boxWidth / 2, nextNextY + 45, nextNextPuyo.color2, 0.9);
    drawSmallPuyo(nextX + boxWidth / 2, nextNextY + 80, nextNextPuyo.color1, 0.9);
}

function drawSmallPuyo(x, y, colorIndex, puyoScale = 1.0) {
    let colorName = COLOR_NAMES[colorIndex];
    if (!colorName || !puyoImages[colorName]) return;

    let size = 30 * puyoScale;

    push();
    imageMode(CENTER);
    image(puyoImages[colorName], x, y, size, size);
    pop();

    drawSmallEye(x, y, size);
}

function drawSmallEye(x, y, size) {
    let eyeOffsetX = size * 0.12;
    let eyeOffsetY = -size * 0.10;
    let eyeRadius = size * 0.18;
    let pupilRadius = size * 0.09;

    push();
    translate(x + eyeOffsetX, y + eyeOffsetY);

    fill(255);
    noStroke();
    ellipse(0, 0, eyeRadius * 2, eyeRadius * 2);

    fill(59, 130, 246);
    let pupilAngle = radians(-45);
    let pupilDistance = eyeRadius - pupilRadius * 0.8;
    let pupilX = cos(pupilAngle) * pupilDistance;
    let pupilY = sin(pupilAngle) * pupilDistance;
    ellipse(pupilX, pupilY, pupilRadius * 2, pupilRadius * 2);

    pop();
}

function drawScore() {
    // スコアボックス
    fill(255, 255, 255, 200);
    stroke(200, 210, 230);
    strokeWeight(2);
    rect(fieldOffsetX, 8, 150, 32, 10);

    fill(80, 80, 100);
    noStroke();
    textSize(18);
    textStyle(BOLD);
    textAlign(LEFT, CENTER);
    text('SCORE: ' + score, fieldOffsetX + 15, 24);
}

function drawDeathMark() {
    let x = fieldOffsetX + 2 * CELL_SIZE + CELL_SIZE / 2;
    let y = fieldOffsetY + CELL_SIZE / 2;

    stroke(232, 52, 78, 80);
    strokeWeight(3);
    noFill();

    let size = CELL_SIZE * 0.25;
    line(x - size, y - size, x + size, y + size);
    line(x + size, y - size, x - size, y + size);
}

function drawGameOver() {
    // オーバーレイ
    fill(0, 0, 0, 150);
    noStroke();
    rect(0, 0, width, height);

    // ゲームオーバーボックス
    fill(255, 255, 255, 240);
    stroke(232, 52, 78);
    strokeWeight(4);
    rect(width / 2 - 120, height / 2 - 100, 240, 220, 20);

    // テキスト
    fill(232, 52, 78);
    noStroke();
    textSize(32);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text('GAME OVER', width / 2, height / 2 - 60);

    fill(59, 130, 246);
    textSize(22);
    textStyle(BOLD);
    text('SCORE: ' + score, width / 2, height / 2 - 15);

    // もう一度ボタン
    let btnX = width / 2 - 80;
    let btnY = height / 2 + 25;
    let btnW = 160;
    let btnH = 50;

    // ボタン背景
    fill(232, 52, 78);
    noStroke();
    rect(btnX, btnY, btnW, btnH, 12);

    // ボタンテキスト
    fill(255);
    textSize(20);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text('もう一度', width / 2, btnY + btnH / 2);
}

// リスタートボタンの領域
function getRestartButtonBounds() {
    return {
        x: width / 2 - 80,
        y: height / 2 + 25,
        w: 160,
        h: 50
    };
}

function mousePressed() {
    if (gameState === STATE_GAMEOVER) {
        let btn = getRestartButtonBounds();
        if (mouseX >= btn.x && mouseX <= btn.x + btn.w &&
            mouseY >= btn.y && mouseY <= btn.y + btn.h) {
            initGame();
        }
    }
}

function touchStarted() {
    if (gameState === STATE_GAMEOVER) {
        let btn = getRestartButtonBounds();
        if (mouseX >= btn.x && mouseX <= btn.x + btn.w &&
            mouseY >= btn.y && mouseY <= btn.y + btn.h) {
            initGame();
            return false;
        }
    }
}

function keyPressed() {
    if ([LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW].includes(keyCode)) {
        event.preventDefault();
    }

    if (gameState === STATE_GAMEOVER) {
        if (key === 'r' || key === 'R') {
            initGame();
        }
        return false;
    }

    if (gameState !== STATE_PLAYING) return false;

    if (keyCode === LEFT_ARROW) {
        moveLeft();
    } else if (keyCode === RIGHT_ARROW) {
        moveRight();
    } else if (keyCode === UP_ARROW || key === 'z' || key === 'Z') {
        rotateLeft();
    } else if (key === 'x' || key === 'X') {
        rotateRight();
    } else if (keyCode === DOWN_ARROW) {
        dropInterval = 2;
    } else if (key === 'r' || key === 'R') {
        initGame();
    }

    return false;
}

function keyReleased() {
    if (keyCode === DOWN_ARROW) {
        dropInterval = 30;
    }
}

// タッチボタン用グローバル関数
window.onMoveLeft = function() {
    if (gameState === STATE_PLAYING) {
        moveLeft();
    }
};

window.onMoveRight = function() {
    if (gameState === STATE_PLAYING) {
        moveRight();
    }
};

window.onRotateLeft = function() {
    if (gameState === STATE_PLAYING) {
        rotateLeft();
    }
};

window.onRotateRight = function() {
    if (gameState === STATE_PLAYING) {
        rotateRight();
    }
};

window.onDropStart = function() {
    if (gameState === STATE_PLAYING) {
        dropInterval = 2;
    }
};

window.onDropRelease = function() {
    dropInterval = 30;
};
