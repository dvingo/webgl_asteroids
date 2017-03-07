import twgl from 'twgl.js'
import chroma from 'chroma-js'
import parseModel from './parseJson'
const { m4, v3 } = twgl
window.twgl = twgl

const createEl = document.createElement.bind(document)
Node.prototype.on = function(){this.addEventListener.apply(this,arguments)}

const getJson = (endpoint, cb) => {
  const xhr = new XMLHttpRequest
  xhr.open('GET', endpoint)
  xhr.onreadystatechange = () => {
    console.log('in on ready');
    window.xhr = xhr
    if (xhr.readyState === 4 && xhr.status < 400)
      cb(JSON.parse(xhr.responseText))
  }
  xhr.send()
}

const loadModel = (file, cb) => {
  getJson(file, data => {
    const vertices = data.vertices
    cb(data)
  })
}

var wingX = .3
var wingY = -.75

var middleTop = [0, 0, 0]
var middleBottom = [0, -.4, 0]
var bottomRight = [wingX, wingY, 0]
var bottomLeft = [-wingX, wingY, 0]

var ship = [].concat(bottomRight, middleTop, middleBottom)
ship = ship.concat(middleTop, bottomLeft, middleBottom)

var squarePoints = [
  -1, -1, 0,
  1, -1, 0,
  -1, 1, 0,
  -1, 1, 0,
  1, -1, 0,
  1, 1, 0
]

var arrays = {
  position: ship
}

var createCanvas = (width, height) => {
  const canvas = createEl('canvas')
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  // canvas.style.outline = '1px solid'
  canvas.style.boxShadow = '1px 1px 4px hsla(0, 0%, 0%, 0.8)'
  return document.body.appendChild(canvas)
}

const uniforms = {
  u_viewProjection: m4.identity(),
  u_model: m4.identity()
}

var throttle = (fn, timeMs) => {
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

const log = throttle((...args) => console.log.apply(console, args), 1000)

function main(data) {
  var faceData = parseModel.parseJson(data)
  var indices = parseModel.getIndicesFromFaces(faceData)
  const arrays = {
    position: {numComponents: 3, data: data.vertices},
    indices: {numComponents: 3, data: indices}
  }
  const canvas = createCanvas(500, 300)
  var gl = canvas.getContext('webgl')
  var programInfo = twgl.createProgramInfo(gl, ['vs', 'fs'])
  window.bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)

  var camera = m4.identity();
  var view = m4.identity();
  var viewProjection = m4.identity();
  var eye = [0, 400, 1]
  var target = [0, 0, 0]
  var up = [0, 1, 0]
  var modelM = m4.identity()
  var ship = {
    velocity: [0, 0, 0],
    moveM: m4.translation(vec3.create(1, 0, 0))
  }

  const keyToName = {
    37: 'left',
    39: 'right',
    40: 'down',
    38: 'up',
    32: 'space'
  }

  const validKeys = Object.keys(keyToName).map(Number)
  window.uniforms = uniforms
  window.m4 = m4
  window.addEventListener('keydown', throttle(({keyCode}) => {
    if (validKeys.indexOf(keyCode) < 0) { return }
    console.log('got keydown: ', keyToName[keyCode])
    const keyName = keyToName[keyCode]
    if (keyName === 'up') {
      ship.velocity[0] = 1
    }
    if (keyName === 'down') {
      ship.velocity[0] = 0
    }
  }, 30))

  var shipPoint = [arrays.position.data[0], arrays.position.data[1], arrays.position.data[2]]
  var shipLoc = [], shipViewLoc = []
  var viewProjectInverse = m4.identity()

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
  var projection = m4.perspective(30 * Math.PI/180, aspect, .5, 400)
  camera = m4.lookAt(eye, target, up)
  view = m4.inverse(camera)
  uniforms.u_viewProjection = m4.multiply(projection, view)

  var clipSpaceCoord = m4.transformPoint(uniforms.u_viewProjection, shipPoint)
  var shipStartX = Math.round(((clipSpaceCoord[0] + 1 ) / 2.0) * gl.canvas.clientWidth)

  function render(time) {
    twgl.resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
    var projection = m4.perspective(30 * Math.PI/180, aspect, .5, 400)

    camera = m4.lookAt(eye, target, up)
    view = m4.inverse(camera)
    uniforms.u_viewProjection = m4.multiply(projection, view)

    m4.translate(uniforms.u_model, ship.velocity, uniforms.u_model)
    m4.transformPoint(uniforms.u_model, shipPoint, shipLoc)
    m4.transformPoint(uniforms.u_viewProjection, shipLoc, shipViewLoc)
    if (shipViewLoc[0] < -1) {
      console.log('ship is off left: ', shipLoc);
    }
  if (shipViewLoc[0] > 1) {
    console.log('ship is off right: ', shipLoc);

    // var halfW = (gl.canvas.clientWidth/2)
    // m4.inverse(uniforms.u_viewProjection, viewProjectInverse)
    // var tr = m4.transformPoint(viewProjectInverse, [halfW, 0, 0])
    var tr = m4.getTranslation(uniforms.u_model)

    m4.setTranslation(uniforms.u_model, [-tr[0], 0, 0], uniforms.u_model)
  }

    gl.useProgram(programInfo.program)
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo)
    twgl.setUniforms(programInfo, uniforms)

    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawElements(gl.TRIANGLES, bufferInfo.numElements, gl.UNSIGNED_SHORT, 0)
    // twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLES)

    requestAnimationFrame(render)
  }
  requestAnimationFrame(render)
}

loadModel('models/ship.json', (data) => {
  main(data)
})
