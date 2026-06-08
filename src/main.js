import kaplay from "kaplay";
import { state } from "./state.js";
import { generateChallenge, checkAnswer, determineSpecializedClass, getZoneInfo } from "./api.js";

// ==========================================
// 1. DYNAMIC SYNTHESIS AUDIO CONTROLLER
// ==========================================
class TowerAudioSynth {
    constructor() {
        this.ctx = null;
        this.droneOsc = null;
        this.droneGain = null;
    }

    init() {
        if (this.ctx) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
    }

    playClick() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playSuccess() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, now + idx * 0.07);

            gain.gain.setValueAtTime(0.06, now + idx * 0.07);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.15);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.07);
            osc.stop(now + idx * 0.07 + 0.15);
        });
    }

    playFail() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = "sawtooth";
        osc1.frequency.setValueAtTime(120, now);
        osc1.frequency.exponentialRampToValueAtTime(60, now + 0.35);

        osc2.type = "square";
        osc2.frequency.setValueAtTime(122, now);
        osc2.frequency.exponentialRampToValueAtTime(61, now + 0.35);

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.4);
    }

    playPromotion() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const now = this.ctx.currentTime;
        const chords = [196.00, 293.66, 392.00, 493.88, 587.33, 783.99];

        chords.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now + idx * 0.1);
            osc.frequency.linearRampToValueAtTime(freq * 1.5, now + 1.2);

            gain.gain.setValueAtTime(0.05, now + idx * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

            if (panner) {
                panner.pan.setValueAtTime((idx / chords.length) * 2 - 1, now);
                osc.connect(panner);
                panner.connect(gain);
            } else {
                osc.connect(gain);
            }
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.1);
            osc.stop(now + 1.5);
        });
    }

    startAmbientDrone() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (this.droneOsc) return;

        try {
            const now = this.ctx.currentTime;
            this.droneOsc = this.ctx.createOscillator();
            this.droneGain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            this.droneOsc.type = "sawtooth";
            this.droneOsc.frequency.setValueAtTime(45, now);

            filter.type = "lowpass";
            filter.frequency.setValueAtTime(100, now);
            filter.Q.setValueAtTime(1, now);

            this.droneGain.gain.setValueAtTime(0.015, now);

            this.droneOsc.connect(filter);
            filter.connect(this.droneGain);
            this.droneGain.connect(this.ctx.destination);

            this.droneOsc.start();
            this.droneVolumeLoop();
        } catch (e) {
            console.error("Failed to start ambient hum:", e);
        }
    }

    stopAmbientDrone() {
        if (this.droneOsc) {
            try {
                this.droneOsc.stop();
            } catch (e) {}
            this.droneOsc = null;
        }
    }

    droneVolumeLoop() {
        if (!this.droneGain || !this.droneOsc || !this.ctx) return;
        const now = this.ctx.currentTime;
        this.droneGain.gain.linearRampToValueAtTime(0.022, now + 3);
        this.droneGain.gain.linearRampToValueAtTime(0.012, now + 6);
        setTimeout(() => this.droneVolumeLoop(), 6000);
    }
}

const synth = new TowerAudioSynth();

// ==========================================
// 2. KAPLAY SCREEN & WORLD ENGINE
// ==========================================
const k = kaplay({
    width: window.innerWidth,
    height: window.innerHeight,
    canvas: document.getElementById("kaplay-canvas"),
    letterbox: false,
    background: [10, 10, 12]
});

let menuMusic = null;
let musicStarted = false;
let musicAllowed = true;

function addMenuMusicListeners() {
    window.addEventListener("click", startMenuMusic, { capture: true });
    window.addEventListener("keydown", startMenuMusic, { capture: true });
}

function removeMenuMusicListeners() {
    window.removeEventListener("click", startMenuMusic, { capture: true });
    window.removeEventListener("keydown", startMenuMusic, { capture: true });
}

function startMenuMusic() {
    if (!musicAllowed) return;
    if (musicStarted) return;
    const menuBg = document.getElementById("menu-background");
    if (menuBg && menuBg.style.display !== "none") {
        try {
            synth.init();
            if (!menuMusic) {
                menuMusic = document.getElementById("menu-music");
                if (menuMusic) {
                    menuMusic.volume = 0.3;
                }
            }
            if (menuMusic) {
                menuMusic.play().then(() => {
                    musicStarted = true;
                }).catch(e => {
                    console.warn("Failed to play menu music on user interaction:", e);
                });
            }
        } catch (e) {
            console.warn("Failed to initiate menu music:", e);
        }
    }
}

function stopMenuMusic() {
    musicAllowed = false;
    removeMenuMusicListeners();
    if (!menuMusic) {
        menuMusic = document.getElementById("menu-music");
    }
    if (menuMusic) {
        try {
            menuMusic.pause();
            menuMusic.currentTime = 0;
        } catch (e) {
            console.warn("Failed to stop menu music:", e);
        }
        musicStarted = false;
    }
}



// Setup scaling variables
const floorHeight = 180;
const columnXLeft = 100;
const columnXRight = k.width() - 100;

// Central coordinates
const centerX = k.width() / 2;
const terminalX = centerX - 140; // The workstation on the left of the elevator

// Visual effects particles
let sparks = [];

k.onUpdate(() => {
    sparks = sparks.filter(s => {
        s.pos = s.pos.add(s.vel);
        s.vel = s.vel.scale(s.drag || 0.97);
        if (s.rotSpeed) s.angle += s.rotSpeed * k.dt();
        s.life -= k.dt();
        return s.life > 0;
    });
});

