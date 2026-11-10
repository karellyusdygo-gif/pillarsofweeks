# Pillars of Weeks - Blender posing script
# Rigs assets/Mannequin.stl (T-pose, Z up, faces -Y, 1 unit tall) with an armature,
# skins it with automatic weights, poses it in the expressions of Wat Rong Khun's
# "hands of hell" (reaching, clawing, pleading, despairing, drowning in the ground),
# and exports every pose as a decimated STL into assets/poses/ plus poses.json.
#
# Run:  Blender -b --python assets/poses/pose_mannequin.py -- <A2B folder>
import bpy, bmesh, sys, os, json, math
from mathutils import Vector, Matrix

ROOT = sys.argv[-1]
SRC = os.path.join(ROOT, 'assets', 'Mannequin.stl')
OUT = os.path.join(ROOT, 'assets', 'poses')
TARGET_TRIS = 1500

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=SRC)
body = bpy.context.selected_objects[0]
body.name = 'Mannequin'
bpy.context.view_layer.objects.active = body
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.shade_smooth()

# ---------- skeleton (rest = the STL's T-pose) ----------
BONES = [  # name, head, tail, parent, connected
    ('hips',  (0, 0.005, 0.47), (0, 0.005, 0.58), None, False),
    ('spine', (0, 0.005, 0.58), (0, 0.005, 0.69), 'hips', True),
    ('chest', (0, 0.005, 0.69), (0, 0.005, 0.83), 'spine', True),
    ('neck',  (0, 0.005, 0.83), (0, -0.003, 0.885), 'chest', True),
    ('head',  (0, -0.003, 0.885), (0, -0.003, 1.0), 'neck', True),
]
for s, sx in (('R', 1), ('L', -1)):
    BONES += [
        (f'clav.{s}',  (0.02 * sx, 0.012, 0.80), (0.125 * sx, 0.015, 0.80), 'chest', False),
        (f'upper.{s}', (0.125 * sx, 0.015, 0.80), (0.24 * sx, 0.015, 0.80), f'clav.{s}', True),
        (f'fore.{s}',  (0.24 * sx, 0.015, 0.80), (0.338 * sx, 0.012, 0.798), f'upper.{s}', True),
        (f'hand.{s}',  (0.338 * sx, 0.012, 0.798), (0.437 * sx, 0.0, 0.794), f'fore.{s}', True),
        (f'thigh.{s}', (0.045 * sx, 0.005, 0.47), (0.04 * sx, 0.01, 0.30), 'hips', False),
        (f'shin.{s}',  (0.04 * sx, 0.01, 0.30), (0.035 * sx, 0.02, 0.07), f'thigh.{s}', True),
        (f'foot.{s}',  (0.035 * sx, 0.02, 0.07), (0.035 * sx, -0.065, 0.01), f'shin.{s}', True),
    ]

