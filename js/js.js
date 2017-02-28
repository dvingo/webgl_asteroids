import twgl from 'twgl.js'
import chroma from 'chroma-js'

console.log('hellow3', twgl);

const createEl = document.createElement.bind(document)
Node.prototype.on = function(){this.addEventListener.apply(this,arguments)}

function main() {
  const canvas = createEl('canvas')
  canvas.style.width = '500px'
  canvas.style.height = '300px'
  // canvas.style.outline = '1px solid'
  canvas.style.boxShadow = '1px 1px 4px hsla(0, 0%, 0%, 0.8)'
  document.body.appendChild(canvas)
}

main()