k.onDraw(() => {
    sparks.forEach(s => {
        if (s.isPaper) {
            // Draw fluttering office papers
            k.pushTransform();
            k.pushTranslate(s.pos);
            k.pushRotate(s.angle || 0);
            k.drawRect({
                width: s.size,
                height: s.size * 1.3,
                color: k.rgb(255, 255, 255),
                opacity: (s.life / s.maxLife) * 0.85
            });
            k.popTransform();
        } else {
            k.drawCircle({
                pos: s.pos,
                radius: s.radius * (s.life / s.maxLife),
                color: s.color,
                opacity: s.life / s.maxLife
            });
        }
    });
});

function spawnLevelUpBurst(pos) {
    const zone = getZoneInfo(state.floor);
    const color = k.rgb(zone.r, zone.g, zone.b);
    for (let i = 0; i < 40; i++) {
        const angle = k.rand(0, Math.PI * 2);
        const speed = k.rand(100, 400);
        sparks.push({
            pos: pos,
            vel: k.vec2(Math.cos(angle) * speed, Math.sin(angle) * speed).scale(k.dt()),
            radius: k.rand(3, 8),
            color: color,
            maxLife: k.rand(0.5, 1.1),
            life: k.rand(0.5, 1.1)
        });
    }
}

// Procedural wind fluttering papers
function spawnWindPaper(x, y) {
    sparks.push({
        pos: k.vec2(x, y),
        vel: k.vec2(k.rand(-40, 110), k.rand(-15, -60)).scale(k.dt()),
        size: k.rand(5, 8),
        angle: k.rand(0, 360),
        rotSpeed: k.rand(-180, 180),
        isPaper: true,
        maxLife: k.rand(2, 4),
        life: k.rand(2, 4),
        drag: 0.99
    });
}