arm_data = bpy.data.armatures.new('Rig')
rig = bpy.data.objects.new('Rig', arm_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
for name, h, t, parent, conn in BONES:
    eb = arm_data.edit_bones.new(name)
    eb.head, eb.tail = Vector(h), Vector(t)
    if parent:
        eb.parent = arm_data.edit_bones[parent]
        eb.use_connect = conn
bpy.ops.object.mode_set(mode='OBJECT')

# automatic (bone heat) weights
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
unweighted = sum(1 for v in body.data.vertices if not any(g.weight > 1e-4 for g in v.groups))
print('unweighted vertices:', unweighted)

# ---------- posing by bone directions (body space: x side, -y front, z up) ----------
ORDER = [b[0] for b in BONES]
PARENT = {b[0]: b[3] for b in BONES}

def V(x, y, z):
    return Vector((x, y, z)).normalized()

def apply_pose(dirs):
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    delta = {}
    for name in ORDER:
        pb, b = rig.pose.bones[name], rig.data.bones[name]
        rest = b.matrix_local
        par = PARENT[name]
        D = delta[par] if par else Matrix.Identity(4)
        head = D @ b.head_local
        if name in dirs:
            rdir = (b.tail_local - b.head_local).normalized()
            R = rdir.rotation_difference(dirs[name]).to_matrix().to_4x4()
        else:
            R = D.to_quaternion().to_matrix().to_4x4()
        M = Matrix.Translation(head) @ R @ rest.to_quaternion().to_matrix().to_4x4()
        pb.matrix = M
        bpy.context.view_layer.update()
        delta[name] = pb.matrix @ rest.inverted()
    bpy.ops.object.mode_set(mode='OBJECT')
    return delta

def sym(d, bone, v):
    d[bone + '.R'] = V(*v)
    d[bone + '.L'] = V(-v[0], v[1], v[2])

def side(d, bone, s, v):
    d[f'{bone}.{s}'] = V(*v)

STAND = {}
for s, sx in (('R', 1), ('L', -1)):
    side(STAND, 'thigh', s, (0.02 * sx, 0.02, -1)); side(STAND, 'shin', s, (0.02 * sx, 0.04, -1))

def P(**kw):
    d = dict(kw.pop('base', {}))
    for k, v in kw.items(): d[k.replace('_', '.')] = V(*v)
    return d

POSES = {}
# 1 both arms straining straight up, head thrown back
d = dict(STAND); d.update(P(spine=(0, 0.08, 1), chest=(0, 0.15, 1), neck=(0, 0.35, 1), head=(0, 0.6, 1)))
sym(d, 'clav', (1, 0, 0.35)); sym(d, 'upper', (0.22, -0.12, 1)); sym(d, 'fore', (0.12, -0.08, 1)); sym(d, 'hand', (0.06, -0.25, 1))
POSES['reachUp'] = d
# 2 one arm high, the other stretched forward, body leaning toward the high hand
d = dict(STAND); d.update(P(spine=(0.08, 0.05, 1), chest=(0.15, 0.1, 1), neck=(0.2, 0.3, 1), head=(0.25, 0.55, 1)))
side(d, 'clav', 'R', (1, 0, 0.45)); side(d, 'upper', 'R', (0.25, -0.1, 1)); side(d, 'fore', 'R', (0.12, -0.05, 1)); side(d, 'hand', 'R', (0.05, -0.2, 1))
side(d, 'upper', 'L', (-0.35, -0.85, 0.45)); side(d, 'fore', 'L', (-0.15, -0.8, 0.6)); side(d, 'hand', 'L', (-0.1, -0.6, 0.8))
side(d, 'thigh', 'L', (-0.05, -0.1, -1)); side(d, 'shin', 'L', (-0.03, 0.35, -1))
POSES['reachOne'] = d
# 3 clawing upward, elbows out, hands bent back, head wrenched back
d = dict(STAND); d.update(P(spine=(0, 0.12, 1), chest=(0, 0.25, 1), neck=(0, 0.6, 0.9), head=(0, 0.9, 0.55)))
sym(d, 'clav', (1, 0, 0.45)); sym(d, 'upper', (0.85, -0.15, 0.6)); sym(d, 'fore', (0.15, -0.3, 1)); sym(d, 'hand', (-0.1, -0.75, 0.7))
side(d, 'thigh', 'R', (0.1, -0.45, -0.9)); side(d, 'shin', 'R', (0.04, 0.3, -1))
POSES['clawUp'] = d
# 4 writhing: torso bent sideways and back, one arm flung up, the other shielding the face
d = dict(STAND); d.update(P(spine=(0.15, 0.12, 1), chest=(0.32, 0.25, 1), neck=(0.42, 0.45, 0.85), head=(0.45, 0.7, 0.6)))
side(d, 'upper', 'R', (0.7, 0.35, 0.75)); side(d, 'fore', 'R', (0.25, 0.55, 0.85)); side(d, 'hand', 'R', (0.1, 0.5, 1))
side(d, 'upper', 'L', (-0.35, -0.85, 0.3)); side(d, 'fore', 'L', (0.55, -0.45, 0.75)); side(d, 'hand', 'L', (0.6, -0.3, 0.7))
side(d, 'thigh', 'L', (-0.12, -0.35, -1)); side(d, 'shin', 'L', (0, 0.4, -1))
POSES['writhe'] = d
# 5 kneeling, pleading upward with both hands
d = P(spine=(0, -0.05, 1), chest=(0, -0.05, 1), neck=(0, 0.2, 1), head=(0, 0.45, 1))
sym(d, 'thigh', (0.12, -0.15, -1)); sym(d, 'shin', (0.0, 1, -0.02)); sym(d, 'foot', (0, 1, -0.35))
sym(d, 'clav', (1, 0, 0.3)); sym(d, 'upper', (0.25, -0.8, 0.55)); sym(d, 'fore', (0.08, -0.55, 1)); sym(d, 'hand', (0.0, -0.4, 1))
POSES['kneelPlead'] = d
# 6 despair: sitting on the heels, folded forward, hands clutching the head
d = P(hips=(0, -0.35, 1), spine=(0, -0.7, 0.75), chest=(0, -0.9, 0.5), neck=(0, -1, 0.25), head=(0, -1, -0.15))
sym(d, 'thigh', (0.18, -1, -0.32)); sym(d, 'shin', (0.0, 1, -0.05)); sym(d, 'foot', (0, 1, -0.35))
sym(d, 'upper', (0.35, -0.75, 0.45)); sym(d, 'fore', (-0.55, -0.7, 0.35)); sym(d, 'hand', (-0.8, -0.3, -0.3))
POSES['despair'] = d
# 7 cowering crouch, arms wrapped over the head
d = P(hips=(0, -0.3, 1), spine=(0, -0.55, 0.85), chest=(0, -0.75, 0.65), neck=(0, -0.85, 0.4), head=(0, -0.95, 0.1))
sym(d, 'thigh', (0.25, -1, -0.12)); sym(d, 'shin', (0.06, 0.35, -1)); sym(d, 'foot', (0.05, -1, -0.4))
sym(d, 'upper', (0.4, -0.55, 0.75)); sym(d, 'fore', (-0.85, -0.2, 0.45)); sym(d, 'hand', (-0.8, 0.2, -0.2))
POSES['cower'] = d
# 8 sitting on the ground, knees up, reaching up
d = P(hips=(0, 0.25, 1), spine=(0, 0.15, 1), chest=(0, 0.1, 1), neck=(0, 0.3, 1), head=(0, 0.55, 1))
sym(d, 'thigh', (0.18, -1, 0.42)); sym(d, 'shin', (0.02, -0.35, -1)); sym(d, 'foot', (0, -1, -0.2))
sym(d, 'clav', (1, 0, 0.35)); sym(d, 'upper', (0.3, -0.45, 1)); sym(d, 'fore', (0.12, -0.3, 1)); sym(d, 'hand', (0.05, -0.35, 1))
POSES['sitReach'] = d
# 9 sitting on an edge, legs dangling, one hand on the edge, one reaching
d = P(hips=(0, 0.05, 1), spine=(0, -0.05, 1), chest=(0, -0.1, 1), neck=(0, 0.05, 1), head=(0, 0.25, 1))
sym(d, 'thigh', (0.1, -1, -0.05)); side(d, 'shin', 'R', (0.02, 0.15, -1)); side(d, 'shin', 'L', (-0.02, -0.2, -1))
sym(d, 'foot', (0, -1, -0.6))
side(d, 'upper', 'L', (-0.3, 0.25, -1)); side(d, 'fore', 'L', (-0.08, 0.1, -1)); side(d, 'hand', 'L', (-0.05, -0.4, -1))
side(d, 'upper', 'R', (0.35, -0.6, 0.75)); side(d, 'fore', 'R', (0.15, -0.4, 1)); side(d, 'hand', 'R', (0.05, -0.4, 1))
POSES['dangle'] = d
# 10 climbing: one knee up, hands gripping above
d = dict(STAND); d.update(P(spine=(0, -0.05, 1), chest=(0, -0.08, 1), neck=(0, 0.15, 1), head=(0, 0.4, 1)))
side(d, 'upper', 'R', (0.3, -0.35, 1)); side(d, 'fore', 'R', (0.08, -0.3, 1)); side(d, 'hand', 'R', (0, -0.7, 0.7))
side(d, 'upper', 'L', (-0.6, -0.45, 0.6)); side(d, 'fore', 'L', (-0.2, -0.45, 1)); side(d, 'hand', 'L', (0, -0.7, 0.7))
side(d, 'thigh', 'R', (0.12, -0.85, -0.35)); side(d, 'shin', 'R', (0.03, 0.15, -1))
POSES['climb'] = d
# 11 hanging by both hands, legs limp
d = P(spine=(0, 0.03, 1), chest=(0, 0.05, 1), neck=(0, 0.25, 1), head=(0, 0.35, 1))
sym(d, 'clav', (1, 0, 0.5)); sym(d, 'upper', (0.12, -0.08, 1)); sym(d, 'fore', (0.04, -0.12, 1)); sym(d, 'hand', (0, -0.6, 0.8))
side(d, 'thigh', 'R', (0.06, -0.25, -1)); side(d, 'shin', 'R', (0.02, 0.35, -1))
side(d, 'thigh', 'L', (-0.04, 0.05, -1)); side(d, 'shin', 'L', (-0.02, 0.15, -1)); sym(d, 'foot', (0, -0.4, -1))
POSES['hang'] = d
# 12 crawling, one hand clawing forward and up
d = P(hips=(0, -1, 0.12), spine=(0, -1, 0.15), chest=(0, -1, 0.22), neck=(0, -1, 0.5), head=(0, -0.8, 0.8))
sym(d, 'thigh', (0.12, -0.05, -1)); sym(d, 'shin', (0.0, 1, -0.02)); sym(d, 'foot', (0, 1, -0.3))
side(d, 'upper', 'L', (-0.15, -0.25, -1)); side(d, 'fore', 'L', (-0.05, -0.1, -1)); side(d, 'hand', 'L', (0, -1, -0.2))
side(d, 'upper', 'R', (0.25, -1, 0.45)); side(d, 'fore', 'R', (0.12, -0.8, 0.8)); side(d, 'hand', 'R', (0, -0.6, 1))
POSES['crawl'] = d
# 13 drowning: head bowed, both arms thrust straight up (cut low, only the arms show)
d = dict(STAND); d.update(P(spine=(0, -0.05, 1), chest=(0, -0.12, 1), neck=(0, -0.4, 0.9), head=(0, -0.6, 0.75)))
sym(d, 'clav', (1, 0, 0.5)); sym(d, 'upper', (0.18, 0.05, 1)); sym(d, 'fore', (0.15, -0.1, 1)); sym(d, 'hand', (0.25, -0.3, 1))
POSES['drown'] = d
d = dict(POSES['drown'])
side(d, 'upper', 'L', (-0.2, -0.2, 1)); side(d, 'fore', 'L', (-0.1, -0.35, 1)); side(d, 'hand', 'L', (-0.05, -0.8, 0.6))
side(d, 'upper', 'R', (0.45, 0.3, 0.85)); side(d, 'fore', 'R', (0.3, 0.1, 1)); side(d, 'hand', 'R', (0.2, 0.4, 1))
POSES['drownWild'] = d


# ---------- war of life: fighting poses (singles and the halves of fighting pairs) ----------
# 15 punching forward, the other arm guarding
d = P(hips=(0, -0.1, 1), spine=(0.05, -0.2, 1), chest=(0.1, -0.3, 1), neck=(0.05, -0.2, 1), head=(0, -0.1, 1))
side(d, 'clav', 'R', (1, -0.25, 0.1)); side(d, 'upper', 'R', (0.05, -1, 0.12)); side(d, 'fore', 'R', (0, -1, 0.1)); side(d, 'hand', 'R', (0, -1, 0.05))
side(d, 'upper', 'L', (-0.2, -0.6, -0.75)); side(d, 'fore', 'L', (0.15, -0.45, 1)); side(d, 'hand', 'L', (0.1, -0.3, 1))
side(d, 'thigh', 'L', (-0.08, -0.45, -1)); side(d, 'shin', 'L', (0, 0.1, -1))
side(d, 'thigh', 'R', (0.08, 0.4, -1)); side(d, 'shin', 'R', (0, 0.35, -1)); side(d, 'foot', 'R', (0, -0.5, -1))
POSES['punch'] = d
# 16 recoiling from a blow, head snapped back, one arm shielding
d = P(hips=(0, 0.1, 1), spine=(0, 0.25, 1), chest=(0, 0.35, 1), neck=(0, 0.6, 0.85), head=(0, 0.85, 0.55))
side(d, 'upper', 'R', (0.4, -0.3, 0.85)); side(d, 'fore', 'R', (-0.2, -0.6, 0.7)); side(d, 'hand', 'R', (-0.25, -0.5, 0.6))
side(d, 'upper', 'L', (-0.85, 0.2, 0.3)); side(d, 'fore', 'L', (-0.6, 0.4, 0.6))
side(d, 'thigh', 'R', (0.05, 0.25, -1)); side(d, 'shin', 'R', (0, 0.3, -1))
side(d, 'thigh', 'L', (-0.05, -0.15, -1)); side(d, 'shin', 'L', (0, 0.1, -1))
POSES['recoil'] = d
# 17 shoving with both hands, leaning in, back leg driving
d = P(hips=(0, -0.15, 1), spine=(0, -0.3, 1), chest=(0, -0.35, 1), neck=(0, -0.3, 1), head=(0, -0.1, 1))
sym(d, 'clav', (1, -0.25, 0.1)); sym(d, 'upper', (0.15, -1, 0.1)); sym(d, 'fore', (0.05, -1, 0.15)); sym(d, 'hand', (0, -0.6, 0.8))
side(d, 'thigh', 'R', (0.05, -0.25, -1)); side(d, 'shin', 'R', (0, 0.05, -1))
side(d, 'thigh', 'L', (-0.05, 0.35, -1)); side(d, 'shin', 'L', (0, 0.45, -1)); side(d, 'foot', 'L', (0, -0.4, -1))
POSES['shove'] = d
# 18 staggering backward, arms flailing
d = P(hips=(0, 0.15, 1), spine=(0, 0.3, 1), chest=(0, 0.4, 1), neck=(0, 0.5, 1), head=(0, 0.6, 0.9))
side(d, 'upper', 'R', (0.8, 0.2, 0.6)); side(d, 'fore', 'R', (0.5, 0.4, 0.8))
side(d, 'upper', 'L', (-0.9, -0.1, 0.4)); side(d, 'fore', 'L', (-0.6, -0.5, 0.6))
side(d, 'thigh', 'R', (0.05, 0.3, -1)); side(d, 'shin', 'R', (0, 0.35, -1))
side(d, 'thigh', 'L', (-0.05, -0.2, -1)); side(d, 'shin', 'L', (0, 0.05, -1))
POSES['stagger'] = d
# 19 grappling: leaning in, one hand on the rival's shoulder, the other at his waist
d = P(hips=(0, -0.2, 1), spine=(0, -0.4, 1), chest=(0, -0.5, 1), neck=(0, -0.5, 0.9), head=(0, -0.35, 1))
side(d, 'upper', 'R', (0.25, -0.9, 0.45)); side(d, 'fore', 'R', (-0.15, -0.8, 0.3)); side(d, 'hand', 'R', (-0.2, -0.6, -0.2))
side(d, 'upper', 'L', (-0.2, -0.95, 0.1)); side(d, 'fore', 'L', (0.1, -0.7, -0.3)); side(d, 'hand', 'L', (0.1, -0.6, -0.5))
sym(d, 'thigh', (0.25, 0.15, -1)); sym(d, 'shin', (0.1, 0.2, -1))
POSES['grapple'] = d
# 20 on the knees, dragging someone down by the legs
d = P(hips=(0, -0.25, 1), spine=(0, -0.45, 1), chest=(0, -0.5, 1), neck=(0, -0.4, 1), head=(0, -0.2, 1))
sym(d, 'thigh', (0.12, -0.15, -1)); sym(d, 'shin', (0.0, 1, -0.02)); sym(d, 'foot', (0, 1, -0.35))
sym(d, 'upper', (0.2, -1, 0.15)); sym(d, 'fore', (-0.15, -1, 0.25)); sym(d, 'hand', (0, -0.8, 0.4))
POSES['dragDown'] = d
# 21 trampled flat (posed standing, then laid face down): arms clawing ahead, head lifted
d = P(neck=(0, 0.4, 1), head=(0, 0.75, 0.65))
sym(d, 'clav', (1, 0, 0.4)); sym(d, 'upper', (0.25, -0.15, 1)); sym(d, 'fore', (0.1, -0.25, 1)); sym(d, 'hand', (0, -0.6, 0.8))
sym(d, 'thigh', (0.05, 0, -1)); sym(d, 'shin', (0.03, 0.08, -1)); sym(d, 'foot', (0, -0.6, -0.8))
POSES['prone'] = d

# ---------- climbing the cards: chest, hands, knee and toes all pressed to the wall (-y) ----------
def wall(high_R, low_reach):
    d = P(hips=(0, -0.06, 1), spine=(0, -0.1, 1), chest=(0, -0.08, 1), neck=(0, 0.1, 1), head=(0, 0.35, 1))
    side(d, 'clav', 'R', (1, 0, 0.4)); side(d, 'upper', 'R', (0.28, -0.12, 1)); side(d, 'fore', 'R', (0.05, -0.1, 1)); side(d, 'hand', 'R', (0, -0.2, 1))
    if low_reach:
        side(d, 'clav', 'L', (-1, 0, 0.4)); side(d, 'upper', 'L', (-0.25, -0.12, 1)); side(d, 'fore', 'L', (-0.1, -0.1, 1)); side(d, 'hand', 'L', (0, -0.2, 1))
    else:
        side(d, 'upper', 'L', (-0.6, -0.15, 0.75)); side(d, 'fore', 'L', (-0.1, -0.15, 1)); side(d, 'hand', 'L', (0, -0.25, 1))
    # the raised knee turns out to the side so the foot can find a hold on the wall
    side(d, 'thigh', 'R', (0.6, -0.3, -0.6)); side(d, 'shin', 'R', (0.05, 0.04, -1)); side(d, 'foot', 'R', (0, -0.5, -1))
    side(d, 'thigh', 'L', (-0.04, 0.0, -1)); side(d, 'shin', 'L', (-0.02, 0.08, -1)); side(d, 'foot', 'L', (0, -0.85, -0.55))
    return d
POSES['wallClimb'] = wall(True, False)
POSES['wallReach'] = wall(True, True)
d = P(hips=(0, -0.02, 1), spine=(0, -0.03, 1), chest=(0, -0.02, 1), neck=(0, 0.15, 1), head=(0, 0.3, 1))
sym(d, 'clav', (1, 0, 0.5)); sym(d, 'upper', (0.18, -0.15, 1)); sym(d, 'fore', (0.04, -0.12, 1)); sym(d, 'hand', (0, -0.35, 0.95))
sym(d, 'thigh', (0.05, -0.12, -1)); sym(d, 'shin', (0.02, 0.08, -1)); sym(d, 'foot', (0, -0.8, -0.6))
POSES['wallHang'] = d

# ---------- the pit of bodies (after the reference scene): sprawled, climbing, falling ----------
# 26 lying on the back (posed standing, then laid face up): one arm reaching for the sky
d = P(neck=(0, -0.3, 1), head=(0, -0.6, 0.8))
side(d, 'upper', 'R', (0.15, -1, 0.2)); side(d, 'fore', 'R', (0.05, -1, 0.1)); side(d, 'hand', 'R', (0, -1, -0.1))
side(d, 'upper', 'L', (-1, -0.1, 0.2)); side(d, 'fore', 'L', (-0.8, -0.4, 0.4))
side(d, 'thigh', 'R', (0.1, -0.7, -0.7)); side(d, 'shin', 'R', (0.02, 0.45, -1))
side(d, 'thigh', 'L', (-0.08, -0.05, -1)); side(d, 'shin', 'L', (-0.02, 0.05, -1))
POSES['supine'] = d
# 27 clambering up a slope: leaning in, one hand planted, the other reaching on
d = P(hips=(0, -0.5, 1), spine=(0, -0.65, 1), chest=(0, -0.7, 1), neck=(0, -0.6, 1), head=(0, -0.3, 1))
side(d, 'upper', 'R', (0.2, -1, 0.6)); side(d, 'fore', 'R', (0.1, -1, 0.7)); side(d, 'hand', 'R', (0, -1, 0.4))
side(d, 'upper', 'L', (-0.2, -0.6, -1)); side(d, 'fore', 'L', (0, -0.3, -1)); side(d, 'hand', 'L', (0, -1, -0.3))
side(d, 'thigh', 'R', (0.1, -0.8, -0.5)); side(d, 'shin', 'R', (0, 0.3, -1))
side(d, 'thigh', 'L', (-0.05, 0.4, -1)); side(d, 'shin', 'L', (0, 0.7, -1)); side(d, 'foot', 'L', (0, -0.3, -1))
POSES['slopeClimb'] = d
# 28 toppling backward, both arms thrown up for something to hold
d = P(hips=(0, 0.35, 1), spine=(0, 0.5, 1), chest=(0, 0.6, 1), neck=(0, 0.7, 0.8), head=(0, 0.9, 0.5))
side(d, 'upper', 'R', (0.3, -0.6, 1)); side(d, 'fore', 'R', (0.15, -0.5, 1))
side(d, 'upper', 'L', (-0.5, -0.3, 1)); side(d, 'fore', 'L', (-0.3, -0.6, 1))
side(d, 'thigh', 'R', (0.03, -0.3, -1)); side(d, 'shin', 'R', (0, -0.05, -1))
side(d, 'thigh', 'L', (-0.1, -0.9, -0.45)); side(d, 'shin', 'L', (0, -0.5, -1))
POSES['fallBack'] = d
# 29 bent double, hands on the knees: someone else's step up
d = P(hips=(0, -0.55, 1), spine=(0, -0.95, 0.35), chest=(0, -1, 0.2), neck=(0, -1, 0.1), head=(0, -0.9, -0.3))
sym(d, 'upper', (0.15, -0.5, -1)); sym(d, 'fore', (0.02, -0.2, -1))
sym(d, 'thigh', (0.12, -0.35, -1)); sym(d, 'shin', (0.03, 0.3, -1))
POSES['bentBase'] = d

# ---------- baking ----------
from mathutils.bvhtree import BVHTree

def bake_raw(pose_name):
    apply_pose(POSES[pose_name])
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(body.evaluated_get(dg), depsgraph=dg)
    verts = [v.co.copy() for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    bpy.data.meshes.remove(me)
    return verts, faces

def xform(verts, M):
    return [M @ v for v in verts]

def ground(verts):
    z0 = min(v.z for v in verts)
    return [v - Vector((0, 0, z0)) for v in verts]

def overlaps(A, B):
    ta = BVHTree.FromPolygons(A[0], A[1]); tb = BVHTree.FromPolygons(B[0], B[1])
    return len(ta.overlap(tb)) > 0

def approach(A, B, direction, start, step=0.004, limit=600):
    # slide B from `start` along `direction` until it would touch A, then stop just short
    d = Vector(direction).normalized()
    pos = Vector(start)
    prev = None
    for _ in range(limit):
        cand = ([v + pos for v in B[0]], B[1])
        if overlaps(A, cand):
            return prev if prev else cand
        prev = cand
        pos = pos + d * step
    return prev

def merge(A, B):
    n = len(A[0])
    return (A[0] + B[0], A[1] + [tuple(i + n for i in f) for f in B[1]])

def single(name):
    v, f = bake_raw(name)
    return (ground(v), f)

def mirrored(mesh):
    v, f = mesh
    return ([Vector((-p.x, p.y, p.z)) for p in v], [tuple(reversed(t)) for t in f])

ROT180 = Matrix.Rotation(math.pi, 4, 'Z')

def pair_facing(a_name, b_name, b_rot=True, b_behind=False):
    A = single(a_name)
    Bv, Bf = single(b_name)
    if b_rot: Bv = xform(Bv, ROT180)
    if b_behind:   # B behind A's back (+y), sliding toward -y
        return merge(A, approach(A, (Bv, Bf), (0, -1, 0), (0, 1.0, 0)))
    return merge(A, approach(A, (Bv, Bf), (0, 1, 0), (0, -1.0, 0)))

def trample():
    v, f = bake_raw('prone')
    v = ground(xform(v, Matrix.Rotation(math.pi / 2, 4, 'X')))
    B = (v, f)
    # the body on top kneels on the lower back, reaching on up over him
    Av, Af = single('kneelPlead')
    knees = [p for p in Av if p.z < 0.06]
    kc = sum(knees, Vector()) / len(knees)
    hips = [p for p in v if p.z > 0.1]
    back_y = sorted(p.y for p in hips)[len(hips) // 2]
    A0 = ([p + Vector((-kc.x, back_y - kc.y - 0.05, 0)) for p in Av], Af)
    top = max(p.z for p in v)
    A = approach(B, A0, (0, 0, -1), (0, 0, top + 0.05), step=0.003)
    return merge(B, A)

def supine():
    v, f = bake_raw('supine')
    return (ground(xform(v, Matrix.Rotation(-math.pi / 2, 4, 'X'))), f)

def step_up():
    # one kneels on another's bent back, still reaching higher
    B = single('bentBase')
    top = max(p.z for p in B[0])
    back = [p for p in B[0] if p.z > top - 0.06]
    bc = sum(back, Vector()) / len(back)
    Av, Af = single('kneelPlead')
    knees = [p for p in Av if p.z < 0.06]
    kc = sum(knees, Vector()) / len(knees)
    A0 = ([p + Vector((bc.x - kc.x, bc.y - kc.y, 0)) for p in Av], Af)
    A = approach(B, A0, (0, 0, -1), (0, 0, top + 0.05), step=0.003)
    return merge(B, A)

def to_object(mesh, name):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in mesh[0]], [], mesh[1])
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob

def finish(ob, cut=None, target=TARGET_TRIS):
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    if cut is not None:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, cut), plane_no=(0, 0, 1), clear_inner=True)
        cutedges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        bmesh.ops.holes_fill(bm, edges=cutedges, sides=0)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
        for v in bm.verts: v.co.z -= cut
    bm.to_mesh(me); bm.free()
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    mod = ob.modifiers.new('dec', 'DECIMATE')
    mod.ratio = min(1.0, target / max(1, tris))
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier='dec')
    return ob

