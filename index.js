const regl = require('regl')()
const createMesh = require('./fem')({regl})
const mesh = createMesh(require('./mesh.json'), 4)
const setupCamera = require('regl-camera')(regl, {
  center: [0, 0, 0],
  near: 0.1,
  far: 1e4
})

regl.frame(({tick}) => {
  regl.clear({
    color: [0, 0, 0, 0],
    depth: 1
  })

  setupCamera(() => {
    mesh.draw({
      displacement: 100.0 * (1.0 + Math.cos(0.01 * tick)),
      mode: 'stress'
    })
  })
})