// Draw dynamic interior office environments for each floor
k.onDraw(() => {
    const camY = k.getCamPos().y;
    const activeZone = getZoneInfo(state.floor);
    const activeColor = k.rgb(activeZone.r, activeZone.g, activeZone.b);

    // Dark exterior cityscape background
    k.drawRect({
        width: k.width(),
        height: k.height(),
        pos: k.vec2(0, camY - k.height() / 2),
        color: k.rgb(5, 5, 8),
        opacity: 0.95
    });

    const startFloor = Math.max(1, state.floor - 4);
    const endFloor = Math.min(100, state.floor + 4);

    for (let f = startFloor; f <= endFloor; f++) {
        const floorY = k.height() - 100 - (f - 1) * floorHeight;
        const roomHeight = floorHeight - 12;
        const roomTopY = floorY - roomHeight;

        // Warm vector office beige wall backdrop
        k.drawRect({
            width: columnXRight - columnXLeft,
            height: roomHeight,
            pos: k.vec2(columnXLeft, roomTopY),
            color: k.rgb(215, 202, 185),
            radius: 2
        });

        // Room shadow depth borders (Left & Right walls)
        k.drawRect({
            width: 14,
            height: roomHeight,
            pos: k.vec2(columnXLeft, roomTopY),
            color: k.rgb(180, 165, 150),
            opacity: 0.95
        });
        k.drawRect({
            width: 14,
            height: roomHeight,
            pos: k.vec2(columnXRight - 14, roomTopY),
            color: k.rgb(180, 165, 150),
            opacity: 0.95
        });

        // Vertical room pillar accents
        for (let x = columnXLeft + 120; x < columnXRight - 100; x += 220) {
            k.drawRect({
                width: 16,
                height: roomHeight,
                pos: k.vec2(x, roomTopY),
                color: k.rgb(198, 185, 168),
                opacity: 0.8
            });
        }

        // Baseboards (Wall floor border)
        k.drawRect({
            width: columnXRight - columnXLeft,
            height: 6,
            pos: k.vec2(columnXLeft, floorY - 14),
            color: k.rgb(85, 75, 65)
        });

        // Main Foreground silhouette platform (Floor slab)
        k.drawRect({
            width: columnXRight - columnXLeft + 40,
            height: 12,
            pos: k.vec2(columnXLeft - 20, floorY - 8),
            color: k.rgb(20, 20, 25),
            radius: 2
        });

        // Left Office exit door with floor tag
        const doorX = columnXLeft + 45;
        k.drawRect({ width: 32, height: 70, pos: k.vec2(doorX, floorY - 78), color: k.rgb(40, 40, 45) });
        k.drawRect({ width: 26, height: 66, pos: k.vec2(doorX + 3, floorY - 75), color: k.rgb(75, 70, 65) });
        k.drawRect({ width: 12, height: 6, pos: k.vec2(doorX + 10, floorY - 60), color: k.rgb(220, 210, 190) });
        k.drawText({
            text: `RM-${f.toString().padStart(3, '0')}`,
            pos: k.vec2(doorX + 3, floorY - 92),
            size: 10,
            color: k.rgb(20, 20, 25),
            font: "monospace"
        });

        // Fluorescent Ceiling Lights casting warm glow
        const lightX1 = columnXLeft + 180;
        const lightX2 = columnXRight - 220;
        [lightX1, lightX2].forEach(lx => {
            k.drawRect({ width: 60, height: 5, pos: k.vec2(lx, roomTopY), color: k.rgb(255, 255, 255) });
            k.drawPolygon({
                pts: [
                    k.vec2(lx, roomTopY + 5),
                    k.vec2(lx + 60, roomTopY + 5),
                    k.vec2(lx + 110, floorY - 8),
                    k.vec2(lx - 50, floorY - 8)
                ],
                color: k.rgb(255, 250, 230),
                opacity: 0.08
            });
        });

        // ------------------------------------
        // SILHOUETTE OFFICE FURNITURE
        // ------------------------------------
        const deskX = terminalX - 45;
        // Office desk silhouette
        k.drawRect({ width: 85, height: 28, pos: k.vec2(deskX, floorY - 36), color: k.rgb(20, 20, 25) });
        k.drawRect({ width: 65, height: 22, pos: k.vec2(deskX + 10, floorY - 30), color: k.rgb(215, 202, 185) });
        // Ergonomic office chair silhouette
        k.drawRect({ width: 16, height: 32, pos: k.vec2(terminalX + 50, floorY - 48), color: k.rgb(20, 20, 25), radius: 2 });
        k.drawRect({ width: 4, height: 12, pos: k.vec2(terminalX + 56, floorY - 18), color: k.rgb(20, 20, 25) });
        k.drawRect({ width: 18, height: 4, pos: k.vec2(terminalX + 49, floorY - 10), color: k.rgb(20, 20, 25) });

        // Glowing Holographic Workstation Monitor
        const currentZone = getZoneInfo(f);
        const col = k.rgb(currentZone.r, currentZone.g, currentZone.b);
        const isCurrent = state.floor === f;
        const opacity = isCurrent ? 0.9 : 0.3;

        k.drawRect({ width: 6, height: 14, pos: k.vec2(terminalX - 3, floorY - 50), color: k.rgb(20, 20, 25) });
        k.drawRect({ width: 48, height: 30, pos: k.vec2(terminalX - 24, floorY - 74), color: k.rgb(20, 20, 25), radius: 2 });
        k.drawRect({ width: 42, height: 24, pos: k.vec2(terminalX - 21, floorY - 71), color: col, opacity: opacity * 0.85 });
        k.drawRect({ width: 38, height: 3, pos: k.vec2(terminalX - 19, floorY - 65), color: k.rgb(255, 255, 255), opacity: opacity });
        k.drawRect({ width: 26, height: 3, pos: k.vec2(terminalX - 19, floorY - 58), color: k.rgb(255, 255, 255), opacity: opacity });

        // Fluttering desk papers resting
        k.pushTransform();
        k.pushTranslate(k.vec2(deskX + 15, floorY - 40));
        k.pushRotate(12);
        k.drawRect({ width: 12, height: 16, color: k.rgb(255, 255, 255), opacity: 0.9 });
        k.popTransform();

        k.pushTransform();
        k.pushTranslate(k.vec2(deskX + 25, floorY - 39));
        k.pushRotate(-25);
        k.drawRect({ width: 12, height: 16, color: k.rgb(255, 255, 255), opacity: 0.95 });
        k.popTransform();

        // ------------------------------------
        // HIGH-TECH PNEUMATIC ELEVATOR SHAFT
        // ------------------------------------
        if (f < 100) {
            const elevatorX = centerX;
            k.drawRect({ width: 58, height: 82, pos: k.vec2(elevatorX - 29, floorY - 90), color: k.rgb(20, 20, 25), radius: 2 });
            k.drawRect({ width: 48, height: 76, pos: k.vec2(elevatorX - 24, floorY - 84), color: k.rgb(24, 32, 38), opacity: 0.9 });

            if (isCurrent) {
                k.drawRect({ width: 24, height: 24, pos: k.vec2(elevatorX - 12, floorY - 116), color: activeColor, opacity: 0.15, radius: 4 });
                k.drawText({ text: "▲", pos: k.vec2(elevatorX - 6, floorY - 112), size: 11, color: activeColor, opacity: 0.8 });
            }

            for (let lineY = floorY - 80; lineY < floorY - 10; lineY += 16) {
                k.drawRect({
                    width: 44,
                    height: 2,
                    pos: k.vec2(elevatorX - 22, lineY),
                    color: isCurrent ? activeColor : k.rgb(50, 60, 70),
                    opacity: isCurrent ? 0.35 : 0.1
                });
            }
        }
    }
});

// ==========================================
// 3. HUMAN SILHOUETTE AVATAR ENTITY
// ==========================================
const player = k.add([
    k.pos(terminalX, k.height() - 100),
    k.rect(28, 54, { radius: 0 }),
    k.color(20, 20, 25), // Absolute black vector silhouette
    k.anchor("center"),
    k.rotate(0),
    k.scale(1, 1),
    "player",
    {
        targetX: terminalX,
        targetY: k.height() - 100,
        playerState: "at_terminal", // States: "at_terminal" | "walking_to_ladder" | "climbing" | "entering_terminal"
        animTimer: 0,
        paperTimer: 0
    }
]);