# what each export is: a single pose, a pose cut off by the ground, or a fighting pair
EXPORTS = [(n, ('single', n), None, TARGET_TRIS) for n in POSES if n not in ('prone', 'supine', 'bentBase')]
EXPORTS += [
    ('emergeWaist', ('single', 'reachUp'), 0.50, 1200), ('emergeChest', ('single', 'clawUp'), 0.66, 1200),
    ('emergeWrithe', ('single', 'writhe'), 0.55, 1200), ('emergeOne', ('single', 'reachOne'), 0.62, 1200),
    ('armsUp', ('single', 'drown'), 0.86, 1200), ('armsWild', ('single', 'drownWild'), 0.86, 1200),
    ('trampled', ('prone',), None, TARGET_TRIS),
    ('wallClimbL', ('mirror', 'wallClimb'), None, TARGET_TRIS),
    ('duoPunch', ('pair', 'punch', 'recoil', True, False), None, 2600),
    ('duoShove', ('pair', 'shove', 'stagger', True, False), None, 2600),
    ('duoGrapple', ('pair', 'grapple', 'grapple', True, False), None, 2600),
    ('duoPullDown', ('pair', 'reachUp', 'dragDown', False, True), None, 2600),
    ('duoTrample', ('trample',), None, 2600),
    ('sprawl', ('supine',), None, TARGET_TRIS),
    ('duoStepUp', ('stepup',), None, 2600),
]

