import parseModel from './parseJson'
export const createEl = document.createElement.bind(document)
export const sel = document.querySelector.bind(document)
export const byId = document.getElementById.bind(document)

export function makePool(constructor, count) {
  var pool = []
  var freeList = range(count)
  var growAmount = 20
  for (var z=0; z < count; z++) pool.push(constructor())
  return {
    get: function() {
      var i = freeList[0]
      freeList.splice(0, 1)
      if (!freeList.length) {
        freeList = freeList.concat(range(pool.length, pool.length + growAmount))
        for (var k=0; k < growAmount; k++) pool.push(constructor())
      }
      return pool[i]
    },
    free: function(obj) {
      freeList.push(findIndex(o => o === obj, pool))
    }
  }
}

export var getTime = () => new Date().getTime()

export function range(n, m, s) {
  var r = []
  var start = m ? n : 0
  m = m || n
  s = s || 1
  for (var i = start; i < m; i += s) r.push(i)
  return r
}

export function findIndex(f, arr) {
  for (var i = 0, len = arr.length; i < len; i++) {
    if (f(arr[i])) return i
  }
  return -1
}

export function awaitAll() {
  var cbs = arguments
  var r = Array(cbs.length), count = cbs.length-1
  function cb(i, d) {
    r.splice(i, 1, d)
    count--
    if(!count) cbs[cbs.length-1](r)
  }
  for (var i =0,len=cbs.length-1;i<len;i++) cbs[i](partial(cb, i))
}

export function partial(fn) {
  return fn.bind.apply(fn, [null].concat(Array.prototype.slice.call(arguments, 1)))
}

export var throttle = (fn, timeMs) => {
  let wasCalled = false
  return function() {
    let args = arguments
    if (!wasCalled) {
      wasCalled = true
      setTimeout(function() {
        wasCalled = false
        fn.apply(null, args)
      }, timeMs)
    }
  }
}

export const log = throttle((...args) => console.log.apply(console, args), 1000)

export function rand(n, m) {
  n = n || 1
  m = m || 0
  var x1 = Math.min(n,m)
  var x2 = Math.max(n,m)
  return x1 + Math.random() * (x2-x1)
}

export function randI(n, m) { return Math.floor(rand(n, m)) }

export function objFromStrs() {
  for (var i=0,r={},len=arguments.length;i<len;i++)
  r[arguments[i]] = arguments[i]; return r
}

export var createCanvas = (width, height) => {
  const canvas = createEl('canvas')
/*   canvas.style.width = width + 'px'
  canvas.style.height = height + 'px' */
  return canvas
}

export const keyNames = {
  left: 37,
  right: 39,
  down: 40,
  up: 38,
  space: 32,
  ctrl: 17,
  w: 87,
  a: 65,
  s: 83,
  d: 68
}

export const validKeys = Object.keys(keyNames).map(i => keyNames[i])

export const getJson = (endpoint, cb) => {
  const xhr = new XMLHttpRequest
  xhr.open('GET', endpoint)
  xhr.onreadystatechange = () => {
    console.log('in on ready change, ', xhr.readyState, ' ', xhr.status);
    if (xhr.readyState === 4 && xhr.status < 400)
      cb(JSON.parse(xhr.responseText))
  }
  xhr.send()
}
export function lerp(t, n, m) { return n + t*(m-n) }
export function norm(val, min, max) {
  return (val - min) / (max - min)
}
export const across = (val, x1, x2, y1, y2) =>
  lerp(norm(val, x1, x2), y1, y2)


function augmentTypedArray(typedArray, numComponents) {
  var cursor = 0;
  typedArray.push = function() {
    for (var ii = 0; ii < arguments.length; ++ii) {
      var value = arguments[ii];
      if (value instanceof Array || (value.buffer && value.buffer instanceof ArrayBuffer)) {
        for (var jj = 0; jj < value.length; ++jj) {
          typedArray[cursor++] = value[jj];
        }
      } else {
        typedArray[cursor++] = value;
      }
    }
  };
  typedArray.reset = function(opt_index) {
    cursor = opt_index || 0;
  };
  typedArray.numComponents = numComponents;
  Object.defineProperty(typedArray, 'numElements', {
    get: function() {
      return this.length / this.numComponents | 0;
    },
  });
  return typedArray;
}

function createTypedArray(numComponents, numElements, optionalType) {
  var Type = optionalType || Float32Array
  return augmentTypedArray(new Type(numComponents * numElements), numComponents);
}