player.onDraw(() => {
    k.pushTransform();

    const silhouetteColor = k.rgb(20, 20, 25);
    const headRadius = 7;
    const bodyState = player.playerState;
    const timer = player.animTimer;

    if (bodyState === "at_terminal") {
        // IDLE BREATHING POSE
        const breatheScale = 1 + Math.sin(timer * 4.5) * 0.02;

        k.drawCircle({ pos: k.vec2(-4, -28 * breatheScale), radius: headRadius, color: silhouetteColor });
        k.drawRect({ width: 14, height: 28, pos: k.vec2(-9, -15), color: silhouetteColor, radius: 2 });
        k.drawRect({ width: 6, height: 18, pos: k.vec2(-8, 8), color: silhouetteColor });
        k.drawRect({ width: 6, height: 18, pos: k.vec2(-1, 8), color: silhouetteColor });
        k.drawRect({ width: 14, height: 5, pos: k.vec2(-16, -10), color: silhouetteColor, radius: 1 });
    }
    else if (bodyState === "walking_to_ladder" || bodyState === "entering_terminal") {
        // DYNAMIC SPRINT PARKOUR POSE
        const sprintLean = bodyState === "walking_to_ladder" ? -15 : 15;
        const runCycle = Math.sin(timer * 14);

        player.angle = sprintLean + (Math.sin(timer * 14) * 3);

        k.drawCircle({
            pos: k.vec2(bodyState === "walking_to_ladder" ? 6 : -6, -26),
            radius: headRadius,
            color: silhouetteColor
        });
        k.drawRect({ width: 16, height: 24, pos: k.vec2(-8, -16), color: silhouetteColor, radius: 2 });

        // Animated leg scissors
        k.pushTransform();
        k.pushTranslate(k.vec2(-4, 6));
        k.pushRotate(runCycle * 35);
        k.drawRect({ width: 5, height: 16, pos: k.vec2(-2.5, 0), color: silhouetteColor });
        k.popTransform();

        k.pushTransform();
        k.pushTranslate(k.vec2(2, 6));
        k.pushRotate(-runCycle * 35);
        k.drawRect({ width: 5, height: 16, pos: k.vec2(-2.5, 0), color: silhouetteColor });
        k.popTransform();

        // Pumping Arms
        k.pushTransform();
        k.pushTranslate(k.vec2(0, -10));
        k.pushRotate(runCycle * 40);
        k.drawRect({ width: 12, height: 4, pos: k.vec2(0, -2), color: silhouetteColor });
        k.popTransform();
    }
    else if (bodyState === "climbing") {
        // VERTICAL ASCENSION ELEVATOR HOIST POSE
        const sway = Math.sin(timer * 8) * 8;
        player.angle = sway;

        k.drawCircle({ pos: k.vec2(0, -32), radius: headRadius, color: silhouetteColor });
        k.drawRect({ width: 12, height: 30, pos: k.vec2(-6, -20), color: silhouetteColor, radius: 2 });
        k.drawRect({ width: 4, height: 20, pos: k.vec2(-5, 8), color: silhouetteColor });
        k.drawRect({ width: 4, height: 20, pos: k.vec2(1, 8), color: silhouetteColor });
        k.drawRect({ width: 4, height: 16, pos: k.vec2(-5, -34), color: silhouetteColor });
        k.drawRect({ width: 4, height: 16, pos: k.vec2(1, -34), color: silhouetteColor });
    }

    k.popTransform();
});

k.onUpdate(() => {
    const speed = k.dt() * 6.5;
    player.animTimer += k.dt();

    switch (player.playerState) {
        case "at_terminal":
            player.targetX = terminalX;
            player.pos.x = terminalX;
            player.angle = 0;
            player.scale.x = 1;
            player.scale.y = 1;
            break;

        case "walking_to_ladder":
            player.pos.x = k.lerp(player.pos.x, centerX, speed);

            player.paperTimer += k.dt();
            if (player.paperTimer > 0.08) {
                spawnWindPaper(player.pos.x - 10, player.pos.y + k.rand(-15, 10));
                player.paperTimer = 0;
            }

            if (Math.abs(player.pos.x - centerX) < 2) {
                player.pos.x = centerX;
                player.playerState = "climbing";
            }
            break;

        case "climbing":
            player.pos.y = k.lerp(player.pos.y, player.targetY, speed * 0.8);
            player.pos.x = centerX;

            if (Math.abs(player.pos.y - player.targetY) < 2) {
                player.pos.y = player.targetY;
                player.playerState = "entering_terminal";
            }
            break;

        case "entering_terminal":
            player.pos.x = k.lerp(player.pos.x, terminalX, speed);

            player.paperTimer += k.dt();
            if (player.paperTimer > 0.08) {
                spawnWindPaper(player.pos.x + 10, player.pos.y + k.rand(-15, 10));
                player.paperTimer = 0;
            }

            if (Math.abs(player.pos.x - terminalX) < 2) {
                player.pos.x = terminalX;
                player.playerState = "at_terminal";
                triggerChallengeGeneration();
            }
            break;
    }

    // Camera following the active room vertically
    k.setCamPos(centerX, k.lerp(k.getCamPos().y, player.pos.y - 100, k.dt() * 4.0));
});

// Set starting camera pos
k.setCamPos(centerX, k.height() - 180);

// ==========================================
// 4. INTERACTIVE HUD COORDINATOR
// ==========================================
let currentChallengeData = null;

const header = document.getElementById("main-header");
const headerTitle = document.querySelector(".header-title");
const menuPanel = document.getElementById("menu-panel");
const loginPanel = document.getElementById("login-panel");
const trialPanel = document.getElementById("trial-panel");
const bootLog = document.getElementById("boot-log");
const agentInput = document.getElementById("agent-input");
const loginBtn = document.getElementById("login-btn");

const btnMenuNew = document.getElementById("btn-menu-new");
const btnMenuContinue = document.getElementById("btn-menu-continue");
const btnMenuLeaderboard = document.getElementById("btn-menu-leaderboard");
const btnMenuDiagnostics = document.getElementById("btn-menu-diagnostics");
const diagnosticsModal = document.getElementById("diagnostics-modal");
const btnCloseDiagnostics = document.getElementById("btn-close-diagnostics");
const btnMenuExit = document.getElementById("btn-menu-exit");
const shutdownScreen = document.getElementById("shutdown-screen");

const statFloor = document.getElementById("stat-floor");
const statLevel = document.getElementById("stat-level");
const statClass = document.getElementById("stat-class");
const statCodename = document.getElementById("stat-codename");
const statXp = document.getElementById("stat-xp");
const xpBar = document.getElementById("xp-bar");

