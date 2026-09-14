#!/usr/bin/env bash
# Render media/thumbnail.html to media/upwork-thumbnail.png at 1200x900.
#
# Chrome rasterises at 2x and ffmpeg downsamples, which is what keeps the type
# crisp — a 1x screenshot of this layout goes soft the moment Upwork scales it.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

"$chrome" \
  --headless \
  --disable-gpu \
  --hide-scrollbars \
  --allow-file-access-from-files \
  --force-device-scale-factor=2 \
  --window-size=1200,900 \
  --screenshot="$here/.thumb-2x.png" \
  "file://$here/thumbnail.html" >/dev/null 2>&1

ffmpeg -y -i "$here/.thumb-2x.png" -vf "scale=1200:900:flags=lanczos" \
  "$here/upwork-thumbnail.png" >/dev/null 2>&1

rm -f "$here/.thumb-2x.png"
echo "wrote $here/upwork-thumbnail.png"
