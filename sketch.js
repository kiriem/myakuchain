// パズルゲーム - p5.js実装（ポップデザイン版）

// ゲーム設定
const COLS = 6;
const ROWS = 12;
const HIDDEN_ROWS = 1;
const TOTAL_ROWS = ROWS + HIDDEN_ROWS;
let CELL_SIZE = 40;
const NUM_COLORS = 4;

// ゲーム状態
const STATE_TITLE = -1;
const STATE_PLAYING = 0;
const STATE_DROPPING = 1;
const STATE_CHECKING = 2;
const STATE_ERASING = 3;
const STATE_CHAIN_DROPPING = 4;
const STATE_GAMEOVER = 5;

// 難易度設定
const DIFFICULTY_EASY = 0;
const DIFFICULTY_MIDDLE = 1;
const DIFFICULTY_HARD = 2;
const DROP_INTERVALS = [45, 30, 18]; // Easy, Middle, Hard

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
let currentPiece;
let nextPiece;
let nextNextPiece;
let gameState;
let dropTimer;
let dropInterval;
let baseDropInterval;
let difficulty = DIFFICULTY_MIDDLE;
let score;
let chainCount;
let eraseTimer;
let erasingPieces;
let pieceImages = {};
let pieceStates = {};

// アニメーション用
let globalTime = 0;
let particles = [];
let chainPopups = [];

// キャンバスサイズ
let canvasWidth;
let canvasHeight;
let fieldOffsetX;
let fieldOffsetY;

// BGM
let bgm;
let bgmStarted = false;
let bgmMuted = false;

// 効果音
let seChain;
let seMove;
let seRotate;
let seDown;
let seRelease;

function preload() {
    pieceImages['red'] = loadImage('svg/piece_red.svg');
    pieceImages['green'] = loadImage('svg/piece_green.svg');
    pieceImages['blue'] = loadImage('svg/piece_blue.svg');
    pieceImages['yellow'] = loadImage('svg/piece_yellow.svg');

    // 音声ファイルのロード（エラー時はnullを設定）
    soundFormats('mp3');
    bgm = loadSound('src/bgm.mp3', function() {}, function() { bgm = null; });
    seChain = loadSound('src/chain.mp3', function() {}, function() { seChain = null; });
    seMove = loadSound('src/move.mp3', function() {}, function() { seMove = null; });
    seRotate = loadSound('src/rotate.mp3', function() {}, function() { seRotate = null; });
    seDown = loadSound('src/down.mp3', function() {}, function() { seDown = null; });
    seRelease = loadSound('src/release.mp3', function() {}, function() { seRelease = null; });
}

function setup() {
    calculateSize();
    let canvas = createCanvas(canvasWidth, canvasHeight);
    canvas.parent('game-container');
    gameState = STATE_TITLE;

    // iOSのオーディオコンテキスト対策
    getAudioContext().suspend();

    // ページ非表示時の処理（メモリ節約）
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // バックグラウンド時はオーディオを一時停止
            if (bgm && bgm.isPlaying()) {
                bgm.pause();
            }
            noLoop();
        } else {
            // 復帰時に再開
            loop();
            if (bgm && bgmStarted && !bgmMuted) {
                bgm.play();
            }
        }
    });
}

function calculateSize() {
    // 利用可能なサイズを取得
    let container = document.getElementById('game-container');
    let maxWidth = min(windowWidth - 20, 500);  // 最大幅500px
    let maxHeight = windowHeight - 250;  // コントロール等のスペースを確保

    // サイドバー(NEXT表示)の幅を考慮
    let sidebarWidth = 110;
    let availableFieldWidth = maxWidth - sidebarWidth - 30;
    let availableFieldHeight = maxHeight - 60;

    // セルサイズを計算（幅と高さの制約から小さい方を採用）
    let cellFromWidth = floor(availableFieldWidth / COLS);
    let cellFromHeight = floor(availableFieldHeight / ROWS);
    CELL_SIZE = min(cellFromWidth, cellFromHeight);
    CELL_SIZE = constrain(CELL_SIZE, 25, 45);  // 最小25px、最大45px

    // キャンバスサイズを計算
    canvasWidth = CELL_SIZE * COLS + sidebarWidth + 30;
    canvasHeight = CELL_SIZE * ROWS + 60;
    fieldOffsetX = 15;
    fieldOffsetY = 45;
}

