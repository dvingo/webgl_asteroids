import twgl from 'twgl.js'
import chroma from 'chroma-js'
import {
  awaitAll, bbox, updateBbox, partial, throttle, rand, randInt, objFromStrs,
  createCanvas, validKeys, keyNames, getJson, lerp, range, findIndex, getTime,
  makePool, makeRect, getV3Angle, setV3Angle, setV3Length, setV3,
  log, wrapBounds, setupModelBuffer, intersects, GObject, setupBbox,
  updateGObjectMatrix, createEl, across, byId, sel
} from 'js/util'

import planeModel from 'models/fancy_plane.json'
import shipModel from 'models/shipRotatedYUp.json'
import asteroidModel from 'models/asteroid2.json'

const { m4, v3 } = twgl
window.twgl = twgl
window.m4 = m4, window.v3=v3

EventTarget.prototype.on = function(){this.addEventListener.apply(this,arguments)}

function bulletMaker() { return new GObject }

var gameTypes = objFromStrs('ship', 'asteroid', 'bullet')
var shipTypes = objFromStrs('boring', 'fancy')
var gameStates = objFromStrs('beforePlaying', 'playing', 'gameOver', 'gameWon')
const gameState = {
  thrust: scaleFactor => .06,//across(scaleFactor, .5, 4, .06, .04),
  maxVelocity: 10,
  rotateBy: Math.PI/80,
  numAsteroids: 15,
  state: gameStates.beforePlaying,
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
  shipType: shipTypes.boring,
  bulletLifetimeMs: 2000,
  bulletData: null,
  bulletSpeed: 2,
  bulletSize: 2,
  bulletPool: makePool(bulletMaker, 40),
  projection: m4.identity(),
  view: m4.identity(),
  uniforms: {
    u_viewProjection: m4.identity(),
    u_model: m4.identity(),
    color: v3.create(.8, .8, .8)
  },
  drawBboxes: false,
  globalScaleFactor: 1
}
window.gameState = gameState

const throttledMakeBullet = throttle(function() {
  gameState.objects.push(makeBullet(
    gameState.gl, gameState.getShip(), gameState.bulletData, gameState.bulletPool
  ))
}, 100)

function isAccelerating(gameState) {
  return gameState.keys.upPressed ||
         gameState.keys.downPressed
}

function getShipRotation() {
  var ship = gameState.getShip()
  var isShipFancy = gameState.shipType == shipTypes.fancy
  var rotateField = 'rotateZ'//isShipFancy ? 'rotateY' : 'rotateZ'
  var rotateOffset = 0//isShipFancy ? Math.PI/2 : 0
  return ship[rotateField] - rotateOffset
}
function getShipRotationField() {
  var isShipFancy = gameState.shipType == shipTypes.fancy
  return 'rotateZ'//isShipFancy ? 'rotateY' : 'rotateZ'
}

function updateShip(ship, gameState, t) {
  var gl = gameState.gl
  var shipRotateAngle = getShipRotation()
  var rotateField = getShipRotationField()
  if (gameState.keys.upPressed)
    v3.add(ship.velocity, ship.acceleration, ship.velocity)

  if (gameState.keys.downPressed)
    v3.subtract(ship.velocity, ship.acceleration, ship.velocity)

  if (gameState.keys.leftPressed) {
    ship[rotateField] += gameState.rotateBy
    setV3Angle(ship.acceleration, shipRotateAngle)
  }
  if (gameState.keys.rightPressed) {
    ship[rotateField] -= gameState.rotateBy
    setV3Angle(ship.acceleration, shipRotateAngle)
  }
  if (v3.length(ship.velocity) > gameState.maxVelocity)
    setV3Length(ship.velocity, gameState.maxVelocity)

  v3.add(ship.position, ship.velocity, ship.position)

  wrapBounds(ship, gl.canvas, gameState.globalScaleFactor)

  if (gameState.keys.spacePressed) throttledMakeBullet()

  gameState.objects.forEach(obj => {
    setV3(obj.color, .8, .8, .8)
    if (obj.type != gameTypes.asteroid) return
    if (intersects(obj, ship)) {
      setV3(ship.color, 1, 0, 0)
      setV3(obj.color, 1, 0, 0)
      if (gameState.state == gameStates.playing)
        gameState.state = gameStates.gameOver
    }
  })

  scaleObj(ship, gameState.globalScaleFactor)
  updateGObjectMatrix(ship)
  updateBbox(ship)
}

