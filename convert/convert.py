import re
import colorsys
import json

coordPattern = re.compile(r'\s+I\s+(\d+)\s+X\s+(\S+)\s+Y\s+(\S+)\s+Z\s+(\S+)')
def parseCoordinates(coordData):
    coords = {}
    for parts in re.findall(coordPattern, coordData):
        coords[int(parts[0])] = tuple([float(x) for x in parts[1:]])
    return coords

stressPattern = re.compile(r'\|\s+(\d+)\s+\|\s+(\S+)\s+\|')
def parseStresses(stressData):
    stresses = {}
    for parts in re.findall(stressPattern, stressData):
        stresses[int(parts[0])] = float(parts[1])
    return stresses

displacementPattern = re.compile(r'\|\s+(\d+)\s+\|\s+(\S+)\s+(\S+)\s+(\S+)\s+\|')
def parseDisplacements(displacementData):
    displacements = {}
    for parts in re.findall(displacementPattern, displacementData):
        displacements[int(parts[0])] = tuple([float(x) for x in parts[1:]])
    return displacements

triPattern = re.compile(r'I\s+(\d+)\s+AT\s+\d+\s+\d+\s+N\s+(\d+)\s+-(\d+)\s+(\d+)\s+-(\d+)\s+(\d+)\s+-(\d+)')
def parseTriangles(triangleData):
    triangles = {}
    for parts in re.findall(triPattern, triangleData):
        triangles[int(parts[0])] = tuple([int(x) for x in parts[1:]])
    return triangles

quadPattern = re.compile(r'I\s+(\d+)\s+AT\s+\d+\s+\d+\s+N\s+(\d+)\s+-(\d+)\s+(\d+)\s+-(\d+)\s+(\d+)\s+-(\d+)\s+(\d+)\s+-(\d+)')
def parseQuads(quadData):
    quads = {}
    for parts in re.findall(quadPattern, quadData):
        quads[int(parts[0])] = tuple([int(x) for x in parts[1:]])
    return quads

palPattern = re.compile(r'palette\s+hls\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)')
def parsePalette(palData):
    return [ colorsys.hls_to_rgb(float(h) / 360.0, float(l) / 100.0, float(s) / 100.0) for (_, h, l, s) in re.findall(palPattern, palData)]

def parseMesh(data):
    coordinates_ = parseCoordinates(data['coordinates'])
    displacements_ = parseDisplacements(data['displacements'])
    triangles_ = parseTriangles(data['triangles'])
    quads_ = parseQuads(data['quads'])
    stresses_ = parseStresses(data['stresses'])
    palette_ = parsePalette(data['palette'])

    coordinatesPacked = []
    displacementsPacked = []
    index_ = {}
    def index (n):
        if n in index_:
            return index_[n]
        count = len(coordinatesPacked)
        coordinatesPacked.append(coordinates_[n])
        displacementsPacked.append(displacements_[n])
        index_[n] = count
        return count

    def cell (verts):
        return tuple([index(n) for n in verts])

    quadStresses = []
    quadsPacked = []
    for I in quads_:
        quadStresses.append(stresses_[I])
        quadsPacked.append(cell(quads_[I]))

    triStresses = []
    trisPacked = []
    for I in triangles_:
        triStresses.append(stresses_[I])
        trisPacked.append(cell(triangles_[I]))

    palette_.reverse()
    return {
        'palette': palette_,
        'coordinates': coordinatesPacked,
        'displacements': displacementsPacked,
        'elements': [
            {
                'type': 'P8',
                'stresses': quadStresses,
                'cells': quadsPacked
            },
            {
                'type': 'P6',
                'stresses': triStresses,
                'cells': trisPacked
            }
        ]
    }

def convertMesh(data):
    return json.dumps(parseMesh(data), sort_keys=True)
