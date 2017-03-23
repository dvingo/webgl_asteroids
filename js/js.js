import twgl from 'twgl.js'
import chroma from 'chroma-js'
import parseModel from './parseJson'
import {
  awaitAll, bbox, partial, throttle, rand, randInt, objFromStrs,
  createCanvas, validKeys, keyNames, getJson, lerp, range, findIndex, getTime,
  makePool
} from './util'
const { m4, v3 } = twgl
window.twgl = twgl
window.m4 = m4, window.v3=v3

EventTarget.prototype.on = function(){this.addEventListener.apply(this,arguments)}

function bulletMaker() {
  var bullet = new GObject
  return bullet
}

const gameState = {
  thrust: .03,
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
  bulletLifetimeMs: 4000,
  bulletData: null,
  bulletSpeed: 2,
  bulletSize: 2,
  bulletPool: makePool(bulletMaker, 40),
  projection: m4.identity(),
  view: m4.identity(),
  uniforms: {
    u_viewProjection: m4.identity(),
    u_model: m4.identity()
  }
}
window.gameState = gameState

var gameTypes = objFromStrs('ship', 'asteroid', 'bullet')
/**
 * Game object.
 */
function GObject() {
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
  this.createdTime = getTime()
  this.shouldRemove = false
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

function makeBullet(gl, ship, bulletData, bulletPool) {
  var bullet = bulletPool.get()
  bullet.createdTime = getTime()
  bullet.shouldRemove = false
  bullet.type = gameTypes.bullet
  setV3Length(bullet.velocity, v3.length(ship.velocity) + gameState.bulletSpeed)
  setV3Angle(bullet.velocity, ship.rotateZ)
  bullet.bufferInfo = bulletData.bufferInfo
  bullet.bbox = bulletData.bbox
  bullet.position = v3.copy(ship.position)
  return bullet
}

const throttledMakeBullet = throttle(function() {
  gameState.objects.push(makeBullet(
    gameState.gl, gameState.getShip(), gameState.bulletData, gameState.bulletPool
  ))
}, 100)

function isAccelerating(gameState) {
  return gameState.keys.upPressed ||
         gameState.keys.downPressed
}

function updateShip(ship, gameState, t) {
  var gl = gameState.gl
  if (gameState.keys.upPressed)
    v3.add(ship.velocity, ship.acceleration, ship.velocity)

  if (gameState.keys.downPressed)
    v3.subtract(ship.velocity, ship.acceleration, ship.velocity)

  if (gameState.keys.leftPressed) {
    ship.rotateZ += gameState.rotateBy
    setV3Angle(ship.acceleration, ship.rotateZ)
  }
  if (gameState.keys.rightPressed) {
    ship.rotateZ -= gameState.rotateBy
    setV3Angle(ship.acceleration, ship.rotateZ)
  }
  if (v3.length(ship.velocity) > gameState.maxVelocity)
    setV3Length(ship.velocity, gameState.maxVelocity)

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
  m4.scale(m, ship.scaleV3, m)
}

function defaultUpdate(gObj, gameState, t) {
  var gl = gameState.gl
  v3.add(gObj.position, gObj.velocity, gObj.position)

  if (gObj.position[0] + gObj.width < 0)
    gObj.position[0] = gl.canvas.clientWidth + gObj.width

  if (gObj.position[0] > gl.canvas.clientWidth + gObj.width)
    gObj.position[0] = -gObj.width

  if (gObj.position[1] + gObj.height< 0)
    gObj.position[1] = gl.canvas.clientHeight + gObj.height

  if (gObj.position[1] > gl.canvas.clientHeight + gObj.height)
    gObj.position[1] = -gObj.height
  m4.identity(gObj.matrix)
  m4.translate(gObj.matrix, gObj.position, gObj.matrix)
  m4.rotateX(gObj.matrix, gObj.rotateX, gObj.matrix)
  m4.rotateY(gObj.matrix, gObj.rotateY, gObj.matrix)
  m4.rotateZ(gObj.matrix, gObj.rotateZ, gObj.matrix)
  m4.scale(gObj.matrix, gObj.scaleV3, gObj.matrix)
}

function updateBullet(bullet, gameState, t) {
  if (getTime() - bullet.createdTime > gameState.bulletLifetimeMs)
    bullet.shouldRemove = true
  defaultUpdate(bullet, gameState, t)
}

function updateNoop(){return m4.identity()}

var objTypeToUpdateFn = { }
objTypeToUpdateFn[gameTypes.ship] = updateShip
objTypeToUpdateFn[gameTypes.bullet] = updateBullet
window.objTypeToUpdateFn = objTypeToUpdateFn

function update(gObject, gameState, t) {
  return (objTypeToUpdateFn[gObject.type] || defaultUpdate)(gObject, gameState, t)
}

const log = throttle((...args) => console.log.apply(console, args), 1000)

function setupModelBuffer(gl, data) {
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
  setV3Length(ship.acceleration, gameState.thrust)
  ship.position = position
  ship.scale = 2
  ship.scaleV3 = v3.create(ship.scale, ship.scale, ship.scale)
  // ship.rotateX= Math.PI/2
  // ship.rotateY= Math.PI/2
  ship.type = gameTypes.ship
  ship.bufferInfo = shipData.bufferInfo

  var box = bbox(shipData.modelData.vertices)
  ship.bbox = box
  ship.width = (box.x.max - box.x.min) * ship.scale
  ship.height = (box.y.max - box.y.min) * ship.scale

  window.ship = ship
  return ship
}

function initAsteroid(screenSize, asteroidData) {
  var asteroid = new GObject()
  asteroid.type = gameTypes.asteroid
  asteroid.velocity[0] = rand() * .5 * (rand() > .5 ? -1 : 1)
  asteroid.velocity[1] = rand() * .5 * (rand() > .5 ? -1 : 1)
  asteroid.scale = 4
  asteroid.scaleV3 = v3.create(asteroid.scale, asteroid.scale, asteroid.scale)
  var box = bbox(asteroidData.modelData.vertices)
  asteroid.bbox = box
  asteroid.width = (box.x.max - box.x.min) * asteroid.scale
  asteroid.height = (box.y.max - box.y.min) * asteroid.scale
  asteroid.position = v3.create(
    lerp(rand(), 0, screenSize.w),
    lerp(rand(), 0, screenSize.h),
    0
  )
  // TODO padding around ship in center
  asteroid.rotateZ = rand(Math.PI*2)
  asteroid.bufferInfo = asteroidData.bufferInfo
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
  var screenSize = {
    w:gl.canvas.clientWidth, h: gl.canvas.clientHeight
  }
  for (var i = 0; i < gameState.numAsteroids; i++) {
    gameState.objects.push(initAsteroid(screenSize, gameState.asteroidData))
  }
}

function main(modelsData) {
  const canvas = createCanvas(gameState.canvasSize.w, gameState.canvasSize.h)
  var gl = canvas.getContext('webgl')
  var programInfo = twgl.createProgramInfo(gl, ['vs', 'fs'])
  gameState.gl = gl
  setupGameObjects(gameState, modelsData)

  function loop(time) {
    twgl.resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
    var top = 0,
        right = gl.canvas.clientWidth,
        bottom = gl.canvas.clientHeight,
        left = 0, near = -10, far = 10
    m4.ortho(left, right, top, bottom, near, far, gameState.projection)
    m4.multiply(gameState.projection, gameState.view, gameState.uniforms.u_viewProjection)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    for (var i = 0, len = gameState.objects.length; i < len; i++) {
      update(gameState.objects[i], gameState, time)
    }

    for (
      var i = 0, len = gameState.objects.length, gameObject;
       i < len;
       i++) {
      gameObject = gameState.objects[i]
      gameState.uniforms.u_model = gameObject.matrix
      gl.useProgram(programInfo.program)
      twgl.setBuffersAndAttributes(gl, programInfo, gameObject.bufferInfo)
      twgl.setUniforms(programInfo, gameState.uniforms)
      gl.drawElements(gl.TRIANGLES, gameObject.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0)
    }

    for (var i = 0, len = gameState.objects.length; i < len; i++) {
      var gObj = gameState.objects[i]
      if (gObj.shouldRemove && gObj.type === gameTypes.bullet) {
        gameState.bulletPool.free(gObj)
      }
    }

    gameState.objects = gameState.objects.filter(
      gObj => !(gObj.shouldRemove && gObj.type === gameTypes.bullet)
    )

    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

awaitAll(
  // parial(getJson, 'models/plane.json'),
  partial(getJson, 'models/shipRotatedYUp.json'),
  partial(getJson, 'models/asteroid2.json'),
  main
)
