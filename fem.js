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
    count,
    lineP0,
    lineD0,
    lineP1,
    lineD1,
    lineN,
    lineCount) {
    this._position = position
    this._positionBounds = positionBounds
    this._displacement = displacement
    this._displacementBounds = displacementBounds
    this._stress = stress
    this._stressBounds = stressBounds
    this._palette = palette
    this._count = count
    this._lineP0 = lineP0
    this._lineD0 = lineD0
    this._lineP1 = lineP1
    this._lineD1 = lineD1
    this._lineN = lineN
    this._lineCount = lineCount

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

  const drawLines = regl({
    vert: `
    precision highp float;

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

    count: regl.this('_lineCount')
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
          for (let d = 0; d < 3; ++d) {
            totalColor += Math.max(
              Math.abs(displacementBounds[0][d]),
              Math.abs(displacementBounds[1][d]))
          }
          totalColor = 1 / totalColor
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

    function V (p, d, s) {
      position.push(p[0], p[1], p[2])
      displacement.push(d[0], d[1], d[2])
      stress.push(s)
      for (let i = 0; i < 3; ++i) {
        positionBounds[0][i] = Math.min(positionBounds[0][i], p[i])
        positionBounds[1][i] = Math.max(positionBounds[1][i], p[i])
        displacementBounds[0][i] = Math.min(displacementBounds[0][i], d[i])
        displacementBounds[1][i] = Math.max(displacementBounds[1][i], d[i])
      }
      stressBounds[0] = Math.min(stressBounds[0], s)
      stressBounds[1] = Math.max(stressBounds[1], s)
      vertCount += 1
    }

    const lineP0 = []
    const lineD0 = []
    const lineP1 = []
    const lineD1 = []
    const lineN = []
    let lineCount = 0

    function E (p0, d0, p1, d1) {
      lineP0.push(
        p0, p0, p1,
        p1, p0, p1)
      lineD0.push(
        d0, d0, d1,
        d1, d0, d1)
      lineP1.push(
        p1, p1, p0,
        p0, p1, p0)
      lineD1.push(
        d1, d1, d0,
        d0, d1, d0)
      lineN.push(
        1, -1, 1,
        -1, 1, 1)
      lineCount += 6
    }

    function C (
      pa0, da0, pa1, da1,
      pb0, db0, pb1, db1) {
      lineP0.push(
        pa1, pa1, pb0,
        pb0, pa1, pb0)
      lineD0.push(
        da1, da1, db0,
        db0, da1, db0)
      lineP1.push(
        pa0, pa0, pb1,
        pb1, pa0, pb1)
      lineD1.push(
        da0, da0, db1,
        db1, da0, db1)
      lineN.push(
        1, -1, 1,
        -1, 1, 1)
      lineCount += 6
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

      const corners = [[], [], []]

      for (let s = 0; s < 3; ++s) {
        let P0 = null
        let D0 = null
        let P1 = null
        let D1 = null
        for (let i = 0; i <= N; ++i) {
          const W =
            (s === 0) ? W6(i / N, 0)
            : (s === 1) ? W6(0, i / N)
                        : W6(i / N, 1 - i / N)
          const P2 = dot3(P, W)
          const D2 = dot3(D, W)

          if (i <= 1 || i === N - 1) {
            corners[s].push([P2, D2])
          }

          if (P0) {
            C(P0, D0, P1, D1,
              P1, D1, P2, D2)
          }
          P0 = P1
          D0 = D1

          if (P1) {
            E(P1, D1, P2, D2)
          }
          P1 = P2
          D1 = D2
        }
      }

      for (let d = 0; d < 3; ++d) {
        const u = (d + 2) % 3
        C(
          corners[u][2][0], corners[u][2][1],
          corners[d][0][0], corners[d][0][1],
          corners[d][0][0], corners[d][0][1],
          corners[d][1][0], corners[d][1][1])
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

      const corners = [[], [], [], []]

      let curCorner = 0
      for (let d = 0; d < 2; ++d) {
        for (let s = 0; s <= 1; ++s, ++curCorner) {
          let P0 = null
          let D0 = null
          let P1 = null
          let D1 = null
          for (let i = 0; i <= N; ++i) {
            const ab = [0, 0]
            ab[d] = 2 * i / N - 1
            ab[d ^ 1] = 2 * s - 1
            const W = W8(ab[0], ab[1])
            const P2 = dot3(P, W)
            const D2 = dot3(D, W)

            if (i <= 1 || i === N - 1) {
              corners[curCorner].push([P2, D2])
            }

            if (P0) {
              C(P0, D0, P1, D1,
                P1, D1, P2, D2)
            }
            P0 = P1
            D0 = D1

            if (P1) {
              E(P1, D1, P2, D2)
            }
            P1 = P2
            D1 = D2
          }
        }
      }

      for (let d = 0; d < 4; ++d) {
        const u = (d + 3) % 4
        C(
          corners[u][2][0], corners[u][2][1],
          corners[d][0][0], corners[d][0][1],
          corners[d][0][0], corners[d][0][1],
          corners[d][1][0], corners[d][1][1])
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
      vertCount,
      regl.buffer(lineP0),
      regl.buffer(lineD0),
      regl.buffer(lineP1),
      regl.buffer(lineD1),
      regl.buffer(lineN),
      lineCount)
  }

  return createMesh
}
