# 秋風のシグナル — Akikaze no Signal

Un minuto de prueba de anime romántico. Se reproduce en tiempo real en el navegador
(`index.html`) y también se exporta, fotograma a fotograma, a vídeo MP4.

## Cómo está hecho

- **Personajes y escuela**: las dos ilustraciones de referencia se recortan
  (diferencia entre ambas + GrabCut), se reescalan ×4 con Real-ESRGAN (modelo anime)
  y se animan en 2.5D: un shader WebGL desplaza solo el pelo y la ropa según un mapa
  de pesos (viento), y encima se superponen parpadeos, boca, rubor, respiración y
  cámara con paralaje.
- **Escenarios procedurales** (cielos, paso a nivel, tren, paseo, sombras, título):
  Canvas 2D; los cielos con nubes cumulus se "hornean" con `tools/bake_skies.py`.
- **Composición ("satsuei")**: hojas de otoño, polvo en suspensión, rayos de luz,
  destellos de lente, bloom, viñeta, grano.
- **Música**: balada compuesta en `tools/compose.py` (MIDI → FluidSynth con el
  soundfont GeneralUser GS) más efectos sintetizados (viento, campana del paso a
  nivel, tren, latido).

## Reconstruir

```sh
python3 tools/bake_skies.py OUT                       # cielos
python3 tools/prep_art.py WORK assets/art             # capas de las ilustraciones
python3 tools/compose.py GeneralUser-GS.sf2 WORK out.wav
python3 -m http.server 8765                            # desde la raíz del repo
node tools/render.mjs FRAMES 60 4                      # fotogramas
tools/encode.sh FRAMES 60 out.wav video.mp4            # vídeo
```

## Créditos

- Diseño de personajes y escena de la puerta del instituto: ilustraciones aportadas
  por el autor del proyecto.
- Soundfont: GeneralUser GS (S. Christian Collins). Fuentes: Shippori Mincho B1,
  Zen Maru Gothic y Cormorant Garamond (SIL Open Font License), subconjuntos de
  Google Fonts.