const adminBubble = document.getElementById("admin-bubble");
const challengeFloorTitle = document.getElementById("challenge-floor-title");
const challengeContent = document.getElementById("challenge-content");
const answerInput = document.getElementById("answer-input");
const submitBtn = document.getElementById("submit-btn");
const btnHint = document.getElementById("btn-hint");
const btnReset = document.getElementById("btn-reset");

const promotionScreen = document.getElementById("promotion-screen");
const ceremonyClassTitle = document.getElementById("ceremony-class-title");
const ceremonyClassSpeech = document.getElementById("ceremony-class-speech");
const btnCeremonyAck = document.getElementById("btn-ceremony-ack");

const scoresModal = document.getElementById("scores-modal");
const leaderboardBody = document.getElementById("leaderboard-body");
const btnShowScores = document.getElementById("btn-show-scores");
const btnCloseScores = document.getElementById("btn-close-scores");

function setupRewardShopDOM() {
    if (document.getElementById("reward-shop-modal")) return;

    const modal = document.createElement("div");
    modal.id = "reward-shop-modal";
    modal.className = "glass-panel leaderboard-modal";
    modal.style.display = "none";
    modal.style.zIndex = "1025"; // Above CRT overlay so text is crisp
    modal.style.maxWidth = "460px";
    modal.style.border = "1px solid var(--cyber-cyan)";
    modal.style.boxShadow = "0 0 25px rgba(0, 229, 255, 0.2)";

    modal.innerHTML = `
        <div class="leaderboard-header-row" style="border-bottom: 1px solid rgba(0, 229, 255, 0.3);">
            <h3 style="color: var(--cyber-cyan); font-family: var(--font-display); letter-spacing: 1px;">⚙️ COGNITIVE UPGRADE STATION</h3>
            <button class="btn-secondary" id="btn-close-shop" style="padding: 3px 8px; border-color: var(--cyber-cyan); color: var(--cyber-cyan);">CLOSE</button>
        </div>
        <div style="font-family: var(--font-mono); font-size: 15px; margin-bottom: 15px; text-align: center; color: #ffffff;">
            AVAILABLE BAL: <span id="shop-shards-bal" style="color: var(--green-glow); font-size: 20px; font-weight: bold;">0</span> CORE SHARDS
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4); padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                <div>
                    <div style="font-weight: bold; color: var(--green-glow);">OVERCLOCKED MEMORY</div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.6);">Passive +15% XP gain per level</div>
                </div>
                <button id="buy-xp-boost" class="btn-primary" style="padding: 6px 12px; font-size: 12px;">BUY (50 SHARDS)</button>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4); padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                <div>
                    <div style="font-weight: bold; color: var(--spectral-violet);">VIOLET PHOTON VISOR</div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.6);">Unlock violet laser optics skin</div>
                </div>
                <button id="buy-visor-violet" class="btn-primary" style="padding: 6px 12px; font-size: 12px;">UNLOCK (80)</button>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4); padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                <div>
                    <div style="font-weight: bold; color: var(--volcanic-red);">VOLCANIC VISOR GLOW</div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.6);">Unlock hot volcanic optical skin</div>
                </div>
                <button id="buy-visor-red" class="btn-primary" style="padding: 6px 12px; font-size: 12px;">UNLOCK (120)</button>
            </div>
        </div>
        <div style="font-size: 11px; text-align: center; color: rgba(255,255,255,0.4);">
            *Earn Core Shards by solving encryption keys and leveling up*
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("btn-close-shop").addEventListener("click", () => {
        synth.playClick();
        modal.style.display = "none";
    });

    document.getElementById("buy-xp-boost").addEventListener("click", () => {
        const cost = 50;
        if (state.purchaseUpgrade("xpBoost", cost)) {
            synth.playSuccess();
            updateShopUI();
            syncHUD();
        } else {
            synth.playFail();
        }
    });

    document.getElementById("buy-visor-violet").addEventListener("click", () => {
        const cost = 80;
        if (state.purchaseUpgrade("spectral-violet", cost)) {
            synth.playSuccess();
            updateShopUI();
        } else {
            synth.playFail();
        }
    });

    document.getElementById("buy-visor-red").addEventListener("click", () => {
        const cost = 120;
        if (state.purchaseUpgrade("volcanic-red", cost)) {
            synth.playSuccess();
            updateShopUI();
        } else {
            synth.playFail();
        }
    });
}

function updateShopUI() {
    const shardsBal = document.getElementById("shop-shards-bal");
    if (shardsBal) shardsBal.innerText = state.shards;

    const buyXpBtn = document.getElementById("buy-xp-boost");
    if (buyXpBtn) {
        buyXpBtn.innerText = `BUY LV ${state.upgrades.xpBoost + 1} (${50 + state.upgrades.xpBoost * 20} SHARDS)`;
    }

    const buyVioletBtn = document.getElementById("buy-visor-violet");
    if (buyVioletBtn) {
        if (state.upgrades.visorStyle === "spectral-violet") {
            buyVioletBtn.innerText = "EQUIPPED";
            buyVioletBtn.disabled = true;
        } else {
            buyVioletBtn.innerText = "UNLOCK (80)";
            buyVioletBtn.disabled = false;
        }
    }

    const buyRedBtn = document.getElementById("buy-visor-red");
    if (buyRedBtn) {
        if (state.upgrades.visorStyle === "volcanic-red") {
            buyRedBtn.innerText = "EQUIPPED";
            buyRedBtn.disabled = true;
        } else {
            buyRedBtn.innerText = "UNLOCK (120)";
            buyRedBtn.disabled = false;
        }
    }
}

function injectUpgradeTriggerButton() {
    const existingTrigger = document.getElementById("btn-open-shop");
    if (existingTrigger) return;

    const row = document.querySelector(".console-actions-row");
    if (row) {
        const btnShop = document.createElement("button");
        btnShop.className = "btn-secondary";
        btnShop.id = "btn-open-shop";
        btnShop.style.borderColor = "var(--cyber-cyan)";
        btnShop.style.color = "var(--cyber-cyan)";
        btnShop.innerText = "⚙️ UPGRADES";

        row.insertBefore(btnShop, btnReset);

        btnShop.addEventListener("click", () => {
            synth.playClick();
            setupRewardShopDOM();
            updateShopUI();
            document.getElementById("reward-shop-modal").style.display = "block";
        });
    }
}

function initView() {
    musicAllowed = true;
    musicStarted = false;
    removeMenuMusicListeners();
    addMenuMusicListeners();

    header.style.opacity = 0;
    header.style.pointerEvents = "none";
    loginPanel.style.display = "none";
    trialPanel.style.display = "none";
    promotionScreen.style.display = "none";
    scoresModal.style.display = "none";
    diagnosticsModal.style.display = "none";

    const menuBg = document.getElementById("menu-background");
    if (menuBg) {
        menuBg.style.display = "block";
        menuBg.style.opacity = 1;
    }

    menuPanel.style.display = "block";

    if (state.codename) {
        btnMenuContinue.disabled = false;
        btnMenuContinue.innerText = `📂 RESUME [AGENT: ${state.codename}]`;
    } else {
        btnMenuContinue.disabled = true;
        btnMenuContinue.innerText = "📂 RESUME";
    }
}

function syncHUD() {
    statFloor.innerText = state.floor;
    statLevel.innerText = state.level;
    statClass.innerText = state.className;
    statCodename.innerText = state.codename;

    const requiredXp = state.level * 100;
    statXp.innerText = `${state.xp} / ${requiredXp} XP`;
    const pct = Math.min((state.xp / requiredXp) * 100, 100);
    xpBar.style.width = `${pct}%`;

    const shardHud = document.getElementById("hud-shards-display");
    if (shardHud) {
        shardHud.innerText = `SHARDS: ${state.shards}`;
    } else {
        const leftPanel = document.querySelector(".header-left");
        if (leftPanel) {
            const shSpan = document.createElement("div");
            shSpan.id = "hud-shards-display";
            shSpan.style.color = "var(--green-glow)";
            shSpan.style.fontFamily = "var(--font-mono)";
            shSpan.style.fontSize = "13px";
            shSpan.style.marginTop = "4px";
            shSpan.innerText = `SHARDS: ${state.shards}`;
            leftPanel.appendChild(shSpan);
        }
    }
}

function typeDialogue(text, element = adminBubble) {
    element.innerHTML = "";
    let i = 0;
    const speed = 25;
    const type = () => {
        if (i < text.length) {
            synth.playClick();
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    };
    type();
}

if (headerTitle) {
    headerTitle.addEventListener("click", () => {
        synth.playClick();
        synth.stopAmbientDrone();
        
        const menuBg = document.getElementById("menu-background");
        if (menuBg) {
            menuBg.style.display = "block";
            setTimeout(() => { menuBg.style.opacity = 1; }, 50);
        }

        initView();
    });
}

// ==========================================
// 5. MAIN MENU FLOW HANDLERS
// ==========================================
btnMenuNew.addEventListener("click", () => {
    startMenuMusic();
    synth.playClick();
    state.reset();
    menuPanel.style.display = "none";
    loginPanel.style.display = "block";
    agentInput.value = "";

    bootLog.innerHTML = "<div>> APERTURE NODE CHANNELS READY.</div>";

    const bootLines = [
        ">> DEPLOYING INTEL TOWER PORTAL...",
        ">> SYNCHRONIZING Programmatic Audio Synth [OK]",
        ">> PARSING PERSISTENT STATE REGISTERS...",
        ">> UPLINK SECURE TO CLOUD GATEWAY... [OK]",
        ">> CONNECTING TO CENTRAL MODEL GATEWAY..."
    ];

    let index = 0;
    const printBootLine = () => {
        if (index < bootLines.length) {
            synth.playClick();
            const div = document.createElement("div");
            div.innerText = bootLines[index];
            bootLog.appendChild(div);
            bootLog.scrollTop = bootLog.scrollHeight;
            index++;
            setTimeout(printBootLine, 450);
        } else {
            agentInput.focus();
        }
    };
    setTimeout(printBootLine, 300);
});

btnMenuContinue.addEventListener("click", () => {
    if (!state.codename) return;

    stopMenuMusic();
    synth.startAmbientDrone();
    synth.playSuccess();
    menuPanel.style.display = "none";
    trialPanel.style.display = "flex";
    header.style.opacity = 1;
    header.style.pointerEvents = "auto";
    injectUpgradeTriggerButton();
    syncHUD();

    const menuBg = document.getElementById("menu-background");
    if (menuBg) {
        menuBg.style.opacity = 0;
        setTimeout(() => { menuBg.style.display = "none"; }, 600);
    }

    player.targetY = k.height() - 100 - (state.floor - 1) * floorHeight;
    player.pos.y = player.targetY;
    player.pos.x = terminalX;
    player.targetX = terminalX;
    player.playerState = "at_terminal";
    k.setCamPos(centerX, player.targetY - 100);

    triggerChallengeGeneration();
});

btnMenuLeaderboard.addEventListener("click", () => {
    startMenuMusic();
    synth.playClick();

    const mpModal = document.getElementById("mp-modal");
    const mpSpinner = document.getElementById("mp-spinner-section");
    const mpEnter = document.getElementById("mp-enter-section");
    const mpLabel = document.getElementById("mp-connecting-label");
    const mpConfirm = document.getElementById("mp-confirm-btn");
    const mpCancel = document.getElementById("mp-cancel-btn");

    mpSpinner.style.display = "block";
    mpEnter.style.display = "none";
    mpLabel.innerText = "CONNECTING ...";
    mpModal.style.display = "flex";

    const dotStates = ["CONNECTING .", "CONNECTING ..", "CONNECTING ..."];
    let dotIdx = 0;
    const dotInterval = setInterval(() => {
        dotIdx = (dotIdx + 1) % dotStates.length;
        mpLabel.innerText = dotStates[dotIdx];
    }, 400);

    setTimeout(() => {
        clearInterval(dotInterval);
        mpSpinner.style.display = "none";
        mpEnter.style.display = "block";
        synth.playSuccess();
    }, 2500);

    mpConfirm.onclick = () => {
        synth.playSuccess();
        mpModal.style.display = "none";
    };

    mpCancel.onclick = () => {
        synth.playClick();
        clearInterval(dotInterval);
        mpModal.style.display = "none";
    };
});

btnMenuDiagnostics.addEventListener("click", () => {
    startMenuMusic();
    synth.playClick();
    diagnosticsModal.style.display = "block";
});

btnMenuExit.addEventListener("click", () => {
    stopMenuMusic();
    synth.stopAmbientDrone();
    synth.playFail();

    menuPanel.style.display = "none";
    header.style.opacity = 0;
    header.style.pointerEvents = "none";

    shutdownScreen.style.display = "flex";
    setTimeout(() => { shutdownScreen.style.opacity = 1; }, 50);

    const shutdownLog = document.getElementById("shutdown-log");
    shutdownLog.innerHTML = "<div>> SHUTTING DOWN TOWER CORE CONNECTORS...</div>";

    const shutdownLines = [
        ">> UNLOADING main.js GRAPHICS MODULES...",
        ">> FLUSHING TRANSIENT NEURAL MEMORY PACKETS...",
        ">> DE-REGISTERING MODEL CHANNELS [OK]",
        ">> TERMINATION SUCCESS. NEURAL LINK DISCONNECTED.",
        ">> [TOWER SYSTEM OFFLINE]"
    ];

    let idx = 0;
    const typeShutdown = () => {
        if (idx < shutdownLines.length) {
            synth.playClick();
            const div = document.createElement("div");
            div.innerText = shutdownLines[idx];
            shutdownLog.appendChild(div);
            idx++;
            setTimeout(typeShutdown, 500);
        } else {
            setTimeout(() => { window.close(); }, 1000);
        }
    };
    setTimeout(typeShutdown, 600);
});

btnCloseDiagnostics.addEventListener("click", () => {
    synth.playClick();
    diagnosticsModal.style.display = "none";
});

// ==========================================
// 6. REGISTRATION BYPASS
// ==========================================
loginBtn.addEventListener("click", handleLogin);
agentInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
    else synth.playClick();
});

function handleLogin() {
    const val = agentInput.value.trim();
    if (!val) return;

    stopMenuMusic(); // Stop music immediately!

    synth.playSuccess();
    state.login(val);

    loginPanel.style.animation = "shakeWidget 0.4s";
    setTimeout(() => {
        synth.startAmbientDrone();
        loginPanel.style.display = "none";
        trialPanel.style.display = "flex";
        header.style.opacity = 1;
        header.style.pointerEvents = "auto";
        injectUpgradeTriggerButton();
        syncHUD();

        const menuBg = document.getElementById("menu-background");
        if (menuBg) {
            menuBg.style.opacity = 0;
            setTimeout(() => { menuBg.style.display = "none"; }, 600);
        }

        // Align player and camera to current floor
        player.targetY = k.height() - 100 - (state.floor - 1) * floorHeight;
        player.pos.y = player.targetY;
        player.pos.x = terminalX;
        player.targetX = terminalX;
        player.playerState = "at_terminal";
        k.setCamPos(centerX, player.targetY - 100);

        triggerChallengeGeneration();
    }, 450);
}

// ==========================================
// 7. CHALLENGE UPLINK ROUTINE
// ==========================================
async function triggerChallengeGeneration() {
    // Reset administrator avatar to neutral
    const adminFace = document.getElementById("admin-face");
    if (adminFace) adminFace.style.backgroundImage = "url('/sprites/admin_neutral.png')";

    submitBtn.disabled = true;
    answerInput.disabled = true;
    btnHint.disabled = true;

    const zone = getZoneInfo(state.floor);
    challengeContent.innerHTML = `<span class='blink-text' style='color: rgb(${zone.r}, ${zone.g}, ${zone.b}); font-size: 18px;'>⚡ DECRYPTING FLOOR INTEL DOSSIER...</span>`;
    challengeFloorTitle.innerText = `FLOOR ${state.floor.toString().padStart(3, '0')} // ${zone.name}`;

    const card = document.getElementById("challenge-card-widget");
    if (card) {
        card.style.borderColor = `rgba(${zone.r}, ${zone.g}, ${zone.b}, 0.35)`;
        card.style.boxShadow = `0 0 20px rgba(${zone.r}, ${zone.g}, ${zone.b}, 0.1)`;
    }

    currentChallengeData = await generateChallenge(state.floor, state.className);

    typeDialogue(currentChallengeData.administrator_intro);
    challengeContent.innerText = currentChallengeData.challenge;

    submitBtn.disabled = false;
    answerInput.disabled = false;
    btnHint.disabled = false;
    answerInput.value = "";
    answerInput.focus();
}

