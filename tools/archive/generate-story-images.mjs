/**
 * Tuti Immersive Story — Sequential Image Generation
 *
 * Scene 1  → text-to-image (generation endpoint)
 * Scenes 2–4 → image-to-image edits using the approved previous PNG
 *
 * Model preference: gpt-image-2 → gpt-image-1.5 → gpt-image-1
 * Never uses dall-e-3.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node generate-story-images.mjs
 *   OPENAI_API_KEY=sk-... node generate-story-images.mjs --scene 2
 *   OPENAI_API_KEY=sk-... node generate-story-images.mjs --unsafe-batch   ← WARNING: skips approval
 *
 * Outputs:
 *   Review copies  → docs/status/immersive-assets/
 *   Approved final → apps/web/src/assets/
 *
 * Do not wire images into the website after approval.
 * Do not update homeStoryChapters.js.
 * Do not run builds.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { createInterface } from "readline";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Paths ────────────────────────────────────────────────────────
const ROOT       = dirname(fileURLToPath(import.meta.url));
const REVIEW_DIR = join(ROOT, "docs/status/immersive-assets");
const ASSET_DIR  = join(ROOT, "apps/web/src/assets");

mkdirSync(REVIEW_DIR, { recursive: true });
// ASSET_DIR is expected to exist; fail clearly if not
if (!existsSync(ASSET_DIR)) {
  console.error(`\nError: asset directory not found: ${ASSET_DIR}`);
  console.error("Ensure apps/web/src/assets/ exists before running this script.\n");
  process.exit(1);
}

// ─── Environment ──────────────────────────────────────────────────
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("\nError: OPENAI_API_KEY environment variable is not set.");
  console.error("Usage: OPENAI_API_KEY=sk-... node generate-story-images.mjs");
  console.error("Never pass the key as a command-line argument.\n");
  process.exit(1);
}

// ─── Flags ────────────────────────────────────────────────────────
const UNSAFE_BATCH = process.argv.includes("--unsafe-batch");
const START_SCENE  = (() => {
  const i = process.argv.indexOf("--scene");
  if (i === -1) return 1;
  const n = parseInt(process.argv[i + 1], 10);
  return Number.isFinite(n) && n >= 1 && n <= 4 ? n : 1;
})();

// ─── Model preference order ───────────────────────────────────────
// Try each in sequence; fall back on model-not-found API errors.
const MODEL_PREFERENCE = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1"];

// ─── Image dimensions ─────────────────────────────────────────────
// 1536×1024 is exactly 3:2 landscape and is supported by gpt-image-1.
// The edit endpoint uses "auto" to preserve the source image dimensions.
const GEN_SIZE  = "1536x1024";
const EDIT_SIZE = "auto";

// ─── Scene definitions ────────────────────────────────────────────
const MASTER_SPEC = `
STYLE: Professional luxury editorial product photography. Cinematic and realistic.
Not generic stock. Not a perfume advertisement only. Not overly ornate.

COMPOSITION:
Landscape, 3:2 aspect ratio. Main objects positioned centre-right.
Left one-third and lower-left quadrant: deep, uncluttered shadow reserved for website copy. No objects here.
Camera: slightly elevated three-quarter view, 30–35 degrees above horizontal, above and slightly left of the box.
Shallow depth of field. Background is soft and out of focus.

SETTING:
Surface: dark honed polished marble, horizontal, filling the entire background and foreground.
Left edge accent: a fold of textured cream linen fabric resting partially under the box.
No other props or surface elements.

THE BOX (must be identical in all four images):
Deep forest-green rigid luxury gift box. Matte exterior. Precise rectangular proportions.
Box is OPEN and facing the viewer. Three internal compartments divided by structured cream card inserts.
Each compartment lined with soft cream tissue paper.

THE PERFUME BOTTLE (must be identical in all four images):
Rectangular amber glass bottle, approximately 80mm tall, dark metal cap on top.
Warm honey-amber glass. No labels. No visible text. Standing upright inside the LEFT compartment.

LIGHTING:
Single warm directional light source from the upper right.
Warm colour temperature approximately 3000–3400K.
Controlled specular highlight on the perfume glass and box edges.
Soft deep shadows falling toward the lower-left.
No flat lighting. No harsh overexposure.

COLOUR PALETTE:
Deep forest green (box), dark charcoal marble (surface), warm amber (bottle), cream and ivory (tissue, linen), muted gold (ribbon, accents).

PROHIBITED IN ALL IMAGES:
No text. No logos. No brand labels. No readable writing.
No people. No hands. No faces.
No extra perfume bottles. No multiple cakes.
No flowers covering products. No floating objects.
No excessive decorative elements. No watermarks.
`.trim();

const SCENES = [
  {
    id:             1,
    label:          "Choose a scent",
    review_file:    "scene1-scent-review.png",
    final_file:     "home-ch1-scent.png",
    source_scene:   null,           // Scene 1 has no source — it is a fresh generation
    operation:      "generate",
    prompt: `
${MASTER_SPEC}

SCENE 1 — PERFUME ONLY. First step of building a gift.

Box contents:
• LEFT compartment: the amber perfume bottle standing upright on cream tissue paper. HERO object.
• CENTRE compartment: intentionally empty. Clean cream tissue paper. This space waits for the cake.
• RIGHT compartment: intentionally empty. Clean cream tissue paper. This space waits for the card.

Beside the box on the marble surface, loosely resting:
• A single length of cream-and-gold satin ribbon, loosely coiled, not yet tied.

The two empty compartments must read as deliberate and elegant — structured, waiting to be filled.
The perfume bottle is the unambiguous visual focal point.

Mood: anticipation, the first step of creating something meaningful.
The image must communicate: "Begin with the perfume."
    `.trim(),
  },
  {
    id:             2,
    label:          "Add something sweet",
    review_file:    "scene2-sweet-review.png",
    final_file:     "home-ch2-sweet.png",
    source_scene:   1,              // Edited from approved Scene 1
    operation:      "edit",
    prompt: `
Keep the entire image completely unchanged: the same forest-green gift box, the same amber perfume bottle in the left compartment, the same cream tissue paper, the same marble surface, the same cream linen fold, the same camera angle, the same lighting, the same shadows, the same colour treatment, and the same composition. Do not move, resize, recolour or redesign any existing element.

The ONLY change to make: add one small luxury celebration cake inside the centre compartment, which is currently empty.

The cake: round, approximately 100mm diameter, pale cream or ivory smooth fondant exterior, one subtle gold leaf accent or minimal decoration only. Fits neatly within the compartment walls. Rests on the cream tissue paper.

Do NOT change the perfume bottle. Do NOT change the gift box. Do NOT change anything else.
The cream-and-gold ribbon beside the box remains in the same position.
    `.trim(),
  },
  {
    id:             3,
    label:          "Personalise it",
    review_file:    "scene3-personalise-review.png",
    final_file:     "home-ch3-personalise.png",
    source_scene:   2,              // Edited from approved Scene 2
    operation:      "edit",
    prompt: `
Keep the entire image completely unchanged: the forest-green gift box, the amber perfume bottle in the left compartment, the luxury cake in the centre compartment, the marble surface, the cream linen fold, the camera angle, the lighting, the shadows, and the colour treatment. Do not move, resize or alter any existing element.

Make ONLY these two additions:

1. In the right compartment (currently empty): place one premium ivory message card, thick card stock, leaning slightly forward. NO readable text, no script, no writing visible on the card — only a smooth ivory surface with perhaps a faint texture.

2. The cream-and-gold satin ribbon: move it from beside the box to loosely draped across the open box interior, resting lightly across the tops of all three compartments, suggesting it is about to be tied. Not yet tied into a bow.

Do NOT change the perfume bottle. Do NOT change the cake. Do NOT change anything else.
    `.trim(),
  },
  {
    id:             4,
    label:          "Gift it beautifully",
    review_file:    "scene4-complete-review.png",
    final_file:     "home-ch4-complete.png",
    source_scene:   3,              // Edited from approved Scene 3
    operation:      "edit",
    prompt: `
Keep the entire image completely unchanged: the forest-green gift box, the amber perfume bottle in the left compartment, the luxury cake in the centre compartment, the ivory message card in the right compartment, the marble surface, the cream linen fold, the camera angle, the lighting, the shadows, and the colour treatment. Do not move, resize or alter any existing object.

Make ONLY these finishing changes:

1. The cream-and-gold ribbon: complete it into a full, elegant satin bow resting centred across the front of the open box above the three items. The bow should have two generous loops and two tails. This is the visual finishing touch of the gift.

2. The tissue paper inside each compartment: neaten it slightly so it frames each object elegantly.

3. Optionally: the box lid may appear resting on the marble surface, slightly behind and beside the box at a natural angle. The box contents must remain fully visible. Do NOT close the lid over the contents.

Do NOT replace the cake with chocolates. The cake must remain clearly visible.
Do NOT hide, move or change the perfume bottle, the cake, or the card.
The completed gift must feel ready to present.
    `.trim(),
  },
];

// ─── Utility: prompt the user for Enter before an API call ────────
function waitForEnter(message) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => { rl.close(); resolve(); });
  });
}

// ─── Utility: interactive approval gate ──────────────────────────
function askApproval(scene) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const isLast = scene.id === SCENES.length;

    console.log(`\n${"═".repeat(62)}`);
    console.log(`  Scene ${scene.id} — ${scene.label}`);
    console.log(`  Review file: ${join(REVIEW_DIR, scene.review_file)}`);
    console.log(`\n  Open the PNG and inspect it carefully before deciding.`);
    console.log(`\n  y  → approve — copy to apps/web/src/assets/${scene.final_file}`);
    if (!isLast) {
      console.log(`       then continue to Scene ${scene.id + 1} (${SCENES[scene.id].label})`);
    }
    console.log(`  r  → reject  — regenerate Scene ${scene.id} with the same inputs`);
    console.log(`  q  → quit    — stop safely; resume with --scene ${scene.id}`);
    console.log(`${"═".repeat(62)}`);

    function ask() {
      rl.question(`\n  Scene ${scene.id} [y/r/q]: `, (raw) => {
        const a = raw.trim().toLowerCase();
        if (a === "y" || a === "yes")                      { rl.close(); resolve("approve"); }
        else if (a === "r" || a === "retry")               { rl.close(); resolve("reject"); }
        else if (a === "q" || a === "quit" || a === "exit"){ rl.close(); resolve("quit"); }
        else { console.log("  Please enter y (approve), r (regenerate), or q (quit)."); ask(); }
      });
    }
    ask();
  });
}

// ─── API helpers ──────────────────────────────────────────────────

// Try models in preference order; fall back on model-not-found errors.
function isModelError(body) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return text.includes("model_not_found") ||
         text.includes("does not exist") ||
         text.includes("not supported") ||
         text.includes("invalid_model");
}

async function callWithModelFallback(requestFn) {
  for (let i = 0; i < MODEL_PREFERENCE.length; i++) {
    const model = MODEL_PREFERENCE[i];
    try {
      const result = await requestFn(model);
      return { ...result, modelUsed: model };
    } catch (err) {
      const isLast = i === MODEL_PREFERENCE.length - 1;
      if (isModelError(err.message) && !isLast) {
        console.log(`  Model ${model} unavailable — trying ${MODEL_PREFERENCE[i + 1]}…`);
        continue;
      }
      throw err;
    }
  }
}

// ─── Scene 1: text-to-image generation ───────────────────────────
async function generateScene1(scene, model) {
  // GPT Image models return b64_json by default.
  // Sending a format field causes an "Unknown parameter" error — omit it.
  const body = JSON.stringify({
    model,
    prompt:  scene.prompt,
    n:       1,
    size:    GEN_SIZE,
    quality: "high",
  });

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type":  "application/json",
    },
    body,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data?.error || data));

  const item = data.data?.[0];
  if (!item?.b64_json) {
    throw new Error("The image API response did not contain data[0].b64_json.");
  }
  const buffer = Buffer.from(item.b64_json, "base64");
  return { buffer, revisedPrompt: item.revised_prompt || "" };
}

// ─── Scenes 2–4: image edit using approved source PNG ─────────────
async function editWithSource(scene, sourceBuffer, model) {
  // GPT Image models return b64_json by default.
  // Sending a format field causes an "Unknown parameter" error — omit it.
  const form = new FormData();
  form.append("model",  model);
  form.append("prompt", scene.prompt);
  form.append("n",      "1");
  form.append("size",   EDIT_SIZE);
  form.append("quality", "high");

  // Attach the source image as a Blob so FormData serialises it correctly
  const imageBlob = new Blob([sourceBuffer], { type: "image/png" });
  form.append("image", imageBlob, "source.png");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method:  "POST",
    headers: { "Authorization": `Bearer ${API_KEY}` },
    // Do NOT set Content-Type manually — let fetch set it with the boundary
    body:    form,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data?.error || data));

  const item = data.data?.[0];
  if (!item?.b64_json) {
    throw new Error("The image API response did not contain data[0].b64_json.");
  }
  const buffer = Buffer.from(item.b64_json, "base64");
  return { buffer, revisedPrompt: item.revised_prompt || "" };
}

// ─── Cost-confirmation gate ───────────────────────────────────────
async function confirmCost(scene, model, sourceLabel) {
  console.log(`\n${"─".repeat(62)}`);
  console.log(`  About to send an API request:`);
  console.log(`    Scene      : ${scene.id} — ${scene.label}`);
  console.log(`    Model      : ${model}`);
  console.log(`    Operation  : ${scene.operation}`);
  if (scene.operation === "generate") {
    console.log(`    Size       : ${GEN_SIZE}`);
    console.log(`    Source     : (none — fresh generation from text)`);
  } else {
    console.log(`    Size       : ${EDIT_SIZE} (preserves source dimensions)`);
    console.log(`    Source PNG : ${sourceLabel}`);
  }
  console.log(`    Destination: docs/status/immersive-assets/${scene.review_file}`);
  console.log(`${"─".repeat(62)}`);
  await waitForEnter("  Press Enter to send the request, or Ctrl-C to abort: ");
}

// ─── Source-file guard — just-in-time, per scene ─────────────────
// Called immediately before each scene runs, not upfront for the whole batch.
// Scene 1 never needs a source (fresh generation).
// Scenes 2–4 require the approved PNG from the previous scene.
function validateSourceForScene(scene) {
  if (scene.source_scene === null) return null;

  const sourceScene = SCENES.find((s) => s.id === scene.source_scene);
  const sourcePath  = join(ASSET_DIR, sourceScene.final_file);

  if (!existsSync(sourcePath)) {
    console.error(`\nError: Scene ${scene.id} requires the approved Scene ${scene.source_scene} PNG.`);
    console.error(`Expected at: ${sourcePath}`);
    console.error(`Run Scene ${scene.source_scene} first and approve it before resuming here.\n`);
    process.exit(1);
  }

  return sourcePath;
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  // Unsafe-batch warning
  if (UNSAFE_BATCH) {
    console.log(`\n${"█".repeat(62)}`);
    console.log("  WARNING: --unsafe-batch is set.");
    console.log("  All approval gates will be skipped.");
    console.log("  Images will be written directly to apps/web/src/assets/");
    console.log("  without human review. Use only for trusted test runs.");
    console.log(`${"█".repeat(62)}`);
    await waitForEnter("\n  Press Enter to acknowledge and continue, or Ctrl-C to abort: ");
  }

  console.log(`\n${"═".repeat(62)}`);
  console.log("  Tuti Immersive Story — Sequential Image Production");
  console.log(`  Models: ${MODEL_PREFERENCE.join(" → ")}`);
  console.log(`  Scene 1: generation endpoint (${GEN_SIZE})`);
  console.log(`  Scenes 2–4: edit endpoint (${EDIT_SIZE}, source = approved previous PNG)`);
  console.log(`  Starting at Scene ${START_SCENE}`);
  console.log(`${"═".repeat(62)}\n`);

  const scenesToRun = SCENES.filter((s) => s.id >= START_SCENE);

  for (const scene of scenesToRun) {
    // Validate the source PNG just-in-time — only for this scene, only now.
    // Scene 1 returns null (no source needed).
    // Scenes 2–4 require the approved PNG from the previous scene to exist.
    const sourcePath = validateSourceForScene(scene);

    let approved = false;

    while (!approved) {
      const reviewPath = join(REVIEW_DIR, scene.review_file);
      const finalPath  = join(ASSET_DIR,  scene.final_file);

      try {
        // Cost-confirmation gate (uses first model in preference — actual used model printed after)
        await confirmCost(scene, `${MODEL_PREFERENCE[0]} (or next available)`, sourcePath);

        // Execute with model fallback
        let result;
        if (scene.operation === "generate") {
          result = await callWithModelFallback((model) => generateScene1(scene, model));
        } else {
          const sourceBuffer = readFileSync(sourcePath);
          result = await callWithModelFallback((model) => editWithSource(scene, sourceBuffer, model));
        }

        const { buffer, revisedPrompt, modelUsed } = result;

        console.log(`\n  ✓ Generated with model: ${modelUsed}`);
        if (revisedPrompt) {
          console.log(`  Revised prompt preview: "${revisedPrompt.slice(0, 180)}…"`);
        }

        // Save review copy
        writeFileSync(reviewPath, buffer);
        console.log(`  ✓ Review copy saved: ${reviewPath}`);

        if (UNSAFE_BATCH) {
          writeFileSync(finalPath, buffer);
          console.log(`  ✓ Written to: ${finalPath} (--unsafe-batch, no approval gate)`);
          approved = true;
          continue;
        }

        // Interactive approval gate
        const decision = await askApproval(scene);

        if (decision === "approve") {
          writeFileSync(finalPath, buffer);
          console.log(`\n  ✓ Scene ${scene.id} approved.`);
          console.log(`  ✓ Final PNG: ${finalPath}`);
          approved = true;

          if (scene.id === 4) {
            // All done
            console.log(`\n${"═".repeat(62)}`);
            console.log("  All four scenes approved.");
            console.log("\n  Final assets:");
            SCENES.forEach((s) => console.log(`    ${join(ASSET_DIR, s.final_file)}`));
            console.log("\n  Review copies:");
            SCENES.forEach((s) => console.log(`    ${join(REVIEW_DIR, s.review_file)}`));
            console.log(`\n  Stop here. Do not update homeStoryChapters.js yet.`);
            console.log("  Review all four images together before wiring them in.");
            console.log(`${"═".repeat(62)}\n`);
          } else {
            const next = SCENES[scene.id]; // scene.id is 1-based; SCENES is 0-indexed
            console.log(`\n  Continuing to Scene ${next.id} — ${next.label}…`);
          }

        } else if (decision === "reject") {
          console.log(`\n  Scene ${scene.id} rejected. Regenerating…`);
          // Loop continues — regenerate same scene, same inputs

        } else if (decision === "quit") {
          console.log(`\n  Stopped after Scene ${scene.id}.`);
          console.log(`  Resume with: OPENAI_API_KEY=sk-... node generate-story-images.mjs --scene ${scene.id}`);
          console.log(`  The approved source PNG for Scene ${scene.id + 1} must exist at:`);
          if (scene.id < 4) {
            console.log(`    ${join(ASSET_DIR, scene.final_file)}`);
            console.log("  Approve Scene " + scene.id + " first if you have not done so.\n");
          }
          process.exit(0);
        }

      } catch (err) {
        console.error(`\n  Error on Scene ${scene.id}: ${err.message}`);
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const retry = await new Promise((resolve) => {
          rl.question("  Retry this scene? [y/n]: ", (a) => {
            rl.close();
            resolve(a.trim().toLowerCase() === "y");
          });
        });
        if (!retry) {
          console.log("  Stopped. Run again with --scene " + scene.id + " to resume.");
          process.exit(1);
        }
        console.log("  Retrying…");
      }

      // Brief pause to avoid hitting rate limits on rapid regeneration
      if (!approved) await new Promise((r) => setTimeout(r, 1500));
    }

    // Pause between scenes
    if (scene.id < 4) await new Promise((r) => setTimeout(r, 2000));
  }
}

main().catch((err) => {
  console.error(`\nFatal: ${err.message}`);
  process.exit(1);
});
