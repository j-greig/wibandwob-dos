// Cosmic Horror Generator - Frontend
const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');
const output = document.getElementById('output');
const seedInput = document.getElementById('seedInput');
const generateBtn = document.getElementById('generateBtn');

// Audio context for procedural sound generation
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
}

// Procedural cosmic horror sounds
function playCosmicDrone() {
    initAudio();
    const now = audioCtx.currentTime;

    // Low frequency drone
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(40, now);
    osc1.frequency.exponentialRampToValueAtTime(35, now + 2);

    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(40.5, now); // Slight detune for beating

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.5);
    gain.gain.linearRampToValueAtTime(0.1, now + 2);
    gain.gain.linearRampToValueAtTime(0, now + 5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 5);
    osc2.stop(now + 5);
}

function playWhisper() {
    initAudio();
    const now = audioCtx.currentTime;

    // White noise for whisper effect
    const bufferSize = audioCtx.sampleRate * 0.3;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    // High-pass filter for whisper character
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2000, now);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    noise.start(now);
}

function playCreatureSound() {
    initAudio();
    const now = audioCtx.currentTime;

    // Dissonant chord
    const frequencies = [110, 165, 233]; // Dissonant intervals

    frequencies.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.9, now + 1);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.1 + i * 0.05);
        gain.gain.linearRampToValueAtTime(0, now + 1);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 1);
    });
}

// Resize canvas to window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ASCII Creatures
const CREATURES = [
    {
        name: 'void-dweller',
        frames: [
            `    ∴
   ◉ ◉
  ▓▓▓▓▓
 ▓▓▓▓▓▓▓
  ▓▓▓▓▓
   ▓▓▓`,
            `    ∴
   ◉ ◉
  ▓▓▓▓▓
 ▓▓▓◉▓▓▓
  ▓▓▓▓▓
   ▓▓▓`
        ]
    },
    {
        name: 'star-eater',
        frames: [
            `   ╱╲╱╲
  ╱ ◉◉ ╲
 ╱══════╲
╱ ▓▓▓▓▓▓ ╲
 ╲▓▓▓▓▓▓╱
  ╲════╱`,
            `   ╱╲╱╲
  ╱ ◉◉ ╲
 ╱══◉═══╲
╱ ▓▓▓▓▓▓ ╲
 ╲▓▓▓▓▓▓╱
  ╲════╱`
        ]
    },
    {
        name: 'entropy-herald',
        frames: [
            `  ▓▓▓
 ▓◉ ◉▓
▓▓▓▓▓▓▓
 ▓▓▓▓▓
  ▓ ▓`,
            `  ▓▓▓
 ▓◉ ◉▓
▓▓▓◉▓▓▓
 ▓▓▓▓▓
  ▓ ▓`
        ]
    }
];

// Particle system for background
class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.life = Math.random();
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

        this.life = (this.life + 0.001) % 1;
    }

    draw() {
        const alpha = Math.sin(this.life * Math.PI) * 0.3;
        ctx.fillStyle = `rgba(0, 255, 65, ${alpha})`;
        ctx.fillRect(this.x, this.y, 1, 1);
    }
}

// ASCII Creature renderer
class Creature {
    constructor(type) {
        this.type = type;
        this.x = Math.random() * (canvas.width - 200) + 100;
        this.y = Math.random() * (canvas.height - 200) + 100;
        this.frameIndex = 0;
        this.frameCounter = 0;
        this.alpha = 0;
        this.targetAlpha = 0.8;
        this.scale = 1;
        this.targetScale = 1.5;
        this.rotation = 0;
    }

    update() {
        // Animate frame
        this.frameCounter++;
        if (this.frameCounter % 20 === 0) {
            this.frameIndex = (this.frameIndex + 1) % this.type.frames.length;
        }

        // Fade in/out
        if (this.alpha < this.targetAlpha) {
            this.alpha += 0.02;
        }

        // Pulse scale
        this.scale += (this.targetScale - this.scale) * 0.05;
        this.targetScale = 1.5 + Math.sin(Date.now() * 0.001) * 0.3;

        // Slow rotation
        this.rotation += 0.001;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);

        ctx.globalAlpha = this.alpha;
        ctx.font = '16px Courier New';
        ctx.fillStyle = '#00ff41';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const lines = this.type.frames[this.frameIndex].split('\n');
        lines.forEach((line, i) => {
            ctx.fillText(line, 0, (i - lines.length / 2) * 18);
        });

        ctx.restore();
    }

    fadeOut(callback) {
        this.targetAlpha = 0;
        const interval = setInterval(() => {
            if (this.alpha <= 0.05) {
                clearInterval(interval);
                if (callback) callback();
            }
        }, 50);
    }
}

const particles = Array.from({ length: 200 }, () => new Particle());
let creatures = [];

function animate() {
    ctx.fillStyle = 'rgba(10, 10, 10, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
        p.update();
        p.draw();
    });

    creatures.forEach(c => {
        c.update();
        c.draw();
    });

    requestAnimationFrame(animate);
}
animate();

// Spawn creatures based on entity mentioned in narrative
function spawnCreature(entityName) {
    const creature = CREATURES.find(c => entityName.includes(c.name));
    if (creature) {
        const newCreature = new Creature(creature);
        creatures.push(newCreature);

        // Play creature sound
        playCreatureSound();

        // Remove after 10 seconds
        setTimeout(() => {
            newCreature.fadeOut(() => {
                const index = creatures.indexOf(newCreature);
                if (index > -1) creatures.splice(index, 1);
            });
        }, 10000);
    }
}

// Clear all creatures
function clearCreatures() {
    creatures.forEach(c => {
        c.fadeOut(() => {
            const index = creatures.indexOf(c);
            if (index > -1) creatures.splice(index, 1);
        });
    });
}

// Generate cosmic horror text
async function generate() {
    const seed = seedInput.value.trim();
    if (!seed) {
        alert('Enter some seed words first!');
        return;
    }

    // Clear previous creatures
    clearCreatures();

    output.classList.remove('visible');
    output.textContent = 'SUMMONING THE WIB&WOB VOICES...';
    output.classList.add('visible', 'loading');

    // Play ambient drone during generation
    playCosmicDrone();

    try {
        const response = await fetch('http://localhost:3000/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seed })
        });

        if (!response.ok) throw new Error('Generation failed');

        const data = await response.json();

        // Play whisper when text appears
        playWhisper();

        output.classList.remove('loading');
        output.textContent = data.narrative;

        // Spawn creatures mentioned in narrative
        const narrativeLower = data.narrative.toLowerCase();
        CREATURES.forEach(creature => {
            if (narrativeLower.includes(creature.name)) {
                setTimeout(() => {
                    spawnCreature(creature.name);
                }, Math.random() * 2000); // Stagger creature spawns
            }
        });

    } catch (error) {
        output.classList.remove('loading');
        output.textContent = `ERROR: ${error.message}\n\nIs the server running? Try: npm start`;
    }
}

generateBtn.addEventListener('click', generate);
seedInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') generate();
});
