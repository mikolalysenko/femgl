const mat4 = require('gl-mat4')

module.exports = function ({regl}) {
  const projection = mat4.create()
  const invProjection = mat4.create()
  const view = mat4.create()
  const invView = mat4.create()

  const setup = regl({
    context: {
      projection: () => projection,
      invProjection: () => invProjection,
      view: () => view,
      invView: () => invView,
      eye: regl.prop('eye')
    },

    uniforms: {
      projection: regl.context('projection'),
      invProjection: regl.context('invProjection'),
      view: regl.context('view'),
      invView: regl.context('invView'),
      eye: regl.context('eye')
    }
  })

  function clamp (x, lo, hi) {
    return Math.max(lo, Math.min(x, hi))
  }

  function integrate (state) {
    for (let i = 0; i < 3; ++i) {
      state.polar[i] += 0.8 * state.dpolar[i]
      state.dpolar[i] *= 0.8
    }

    state.polar[1] = clamp(state.polar[1], -0.25 * Math.PI, 0.25 * Math.PI)
    state.polar[2] = clamp(state.polar[2], -5, 10)

    const [ theta, phi, logRadius ] = state.polar
    const radius = Math.exp(logRadius)

    state.eye[0] = radius * Math.cos(theta) * Math.cos(phi) + state.center[0]
    state.eye[1] = radius * Math.sin(phi) + state.center[1]
    state.eye[2] = radius * Math.sin(theta) * Math.cos(phi) + state.center[2]
  }

  return {
    integrate,
    setup: function ({eye, center, up}, body) {
      regl.draw(({viewportWidth, viewportHeight, tick}) => {
        mat4.perspective(projection,
          Math.PI / 4.0,
          viewportWidth / viewportHeight,
          0.125,
          65536.0)
        mat4.lookAt(
          view,
          eye,
          center,
          up)
        mat4.invert(invProjection, projection)
        mat4.invert(invView, view)
        setup({
          eye
        }, body)
      })
    }
  }
}