function windowResized() {
    calculateSize();
    resizeCanvas(canvasWidth, canvasHeight);
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
    baseDropInterval = DROP_INTERVALS[difficulty];
    dropInterval = baseDropInterval;
    score = 0;
    chainCount = 0;
    eraseTimer = 0;
    erasingPieces = [];
    pieceStates = {};
    particles = [];
    chainPopups = [];

    nextPiece = createPiecePair();
    nextNextPiece = createPiecePair();
    spawnPiece();

    // BGM再生開始
    if (bgm && !bgmStarted) {
        bgm.setVolume(0.3);
        bgm.loop();
        bgmStarted = true;
    }
}

function createPiecePair() {
    return {
        color1: floor(random(1, NUM_COLORS + 1)),
        color2: floor(random(1, NUM_COLORS + 1))
    };
}

function spawnPiece() {
    currentPiece = {
        x: 2,
        y: 1,
        color1: nextPiece.color1,
        color2: nextPiece.color2,
        rotation: 0
    };

    nextPiece = nextNextPiece;
    nextNextPiece = createPiecePair();

    if (!canPlace(currentPiece.x, currentPiece.y, currentPiece.rotation)) {
        gameState = STATE_GAMEOVER;
    }
}

function getSecondPieceOffset(rotation) {
    switch (rotation) {
        case 0: return { dx: 0, dy: -1 };
        case 1: return { dx: 1, dy: 0 };
        case 2: return { dx: 0, dy: 1 };
        case 3: return { dx: -1, dy: 0 };
    }
}

function canPlace(x, y, rotation) {
    let offset = getSecondPieceOffset(rotation);
    let x2 = x + offset.dx;
    let y2 = y + offset.dy;

    if (x < 0 || x >= COLS || y < 0 || y >= TOTAL_ROWS) return false;
    if (x2 < 0 || x2 >= COLS || y2 < 0 || y2 >= TOTAL_ROWS) return false;
    if (field[y][x] !== 0) return false;
    if (field[y2][x2] !== 0) return false;

    return true;
}

function moveLeft() {
    if (canPlace(currentPiece.x - 1, currentPiece.y, currentPiece.rotation)) {
        currentPiece.x--;
        playSE(seMove);
    }
}

function moveRight() {
    if (canPlace(currentPiece.x + 1, currentPiece.y, currentPiece.rotation)) {
        currentPiece.x++;
        playSE(seMove);
    }
}

function rotateLeft() {
    let newRotation = (currentPiece.rotation + 3) % 4;
    let rotated = false;
    if (canPlace(currentPiece.x, currentPiece.y, newRotation)) {
        currentPiece.rotation = newRotation;
        rotated = true;
    } else if (canPlace(currentPiece.x + 1, currentPiece.y, newRotation)) {
        currentPiece.x++;
        currentPiece.rotation = newRotation;
        rotated = true;
    } else if (canPlace(currentPiece.x - 1, currentPiece.y, newRotation)) {
        currentPiece.x--;
        currentPiece.rotation = newRotation;
        rotated = true;
    }
    if (rotated) playSE(seRotate);
}

function rotateRight() {
    let newRotation = (currentPiece.rotation + 1) % 4;
    let rotated = false;
    if (canPlace(currentPiece.x, currentPiece.y, newRotation)) {
        currentPiece.rotation = newRotation;
        rotated = true;
    } else if (canPlace(currentPiece.x + 1, currentPiece.y, newRotation)) {
        currentPiece.x++;
        currentPiece.rotation = newRotation;
        rotated = true;
    } else if (canPlace(currentPiece.x - 1, currentPiece.y, newRotation)) {
        currentPiece.x--;
        currentPiece.rotation = newRotation;
        rotated = true;
    }
    if (rotated) playSE(seRotate);
}

