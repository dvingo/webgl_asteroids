A simple clone of the classic asteroids game in JavaScript with the rendering
 in WebGL.

The game is hosted here:

http://dvingo.github.io/2017/04/03/asteroids.html

# Dev setup

```bash
yarn
yarn start
```

# Prod build:

```bash
yarn build:prod
```

The prod bundle will be in `dist/`

# Notes on exporting models from blender:

Export obj from blender:

Position the in object in blender such that when viewed in the Top Ortho view
the object's forward position is looking down the X axis and its
left side is oriented with the positive Y axis.

Then when exporting as obj select the following:

Forward: -Y Forward
Up: -Z Up

A plane model is used from:

https://www.turbosquid.com/3d-models/free-spowith-f1-camel-3d-model/516387

The Three.js Obj to JSON parser is also used to help import the 3d models into
the game.
https://github.com/mrdoob/three.js/blob/dev/utils/converters/obj/convert_obj_three.py
