const P_TOL = 1e6
const D_TOL = 1e9

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

function cmpP (a, b) {
  return Math.abs(a[0] - b[0]) < P_TOL ||
          Math.abs(a[1] - b[1]) < P_TOL ||
          Math.abs(a[2] - b[2]) < P_TOL
}

function cmpD (a, b) {
  return Math.abs(a[0] - b[0]) < D_TOL ||
          Math.abs(a[1] - b[1]) < D_TOL ||
          Math.abs(a[2] - b[2]) < D_TOL
}

function convertLineVerts (lineV) {
  const lineElements = []
  for (let i = 0; i < lineV.length; i += 3) {
    const a = lineV[i]
    const b = lineV[i + 1]
    const c = lineV[i + 2]
    lineElements.push([
      Math.min(a, b, c),
      Math.min(Math.max(a, b), Math.max(b, c), Math.max(c, a)),
      Math.max(a, b, c)
    ])
  }
  lineElements.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
  let ptr = 1
  for (let i = 1; i < lineElements.length; ++i) {
    const a = lineElements[i - 1]
    const b = lineElements[i]
    if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) {
      lineElements[ptr++] = b
    }
  }
  lineElements.length = ptr
  return lineElements
}

module.exports = function ({regl}) {
  function Mesh (
    position,
    positionBounds,
    displacement,
    displacementBounds,
    maxDisplacment,
    stress,
    stressBounds,
    palette,
    count,
    lineP0,
    lineD0,
    lineP1,
    lineD1,
    lineN,
    lineElements) {
    this._position = position
    this._positionBounds = positionBounds
    this._displacement = displacement
    this._displacementBounds = displacementBounds
    this._maxDisplacement = maxDisplacment
    this._stress = stress
    this._stressBounds = stressBounds
    this._palette = palette
    this._count = count
    this._lineP0 = lineP0
    this._lineD0 = lineD0
    this._lineP1 = lineP1
    this._lineD1 = lineD1
    this._lineN = lineN
    this._lineElements = lineElements

    this.center = [0, 0, 0]
    this.radius = 0
    for (let i = 0; i < 3; ++i) {
      this.center[i] = 0.5 *
        (this._positionBounds[0][i] + this._positionBounds[1][i])
      this.radius += Math.pow(
        this._positionBounds[1][i] - this._positionBounds[0][i], 2)
    }
    this.radius = Math.sqrt(this.radius)
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
    precision mediump float;

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
        totalColor * length(displacement) +
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

  const drawLines = regl({
    vert: `
    precision mediump float;

    attribute vec3 p0, d0, p1, d1;
    attribute float n;

    uniform mat4 projection, view;
    uniform float displacementMag, lineWidth;
    uniform vec2 shape;

    void main () {
      vec3 q0 = p0 + displacementMag * d0;
      vec3 q1 = p1 + displacementMag * d1;
      vec4 s0 = projection * view * vec4(q0, 1);
      vec4 s1 = projection * view * vec4(q1, 1);
      vec2 d = lineWidth * n * normalize(s1.xy * s0.w - s0.xy * s1.w);
      gl_Position = s0 + s0.w * vec4(d.y / shape.x, -d.x / shape.y, 0, 0);
    }
    `,

    frag: `
    precision lowp float;
    void main () {
      gl_FragColor = vec4(0, 0, 0, 1);
    }
    `,

    attributes: {
      p0: regl.this('_lineP0'),
      d0: regl.this('_lineD0'),
      p1: regl.this('_lineP1'),
      d1: regl.this('_lineD1'),
      n: regl.this('_lineN')
    },

    uniforms: {
      displacementMag: regl.prop('displacementMag'),
      lineWidth: regl.prop('lineWidth'),
      shape: ({viewportWidth, viewportHeight, pixelRatio}) =>
        [
          viewportWidth / pixelRatio,
          viewportHeight / pixelRatio
        ]
    },

    depth: {
      func: '<='
    },

    elements: regl.this('_lineElements')
  })

  Mesh.prototype = {
    draw ({mode, displacement, lineWidth, elements, lines}) {
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
          totalColor = 1 / this._maxDisplacement
          break
      }
      if (elements) {
        drawElements.call(this, {
          displacementColor,
          totalColor,
          stressColor,
          colorShift,
          displacementMag: displacement
        })
      }
      if (lines) {
        drawLines.call(this, {
          displacementMag: displacement,
          lineWidth
        })
      }
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
    let maxDisplacment = 0

    function V (p, d, s) {
      position.push(p[0], p[1], p[2])
      displacement.push(d[0], d[1], d[2])
      stress.push(s)
      let d2 = 0
      for (let i = 0; i < 3; ++i) {
        positionBounds[0][i] = Math.min(positionBounds[0][i], p[i])
        positionBounds[1][i] = Math.max(positionBounds[1][i], p[i])
        displacementBounds[0][i] = Math.min(displacementBounds[0][i], d[i])
        displacementBounds[1][i] = Math.max(displacementBounds[1][i], d[i])
        d2 += Math.pow(d[i], 2)
      }
      stressBounds[0] = Math.min(stressBounds[0], s)
      stressBounds[1] = Math.max(stressBounds[1], s)
      vertCount += 1
      maxDisplacment = Math.max(maxDisplacment, Math.sqrt(d2))
    }

    const lineP0 = []
    const lineD0 = []
    const lineP1 = []
    const lineD1 = []
    const lineN = []
    const lineV = []

    const lineVertHash = {}
    function LV (p0, d0, p1, d1, n) {
      const k = (p0[0] * P_TOL) + ',' + (p0[1] * P_TOL) + ',' + (p0[2] * P_TOL)
      const bucket = lineVertHash[k] || (lineVertHash[k] = [])

      for (let i = 0; i < bucket.length; ++i) {
        const x = bucket[i]
        if (lineN[x] !== n ||
          cmpD(d0, lineD0[x]) ||
          cmpD(d1, lineD1[x]) ||
          cmpP(p1, lineP1[x])) {
          break
        }
      }

      const c = lineP0.length
      bucket.push(c)
      lineV.push(c)
      lineP0.push(p0)
      lineD0.push(d0)
      lineP1.push(p1)
      lineD1.push(d1)
      lineN.push(n)
    }

    function E (p0, d0, p1, d1) {
      LV(p0, d0, p1, d1, 1)
      LV(p0, d0, p1, d1, -1)
      LV(p1, d1, p0, d0, 1)
      LV(p1, d1, p0, d0, -1)
      LV(p0, d0, p1, d1, 1)
      LV(p1, d1, p0, d0, 1)
    }

    function W6 (a, b) {
      const c = 1 - a - b
      return [
        a * (2 * a - 1),
        4 * a * b,
        b * (2 * b - 1),
        4 * b * c,
        c * (2 * c - 1),
        4 * c * a
      ]
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
            const W = W6(a, b)
            V(dot3(P, W), dot3(D, W), S)
          }
        }
      }

      for (let s = 0; s < 3; ++s) {
        let P1 = null
        let D1 = null
        for (let i = 0; i <= N; ++i) {
          const W =
            (s === 0) ? W6(i / N, 0)
            : (s === 1) ? W6(0, i / N)
                        : W6(i / N, 1 - i / N)
          const P2 = dot3(P, W)
          const D2 = dot3(D, W)

          if (P1) {
            E(P1, D1, P2, D2)
          }
          P1 = P2
          D1 = D2
        }
      }
    }

    function W8 (a, b) {
      return [
        0.25 * (1 - a) * (b - 1) * (a + b + 1),
        0.5 * (1 - b) * (1 - a * a),
        0.25 * (1 + a) * (b - 1) * (b - a + 1),
        0.5 * (1 + a) * (1 - b * b),
        0.25 * (1 + a) * (1 + b) * (a + b - 1),
        0.5 * (1 + b) * (1 - a * a),
        0.25 * (a - 1) * (b + 1) * (a - b + 1),
        0.5 * (1 - a) * (1 - b * b)
      ]
    }

    function P8 (S, cell) {
      const P = pick(coordinates, cell)
      const D = pick(displacements, cell)

      for (let i = 0; i < N; ++i) {
        for (let j = 0; j < N; ++j) {
          for (let v = 0; v < QUAD_TRIS.length; ++v) {
            const a = 2 * (i + QUAD_TRIS[v][0]) / N - 1
            const b = 2 * (j + QUAD_TRIS[v][1]) / N - 1
            const W = W8(a, b)
            V(dot3(P, W), dot3(D, W), S)
          }
        }
      }

      let curCorner = 0
      for (let d = 0; d < 2; ++d) {
        for (let s = 0; s <= 1; ++s, ++curCorner) {
          let P1 = null
          let D1 = null
          for (let i = 0; i <= N; ++i) {
            const ab = [0, 0]
            ab[d] = 2 * i / N - 1
            ab[d ^ 1] = 2 * s - 1
            const W = W8(ab[0], ab[1])
            const P2 = dot3(P, W)
            const D2 = dot3(D, W)

            if (P1) {
              E(P1, D1, P2, D2)
            }
            P1 = P2
            D1 = D2
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
      maxDisplacment,
      regl.buffer(stress),
      stressBounds,
      regl.texture({
        data: palette.map(([r, g, b]) => [
          255 * Math.pow(r, 2.2),
          255 * Math.pow(g, 2.2),
          255 * Math.pow(b, 2.2)
        ]),
        shape: [palette.length, 1, 3]
      }),
      vertCount,
      regl.buffer(lineP0),
      regl.buffer(lineD0),
      regl.buffer(lineP1),
      regl.buffer(lineD1),
      regl.buffer(lineN),
      regl.elements(convertLineVerts(lineV)))
  }

  return createMesh
}