function defaultUpdate(gObj, gameState, t) {
  var gl = gameState.gl
  v3.add(gObj.position, gObj.velocity, gObj.position)
  wrapBounds(gObj, gl.canvas, gameState.globalScaleFactor)
  scaleObj(gObj, gameState.globalScaleFactor)
  updateGObjectMatrix(gObj)
  updateBbox(gObj)
}

function updateBullet(bullet, gameState, t) {
  if (getTime() - bullet.createdTime > gameState.bulletLifetimeMs) {
    bullet.shouldRemove = true
  } else {
    var objsToAdd = []
    gameState.objects.forEach(obj => {
      if (obj.type === gameTypes.asteroid && !obj.shouldRemove && intersects(obj, bullet)) {
        var len = objsToAdd.length
        obj.shouldRemove = true
        bullet.shouldRemove = true
        setV3(bullet.color, 1, 0, 0)
        setV3(obj.color, 1, 0, 0)
        if (obj.life > 0) {
          for (var i = 0; i < 4;i++)
            objsToAdd.push(initSmallAsteroid(gameState, obj, i))
        }
      }
    })
    gameState.objects = gameState.objects.concat(objsToAdd)
    defaultUpdate(bullet, gameState, t)
  }
}

var objTypeToUpdateFn = {}
objTypeToUpdateFn[gameTypes.ship]   = updateShip
objTypeToUpdateFn[gameTypes.bullet] = updateBullet

function update(gObject, gameState, t) {
  (objTypeToUpdateFn[gObject.type] || defaultUpdate)(gObject, gameState, t)
}

const scaleObj = (gobj, scaleFactor) =>
  v3.mulScalar(gobj.originalScaleV3, scaleFactor, gobj.scaleV3)


function makeBullet(gl, ship, bulletData, bulletPool) {
  var bullet = bulletPool.get()
  bullet.createdTime = getTime()
  bullet.shouldRemove = false
  bullet.type = gameTypes.bullet
  bullet.bufferInfo = bulletData.bufferInfo
  bullet.originalScaleV3 = v3.create(1, 1, 1)
  scaleObj(bullet, gameState.globalScaleFactor)
  setV3Length(bullet.velocity, v3.length(ship.velocity) + gameState.bulletSpeed)
  setV3Angle(bullet.velocity, getShipRotation())
  updateGObjectMatrix(bullet)
  setupBbox(bullet, bulletData.vertices)
  bullet.position = v3.create(
    ship.position[0] + Math.cos(ship.rotateZ) * ship.width / 4,
    ship.position[1] + Math.sin(ship.rotateZ) * ship.height / 4,
    ship.position[2]
  )
  return bullet
}

function handlePlayingKeyDown(keyCode) {
  if (validKeys.indexOf(keyCode) < 0) { return }
  if (keyCode == keyNames.up || keyCode == keyNames.w)
    gameState.keys.upPressed = true
  if (keyCode == keyNames.down || keyCode == keyNames.s)
    gameState.keys.downPressed = true
  if (keyCode == keyNames.left || keyCode == keyNames.a)
    gameState.keys.leftPressed = true
  if (keyCode == keyNames.right || keyCode == keyNames.d)
    gameState.keys.rightPressed = true
  if (keyCode == keyNames.space) gameState.keys.spacePressed = true
  if (keyCode == keyNames.ctrl) gameState.drawBboxes = !gameState.drawBboxes
}

window.on('keyup', ({keyCode}) => {
  if (gameState.state != gameStates.playing) { return }
  console.log('keyup', keyCode);
  if (keyCode == keyNames.up || keyCode == keyNames.w)
    gameState.keys.upPressed = false
  if (keyCode == keyNames.down || keyCode == keyNames.s)
    gameState.keys.downPressed = false
  if (keyCode == keyNames.left || keyCode == keyNames.a)
    gameState.keys.leftPressed = false
  if (keyCode == keyNames.right || keyCode == keyNames.d)
    gameState.keys.rightPressed = false
  if (keyCode == keyNames.space) gameState.keys.spacePressed = false
  if (keyCode == keyNames.ctrl) gameState.keys.ctrlPressed = false
})

window.on('mousedown', () => {
  if (gameState.state == gameStates.playing)
    gameState.keys.spacePressed = true
})
window.on('mouseup', () => {
  if (gameState.state == gameStates.playing)
    gameState.keys.spacePressed = false
})

window.on('keydown', ({keyCode}) => {
  console.log('keydown: ', keyCode)

  if (gameState.state == gameStates.playing)
    handlePlayingKeyDown(keyCode)

  if (gameState.state == gameStates.beforePlaying)
    gameState.state = gameStates.playing
})