def build(spec):
    kind = spec[0]
    if kind == 'single': return single(spec[1])
    if kind == 'mirror': return mirrored(single(spec[1]))
    if kind == 'pair': return pair_facing(*spec[1:])
    if kind == 'trample': return trample()
    if kind == 'supine': return supine()
    if kind == 'stepup': return step_up()
    if kind == 'prone':
        v, f = bake_raw('prone')
        return (ground(xform(v, Matrix.Rotation(math.pi / 2, 4, 'X'))), f)

meta = {}
for out_name, spec, cut, target in EXPORTS:
    ob = finish(to_object(build(spec), 'pose_' + out_name), cut, target)
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.wm.stl_export(filepath=os.path.join(OUT, out_name + '.stl'), export_selected_objects=True, ascii_format=False)
    zs = [v.co.z for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]
    bm = bmesh.new(); bm.from_mesh(ob.data)
    nonman = sum(1 for e in bm.edges if not e.is_manifold); bm.free()
    meta[out_name] = {'from': list(spec[1:]) or [spec[0]], 'cut': cut is not None, 'height': round(max(zs), 4),
                      'front': round(min(ys), 4), 'tris': len(ob.data.polygons), 'nonManifold': nonman}
    print(out_name, meta[out_name])
    ob.hide_render = True