// ==========================================
// 8. ANSWER VERIFICATION
// ==========================================
submitBtn.addEventListener("click", handleAnswerSubmit);
answerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAnswerSubmit();
});

async function handleAnswerSubmit() {
    const val = answerInput.value.trim();
    if (!val || submitBtn.disabled) return;

    submitBtn.disabled = true;
    answerInput.disabled = true;

    adminBubble.innerHTML = "<span class='blink-text' style='color: var(--green-glow);'>> INITIATING COGNITIVE PARITY SCAN...</span>";

    const result = await checkAnswer(state.floor, currentChallengeData.challenge, val);

    if (result.correct) {
        synth.playSuccess();
        spawnLevelUpBurst(player.pos);

        state.recordAnswer(state.floor, currentChallengeData.challenge, val, true);

        const baseXP = state.floor * 15 + 20;
        const shardGain = Math.round(state.floor * 1.5 + 5);
        state.addShards(shardGain);
        const xpResult = state.addXP(baseXP);

        typeDialogue(result.administrator_remarks + ` [Unlocked +${shardGain} Core Shards]`);

        setTimeout(() => {
            if (xpResult.leveledUp) {
                synth.playPromotion();
                spawnLevelUpBurst(player.pos);
                k.shake(8);
            }

            if (state.floor > 0 && state.floor % 10 === 0) {
                triggerClassCeremony();
            } else {
                ascendPlayer();
            }
        }, 1500);
    } else {
        synth.playFail();
        k.shake(12);
        answerInput.classList.add("shake");

        // Show angry/error avatar
        const adminFace = document.getElementById("admin-face");
        if (adminFace) adminFace.style.backgroundImage = "url('/sprites/admin_error.png')";

        setTimeout(() => answerInput.classList.remove("shake"), 500);

        state.recordAnswer(state.floor, currentChallengeData.challenge, val, false);
        typeDialogue(result.administrator_remarks);

        submitBtn.disabled = false;
        answerInput.disabled = false;
        answerInput.focus();
    }
}

