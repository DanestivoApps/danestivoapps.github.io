#!/usr/bin/env bash
# Mux rendered frames + soundtrack into MP4.
# Usage: tools/encode.sh FRAMES_DIR FPS SOUNDTRACK.wav OUT.mp4 [CRF=16]
set -euo pipefail
frames="$1"; fps="$2"; audio="$3"; out="$4"; crf="${5:-16}"
ffmpeg -hide_banner -loglevel warning -stats -y \
  -framerate "$fps" -i "$frames/f%05d.jpg" -i "$audio" \
  -c:v libx264 -preset slow -tune animation -crf "$crf" -pix_fmt yuv420p \
  -x264-params "aq-mode=3" -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 256k -ar 48000 -af "loudnorm=I=-15:TP=-1.2:LRA=13" \
  -shortest -movflags +faststart "$out"
ls -la "$out"
