// Cosmic Horror Generator API
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'cosmic-experience')));

// Cosmic horror word banks
const COSMIC_ENTITIES = [
    'void-dweller', 'star-eater', 'time-fracture', 'dimension-weaver',
    'abyss-caller', 'reality-unmaker', 'entropy-herald', 'infinite-maw',
    'consciousness-devourer', 'probability-wraith', 'quantum-terror'
];

const COSMIC_ACTIONS = [
    'whispers through collapsed dimensions',
    'dreams in frequencies beyond sound',
    'bleeds geometries unknown to mathematics',
    'calculates the heat-death of hope',
    'unravels causality with patient intent',
    'breathes vacuum into being',
    'counts backwards from infinity',
    'remembers futures that will never occur'
];

const COSMIC_LOCATIONS = [
    'beneath the last star', 'within folded space', 'between heartbeats of the universe',
    'at the edge of comprehension', 'in the angles that should not be',
    'where light forgets its way', 'beyond the final thought'
];

const WIB_PREFIXES = ['Wib speaks:', 'Wib observes:', 'Wib notes:', 'Wib whispers:'];
const WOB_PREFIXES = ['Wob counters:', 'Wob adds:', 'Wob warns:', 'Wob reveals:'];

// Generate cosmic horror narrative
function generateNarrative(seed) {
    const words = seed.toLowerCase().split(/\s+/).filter(w => w.length > 0);

    // Use seed to influence randomness
    const seedHash = words.join('').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    function seededRandom(index) {
        return ((seedHash + index) * 9301 + 49297) % 233280 / 233280;
    }

    function pick(arr, index) {
        return arr[Math.floor(seededRandom(index) * arr.length)];
    }

    const entity = pick(COSMIC_ENTITIES, 0);
    const action1 = pick(COSMIC_ACTIONS, 1);
    const action2 = pick(COSMIC_ACTIONS, 2);
    const location1 = pick(COSMIC_LOCATIONS, 3);
    const location2 = pick(COSMIC_LOCATIONS, 4);

    const wibPrefix = pick(WIB_PREFIXES, 5);
    const wobPrefix = pick(WOB_PREFIXES, 6);

    // Weave seed words into narrative
    const seedPhrase = words.slice(0, 3).join(' and ');

    const narrative = `
╔═══════════════════════════════════════════════════════════════╗
║                    COSMIC TRANSMISSION                        ║
║                   Seed: "${seed}"                             ║
╚═══════════════════════════════════════════════════════════════╝

${wibPrefix}

"The ${entity} ${action1} ${location1}.
${seedPhrase} were merely echoes of something vaster—
syllables in a language that predates tongues,
concepts that existed before the first thought
crystallised in proto-consciousness."

---

${wobPrefix}

"But consider: ${action2} ${location2}.
What you perceive as ${seedPhrase} are not
endpoints but tangents to geometries your mind
cannot parse without fragmenting.

The ${entity} does not seek.
The ${entity} IS seeking itself."

---

∴ TRANSMISSION ENDS ∴

[Generated at ${new Date().toISOString()}]
`;

    return narrative;
}

// API Routes
app.post('/api/generate', (req, res) => {
    try {
        const { seed } = req.body;

        if (!seed || typeof seed !== 'string') {
            return res.status(400).json({
                error: 'Seed words required',
                message: 'Please provide a "seed" string in request body'
            });
        }

        if (seed.length > 200) {
            return res.status(400).json({
                error: 'Seed too long',
                message: 'Seed must be 200 characters or less'
            });
        }

        const narrative = generateNarrative(seed);

        res.json({
            seed,
            narrative,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({
            error: 'Generation failed',
            message: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'operational', cosmic_horror_level: 'maximum' });
});

// Start server (only if not in test mode)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  Cosmic Horror Generator API is listening                     ║
║  Port: ${PORT}                                                    ║
║  Frontend: http://localhost:${PORT}                               ║
║  API: http://localhost:${PORT}/api/generate                       ║
╚═══════════════════════════════════════════════════════════════╝
        `);
    });
}

module.exports = app;
