import convert

open('mesh.json', 'w').write(convert.convertMesh({
    'coordinates': open('data/coordinates.dat').read(),
    'displacements': open('data/displacements.dat').read(),
    'triangles': open('data/triangles.dat').read(),
    'quads': open('data/quadrangles.dat').read(),
    'stresses': open('data/stresses.dat').read(),
    'palette': open('data/pale.dat').read()
}))
