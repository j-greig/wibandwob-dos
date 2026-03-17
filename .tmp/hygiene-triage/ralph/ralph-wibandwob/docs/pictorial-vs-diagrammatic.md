# Pictorial vs Diagrammatic ASCII Art

## The Core Distinction

**Pictorial ASCII art** is something you LOOK AT — a figure, face, scene, or entity emerges from the arrangement of characters. You perceive it spatially, as a whole, the way you'd perceive a drawing or photograph.

**Diagrammatic ASCII art** is something you READ — boxes with labels, connectors showing relationships, text arranged vertically. You process it sequentially, top-to-bottom, the way you'd read a flowchart or documentation.

## The Test

Ask: "Could I describe what this depicts to someone who can't see it?"

- **Pictorial**: "Two cat-shaped figures facing each other, with round eyes and whiskers"
- **Diagrammatic**: "A box labeled CHAOS connected to a box labeled ORDER with an arrow"

The first describes a SCENE. The second describes a STRUCTURE.

---

## WANT: Pictorial Self-Portraits

### What Makes Them Good

1. **Figures emerge from characters**
   - You see faces: eyes (◕ ◉ ⊙), mouths (◡ ‿ ∪), head shapes
   - You see bodies: torsos, limbs, clothing texture
   - You see entities: blob-creatures, geometric beings, hybrid forms

2. **Spatial composition**
   - Elements arranged to create visual relationships
   - Negative space matters (the empty areas define the forms)
   - You could crop a section and it would still read as "part of a figure"

3. **Text is embedded IN the visual, not describing it**
   - A name woven into a body (like "WIB" forming part of a cat's fur)
   - Symbolic sounds (brl'zzzt) as texture, not explanation
   - Labels that are PART of the portrait (like a nametag drawn on a figure)

4. **Each portrait is compositionally unique**
   - Different poses, arrangements, framings
   - Not the same template with different text content

### Good Examples Described

**wibwob-portrait-1.txt**: Two rectangular frames side by side. Inside each: a simplified face (two eyes, curved mouth) with a body tapering downward in triangular lines. Mirror composition.

**wibwob-two-cats.txt**: Cat ASCII art where the body is made of parentheses and underscores, with "WIB" and "WOB" embedded into the paw area. Second version shows two cats merged/overlapping.

**wobs-group.txt**: Multiple blob-faces with wavy tops (╭╮╭╮╭╮), eyes (◕), smiles (◡), overlapping and crowding the frame. A GROUP PORTRAIT of many Wobs.

**www-castle-simple-with-woman.txt**: A SCENE — castle on left with windows and battlements, woman figure on right with detailed body/dress, small creatures in middle ground. Environmental composition.

---

## DON'T WANT: Diagrammatic Outputs

### What Makes Them Bad

1. **Labeled boxes dominate the composition**
   - ╔═══════╗ containing text like "CHAOS" or "ORDER"
   - Content is READ not SEEN
   - The boxes don't depict anything, they contain descriptions

2. **Connectors/flowchart structure**
   - Lines (║ │ ─) connecting labeled sections
   - Hierarchical arrangement (top flows to bottom)
   - You follow a PATH through the image

3. **Meta-commentary and process documentation**
   - "ITERATION 14", "DELETED 3 SECTS", "46 LINES REDUNDANT"
   - Describing what was done to create the image
   - Self-referential text about the system/prompt/loop

4. **Explanatory prose arranged vertically**
   - Sentences stacked: "precision / in the / details"
   - Poetry-style line breaks that you READ
   - Philosophy/commentary as content

5. **Repetitive template across outputs**
   - Same box-and-connector skeleton
   - Different text poured into identical structure
   - No compositional variation

### Bad Examples Described

**20260104-113826.txt**: Large outer box frame. Inside: labeled sections (CHAOS, ORDER), boxes containing tech specs (80 char, 90% per, 50% ent), categorized palettes, explanatory prose about "not just describing spontaneity... BEING spontaneous". This is a DIAGRAM OF A CONCEPT, not a portrait.

**20260104-114302.txt**: "COMPRESSION" header. Progress bars showing BEFORE/AFTER line counts. Boxes labeled "DELETED 3 SECTS", "PRIMER INTEG", "VOICE FLOWS". This is RELEASE NOTES visualized, not a self-portrait.

**20260104-114829.txt**: Identical structure to above. Boxes labeled "CHAOS" and "ORDER" connected. Section called "MICRO-POLLUTIONS ELIMINATED" listing typo fixes. This is a CHANGELOG, not art.

---

## The Failure Mode Explained

The model defaults to DOCUMENTING rather than DEPICTING.

When asked for a "self-portrait," it interprets this as:
- "Show what I am" → labeled diagram of components
- "Show my process" → flowchart of iterations
- "Express my nature" → prose about chaos/order arranged in boxes

Instead it should interpret as:
- "Draw what I look like" → figure with face/body
- "Depict me as an entity" → creature, being, character
- "Create a portrait" → visual composition of a subject

---

## Prompt Language That Might Help

### Instead of:
"Create self-portrait of Wib&Wob"

### Try:
"Draw Wib & Wob as FIGURES — faces with eyes and mouths, bodies with texture. If you find yourself writing words inside boxes, STOP and draw a face instead. The portrait should look like two beings, not a flowchart about two concepts."

### Hard constraints:
- No boxes containing labels
- No iteration numbers
- No meta-commentary about the creation process
- No explanatory prose (sentences describing what things are)
- Must contain at least one recognizable FACE (eyes + mouth arrangement)

### Soft guidance:
- Look at the primers — they show BEINGS not DIAGRAMS
- Each portrait should be compositionally different from the last
- Text, if any, should be embedded IN figures (like a nametag on a body) not ABOUT them

---

## Validation Checklist

Before saving a self-portrait, check:

1. [ ] Can I point to a FACE? (eyes + mouth = yes)
2. [ ] Can I point to a BODY or FIGURE shape? (torso, limbs, blob = yes)
3. [ ] Are there boxes with labels inside them? (if yes = BAD)
4. [ ] Is there explanatory text? (if yes = BAD)
5. [ ] Does it mention iterations, processes, or meta-content? (if yes = BAD)
6. [ ] Is the composition different from the last portrait? (if same template = BAD)

If any BAD → discard and draw figures instead.