// Example vertices for a 5 wide cube, grouped into six faces.
var fiveCube = [
  5,  5, -5,
  5,  5, 5,
  5, -5, 5,
 5,-5,-5,

 -5,5,5,
 -5,5,-5,
 -5,-5,-5,
 -5,-5,5,

 -5,5,5,
 5,5,5,
 5,5,-5,
 -5,5,-5,

 -5,-5,-5,
 5,-5,-5,
 5,-5,5,
 -5,-5,5,

 5,5,5,
 -5,5,5,
 -5,-5,5,
 5,-5,5,

 -5,5,-5,
 5,5,-5,
 5,-5,-5,
 -5,-5,-5
]

export function createRectanglurPrizm(gl, width, height) {
  var z = 1
  const numFaces = 6
  const numVerticesPerFace = 4
  const x = width / 2
  const y = height / 2

  var cubeFaceIndices = [
    [3, 7, 5, 1], // right
    [6, 2, 0, 4], // left
    [6, 7, 3, 2], // top
    [0, 1, 5, 4], // bottom
    [7, 6, 4, 5], // front
    [2, 3, 1, 0], // back
  ]
  var cornerVertices = [
    [-x, -y, -z], // 0, frontBottomLeft
    [ x, -y, -z], // 1, frontBottomRight
    [-x,  y, -z], // 2, frontTopLeft
    [ x,  y, -z], // 3, frontTopRight
    [-x, -y,  z], // 4, backBottomLeft
    [ x, -y,  z], // 5, backBottomRight
    [-x,  y,  z], // 6, backTopLeft
    [ x,  y,  z]  // 7, backTopRight
  ]
  var numVertices = numFaces * numVerticesPerFace
  var positions = createTypedArray(3, numVertices)
  var indices = createTypedArray(3, numFaces * 2, Uint16Array)

  for (var f = 0; f < numFaces; f++) {
    var faceIndices = cubeFaceIndices[f]
    for (var v = 0; v < numVerticesPerFace; v++) {
      var position = cornerVertices[faceIndices[v]]
      positions.push(position)
    }
    // Two triangles make a face.
    var offset = 4 * f
    indices.push(offset, offset + 1, offset + 2)
    indices.push(offset, offset + 2, offset + 3)
  }
  var bi = twgl.createBufferInfoFromArrays(gl, {
    position: positions,
    indices: indices
  })
  return bi
}

export const pV3 = v => v[0] + ', ' + v[1] + ', ' + v[2]
export const setV3 = (v, x,y,z) => (v[0]=x,v[1]=y,v[2]=z)

export const getV3Angle = v => Math.atan2(v[1], v[0])
export const copyV3Angle = (v1, v2) => setV3Angle(v1, getV3Angle(v2))
export const setV3Length = (v, length) => {
  var angle = getV3Angle(v)
  v[0] = Math.cos(angle) * length
  v[1] = Math.sin(angle) * length
}

export const setV3Angle = (v, a) => {
  const len = v3.length(v)
  v[0] = Math.cos(a) * len
  v[1] = Math.sin(a) * len
}

export const wrapBounds = (gObj, canvas, globalScaleFactor) => {
  var w = gObj.width * globalScaleFactor
  var h = gObj.height * globalScaleFactor
  if (gObj.position[0] + w < 0)
    gObj.position[0] = canvas.clientWidth + w/2

  if (gObj.position[0] > canvas.clientWidth + w)
    gObj.position[0] = -w/2

  if (gObj.position[1] + h < 0)
    gObj.position[1] = canvas.clientHeight + h/2

  if (gObj.position[1] > canvas.clientHeight + h)
    gObj.position[1] = -h/2
}

/**
 * Compute bounding box of vertex array.
 */
export function bbox(vertices) {
  var maxX, maxY, maxZ, minX, minY, minZ
  minX = maxX = vertices[0]
  minY = maxY = vertices[1]
  minZ = maxZ = vertices[2]

  for (var i = 3, len=vertices.length; i < len - 3;i+=3) {
    var x = vertices[i], y = vertices[i+1], z = vertices[i+2]

    if (x < minX) minX = x
    else if (x > maxX) maxX = x

    if (y < minY) minY = y
    else if (y > maxY) maxY = y

    if (z < minZ) minZ = z
    else if (z > maxZ) maxZ = z
  }

  return {
    x: {min: minX, max: maxX},
    y: {min: minY, max: maxY},
    z: {min: minZ, max: maxZ}
  }
}