function setupFancyShip(position, shipData) {
  var ship = new GObject
  setV3Length(ship.acceleration, gameState.thrust(gameState.globalScaleFactor))
  ship.type = gameTypes.ship
  ship.shipType = shipTypes.fancy
  ship.bufferInfo = shipData.bufferInfo
  ship.position = position
  ship.scale = .5
  ship.originalScaleV3 = v3.create(ship.scale, ship.scale, ship.scale)
  ship.scaleV3 = v3.create(ship.scale, ship.scale, ship.scale)
  scaleObj(ship, gameState.globalScaleFactor)
  updateGObjectMatrix(ship)
  setupBbox(ship, shipData.modelData.vertices)
  return ship
}

function setupBoringShip(position, shipData) {
  var ship = new GObject
  setV3Length(ship.acceleration, gameState.thrust(gameState.globalScaleFactor))
  ship.type = gameTypes.ship
  ship.shipType = shipTypes.boring
  ship.bufferInfo = shipData.bufferInfo
  ship.position = position
  ship.scale = 2
  ship.originalScaleV3 = v3.create(ship.scale, ship.scale, ship.scale)
  ship.scaleV3 = v3.create(ship.scale, ship.scale, ship.scale)
  scaleObj(ship, gameState.globalScaleFactor)
  updateGObjectMatrix(ship)
  setupBbox(ship, shipData.modelData.vertices)
  return ship
}

function initSmallAsteroid(gameState, parentAsteroid, i) {
  var asteroid = new GObject
  var asteroidData = gameState.asteroidData
  asteroid.type = gameTypes.asteroid
  asteroid.life = parentAsteroid.life - 1
  setV3Length(asteroid.velocity, v3.length(parentAsteroid.velocity) * (rand()+.5))
  setV3Angle(asteroid.velocity,
    getV3Angle(parentAsteroid.velocity) + rand(Math.PI*2) * (i < 2 ? -1 : 1))
  asteroid.rotateZ = rand(Math.PI*2)
  asteroid.position[0] = parentAsteroid.position[0] + rand(5) * (rand() > .5 ? -1 : 1)
  asteroid.position[1] = parentAsteroid.position[1] + rand(5)* (rand() > .5 ? -1 : 1)
  asteroid.position[2] = parentAsteroid.position[2]
  asteroid.scale = 2
  asteroid.originalScaleV3 = v3.create(asteroid.scale, asteroid.scale, asteroid.scale)
  asteroid.scaleV3 = v3.create(asteroid.scale, asteroid.scale, asteroid.scale)
  scaleObj(asteroid, gameState.globalScaleFactor)
  asteroid.bufferInfo = asteroidData.bufferInfo
  updateGObjectMatrix(asteroid)
  setupBbox(asteroid, asteroidData.modelData.vertices)
  return asteroid
}

function initAsteroid(screenSize, asteroidData, ship) {
  var asteroid = new GObject
  asteroid.type = gameTypes.asteroid
  asteroid.life = 1
  asteroid.velocity[0] = rand() * .5 * (rand() > .5 ? -1 : 1)
  asteroid.velocity[1] = rand() * .5 * (rand() > .5 ? -1 : 1)
  asteroid.rotateZ = rand(Math.PI*2)
  asteroid.scale = 4
  asteroid.originalScaleV3 = v3.create(asteroid.scale, asteroid.scale, asteroid.scale)
  asteroid.scaleV3 = v3.create(asteroid.scale, asteroid.scale, asteroid.scale)
  scaleObj(asteroid, gameState.globalScaleFactor)
  asteroid.bufferInfo = asteroidData.bufferInfo
  updateGObjectMatrix(asteroid)
  setupBbox(asteroid, asteroidData.modelData.vertices)
  do {
    asteroid.position = v3.create(
      lerp(rand(), 0, screenSize.w),
      lerp(rand(), 0, screenSize.h),
      0
    )
  } while (intersects(ship, asteroid))
  return asteroid
}

