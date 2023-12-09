#!/bin/env python3.9

import os
os.environ['PYOPENGL_PLATFORM'] = 'egl'
#os.environ['EGL_DEVICE_ID'] = os.envrion['SLURM_STEP_GPUS']

############################################# patch 2023-may-20
# установка правильного EGL_DEVICE_ID. Почему-то на некоторых машинах дается не 1 устр-во egl а много. Надо указать правильное.
if 'SLURM_STEP_GPUS' in os.environ:
  from pyrender.platforms import egl
  #device_id = int(os.environ.get('EGL_DEVICE_ID', '0'))
  egl_devices = egl.query_devices()
  if (len(egl_devices) > 1):
    print("PATCHING EGL_DEVICE_ID")
    os.environ['EGL_DEVICE_ID'] = os.environ['SLURM_STEP_GPUS']
#############################################


print("=====")
for name, value in sorted(os.environ.items()):
    print("{0}: {1}".format(name, value))
print("=====")

import subprocess
print("=====")
#subprocess.run(['lsof', '-p',str(os.getpid()) ])
p = subprocess.run(['nvidia-smi', '-L' ], capture_output=True)
print(p.stdout.decode())
print("=====")

import trimesh
import pyrender
import numpy as np
#import np

import time                                

from PIL import Image
def saveimg( buf, fname ):
  im = Image.fromarray(buf)
  im.save(fname)


st1 = time.time()                                
try:
  r = pyrender.OffscreenRenderer(viewport_width=1200,
                                viewport_height=1000,
                                point_size=1.0)
except Exception as e:
  print(e)
finally:
  subprocess.run(['lsof', '-p',str(os.getpid()) ])
                                
et1 = time.time()
elapsed_time1 = et1 - st1
print('make ofscr time:', elapsed_time1, 'seconds')                                

#print("=====")
#subprocess.run(['lsof', '-p',str(os.getpid()) ])
#print("=====")

#points = trimesh.creation.icosphere(radius=0.05).vertices
points = np.random.uniform(size=[1000*1000,3])
point_colors = np.random.uniform(size=points.shape)
mesh = pyrender.Mesh.from_points(points, colors=point_colors)

#tmesh = trimesh.Trimesh(vertices=[[0, 0, 0], [0, 0, 1], [0, 1, 0]],faces=[[0, 1, 2]],
#                        process=False)
#tmesh = trimesh.Trimesh(vertices=[[0, 0, 0], [0, 0, 1], [0, 1, 0]] )

#mesh = pyrender.Mesh.from_trimesh(tmesh)

#tms = [trimesh.creation.icosahedron(), trimesh.creation.cylinder(1,height=0.5)]
#mesh = pyrender.Mesh.from_trimesh(tms)
light = pyrender.PointLight(color=[1.0, 1.0, 1.0], intensity=2.0)
cam = pyrender.PerspectiveCamera(yfov=np.pi / 3.0, aspectRatio=1.414)
nm = pyrender.Node(mesh=mesh, matrix=np.eye(4))
nl = pyrender.Node(light=light, matrix=np.eye(4))
nc = pyrender.Node(camera=cam, matrix=np.eye(4))

scene = pyrender.Scene(ambient_light=[0.02, 0.02, 0.02],
                        bg_color=[0.20, 0.0, 0.0])

scene.add_node(nm)
scene.add_node(nl)
#scene.add_node(nc)

camera = pyrender.PerspectiveCamera(yfov=np.pi / 3.0, aspectRatio=1.0)
s = np.sqrt(2)/2
camera_pose = np.array([
    [0.0, -s,   s,   0.3],
    [1.0,  0.0, 0.0, 0.0],
    [0.0,  s,   s,   0.35],
    [0.0,  0.0, 0.0, 1.0],
])
#scene.add(camera, pose=camera_pose)

bb = pyrender.Node(camera=camera, matrix=camera_pose)
scene.add_node(bb)
#tf = scene.get_pose(bb)
#print(tf)

#pyrender.Viewer(scene, use_raymond_lighting=True)

st = time.time()                                
color = None
depth = None
#for x in range(500):
color, depth = r.render(scene)
et = time.time()
elapsed_time = et - st
print('Execution time:', elapsed_time, 'seconds')

r.delete()

print( "saving image",type(color),color.shape )

saveimg( color,"test.png" )