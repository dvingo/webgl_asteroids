const createEl = document.createElement.bind(document)

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
  var r = [], count = cbs.length-1
  function cb(i, d) {
    r.splice(i, 0, d)
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
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  canvas.style.boxShadow = '1px 1px 4px hsla(0, 0%, 0%, 0.8)'
  return document.body.appendChild(canvas)
}

export const keyNames = {
  left: 37,
  right: 39,
  down: 40,
  up: 38,
  space: 32,
  ctrl: 17
}

export const validKeys = Object.keys(keyNames).map(i => keyNames[i])

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
