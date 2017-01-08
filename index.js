const regl = require('regl')()
const camera = require('./camera')({regl})
const createMesh = require('./fem')({regl})

const state = {
  center: [0, 0, 0],
  eye: [0, 0, 0],
  up: [0, 1, 0],
  polar: [Math.PI / 4, Math.PI / 16, 0],
  dpolar: [0, 0, 0],
  displacement: 0,
  lineWidth: 1.25,
  mode: 'stress',
  elements: true,
  lines: true,
  subdivisions: 4,
  meshData: require('./mesh.json')
}

let mesh = null

function rebuildMesh () {
  mesh = createMesh(state.meshData, state.subdivisions)
  state.center = mesh.center.slice()
  state.polar[0] = Math.PI / 4
  state.polar[1] = Math.PI / 16
  state.polar[2] = Math.log(2 * mesh.radius)
}

rebuildMesh()

require('control-panel')([
  {
    type: 'range',
    label: 'displacement',
    min: 0,
    max: 100,
    initial: state.displacement
  },
  /*
  {
    type: 'range',
    label: 'lineWidth',
    min: 0,
    max: 10,
    initial: state.lineWidth
  },
  */
  {
    type: 'select',
    label: 'mode',
    options: [
      'stress',
      'x',
      'y',
      'z',
      'total'
    ],
    initial: state.mode
  },
  {
    type: 'checkbox',
    label: 'elements',
    initial: state.elements
  },
  {
    type: 'checkbox',
    label: 'lines',
    initial: state.lines
  },
  {
    type: 'range',
    label: 'subdivisions',
    min: 3,
    max: 8,
    step: 1,
    initial: state.subdivisions
  }
]).on('input', (data) => {
  const psubdiv = state.subdivisions
  Object.assign(state, data)
  if (psubdiv !== data.subdivisions) {
    rebuildMesh()
  }
})

require('./gesture')({
  canvas: regl._gl.canvas,

  onZoom (dz) {
    state.dpolar[2] += 0.25 * dz
  },

  onRotate (dx, dy) {
    state.dpolar[0] += dx
    state.dpolar[1] -= dy
  }
})

require('drag-and-drop-files')(regl._gl.canvas, ([file]) => {
  const reader = new window.FileReader()
  reader.onload = (data) => {
    try {
      const meshData = JSON.parse(data.target.result)
      mesh = createMesh(meshData, state.subdivisions)
      state.meshData = meshData
      rebuildMesh()
    } catch (e) {
      window.alert('invalid data file')
    }
  }
  reader.readAsText(file)
})

regl.frame(({tick}) => {
  camera.integrate(state)

  regl.clear({
    color: [0, 0, 0, 0],
    depth: 1
  })

  camera.setup(state, () => {
    mesh.draw(state)
  })
})
