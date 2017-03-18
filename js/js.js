import twgl from 'twgl.js'
import chroma from 'chroma-js'
import parseModel from './parseJson'
const { m4, v3 } = twgl
const canvasSize = {
  w: 600, h: 400
}
window.twgl = twgl
window.m4 = m4, window.v3=v3

const createEl = document.createElement.bind(document)
Node.prototype.on = function(){this.addEventListener.apply(this,arguments)}

const gameState = {
  thrust: .01,
  maxAcc: .03,
  maxVelocity: 10,
  rotateBy: Math.PI/40,
  keys: {
    ctrlPressed: false,
    leftPressed: false,
    rightPressed: false,
    upPressed: false,
    downPressed: false,
    spacePressed: false
  }
}

var gameTypes = objFromStrs('ship')
/**
 * Game object.
 */
function GObject() {
  this.position = v3.create(0,0,0)
  this.scale = v3.create(1, 1, 1)
  this.velocity = v3.create(0, 0, 0)
  this.acceleration = v3.create(0, 0, 0)
  this.rotateY = 0
  this.rotateX= 0
  this.rotateZ= 0
  this.width = 0
  this.type = ''
}

var ship = new GObject()
ship.position = v3.create(canvasSize.w / 2, canvasSize.h / 2, 0)
// ship.scale = v3.create(2,2,2)
ship.scale = v3.create(.2,.2,.2)
ship.rotateX= Math.PI/2
ship.rotateY= Math.PI/2
ship.type = gameTypes.ship
ship.width = 15
window.ship = ship

const getJson = (endpoint, cb) => {
  const xhr = new XMLHttpRequest
  xhr.open('GET', endpoint)
  xhr.onreadystatechange = () => {
    console.log('in on ready change');
    window.xhr = xhr
    if (xhr.readyState === 4 && xhr.status < 400)
      cb(JSON.parse(xhr.responseText))
  }
  xhr.send()
}

const loadModel = (file, cb) => {
  getJson(file, data => cb(data))
}
function isAccelerating(gameState) {
  return gameState.keys.upPressed ||
         gameState.keys.downPressed
}

function updateShip(gl, ship) {
  if (gameState.keys.upPressed) {
    console.log('UP pressed');
    ship.acceleration[0] += Math.cos(ship.rotateZ) * gameState.thrust
    ship.acceleration[1] += Math.sin(ship.rotateZ) * gameState.thrust
    if (ship.acceleration[0] > gameState.maxAcc) ship.acceleration[0] = gameState.maxAcc
    if (ship.acceleration[1] > gameState.maxAcc) ship.acceleration[1] = gameState.maxAcc
  }

  if (gameState.keys.downPressed) {
    console.log('DOWN pressed');
    ship.acceleration[0] -= Math.cos(ship.rotateZ) * gameState.thrust
    ship.acceleration[1] -= Math.sin(ship.rotateZ) * gameState.thrust
    if (ship.acceleration[0] < -gameState.maxAcc) ship.acceleration[0] = -gameState.maxAcc
    if (ship.acceleration[1] < -gameState.maxAcc) ship.acceleration[1] = -gameState.maxAcc
  }
  if (gameState.keys.leftPressed) {
    ship.rotateZ += gameState.rotateBy
    setV3Angle(ship.acceleration, ship.rotateZ)
  }
  if (gameState.keys.rightPressed) {
    ship.rotateZ -= gameState.rotateBy
    setV3Angle(ship.acceleration, ship.rotateZ)
  }
  if (isAccelerating(gameState)) {
    v3.add(ship.velocity, ship.acceleration, ship.velocity)
  } else {
    setV3Angle(ship.acceleration, ship.rotateZ)
  }
  if (ship.velocity[0] > gameState.maxVelocity) ship.velocity[0] = gameState.maxVelocity
  if (ship.velocity[1] > gameState.maxVelocity) ship.velocity[1] = gameState.maxVelocity
  if (ship.velocity[0] < -gameState.maxVelocity) ship.velocity[0] = -gameState.maxVelocity
  if (ship.velocity[1] < -gameState.maxVelocity) ship.velocity[1] = -gameState.maxVelocity
  v3.add(ship.position, ship.velocity, ship.position)
  // Wrap the ship around the screen.
  if (ship.position[0] + ship.width < 0) {
    ship.position[0] = gl.canvas.clientWidth + ship.width
  }
  if (ship.position[0] > gl.canvas.clientWidth + ship.width) {
    ship.position[0] = 0
  }
  if (ship.position[1] + ship.width < 0) {
    ship.position[1] = gl.canvas.clientHeight + ship.width
  }
  if (ship.position[1] > gl.canvas.clientHeight + ship.width) {
    ship.position[1] = 0
  }

  var xform = m4.identity()
  m4.translate(xform, ship.position, xform)
  m4.rotateX(xform, ship.rotateX, xform)
  m4.rotateY(xform, ship.rotateY, xform)
  m4.rotateZ(xform, ship.rotateZ, xform)
  m4.scale(xform, ship.scale, xform)
  return xform
}

