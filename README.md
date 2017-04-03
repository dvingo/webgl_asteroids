```bash
yarn
npm start
```
# Prod build:

```bash
./node_modules/.bin/webpack -p
```
The prod bundle will be in `dist/`

Notes on exporting models from blender:

Export obj from blender:

Position the in object in blender such that when viewed in the Top Ortho view
the object's forward position is looking down the position X axis and its
left side is oriented with the positive Y axis.

Then when exporting as obj select the following:

Forward: -Y Forward
Up: -Z Up
