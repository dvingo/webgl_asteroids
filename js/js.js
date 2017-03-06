import twgl from 'twgl.js'
import chroma from 'chroma-js'
import parseModel from './parseJson'
console.log('parseModel: ', parseModel );
const { m4 } = twgl
window.twgl = twgl
console.log('hellow3', twgl);

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
    console.log('GOT DATA: ', data)
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
  // u_matrix: m4.identity(),
  u_matrix: m4.identity(),
}

function main(data) {
  console.log('main data: ', data);

  var faceData = parseModel.parseJson(data)
  var indices = parseModel.getIndicesFromFaces(faceData)
  const arrays = {
    position: {numComponents: 3, data: data.vertices},
    indices: {numComponents: 3, data: indices}
  }
  // twgl.setDefaults({attribPrefix: "a_"})
  const canvas = createCanvas(500, 300)
  var gl = canvas.getContext('webgl')
  var programInfo = twgl.createProgramInfo(gl, ['vs', 'fs'])
  window.bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)

  var camera = m4.identity();
  var view = m4.identity();
  var viewProjection = m4.identity();

  function render(time) {
    twgl.resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
    // uniforms.u_matrix = m4.ortho(-aspect, aspect, 1, -1, -1, 1)
    // var projection = m4.perspective(30 * Math.PI / 180, gl.canvas.clientWidth / gl.canvas.clientHeight, 0.5, 100);

    var projection = m4.perspective(30 * Math.PI/180, aspect, .5, 100)
    var eye = [10, 40, -40];
    var target = [0, 0, 0];
    var up = [0, 1, 0];
    camera = m4.lookAt(eye, target, up)
    view = m4.inverse(camera)
    uniforms.u_matrix = m4.multiply(projection, view)
    // uniforms.u_matrix = viewProjection

    gl.useProgram(programInfo.program)
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo)
    twgl.setUniforms(programInfo, uniforms)

    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawElements(gl.TRIANGLES, bufferInfo.numElements, gl.UNSIGNED_SHORT, 0)
    // gl.drawArrays(gl.TRIANGLES, 0, bufferInfo.numElements)
    // twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLES)

    requestAnimationFrame(render)
  }
  requestAnimationFrame(render)
}

loadModel('models/ship.json', (data) => {
  main(data)
})
