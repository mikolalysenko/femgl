const QUAD_TRIS = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 0],
  [0, 1],
  [1, 1]
]

function dot3 (values, weights) {
  const r = [0, 0, 0]
  for (let i = 0; i < values.length; ++i) {
    const v = values[i]
    const w = weights[i]
    for (let j = 0; j < 3; ++j) {
      r[j] += w * v[j]
    }
  }
  return r
}

function pick (array, index) {
  const r = new Array(index.length)
  for (let i = 0; i < index.length; ++i) {
    r[i] = array[index[i]]
  }
  return r
}

module.exports = function ({regl}) {
  function Mesh (
    position,
    positionBounds,
    displacement,
    displacementBounds,
    stress,
    stressBounds,
    palette,
    count) {
    this._position = position
    this._displacement = displacement
    this._stress = stress
    this._palette = palette
    this._count = count
    this._positionBounds = positionBounds
    this._stressBounds = stressBounds
    this._displacementBounds = displacementBounds
  }

  const drawElements = regl({
    frag: `
    precision mediump float;
    varying float intensity;
    uniform sampler2D palette;
    void main () {
      vec3 color = texture2D(palette, vec2(intensity)).rgb;
      gl_FragColor = vec4(pow(color, vec3(1. / 2.2)), 1);
    }
    `,

    vert: `
    precision highp float;

    attribute vec3 position, displacement;
    attribute float stress;

    uniform mat4 projection, view;

    uniform float displacementMag;

    uniform vec3 displacementColor;
    uniform float stressColor, totalColor, colorShift;

    varying float intensity;

    void main () {
      intensity =
        stressColor * stress +
        totalColor * dot(vec3(1), abs(displacement)) +
        dot(displacementColor, displacement) +
        colorShift;
      gl_Position = projection * view *
        vec4(position + displacementMag * displacement, 1);
    }
    `,

    uniforms: {
      displacementMag: regl.prop('displacementMag'),

      displacementColor: regl.prop('displacementColor'),
      stressColor: regl.prop('stressColor'),
      totalColor: regl.prop('totalColor'),
      colorShift: regl.prop('colorShift'),

      palette: regl.this('_palette')
    },

    attributes: {
      position: regl.this('_position'),
      displacement: regl.this('_displacement'),
      stress: regl.this('_stress')
    },

    count: regl.this('_count'),
    offset: 0,
    primitive: 'triangles',
    elements: null
  })

  Mesh.prototype = {
    draw ({mode, displacement}) {
      let displacementColor = [0, 0, 0]
      let totalColor = 0
      let stressColor = 0
      let colorShift = 0

      const stressBounds = this._stressBounds
      const displacementBounds = this._displacementBounds
      switch (mode) {
        case 'stress':
          stressColor = 1 / (stressBounds[1] - stressBounds[0])
          colorShift = -stressBounds[0] * stressColor
          break
        case 'x':
        case 'y':
        case 'z':
          const d = mode.charCodeAt(0) - 'x'.charCodeAt(0)
          displacementColor[d] = 1 / (displacementBounds[1][d] - displacementBounds[0][d])
          colorShift = -displacementBounds[0][d] * displacementColor[d]
          break
        case 'total':
          for (let d = 0; d < 3; ++d) {
            totalColor += Math.max(
              Math.abs(displacementBounds[0][d]),
              Math.abs(displacementBounds[1][d]))
          }
          totalColor = 1 / totalColor
          break
      }
      drawElements.call(this, {
        displacementColor,
        totalColor,
        stressColor,
        colorShift,
        displacementMag: displacement
      })
    }
  }

  function createMesh ({
    palette,
    coordinates,
    displacements,
    elements
  }, N) {
    const position = []
    const displacement = []
    const stress = []
    let vertCount = 0

    const positionBounds = [
      [Infinity, Infinity, Infinity],
      [-Infinity, -Infinity, -Infinity]
    ]
    const displacementBounds = [
      [Infinity, Infinity, Infinity],
      [-Infinity, -Infinity, -Infinity]
    ]
    const stressBounds = [ Infinity, -Infinity ]

    function V (p, d, s) {
      position.push(p[0], p[1], p[2])
      displacement.push(d[0], d[1], d[2])
      stress.push(s)
      for (let i = 0; i < 3; ++i) {
        positionBounds[0][i] = Math.min(positionBounds[0][i], d[i])
        positionBounds[1][i] = Math.max(positionBounds[1][i], d[i])
        displacementBounds[0][i] = Math.min(displacementBounds[0][i], d[i])
        displacementBounds[1][i] = Math.max(displacementBounds[1][i], d[i])
      }
      stressBounds[0] = Math.min(stressBounds[0], s)
      stressBounds[1] = Math.max(stressBounds[1], s)
      vertCount += 1
    }

    function P6 (S, cell) {
      const P = pick(coordinates, cell)
      const D = pick(displacements, cell)

      for (let i = 0; i < N; ++i) {
        for (let j = 0; i + j < N; ++j) {
          const COUNT = (i + j === N - 1 ? 3 : 6)
          for (let v = 0; v < COUNT; ++v) {
            const a = (i + QUAD_TRIS[v][0]) / N
            const b = (j + QUAD_TRIS[v][1]) / N
            const c = 1 - a - b

            const W = [
              a * (2 * a - 1),
              4 * a * b,
              b * (2 * b - 1),
              4 * b * c,
              c * (2 * c - 1),
              4 * c * a
            ]

            V(dot3(P, W), dot3(D, W), S)
          }
        }
      }
    }

    function P8 (S, cell) {
      const P = pick(coordinates, cell)
      const D = pick(displacements, cell)

      for (let i = 0; i < N; ++i) {
        for (let j = 0; j < N; ++j) {
          for (let v = 0; v < QUAD_TRIS.length; ++v) {
            const a = 2 * (i + QUAD_TRIS[v][0]) / N - 1
            const b = 2 * (j + QUAD_TRIS[v][1]) / N - 1

            const W = [
              0.25 * (1 - a) * (b - 1) * (a + b + 1),
              0.5 * (1 - b) * (1 - a * a),
              0.25 * (1 + a) * (b - 1) * (b - a + 1),
              0.5 * (1 + a) * (1 - b * b),
              0.25 * (1 + a) * (1 + b) * (a + b - 1),
              0.5 * (1 + b) * (1 - a * a),
              0.25 * (a - 1) * (b + 1) * (a - b + 1),
              0.5 * (1 - a) * (1 - b * b)
            ]

            V(dot3(P, W), dot3(D, W), S)
          }
        }
      }
    }

    elements.forEach(({type, stresses, cells}) => {
      switch (type) {
        case 'P6':
          for (let i = 0; i < stresses.length; ++i) {
            P6(stresses[i], cells[i])
          }
          break
        case 'P8':
          for (let i = 0; i < stresses.length; ++i) {
            P8(stresses[i], cells[i])
          }
          break
        default:
          console.error('unsupported element type:', type)
      }
    })

    return new Mesh(
      regl.buffer(position),
      positionBounds,
      regl.buffer(displacement),
      displacementBounds,
      regl.buffer(stress),
      stressBounds,
      regl.texture({
        data: palette.map(([r, g, b]) => [
          255 * Math.pow(r, 2.2),
          255 * Math.pow(g, 2.2),
          255 * Math.pow(b, 2.2)
        ]),
        shape: [palette.length, 1, 3],
        min: 'linear',
        mag: 'linear'
      }),
      vertCount)
  }

  return createMesh
}