export function setupBbox(gobj, vertices) {
  var box = bbox(vertices)
  gobj.width = (box.x.max - box.x.min) * gobj.scale
  gobj.height = (box.y.max - box.y.min) * gobj.scale
  gobj.bbox = {
    startBox: box,
    oTopLeft: v3.create(box.x.min, box.y.max, box.z.min),
    oTopRight: v3.create(box.x.max, box.y.max, box.z.min),
    oBottomRight: v3.create(box.x.max, box.y.min, box.z.min),
    oBottomLeft: v3.create(box.x.min, box.y.min, box.z.min),
    topLeft: v3.create(box.x.min, box.y.max, box.z.min),
    topRight: v3.create(box.x.max, box.y.max, box.z.min),
    bottomRight: v3.create(box.x.max, box.y.min, box.z.min),
    bottomLeft: v3.create(box.x.min, box.y.min, box.z.min),
    min: v3.create(box.x.min, box.y.min, box.z.min),
    max: v3.create(box.x.max, box.y.max, box.z.max)
  }
  updateBbox(gobj)
}

export function updateBbox(go) {
  var b = go.bbox
  var box = go.bbox.startBox
  go.width = (box.x.max - box.x.min) * go.scale
  go.height = (box.y.max - box.y.min) * go.scale
  m4.transformPoint(go.matrix, b.oTopLeft, b.topLeft)
  m4.transformPoint(go.matrix, b.oTopRight, b.topRight)
  m4.transformPoint(go.matrix, b.oBottomRight, b.bottomRight)
  m4.transformPoint(go.matrix, b.oBottomLeft, b.bottomLeft)
  var newMinX = Math.min(b.topLeft[0], b.topRight[0], b.bottomRight[0], b.bottomLeft[0])
  var newMaxX = Math.max(b.topLeft[0], b.topRight[0], b.bottomRight[0], b.bottomLeft[0])
  var newMinY = Math.min(b.topLeft[1], b.topRight[1], b.bottomRight[1], b.bottomLeft[1])
  var newMaxY = Math.max(b.topLeft[1], b.topRight[1], b.bottomRight[1], b.bottomLeft[1])
  setV3(b.topLeft, newMinX, newMaxY, 1)
  setV3(b.topRight, newMaxX, newMaxY, 1)
  setV3(b.bottomRight, newMaxX, newMinY, 1)
  setV3(b.bottomLeft, newMinX, newMinY, 1)
  setV3(b.min, newMinX, newMinY, 1)
  setV3(b.max, newMaxX, newMaxY, 1)
}

export function setupModelBuffer(gl, data) {
  var faceData = parseModel.parseJson(data)
  var indices = parseModel.getIndicesFromFaces(faceData)
  var arrays = {
    position: {numComponents: 3, data: data.vertices},
    indices: {numComponents: 3, data: indices}
  }
  return twgl.createBufferInfoFromArrays(gl, arrays)
}

/**
 * @param {GObject} obj1
 * @param {GObject} obj2
 */
export function intersects(obj1, obj2) {
  return (
    (obj1.bbox.min[0] <= obj2.bbox.max[0] && obj1.bbox.max[0] >= obj2.bbox.min[0])
    &&
    (obj1.bbox.min[1] <= obj2.bbox.max[1] && obj1.bbox.max[1] >= obj2.bbox.min[1])
  )
}

/**
 * Game object.
 */
export function GObject() {
  this.position = v3.create(0,0,0)
  this.scale = 1
  this.scaleV3 = v3.create(1, 1, 1)
  this.velocity = v3.create(0, 0, 0)
  this.acceleration = v3.create(0, 0, 0)
  this.rotateY = 0
  this.rotateX= 0
  this.rotateZ= 0
  this.matrix = m4.identity()
  this.width = 0
  this.height = 0
  this.type = ''
  this.bufferInfo = null
  this.color = v3.create(.8, .8, .8)
  this.createdTime = getTime()
  this.shouldRemove = false
}

export function makeRect(gl, w, h) {
  var g = new GObject
  g.bufferInfo = createRectanglurPrizm(gl, w, h)
  return g
}

export function updateGObjectMatrix(gobj) {
  var m = gobj.matrix
  m4.identity(m)
  m4.translate(m, gobj.position, m)
  m4.rotateX(m, gobj.rotateX, m)
  m4.rotateY(m, gobj.rotateY, m)
  m4.rotateZ(m, gobj.rotateZ, m)
  m4.scale(m, gobj.scaleV3, m)
}