with open(os.path.join(OUT, 'poses.json'), 'w') as f:
    json.dump(meta, f, indent=1)

# contact sheet: every export from a three-quarter view
scn = bpy.context.scene
names = [e[0] for e in EXPORTS]
cols = 9
for i, n in enumerate(names):
    ob = bpy.data.objects['pose_' + n]
    ob.hide_render = False
    ob.location = ((i % cols) * 1.3, (i // cols) * 1.9, 0)
scn.render.engine = 'BLENDER_WORKBENCH'
scn.display.shading.light = 'STUDIO'
scn.display.shading.color_type = 'SINGLE'
scn.display.shading.single_color = (0.93, 0.92, 0.9)
scn.display.shading.show_cavity = True
scn.render.resolution_x, scn.render.resolution_y = 2400, 1500
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 12.5
co = bpy.data.objects.new('cam', cam); scn.collection.objects.link(co); scn.camera = co
target = Vector(((cols - 1) * 0.65, 1.9, 0.4))
dv = Vector((-0.75, -1.0, 0.55)).normalized()
co.location = target + dv * 20
co.rotation_euler = (-dv).to_track_quat('-Z', 'Y').to_euler()
body.hide_render = True
scn.render.filepath = os.path.join(OUT, 'poses_sheet.png')
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'mannequin_rig.blend'))
