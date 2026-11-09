"""Wait-time skyline: Chicago's 77 community areas raised by how long their 311 requests wait.

Height and color both come from the app's wait index (1.0 = city average for the same requests):
gold = faster than average, deep rose = slower, matching the app's map and grades.

Data first:  node blender/export.js
Run headless (Store install: use blender-launcher):
    blender -b -P skyline.py               still, Cycles     -> skyline.png
    blender -b -P skyline.py -- preview    quick EEVEE still -> skyline_preview.png
    blender -b -P skyline.py -- anim       10 s seamless turntable loop -> skyline_loop.mp4
All save skyline.blend (open it in Blender to tweak).
"""
import json
import math
import os
import sys

import bmesh
import bpy

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MODE = args[0] if args else "still"
W, H = 1920, 1080
LOOP = 300                      # frames in the turntable (10 s at 30 fps)
HERE = os.path.dirname(os.path.abspath(__file__))
SCALE_KM = 7                    # km of height per 1.0 of wait index above the floor
FLOOR = 0.65                    # index that maps to zero height (fastest area is 0.74)

# Centered on the city average so both ends stand out: gold (faster) <- olive (average) -> rose (slower).
RAMP = [(0.00, "#f3db91"), (0.42, "#8f8a4e"), (1.00, "#c27a68")]
RAMP_LO, RAMP_HI = 0.75, 1.35   # fixed, so 1.0 always lands on olive whatever the data


def linear(hexcol):
    """Blender colors are linear, so convert sRGB hex before using it."""
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    h = hexcol.lstrip("#")
    return (ch(int(h[0:2], 16)), ch(int(h[2:4], 16)), ch(int(h[4:6], 16)), 1.0)


def ramp(t):
    t = min(max(t, 0.0), 1.0)
    for (t0, c0), (t1, c1) in zip(RAMP, RAMP[1:]):
        if t <= t1:
            a, b, f = linear(c0), linear(c1), (t - t0) / (t1 - t0)
            return tuple(x + (y - x) * f for x, y in zip(a, b))
    return linear(RAMP[-1][1])


def material(name, color, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = color
    p.inputs["Roughness"].default_value = 0.55
    if emit:
        p.inputs["Emission Color"].default_value = color
        p.inputs["Emission Strength"].default_value = emit
    return m


def prism(name, rings, height):
    """Flat outline(s) extruded straight up."""
    bm = bmesh.new()
    for ring in rings:
        pts = [p for i, p in enumerate(ring) if p != ring[i - 1]]   # drop repeated points
        if len(pts) < 3:
            continue
        try:
            face = bm.faces.new([bm.verts.new((x, y, 0.0)) for x, y in pts])
        except ValueError:
            continue
        if face.normal.z < 0:
            face.normal_flip()
    top = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    bmesh.ops.translate(bm, verts=[g for g in top["geom"] if isinstance(g, bmesh.types.BMVert)], vec=(0, 0, height))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])   # inward-facing walls render as dark streaks
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
data = json.load(open(os.path.join(HERE, "skyline-data.json")))
areas = [a for a in data["areas"] if a["index"] is not None]

for a in areas:
    h = 0.15 + max(a["index"] - FLOOR, 0) * SCALE_KM
    obj = prism(a["name"].title(), a["rings"], h)
    obj.data.materials.append(material(a["name"], ramp((a["index"] - RAMP_LO) / (RAMP_HI - RAMP_LO))))
    a["height"] = h

# Ground the same green as the sky and far bigger than the view, so there is no visible edge.
bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, -0.01))
bpy.context.active_object.data.materials.append(material("Ground", linear("#152b12")))

# Camera on a spinning rig aimed at the city center.
center = (-4.5, -0.5, 1.5)
rig = bpy.data.objects.new("Rig", None)
rig.location = center
bpy.context.collection.objects.link(rig)
cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
cam.data.lens = 35
cam.parent = rig
cam.location = (0, -40, 46)
bpy.context.collection.objects.link(cam)
look = cam.constraints.new("TRACK_TO")
look.target, look.track_axis, look.up_axis = rig, "TRACK_NEGATIVE_Z", "UP_Y"
scene.camera = cam
rig.rotation_euler.z = math.radians(-15)        # still: view from the south, a little west

# Labels on the two slowest areas and the fastest: all float above the tallest tower so none hide
# behind a neighbor, with a thin pin down to their area. They always face the camera.
by_wait = sorted(areas, key=lambda a: a["index"])
label_mat = material("Label", linear("#f7f2e4"), emit=1.5)
label_z = max(a["height"] for a in areas) + 2.0
for a in (by_wait[-1], by_wait[-2], by_wait[0]):
    ring = max(a["rings"], key=len)
    cx, cy = sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
    pin_len = label_z - 0.3 - a["height"]
    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=pin_len, location=(cx, cy, a["height"] + pin_len / 2))
    bpy.context.active_object.data.materials.append(label_mat)
    curve = bpy.data.curves.new(a["name"] + " label", "FONT")
    curve.body = f"{a['name'].title()}  {a['index']:.2f}x"
    curve.size, curve.align_x, curve.extrude = 1.1, "CENTER", 0.02
    label = bpy.data.objects.new(curve.name, curve)
    label.location = (cx, cy, label_z)
    label.data.materials.append(label_mat)
    bpy.context.collection.objects.link(label)
    face = label.constraints.new("TRACK_TO")
    face.target, face.track_axis, face.up_axis = cam, "TRACK_Z", "UP_Y"

# Low warm sun for long readable shadows, plus soft fill from the forest-green sky.
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy, sun.data.angle = 3.2, math.radians(4)
sun.data.color = linear("#fff2d6")[:3]
sun.rotation_euler = (math.radians(52), 0, math.radians(-40))
bpy.context.collection.objects.link(sun)
world = bpy.data.worlds.new("Forest")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = linear("#152b12")
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.2
scene.world = world

scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.resolution_percentage = 50 if MODE == "preview" else 100
scene.view_settings.view_transform = "Standard"   # keep palette colors exact (AgX/Filmic would wash them)
engines = bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys()
eevee = next(e for e in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT") if e in engines)

if MODE == "anim":
    scene.render.engine = eevee
    scene.frame_start, scene.frame_end = 1, LOOP
    scene.render.fps = 30
    drv = rig.driver_add("rotation_euler", 2).driver
    drv.type = "SCRIPTED"
    drv.expression = f"-0.4887 + (frame-1)/{LOOP}*2*pi"   # one full turn, starting at the still's angle
    img = scene.render.image_settings
    if hasattr(img, "media_type"):              # Blender 5.x splits image vs video output
        img.media_type = "VIDEO"
    img.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"          # 1080p plays everywhere, including venue TVs
    scene.render.ffmpeg.constant_rate_factor = "HIGH"
    scene.render.filepath = os.path.join(HERE, "skyline_loop.mp4")
elif MODE == "preview":
    scene.render.engine = eevee
    scene.render.filepath = os.path.join(HERE, "skyline_preview.png")
else:
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.render.filepath = os.path.join(HERE, "skyline.png")

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "skyline.blend"))
bpy.ops.render.render(animation=MODE == "anim", write_still=MODE != "anim")
print("rendered", scene.render.filepath)