function objFromStrs() {
  for (var i=0,r={},len=arguments.length;i<len;i++)
  r[arguments[i]] = arguments[i]; return r
}

function updateNoop(){return m4.identity()}

var objTypeToUpdateFn = { }
objTypeToUpdateFn[gameTypes.ship] = updateShip
window.objTypeToUpdateFn = objTypeToUpdateFn

function update(gl, gObject, t) {
  return (objTypeToUpdateFn[gObject.type] || updateNoop)(gl, gObject, t)
}

var createCanvas = (width, height) => {
  const canvas = createEl('canvas')
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
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

const setV3Angle = (v, a) => {
  const len = v3.length(v)
  v[0] = Math.cos(a) * len
  v[1] = Math.sin(a) * len
}

const log = throttle((...args) => console.log.apply(console, args), 1000)

function main(data) {
  var faceData = parseModel.parseJson(data)
  var indices = parseModel.getIndicesFromFaces(faceData)
  const arrays = {
    position: {numComponents: 3, data: data.vertices},
    indices: {numComponents: 3, data: indices}
  }
  const canvas = createCanvas(canvasSize.w, canvasSize.h)
  var gl = canvas.getContext('webgl')
  var programInfo = twgl.createProgramInfo(gl, ['vs', 'fs'])
  window.bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)

  const keyNames = {
    left: 37,
    right: 39,
    down: 40,
    up: 38,
    space: 32,
    ctrl: 17
  }

  const keyToName = {
    37: 'left',
    39: 'right',
    40: 'down',
    38: 'up',
    32: 'space',
    17: 'ctrl'
  }

  const validKeys = Object.keys(keyToName).map(Number)
  window.uniforms = uniforms
  window.m4 = m4

  window.addEventListener('keyup', (e) => {
    // e.preventDefault()
    var keyCode = e.keyCode
    console.log('keuyp', keyCode);
    if (keyCode == keyNames.up) gameState.keys.upPressed = false
    if (keyCode == keyNames.down) gameState.keys.downPressed = false
    if (keyCode == keyNames.left) gameState.keys.leftPressed = false
    if (keyCode == keyNames.right) gameState.keys.rightPressed = false
    if (keyCode == keyNames.space) gameState.keys.spacePressed = false
    if (keyCode == keyNames.ctrl) gameState.keys.ctrlPressed = false
  })

  window.addEventListener('keydown', (e) => {
    // e.preventDefault()
    var keyCode = e.keyCode
    console.log('got keydown: ', keyCode)
    if (validKeys.indexOf(keyCode) < 0) { return }
    if (keyCode == keyNames.up) gameState.keys.upPressed = true
    if (keyCode == keyNames.down) gameState.keys.downPressed = true
    if (keyCode == keyNames.left) gameState.keys.leftPressed = true
    if (keyCode === keyNames.right) gameState.keys.rightPressed = true
  })

  /**
   * Camera setup.
   */
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
  var eye = [0, 0, .1], target = [0, 0, 0], up = [0, 1, 0]
  var left = 0, right = gl.canvas.clientWidth, bottom = gl.canvas.clientHeight,
      top = 0, near = -40, far = 40

  /**
   * Draw.
   */
  function render(time) {
    twgl.resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
    var left = 0, right = gl.canvas.clientWidth, bottom = gl.canvas.clientHeight,
        top = 0, near = -10, far = 10
    var projection = m4.ortho(left, right, top, bottom, near, far)
    var view = m4.identity()
    uniforms.u_viewProjection = m4.multiply(projection, view)
    uniforms.u_model = update(gl, ship)

    gl.useProgram(programInfo.program)
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo)
    twgl.setUniforms(programInfo, uniforms)

    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawElements(gl.TRIANGLES, bufferInfo.numElements, gl.UNSIGNED_SHORT, 0)
    requestAnimationFrame(render)
  }
  requestAnimationFrame(render)
}

loadModel('models/plane.json', (data) => {
// loadModel('models/shipRotatedYUp.json', (data) => {
  main(data)
})
