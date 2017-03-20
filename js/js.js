import twgl from 'twgl.js'
import chroma from 'chroma-js'
import parseModel from './parseJson'
import {
  awaitAll, bbox, partial, throttle, rand, randInt, objFromStrs,
  createCanvas, validKeys, keyNames, getJson
} from './util'
const { m4, v3 } = twgl
window.twgl = twgl
window.m4 = m4, window.v3=v3

EventTarget.prototype.on = function(){this.addEventListener.apply(this,arguments)}

const gameState = {
  thrust: .01,
  maxAcc: .03,
  maxVelocity: 10,
  rotateBy: Math.PI/80,
  numAsteroids: 10,
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
  bulletSize: 2,
  projection: m4.identity(),
  view: m4.identity()
}
window.gameState = gameState

var gameTypes = objFromStrs('ship', 'asteroid')
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
  this.matrix = m4.identity()
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

function makeBullet(gl, ship, bulletData) {
  var bullet = new GObject
  setV3Length(bullet.velocity, v3.length(ship.velocity) + gameState.bulletSpeed)
  setV3Angle(bullet.velocity, ship.rotateZ)
  bullet.bufferInfo = bulletData.bufferInfo
  bullet.bbox = bulletData.bbox
  bullet.position = v3.copy(ship.position)
  return bullet
}

const throttledMakeBullet = throttle(function() {
  gameState.objects.push(makeBullet(gameState.gl, gameState.getShip(), gameState.bulletData))
}, 100)

function isAccelerating(gameState) {
  return gameState.keys.upPressed ||
         gameState.keys.downPressed
}

