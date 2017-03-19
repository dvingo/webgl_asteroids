import twgl from 'twgl.js'
import chroma from 'chroma-js'
import parseModel from './parseJson'
const { m4, v3 } = twgl
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
  },
  canvasSize: {w: 600, h: 400},
  objects: [],
  getShip: function(){return this.objects[0]},
  bulletSpeed: 4,
  bulletSize: 6
}
window.gameState = gameState

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
  this.bufferInfo = null
}

const getV3Angle = (v) => Math.atan2(v[1], v[0])
const setV3Length = (v, length) => {
  var angle = getV3Angle(v)
  v[0] = Math.cos(angle) * length
  v[1] = Math.sin(angle) * length
}

const setV3Angle = (v, a) => {
  const len = v3.length(v)
  v[0] = Math.cos(a) * len
  v[1] = Math.sin(a) * len
}

function makeBullet(gl, ship) {
  var bullet = new GObject
  bullet.velocity = v3.create()
  setV3Length(bullet.velocity, v3.length(ship.velocity) + gameState.bulletSpeed)
  setV3Angle(bullet.velocity, ship.rotateZ)
  bullet.bufferInfo = twgl.primitives.createCubeBufferInfo(gl, gameState.bulletSize)
  bullet.position = v3.copy(ship.position)
  return bullet
}

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

const getJson = (endpoint, cb) => {
  const xhr = new XMLHttpRequest
  xhr.open('GET', endpoint)
  xhr.onreadystatechange = () => {
    console.log('in on ready change, ', xhr.readyState, ' ', xhr.status);
    window.xhr = xhr
    if (xhr.readyState === 4 && xhr.status < 400)
      cb(JSON.parse(xhr.responseText))
  }
  xhr.send()
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

function defaultUpdate(gl, gObj, t) {
  v3.add(gObj.position, gObj.velocity, gObj.position)
  var xform = m4.identity()
  m4.translate(xform, gObj.position, xform)
  m4.rotateX(xform, gObj.rotateX, xform)
  m4.rotateY(xform, gObj.rotateY, xform)
  m4.rotateZ(xform, gObj.rotateZ, xform)
  m4.scale(xform, gObj.scale, xform)
  return xform
}

function updateNoop(){return m4.identity()}

var objTypeToUpdateFn = { }
objTypeToUpdateFn[gameTypes.ship] = updateShip
window.objTypeToUpdateFn = objTypeToUpdateFn

function update(gl, gObject, t) {
  return (objTypeToUpdateFn[gObject.type] || defaultUpdate)(gl, gObject, t)
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

const log = throttle((...args) => console.log.apply(console, args), 1000)

function main(data) {
  var faceData = parseModel.parseJson(data)
  var indices = parseModel.getIndicesFromFaces(faceData)
  const arrays = {
    position: {numComponents: 3, data: data.vertices},
    indices: {numComponents: 3, data: indices}
  }
  const canvas = createCanvas(gameState.canvasSize.w, gameState.canvasSize.h)
  var gl = canvas.getContext('webgl')
  gameState.gl = gl
  var programInfo = twgl.createProgramInfo(gl, ['vs', 'fs'])

  var ship = new GObject()
  ship.position = v3.create(gameState.canvasSize.w / 2, gameState.canvasSize.h / 2, 0)
  ship.scale = v3.create(2,2,2)
  // ship.rotateX= Math.PI/2
  // ship.rotateY= Math.PI/2
  ship.type = gameTypes.ship
  ship.width = 15
  ship.bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)
  window.ship = ship
  gameState.objects.push(ship)

  window.addEventListener('keyup', ({keyCode}) => {
    console.log('keyup', keyCode);
    if (keyCode == keyNames.up) gameState.keys.upPressed = false
    if (keyCode == keyNames.down) gameState.keys.downPressed = false
    if (keyCode == keyNames.left) gameState.keys.leftPressed = false
    if (keyCode == keyNames.right) gameState.keys.rightPressed = false
    if (keyCode == keyNames.space) gameState.keys.spacePressed = false
    if (keyCode == keyNames.ctrl) gameState.keys.ctrlPressed = false
  })

  const throttledMakeBullet = throttle(function() {
    gameState.objects.push(makeBullet(gameState.gl, gameState.getShip()))
  }, 100)

  window.addEventListener('keydown', ({keyCode}) => {
    console.log('keydown: ', keyCode)
    if (validKeys.indexOf(keyCode) < 0) { return }
    if (keyCode == keyNames.up) gameState.keys.upPressed = true
    if (keyCode == keyNames.down) gameState.keys.downPressed = true
    if (keyCode == keyNames.left) gameState.keys.leftPressed = true
    if (keyCode == keyNames.right) gameState.keys.rightPressed = true
    if (keyCode == keyNames.space) throttledMakeBullet()
  })

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
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    var gameObject
    for (var i = 0, len = gameState.objects.length; i < len; i++) {
      gameObject = gameState.objects[i]
      uniforms.u_model = update(gl, gameObject)
      gl.useProgram(programInfo.program)
      twgl.setBuffersAndAttributes(gl, programInfo, gameObject.bufferInfo)
      twgl.setUniforms(programInfo, uniforms)
      gl.drawElements(gl.TRIANGLES, gameObject.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0)
    }
    requestAnimationFrame(render)
  }
  requestAnimationFrame(render)
}

// getJson('models/plane.json', main)
getJson('models/shipRotatedYUp.json', main)