function canDrop() {
    let offset = getSecondPieceOffset(currentPiece.rotation);
    let x1 = currentPiece.x;
    let y1 = currentPiece.y + 1;
    let x2 = currentPiece.x + offset.dx;
    let y2 = currentPiece.y + offset.dy + 1;

    if (y1 >= TOTAL_ROWS || y2 >= TOTAL_ROWS) return false;
    if (field[y1][x1] !== 0 || field[y2][x2] !== 0) return false;

    return true;
}

function placePiece() {
    let offset = getSecondPieceOffset(currentPiece.rotation);
    let x1 = currentPiece.x;
    let y1 = currentPiece.y;
    let x2 = currentPiece.x + offset.dx;
    let y2 = currentPiece.y + offset.dy;

    if (y1 >= 0 && y1 < TOTAL_ROWS) {
        field[y1][x1] = currentPiece.color1;
        initPieceState(x1, y1);
    }
    if (y2 >= 0 && y2 < TOTAL_ROWS) {
        field[y2][x2] = currentPiece.color2;
        initPieceState(x2, y2);
    }

    playSE(seRelease);
    gameState = STATE_DROPPING;
}

function initPieceState(x, y) {
    let key = x + ',' + y;
    pieceStates[key] = {
        blinking: false,
        blinkFrame: 0,
        nextBlink: floor(random(60, 300)),
        rotation: floor(random(0, 360)),
        wobbleOffset: random(0, TWO_PI),  // ゆらゆらのオフセット
        scale: 1.2,  // 着地時の拡大（アニメーション用）
        bounceY: -5   // バウンス用
    };
}

