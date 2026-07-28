# README Banner v1

Asset: `assets/readme-banner-v1.jpg` (1408x469, 3:1, 240 KB)

Tool/model: xAI Grok CLI, built-in `image_gen` tool, plus local compositing.

Part of a shared visual identity across the openfluids repositories —
`dynachaos`, `fftkit`, `openmodalpy` — all 3:1, all on a charcoal ground with a
warm off-white lowercase wordmark and cyan/teal structure with coral accents.

## Approach

The wordmark is **not** generated. Image models render short lowercase words
unpredictably, and accepting whatever letterforms come back is most of what
makes a generated banner look cheap. The artwork is generated deliberately
textless, and the type is set locally in Lato Light, sized to a fixed fraction
of the frame width so names of different lengths carry comparable optical
weight.

## Subject

A strange attractor: folded, stretched, layered sheets curling back on
themselves, with the folding visible as nested laminae of ever finer detail.
Stretching and folding is the mechanism that makes a bounded system chaotic, so
the image is the subject of the repository rather than decoration around it.

Deliberately *not* a bifurcation diagram — that motif belongs to the sibling
`dynachaos` banner, and reusing it would blur the two.

## Prompt (artwork only, no text)

```text
A stunning abstract scientific artwork, wide 2:1 landscape: a single magnificent
strange attractor of a chaotic dynamical system, rendered as an exquisitely fine
filamentary structure of millions of delicate luminous points tracing folded,
stretched and layered sheets that curl back on themselves. The folding is
visible as nested laminae of ever finer detail, the signature of stretching and
folding in chaos. The attractor is wide and horizontally elongated, sitting
entirely within the central horizontal band of the frame with generous empty
dark margins above and below it, and it occupies the right two thirds of the
width. Brilliant electric cyan and teal filaments, with the densest folds
flaring hot coral and warm amber. Deep near-black charcoal background with a
subtle gradient and a very faint fine grid, volumetric glow, atmospheric depth
of field, fine film grain, rich deep blacks and luminous highlights. Cinematic,
elegant, expensive, gallery-quality scientific data art. ABSOLUTELY NO TEXT [...]
Leave the left third dark, calm and completely empty as negative space.
```

The framing clause matters. `image_gen` rejects a 3:1 request and returns 2:1,
so the result is cropped afterwards. A first round composed subjects across the
full height and the crop decapitated them; telling the model to keep everything
inside the central band, with empty margins above and below, fixed it.

## Post-processing

- Returned 1408x704, centre-cropped to 1408x469 for the family's 3:1 aspect.
- Wordmark composited locally: Lato Light, auto-sized to 30% of frame width
  (78 px here), tracking 6% of point size, warm off-white `#F7F3EC`, with a wide
  blurred dark halo underneath for legibility over busy pixels.
- JPEG q95, no chroma subsampling. The image is a smooth gradient render with no
  flat colour fields, which is the case PNG handles worst and JPEG handles best.

## Rejected alternatives

- **Specimen row** — five distinct attractors side by side, the most literal
  reading of "atlas". Framing was right but the model ignored the empty-left
  instruction and the wordmark collided with the first specimen; one specimen
  also rendered as a literal butterfly rather than a Lorenz attractor.
- **Julia set filigree** — self-similar budding tendrils receding into
  magnification. Beautiful, but closer to generic fractal art.
- **Scattered specimen collection** — attractors spread over the full frame
  height; the 3:1 crop cut through them.