function setupGameObjects(gameState, modelsData) {
  var gl = gameState.gl

  /* Ship setup */
  var fancyShipBufferInfo = setupModelBuffer(gl, modelsData[0])
  var boringShipBufferInfo = setupModelBuffer(gl, modelsData[1])
  gameState.fancyShipData = {bufferInfo: fancyShipBufferInfo, modelData: modelsData[0]}
  gameState.boringShipData = {bufferInfo: boringShipBufferInfo, modelData: modelsData[1]}
  var startShipData = (gameState.shipType == shipTypes.boring
    ? gameState.boringShipData : gameState.fancyShipData)
  var center = v3.create(gl.canvas.clientWidth / 2, gl.canvas.clientHeight / 2, 0)

  gameState.boringShip = setupBoringShip(center, gameState.boringShipData)
  gameState.fancyShip = setupFancyShip(center, gameState.fancyShipData)
  gameState.objects.push(gameState.shipType == shipTypes.boring
    ? gameState.boringShip : gameState.fancyShip)

  /* Bullet setup */
  var bulletVertices = twgl.primitives.createCubeVertices(gameState.bulletSize)
  gameState.bulletData = {
    bufferInfo: twgl.primitives.createCubeBufferInfo(gl, gameState.bulletSize),
    vertices: twgl.primitives.createCubeVertices(gameState.bulletSize).position
  }

  /* Asteroid setup */
  var asteroidBufferInfo = setupModelBuffer(gl, modelsData[2])
  gameState.asteroidData = {bufferInfo: asteroidBufferInfo, modelData: modelsData[2]}

  var screenSize = {
    w:gl.canvas.clientWidth, h: gl.canvas.clientHeight
  }
  for (var i = 0; i < gameState.numAsteroids; i++) {
    gameState.objects.push(
      initAsteroid(screenSize, gameState.asteroidData, gameState.getShip())
    )
  }
}

function drawBbox(gl, programInfo, gameState, go) {
  var w = (go.bbox.max[0] - go.bbox.min[0])
  var h = (go.bbox.max[1] - go.bbox.min[1])
  const r = makeRect(gl, w, h)
  setV3(r.position,
    go.bbox.min[0] + w/2,
    go.bbox.min[1] + h/2,
    go.position[2]
  )
  m4.identity(r.matrix)
  m4.translate(r.matrix, r.position, r.matrix)
  gameState.uniforms.u_model = r.matrix
  twgl.setBuffersAndAttributes(gl, programInfo, r.bufferInfo)
  twgl.setUniforms(programInfo, gameState.uniforms)
  gl.drawElements(gl.LINES, r.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0)
}

function drawGameObject(gameObject, gameState, programInfo) {
  var gl = gameState.gl
  gameState.uniforms.u_model = gameObject.matrix
  gameState.uniforms.color = gameObject.color
  gl.useProgram(programInfo.program)
  twgl.setBuffersAndAttributes(gl, programInfo, gameObject.bufferInfo)
  twgl.setUniforms(programInfo, gameState.uniforms)
  gl.drawElements(gl.TRIANGLES, gameObject.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0)
  gameState.drawBboxes && drawBbox(gl, programInfo, gameState, gameObject)
}

function setupCanvases() {
  const container = createEl('div')
  container.style.position = 'relative'
  container.style.border = '1px dashed #fff'
  const canvas = createCanvas(gameState.canvasSize.w, gameState.canvasSize.h)
  canvas.className = 'canvas'
  canvas.style.boxShadow = '1px 1px 4px hsla(0, 0%, 0%, 0.8)'
  canvas.style.zIndex = -1
  const txtCanvas = createCanvas()
  txtCanvas.className = 'canvas'
  txtCanvas.setAttribute('width', gameState.canvasSize.w)
  txtCanvas.setAttribute('height', gameState.canvasSize.h)
  txtCanvas.style.position = 'absolute'
  txtCanvas.style.top = 0
  txtCanvas.style.left = 0

  container.appendChild(canvas)
  container.appendChild(txtCanvas)
  document.body.appendChild(container)
  gameState.canvas = canvas
  gameState.txtCanvas = txtCanvas
  gameState.txtCtx = txtCanvas.getContext('2d')
}

function resetGame() {

  gameState.keys.upPressed = false
  gameState.keys.downPressed = false
  gameState.keys.leftPressed = false
  gameState.keys.rightPressed = false
  gameState.keys.spacePressed = false

  var ship = gameState.getShip()
  var gl = gameState.gl
  gameState.objects = gameState.objects.filter(o => o.type === gameTypes.ship)
  setV3(ship.velocity, 0, 0, 0)
  var rotateField = getShipRotationField()
  ship[rotateField] = 0
  setV3Angle(ship.acceleration, 0)
  setV3(ship.position,
     gl.canvas.clientWidth / 2, gl.canvas.clientHeight / 2, 0
  )
  updateGObjectMatrix(ship)
  var screenSize = {
    w: gl.canvas.clientWidth, h: gl.canvas.clientHeight
  }
  gameState.objects.push.apply(gameState.objects,
    range(gameState.numAsteroids).map(a =>
      initAsteroid(screenSize, gameState.asteroidData, ship)
    )
  )
  gameState.state = gameStates.beforePlaying
}