function updatePieceStates() {
    for (let y = 0; y < TOTAL_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (field[y][x] !== 0) {
                let key = x + ',' + y;
                if (!pieceStates[key]) {
                    initPieceState(x, y);
                }

                let state = pieceStates[key];

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

function getPieceState(x, y) {
    let key = x + ',' + y;
    return pieceStates[key] || { blinking: false, blinkFrame: 0, rotation: 0, wobbleOffset: 0, scale: 1, bounceY: 0 };
}

function dropFieldPieces() {
    let dropped = false;

    for (let x = 0; x < COLS; x++) {
        for (let y = TOTAL_ROWS - 2; y >= 0; y--) {
            if (field[y][x] !== 0 && field[y + 1][x] === 0) {
                field[y + 1][x] = field[y][x];
                field[y][x] = 0;

                let oldKey = x + ',' + y;
                let newKey = x + ',' + (y + 1);
                if (pieceStates[oldKey]) {
                    pieceStates[newKey] = pieceStates[oldKey];
                    pieceStates[newKey].bounceY = -3;  // 落下時のバウンス
                    delete pieceStates[oldKey];
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

function erasePieces(pieceList) {
    let erasedCount = pieceList.length;
    let chainBonus = Math.pow(2, chainCount);
    score += erasedCount * 10 * chainBonus;

    // パーティクル生成
    for (let piece of pieceList) {
        let px = fieldOffsetX + piece.x * CELL_SIZE + CELL_SIZE / 2;
        let py = fieldOffsetY + (piece.y - HIDDEN_ROWS) * CELL_SIZE + CELL_SIZE / 2;
        createParticles(px, py, piece.color);

        field[piece.y][piece.x] = 0;
        let key = piece.x + ',' + piece.y;
        delete pieceStates[key];
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

    // タイトル画面
    if (gameState === STATE_TITLE) {
        drawTitleScreen();
        return;
    }

    updatePieceStates();
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
    drawCurrentPiece();
    drawParticles();
    drawNextPiece();
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
            currentPiece.y++;
        } else {
            placePiece();
        }
    }
}

function updateDropping() {
    if (!dropFieldPieces()) {
        gameState = STATE_CHECKING;
    }
}

function updateChecking() {
    erasingPieces = checkAndErase();

    if (erasingPieces.length > 0) {
        chainCount++;
        eraseTimer = 0;
        gameState = STATE_ERASING;
        playSE(seChain);
    } else {
        chainCount = 0;

        if (checkGameOver()) {
            gameState = STATE_GAMEOVER;
        } else {
            spawnPiece();
            gameState = STATE_PLAYING;
        }
    }
}

function updateErasing() {
    eraseTimer++;

    if (eraseTimer >= 20) {
        erasePieces(erasingPieces);
        erasingPieces = [];
        gameState = STATE_CHAIN_DROPPING;
    }
}

function updateChainDropping() {
    if (!dropFieldPieces()) {
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

    // ピースを描画
    for (let y = HIDDEN_ROWS; y < TOTAL_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (field[y][x] !== 0) {
                let isErasing = erasingPieces.some(p => p.x === x && p.y === y);
                let pieceState = getPieceState(x, y);
                drawPiece(x, y - HIDDEN_ROWS, field[y][x], isErasing, pieceState);
            }
        }
    }

    // 窒息マーク
    drawDeathMark();
}

function drawPiece(gridX, gridY, colorIndex, isErasing = false, pieceState = null) {
    let x = fieldOffsetX + gridX * CELL_SIZE + CELL_SIZE / 2;
    let y = fieldOffsetY + gridY * CELL_SIZE + CELL_SIZE / 2;
    let size = CELL_SIZE * 0.85;

    let colorName = COLOR_NAMES[colorIndex];
    if (!colorName || !pieceImages[colorName]) return;

    let rotation = pieceState ? pieceState.rotation : 0;
    let wobbleOffset = pieceState ? pieceState.wobbleOffset : 0;
    let pieceScale = pieceState ? pieceState.scale : 1;
    let bounceY = pieceState ? pieceState.bounceY : 0;

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
    let finalScale = pieceScale * scaleWobble;
    image(pieceImages[colorName], 0, 0, size * finalScale, size * finalScale);
    pop();

    // 目
    if (!isErasing) {
        drawEye(x, y + bounceY + wobble, size * pieceScale * scaleWobble, pieceState);
    }
}

function drawEye(x, y, size, pieceState) {
    let eyeOffsetX = size * 0.12;
    let eyeOffsetY = -size * 0.10;
    let eyeRadius = size * 0.18;
    let pupilRadius = size * 0.09;

    let isBlinking = pieceState && pieceState.blinking;
    let blinkProgress = isBlinking ? pieceState.blinkFrame / 8 : 0;
    let pieceRotation = pieceState ? pieceState.rotation : 0;

    let closedness = 0;
    if (isBlinking) {
        if (blinkProgress < 0.5) {
            closedness = blinkProgress * 2;
        } else {
            closedness = (1 - blinkProgress) * 2;
        }
    }

    let rotRad = radians(pieceRotation);
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

function drawCurrentPiece() {
    if (gameState !== STATE_PLAYING || !currentPiece) return;

    let offset = getSecondPieceOffset(currentPiece.rotation);
    let y1 = currentPiece.y - HIDDEN_ROWS;
    let y2 = currentPiece.y + offset.dy - HIDDEN_ROWS;

    let openState = { blinking: false, blinkFrame: 0, rotation: 0, wobbleOffset: 0, scale: 1, bounceY: 0 };

    if (y1 >= 0) {
        drawPiece(currentPiece.x, y1, currentPiece.color1, false, openState);
    }
    if (y2 >= 0) {
        drawPiece(currentPiece.x + offset.dx, y2, currentPiece.color2, false, openState);
    }

    drawGhost();
}

function drawGhost() {
    let ghostY = currentPiece.y;

    while (true) {
        let offset = getSecondPieceOffset(currentPiece.rotation);
        let y1 = ghostY + 1;
        let y2 = ghostY + offset.dy + 1;
        let x1 = currentPiece.x;
        let x2 = currentPiece.x + offset.dx;

        if (y1 >= TOTAL_ROWS || y2 >= TOTAL_ROWS) break;
        if (field[y1][x1] !== 0 || field[y2][x2] !== 0) break;

        ghostY++;
    }

    if (ghostY === currentPiece.y) return;

    let offset = getSecondPieceOffset(currentPiece.rotation);
    let gy1 = ghostY - HIDDEN_ROWS;
    let gy2 = ghostY + offset.dy - HIDDEN_ROWS;

    if (gy1 >= 0) drawGhostPiece(currentPiece.x, gy1, currentPiece.color1);
    if (gy2 >= 0) drawGhostPiece(currentPiece.x + offset.dx, gy2, currentPiece.color2);
}

function drawGhostPiece(gridX, gridY, colorIndex) {
    let x = fieldOffsetX + gridX * CELL_SIZE + CELL_SIZE / 2;
    let y = fieldOffsetY + gridY * CELL_SIZE + CELL_SIZE / 2;
    let size = CELL_SIZE * 0.85;

    let colorName = COLOR_NAMES[colorIndex];
    if (!colorName || !pieceImages[colorName]) return;

    push();
    imageMode(CENTER);
    tint(255, 60);
    image(pieceImages[colorName], x, y, size, size);
    pop();
}

function drawNextPiece() {
    let nextX = fieldOffsetX + CELL_SIZE * COLS + 15;
    let nextY = fieldOffsetY;
    let boxWidth = max(70, CELL_SIZE * 2.2);
    let boxHeight1 = max(100, CELL_SIZE * 3.2);
    let boxHeight2 = max(80, CELL_SIZE * 2.5);

    // NEXT ボックス
    fill(255, 255, 255, 230);
    stroke(200, 210, 230);
    strokeWeight(2);
    rect(nextX, nextY, boxWidth, boxHeight1, 15);

    // NEXTピースのスケール
    let pieceScale = CELL_SIZE / 40;

    // NEXT ラベル
    fill(232, 52, 78);
    noStroke();
    textSize(max(12, 14 * pieceScale));
    textStyle(BOLD);
    textAlign(CENTER, TOP);
    text('NEXT', nextX + boxWidth / 2, nextY + 8);

    // NEXTピース
    drawSmallPiece(nextX + boxWidth / 2, nextY + boxHeight1 * 0.4, nextPiece.color2, pieceScale);
    drawSmallPiece(nextX + boxWidth / 2, nextY + boxHeight1 * 0.75, nextPiece.color1, pieceScale);

    // NEXT NEXT ボックス
    let nextNextY = nextY + boxHeight1 + 10;
    fill(255, 255, 255, 180);
    stroke(200, 210, 230);
    strokeWeight(2);
    rect(nextX, nextNextY, boxWidth, boxHeight2, 12);

    fill(150, 160, 180);
    noStroke();
    textSize(max(10, 11 * pieceScale));
    text('NEXT', nextX + boxWidth / 2, nextNextY + 6);

    drawSmallPiece(nextX + boxWidth / 2, nextNextY + boxHeight2 * 0.4, nextNextPiece.color2, pieceScale * 0.8);
    drawSmallPiece(nextX + boxWidth / 2, nextNextY + boxHeight2 * 0.75, nextNextPiece.color1, pieceScale * 0.8);

    // ミュートボタン
    drawMuteButton(nextX, nextNextY + boxHeight2 + 10, boxWidth);
}

function drawMuteButton(x, y, w) {
    let h = 35;

    // ボタン背景
    fill(bgmMuted ? 150 : 100, bgmMuted ? 150 : 100, bgmMuted ? 160 : 120);
    noStroke();
    rect(x, y, w, h, 10);

    // アイコンと文字
    fill(255);
    textSize(12);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text(bgmMuted ? '🔇 OFF' : '🔊 ON', x + w / 2, y + h / 2);
}

function getMuteButtonBounds() {
    let nextX = fieldOffsetX + CELL_SIZE * COLS + 15;
    let nextY = fieldOffsetY;
    let boxWidth = max(70, CELL_SIZE * 2.2);
    let boxHeight1 = max(100, CELL_SIZE * 3.2);
    let boxHeight2 = max(80, CELL_SIZE * 2.5);
    let nextNextY = nextY + boxHeight1 + 10;

    return {
        x: nextX,
        y: nextNextY + boxHeight2 + 10,
        w: boxWidth,
        h: 35
    };
}

function drawSmallPiece(x, y, colorIndex, pieceScale = 1.0) {
    let colorName = COLOR_NAMES[colorIndex];
    if (!colorName || !pieceImages[colorName]) return;

    let size = 30 * pieceScale;

    push();
    imageMode(CENTER);
    image(pieceImages[colorName], x, y, size, size);
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
    let boxH = max(28, CELL_SIZE * 0.8);
    let boxW = max(120, CELL_SIZE * 3.5);
    fill(255, 255, 255, 200);
    stroke(200, 210, 230);
    strokeWeight(2);
    rect(fieldOffsetX, 8, boxW, boxH, 8);

    fill(80, 80, 100);
    noStroke();
    textSize(max(14, CELL_SIZE * 0.45));
    textStyle(BOLD);
    textAlign(LEFT, CENTER);
    text('SCORE: ' + score, fieldOffsetX + 10, 8 + boxH / 2);
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

function drawTitleScreen() {
    let boxW = min(300, width - 40);
    let boxH = min(340, height - 40);
    let boxX = width / 2 - boxW / 2;
    let boxY = height / 2 - boxH / 2;

    // ボックスの影
    noStroke();
    fill(0, 0, 0, 30);
    rect(boxX + 5, boxY + 5, boxW, boxH, 20);

    // タイトルボックス
    fill(255, 255, 255, 245);
    stroke(232, 52, 78);
    strokeWeight(4);
    rect(boxX, boxY, boxW, boxH, 20);

    // タイトル
    fill(232, 52, 78);
    noStroke();
    textSize(min(32, boxW * 0.1));
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text('みゃくちぇいん', width / 2, boxY + boxH * 0.15);

    // 難易度選択ラベル
    fill(100, 100, 120);
    textSize(min(14, boxW * 0.045));
    textStyle(NORMAL);
    text('難易度を選んでスタート', width / 2, boxY + boxH * 0.28);

    // 難易度ボタン
    let btnW = min(220, boxW - 40);
    let btnH = min(50, boxH * 0.14);
    let btnX = width / 2 - btnW / 2;
    let btnGap = min(60, boxH * 0.17);
    let firstBtnY = boxY + boxH * 0.38;

    // Easy ボタン
    drawDifficultyButton(btnX, firstBtnY, btnW, btnH, 'Easy',
        '#22C55E', '#16A34A', difficulty === DIFFICULTY_EASY);

    // Middle ボタン
    drawDifficultyButton(btnX, firstBtnY + btnGap, btnW, btnH, 'Middle',
        '#3B82F6', '#2563EB', difficulty === DIFFICULTY_MIDDLE);

    // Hard ボタン
    drawDifficultyButton(btnX, firstBtnY + btnGap * 2, btnW, btnH, 'Hard',
        '#E8344E', '#DC2626', difficulty === DIFFICULTY_HARD);
}

function drawDifficultyButton(x, y, w, h, label, color, darkColor, isSelected) {
    // ボタンの影
    noStroke();
    fill(0, 0, 0, 40);
    rect(x + 2, y + 3, w, h, min(12, h * 0.24));

    // ボタン本体
    fill(isSelected ? darkColor : color);
    rect(x, y, w, h, min(12, h * 0.24));

    // ボタンテキスト
    fill(255);
    textSize(min(20, h * 0.4));
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text(label, x + w / 2, y + h / 2);

    // 選択中マーク
    if (isSelected) {
        fill(255, 255, 255, 80);
        rect(x + 5, y + 5, w - 10, h / 2 - 5, 8, 8, 0, 0);
    }
}

function getDifficultyButtonBounds() {
    let boxW = min(300, width - 40);
    let boxH = min(340, height - 40);
    let boxY = height / 2 - boxH / 2;
    let btnW = min(220, boxW - 40);
    let btnH = min(50, boxH * 0.14);
    let btnX = width / 2 - btnW / 2;
    let btnGap = min(60, boxH * 0.17);
    let firstBtnY = boxY + boxH * 0.38;

    return {
        easy: { x: btnX, y: firstBtnY, w: btnW, h: btnH },
        middle: { x: btnX, y: firstBtnY + btnGap, w: btnW, h: btnH },
        hard: { x: btnX, y: firstBtnY + btnGap * 2, w: btnW, h: btnH }
    };
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
    // ミュートボタン（常時有効）
    if (gameState !== STATE_TITLE) {
        let muteBtn = getMuteButtonBounds();
        if (mouseX >= muteBtn.x && mouseX <= muteBtn.x + muteBtn.w &&
            mouseY >= muteBtn.y && mouseY <= muteBtn.y + muteBtn.h) {
            toggleMute();
            return;
        }
    }

    if (gameState === STATE_TITLE) {
        handleDifficultyClick();
    } else if (gameState === STATE_GAMEOVER) {
        let btn = getRestartButtonBounds();
        if (mouseX >= btn.x && mouseX <= btn.x + btn.w &&
            mouseY >= btn.y && mouseY <= btn.y + btn.h) {
            gameState = STATE_TITLE;
        }
    }
}

function toggleMute() {
    bgmMuted = !bgmMuted;
    if (bgm) {
        if (bgmMuted) {
            bgm.setVolume(0);
        } else {
            bgm.setVolume(0.3);
        }
    }
}

function playSE(sound) {
    if (sound && !bgmMuted) {
        try {
            if (sound.isPlaying()) {
                sound.stop();
            }
            sound.play();
        } catch (e) {
            // iOS Safari対策: エラーを無視
        }
    }
}

function handleDifficultyClick() {
    let btns = getDifficultyButtonBounds();
    let clicked = false;

    if (mouseX >= btns.easy.x && mouseX <= btns.easy.x + btns.easy.w &&
        mouseY >= btns.easy.y && mouseY <= btns.easy.y + btns.easy.h) {
        difficulty = DIFFICULTY_EASY;
        clicked = true;
    } else if (mouseX >= btns.middle.x && mouseX <= btns.middle.x + btns.middle.w &&
        mouseY >= btns.middle.y && mouseY <= btns.middle.y + btns.middle.h) {
        difficulty = DIFFICULTY_MIDDLE;
        clicked = true;
    } else if (mouseX >= btns.hard.x && mouseX <= btns.hard.x + btns.hard.w &&
        mouseY >= btns.hard.y && mouseY <= btns.hard.y + btns.hard.h) {
        difficulty = DIFFICULTY_HARD;
        clicked = true;
    }

    if (clicked) {
        // iOSのオーディオコンテキストを有効化
        userStartAudio();
        initGame();
    }
}

function touchStarted() {
    // ミュートボタン（常時有効）
    if (gameState !== STATE_TITLE) {
        let muteBtn = getMuteButtonBounds();
        if (mouseX >= muteBtn.x && mouseX <= muteBtn.x + muteBtn.w &&
            mouseY >= muteBtn.y && mouseY <= muteBtn.y + muteBtn.h) {
            toggleMute();
            return false;
        }
    }

    if (gameState === STATE_TITLE) {
        handleDifficultyClick();
        return false;
    } else if (gameState === STATE_GAMEOVER) {
        let btn = getRestartButtonBounds();
        if (mouseX >= btn.x && mouseX <= btn.x + btn.w &&
            mouseY >= btn.y && mouseY <= btn.y + btn.h) {
            gameState = STATE_TITLE;
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
            gameState = STATE_TITLE;
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
        playSE(seDown);
    } else if (key === 'r' || key === 'R') {
        gameState = STATE_TITLE;
    }

    return false;
}

function keyReleased() {
    if (keyCode === DOWN_ARROW) {
        dropInterval = baseDropInterval;
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

let isDropping = false;

window.onDropStart = function() {
    if (gameState === STATE_PLAYING) {
        dropInterval = 2;
        if (!isDropping) {
            isDropping = true;
            playSE(seDown);
        }
    }
};

window.onDropRelease = function() {
    dropInterval = baseDropInterval;
    isDropping = false;
};