function ascendPlayer() {
    state.floor += 1;
    state.submitHighScore();
    state.save();
    syncHUD();

    if (state.floor > 100) {
        typeDialogue("Parity breach absolute. You have hijacked my central core matrix. The 100-story tower is yours. You have achieved absolute ascendancy.");
        challengeContent.innerHTML = "<span style='color: var(--green-glow); font-size: 24px; font-weight: bold;'>🏆 THE 100th FLOOR HAS FALLEN! TOWER ASCENT COMPLETE!</span>";
        submitBtn.disabled = true;
        answerInput.disabled = true;
    } else {
        player.targetY = k.height() - 100 - (state.floor - 1) * floorHeight;
        player.playerState = "walking_to_ladder";
    }
}

// ==========================================
// 9. CLASS PROMOTION CEREMONY
// ==========================================
async function triggerClassCeremony() {
    promotionScreen.style.display = "flex";
    promotionScreen.style.opacity = 1;

    ceremonyClassTitle.innerText = "EVALUATING aptitudes...";
    ceremonyClassSpeech.innerText = "Analyzing answer history patterns...";

    const ceremonyData = await determineSpecializedClass(state.history);

    synth.playPromotion();
    ceremonyClassTitle.innerText = ceremonyData.className;
    typeDialogue(ceremonyData.ceremony_speech, ceremonyClassSpeech);

    state.registerClass(ceremonyData.className);
    syncHUD();
}