function switchShipType(currentShipType, gameState) {
  var newShip = (currentShipType === shipTypes.boring
    ? gameState.fancyShip : gameState.boringShip)
  var currentShip = (currentShipType === shipTypes.boring
    ? gameState.boringShip : gameState.fancyShip)
  v3.copy(currentShip.position, newShip.position)
  v3.copy(currentShip.velocity, newShip.velocity)
  newShip.rotateZ = currentShip.rotateZ
  gameState.objects.splice(0,1,newShip)
}

function setupSelectScale() {
  var selectHalf = sel('.select-scale-half')
  var selectOne = sel('.select-scale-one')
  var selectTwo = sel('.select-scale-two')
  var selectFour = sel('.select-scale-four')
  var selectedRgx = /--selected/
  function onSelect(selected, scale) {
    selectHalf.className = selectHalf.className.replace(selectedRgx, '')
    selectOne.className = selectOne.className.replace(selectedRgx, '')
    selectTwo.className = selectTwo.className.replace(selectedRgx, '')
    selectFour.className = selectFour.className.replace(selectedRgx, '')
    selected.className = selected.className + '--selected'
    gameState.globalScaleFactor = scale
  }
  selectHalf.on('click', partial(onSelect, selectHalf, .5))
  selectOne.on('click', partial(onSelect, selectOne, 1))
  selectTwo.on('click', partial(onSelect, selectTwo, 2))
  selectFour.on('click', partial(onSelect, selectFour, 4))
}

function setupControls() {
  byId('restart').on('click', resetGame)
  var fancyShipButton = sel('.select-fancy-ship')
  var boringShipButton = sel('.select-boring-ship')
  setupSelectScale()

  fancyShipButton.on('click', function() {
    var currentShipType = gameState.getShip().shipType
    if (currentShipType != shipTypes.fancy) {
      this.className = 'select-fancy-ship controls__select--selected'
      switchShipType(currentShipType, gameState)
      boringShipButton.className = 'select-fancy-ship controls__select'
    }
  })
  boringShipButton.on('click', function() {
    var currentShipType = gameState.getShip().shipType
    if (currentShipType != shipTypes.boring) {
      this.className = 'select-boring-ship controls__select--selected'
      fancyShipButton.className = 'select-fancy-ship controls__select'
      switchShipType(currentShipType, gameState)
    }
  })
}

function drawGameText(gameState) {
  var ctx = gameState.txtCtx
  gameState.txtCanvas.width = gameState.txtCanvas.clientWidth
  gameState.txtCanvas.height = gameState.txtCanvas.clientHeight
  ctx.clearRect(0, 0, gameState.txtCanvas.clientWidth, gameState.txtCanvas.clientHeight)
  ctx.fillStyle = 'white'
  ctx.font = '24px monospace'
  if (gameState.state == gameStates.beforePlaying)
    ctx.fillText('Press any key to begin.', 100, 100)
  if (gameState.state == gameStates.gameOver)
    ctx.fillText('Game Over.', 100, 100)
  if (gameState.state == gameStates.gameWon)
    ctx.fillText('You win! :)', 100, 100)
}

function main(modelsData) {
  setupControls()
  setupCanvases()

  var canvas = gameState.canvas
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

    drawGameText(gameState)

    for (var i = 0, len = gameState.objects.length; i < len; i++) {
      update(gameState.objects[i], gameState, time)
    }

    for (var i = 0, len = gameState.objects.length; i < len; i++) {
      drawGameObject(gameState.objects[i], gameState, programInfo)
    }

    for (var i = 0, len = gameState.objects.length; i < len; i++) {
      var gObj = gameState.objects[i]
      if (gObj.shouldRemove && gObj.type === gameTypes.bullet) {
        gameState.bulletPool.free(gObj)
      }
    }

    gameState.objects = gameState.objects.filter(gObj => !(gObj.shouldRemove))
    if (gameState.state !== gameStates.gameOver && !gameState.objects.filter(o => o.type == gameTypes.asteroid).length)
      gameState.state = gameStates.gameWon
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

/* awaitAll(
  partial(getJson, 'models/fancy_plane.json'),
  partial(getJson, 'models/shipRotatedYUp.json'),
  partial(getJson, 'models/asteroid2.json'),
  main
) */
main([planeModel, shipModel, asteroidModel])
