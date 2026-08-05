# Media — how each image was produced

Neither image is a screenshot of a third-party product. Both are renders of this
repository's own committed files, and say so on the image itself.

| File | Produced from | How |
|---|---|---|
| `n8n-workflow-canvas.svg` / `.png` | `../n8n-workflow.json` | A script reads the workflow file and draws each node at its `position` with its real `name`/`type`, and each connection along the file's own wiring. The dashed edges are the if-node's false branch and the loop's done branch. It is **not** an n8n screenshot — no n8n instance was available — and the caption on the image says exactly that. |
| `before-after-card.png` | `../output/run-report.json` | A script reads the committed run report and lays out the `huila-reserve` entry: the empty "before" state (which is what the source catalog actually contains), the generated copy with its measured lengths, and the `usedFactIds` list verbatim. The header names the generator (`offline-template-v1`), the run date and the style-guide version from the same file. |

No copy in either image was written by hand for the image; if the pipeline's
outputs change, re-running the scripts changes the images.