btnCeremonyAck.addEventListener("click", () => {
    synth.playClick();
    promotionScreen.style.opacity = 0;
    setTimeout(() => {
        promotionScreen.style.display = "none";
        ascendPlayer();
    }, 500);
});

// ==========================================
// 10. HELPER ACTIONS
// ==========================================
btnHint.addEventListener("click", () => {
    if (!currentChallengeData || btnHint.disabled) return;
    synth.playClick();
    typeDialogue(`>> SCAN CLUE: ${currentChallengeData.hint}`);
});

btnReset.addEventListener("click", () => {
    if (confirm("PURGE CORE registers? All climbing statistics and current neural cleared.")) {
        synth.stopAmbientDrone();
        synth.playFail();
        state.reset();

        const menuBg = document.getElementById("menu-background");
        if (menuBg) {
            menuBg.style.display = "block";
            setTimeout(() => { menuBg.style.opacity = 1; }, 50);
        }

        initView();
    }
});

// ==========================================
// 11. LEADERBOARDS MODAL
// ==========================================
btnShowScores.addEventListener("click", () => {
    synth.playClick();

    leaderboardBody.innerHTML = state.leaderboard.map((e, idx) => {
        let medal = idx + 1;
        if (idx === 0) medal = "🥇";
        else if (idx === 1) medal = "🥈";
        else if (idx === 2) medal = "🥉";

        return `
            <tr>
                <td>${medal}</td>
                <td style="color: var(--green-glow); font-weight: bold;">${e.codename}</td>
                <td>FL ${e.floor}</td>
                <td>LV ${e.level}</td>
                <td style="color: var(--cyber-cyan); font-size: 14px;">${e.className}</td>
            </tr>
        `;
    }).join("");

    scoresModal.style.display = "block";
});

btnCloseScores.addEventListener("click", () => {
    synth.playClick();
    scoresModal.style.display = "none";
});

window.addEventListener("resize", () => {
    k.canvas.width = window.innerWidth;
    k.canvas.height = window.innerHeight;
});

initView();