module.exports = function ({ canvas, onPan, onZoom, onRotate }) {
  let prevX = 0
  let prevY = 0

  canvas.addEventListener('mousemove', ({clientX, clientY, buttons, which}) => {
    if ((buttons | which | 0) & 1) {
      onRotate(
        (clientX - prevX) / window.innerWidth,
        (prevY - clientY) / window.innerHeight)
      prevX = clientX
      prevY = clientY
    }
  })

  canvas.addEventListener('mousedown', ({clientX, clientY, buttons, which}) => {
    if ((buttons | which | 0) & 1) {
      prevX = clientX
      prevY = clientY
    }
  })

  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault()
    let s = ev.deltaY || 0
    switch (ev.deltaMode) {
      case 1:
        s *= 16
        break
      case 2:
        s *= window.innerHeight
        break
    }
    onZoom(s / window.innerHeight)
  })

  // TODO handle touch events
}