function updateShip(gl, ship) {
  // TODO use setlength instead of this
  if (gameState.keys.upPressed) {
    ship.acceleration[0] += Math.cos(ship.rotateZ) * gameState.thrust
    ship.acceleration[1] += Math.sin(ship.rotateZ) * gameState.thrust
    if (ship.acceleration[0] > gameState.maxAcc) ship.acceleration[0] = gameState.maxAcc
    if (ship.acceleration[1] > gameState.maxAcc) ship.acceleration[1] = gameState.maxAcc
  }

  if (gameState.keys.downPressed) {
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
  if (ship.position[0] + ship.width < 0)
    ship.position[0] = gl.canvas.clientWidth + ship.width

  if (ship.position[0] > gl.canvas.clientWidth + ship.width)
    ship.position[0] = 0

  if (ship.position[1] + ship.width < 0)
    ship.position[1] = gl.canvas.clientHeight + ship.width

  if (ship.position[1] > gl.canvas.clientHeight + ship.width)
    ship.position[1] = 0

  if (gameState.keys.spacePressed) throttledMakeBullet()

  var m = ship.matrix
  m4.identity(m)
  m4.translate(m, ship.position, m)
  m4.rotateX(m, ship.rotateX, m)
  m4.rotateY(m, ship.rotateY, m)
  m4.rotateZ(m, ship.rotateZ, m)
  m4.scale(m, ship.scale, m)
}

function defaultUpdate(gl, gObj, t) {
  v3.add(gObj.position, gObj.velocity, gObj.position)
  m4.identity(gObj.matrix)
  m4.translate(gObj.matrix, gObj.position, gObj.matrix)
  m4.rotateX(gObj.matrix, gObj.rotateX, gObj.matrix)
  m4.rotateY(gObj.matrix, gObj.rotateY, gObj.matrix)
  m4.rotateZ(gObj.matrix, gObj.rotateZ, gObj.matrix)
  m4.scale(gObj.matrix, gObj.scale, gObj.matrix)
}

function updateNoop(){return m4.identity()}

var objTypeToUpdateFn = { }
objTypeToUpdateFn[gameTypes.ship] = updateShip
window.objTypeToUpdateFn = objTypeToUpdateFn

function update(gl, gObject, t) {
  return (objTypeToUpdateFn[gObject.type] || defaultUpdate)(gl, gObject, t)
}

const uniforms = {
  u_viewProjection: m4.identity(),
  u_model: m4.identity()
}

const log = throttle((...args) => console.log.apply(console, args), 1000)

function setupModelBuffer(gl, data) {
  console.log('data: ', data);
  window.data=data
  var faceData = parseModel.parseJson(data)
  var indices = parseModel.getIndicesFromFaces(faceData)
  var arrays = {
    position: {numComponents: 3, data: data.vertices},
    indices: {numComponents: 3, data: indices}
  }
  return twgl.createBufferInfoFromArrays(gl, arrays)
}

function initShip(position, shipData) {
  var ship = new GObject
  ship.position = position
  ship.scale = v3.create(2,2,2)
  // ship.rotateX= Math.PI/2
  // ship.rotateY= Math.PI/2
  ship.type = gameTypes.ship
  ship.width = 15
  ship.bufferInfo = shipData.bufferInfo
  ship.bbox = bbox(shipData.modelData.vertices)
  window.ship = ship
  return ship
}

function initAsteroid(position, asteroidData) {
  var asteroid = new GObject()
  asteroid.type = gameTypes.asteroid
  asteroid.velocity[0] = rand() * .5 * (rand() > .5 ? -1 : 1)
  asteroid.velocity[1] = rand() * .5 * (rand() > .5 ? -1 : 1)
  asteroid.width = 15
  asteroid.position = position
  asteroid.scale = v3.create(4,4,4)
  asteroid.rotateZ = rand(Math.PI*2)
  asteroid.bufferInfo = asteroidData.bufferInfo
  asteroid.bbox = bbox(asteroidData.modelData.vertices)
  return asteroid
}

window.on('keyup', ({keyCode}) => {
  console.log('keyup', keyCode);
  if (keyCode == keyNames.up) gameState.keys.upPressed = false
  if (keyCode == keyNames.down) gameState.keys.downPressed = false
  if (keyCode == keyNames.left) gameState.keys.leftPressed = false
  if (keyCode == keyNames.right) gameState.keys.rightPressed = false
  if (keyCode == keyNames.space) gameState.keys.spacePressed = false
  if (keyCode == keyNames.ctrl) gameState.keys.ctrlPressed = false
})

window.on('keydown', ({keyCode}) => {
  console.log('keydown: ', keyCode)
  if (validKeys.indexOf(keyCode) < 0) { return }
  if (keyCode == keyNames.up) gameState.keys.upPressed = true
  if (keyCode == keyNames.down) gameState.keys.downPressed = true
  if (keyCode == keyNames.left) gameState.keys.leftPressed = true
  if (keyCode == keyNames.right) gameState.keys.rightPressed = true
  if (keyCode == keyNames.space) gameState.keys.spacePressed = true
})

function setupGameObjects(gameState, modelsData) {
  var gl = gameState.gl
  var shipBufferInfo = setupModelBuffer(gl, modelsData[0])
  gameState.shipData = {bufferInfo: shipBufferInfo, modelData: modelsData[0]}

  var bulletVertices = twgl.primitives.createCubeVertices(gameState.bulletSize)
  window.bulletVertices = bulletVertices.position

  gameState.bulletData = {
    bufferInfo: twgl.primitives.createCubeBufferInfo(gl, gameState.bulletSize),
    bbox: bbox(twgl.primitives.createCubeVertices(gameState.bulletSize).position)
  }
  window.modelsData = modelsData
  var asteroidBufferInfo = setupModelBuffer(gl, modelsData[1])
  gameState.asteroidData = {bufferInfo: asteroidBufferInfo, modelData: modelsData[1]}
  var center = v3.create(gl.canvas.clientWidth / 2, gl.canvas.clientHeight / 2, 0)
  gameState.objects.push(initShip(center, gameState.shipData))

  var asteroidWidth = 15
  for (var i = 0; i < gameState.numAsteroids; i++) {
    var position = v3.create(
      gl.canvas.clientWidth / 2 + asteroidWidth * 4,
      gl.canvas.clientHeight / 2 + asteroidWidth * 2,
      0
    )
    gameState.objects.push(initAsteroid(position, gameState.asteroidData))
  }
}

function main(modelsData) {
  const canvas = createCanvas(gameState.canvasSize.w, gameState.canvasSize.h)
  var gl = canvas.getContext('webgl')
  var programInfo = twgl.createProgramInfo(gl, ['vs', 'fs'])
  gameState.gl = gl
  setupGameObjects(gameState, modelsData)

  function render(time) {
    twgl.resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
    var top = 0,
        right = gl.canvas.clientWidth,
        bottom = gl.canvas.clientHeight,
        left = 0, near = -10, far = 10
    m4.ortho(left, right, top, bottom, near, far, gameState.projection)
    m4.multiply(gameState.projection, gameState.view, uniforms.u_viewProjection)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    for (
      var i = 0, len = gameState.objects.length, gameObject;
       i < len;
       i++) {
      gameObject = gameState.objects[i]
      update(gl, gameObject)
      uniforms.u_model = gameObject.matrix
      gl.useProgram(programInfo.program)
      twgl.setBuffersAndAttributes(gl, programInfo, gameObject.bufferInfo)
      twgl.setUniforms(programInfo, uniforms)
      gl.drawElements(gl.TRIANGLES, gameObject.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0)
    }
    requestAnimationFrame(render)
  }
  requestAnimationFrame(render)
}

awaitAll(
  // parial(getJson, 'models/plane.json'),
  partial(getJson, 'models/shipRotatedYUp.json'),
  partial(getJson, 'models/asteroid2.json'),
  main
)
