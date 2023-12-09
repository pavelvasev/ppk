#!/bin/env python3.9

import sys
import os
import subprocess
os.environ['PYOPENGL_PLATFORM'] = 'egl'
#print('=================',file=sys.stderr)
#subprocess.run(['nvidia-smi', '-L' ])
#p = subprocess.run(['nvidia-smi', '-L' ], capture_output=True)
#№print(p.stdout.decode(),file=sys.stderr)

#for name, value in sorted(os.environ.items()):
#    print("{0}: {1}".format(name, value),file=sys.stderr)
#print('=================',file=sys.stderr)    

############################################# patch 2023-may-20
# установка правильного EGL_DEVICE_ID. Почему-то на некоторых машинах дается не 1 устр-во egl а много. Надо указать правильное.
#if 'SLURM_STEP_GPUS' in os.environ:
result = subprocess.run(['nvidia-smi'], capture_output=True, text=True)
if 'Driver Version: 390' in result.stdout and 'SLURM_STEP_GPUS' in os.environ:
#if 'EGL_NEED_PATCH' in os.environ:
  #from pyrender.platforms import egl
  #device_id = int(os.environ.get('EGL_DEVICE_ID', '0'))
  #egl_devices = egl.query_devices()
  #if (len(egl_devices) > 2):
  print("PATCHING EGL_DEVICE_ID with",os.environ['SLURM_STEP_GPUS'],"because old nvidia driver:",result.stdout,file=sys.stderr)
  os.environ['EGL_DEVICE_ID'] = os.environ['SLURM_STEP_GPUS']
else:
  print("skipping patch of EGL_DEVICE_ID because seems nvidia driver is ok",file=sys.stderr)
#############################################


#import random
#if random.random() < 0.5:
#  exit(1)

import numpy as np
import urllib.request
import time

# https://stackoverflow.com/a/37429875
from contextlib import contextmanager
import logging
@contextmanager
def log_time(prefix=""):
    '''log the time usage in a code block
    prefix: the prefix text to show
    '''
    start = time.time()
    try:
        yield
    finally:
        end = time.time()
        elapsed_seconds = float("%.4f" % (end - start))
        print(prefix, elapsed_seconds,"sec",file=sys.stderr)

def getbuf(url, typ):
  print("getbuf",url,typ,file=sys.stderr)
  buf = urllib.request.urlopen(url).read()
  dt = np.dtype( typ )
  #dt = dt.newbyteorder('>')
  arr = np.frombuffer(buf, dtype=dt)
  return arr
  
from urllib import request, parse  
def putbuf( url, buf):
  print("putbuf",url,buf.shape,file=sys.stderr)
  bytes = buf.tobytes()
  req =  request.Request( url, data=bytes) # this will make the method "POST"
  with request.urlopen(req) as resp:
    data1 = resp.read()
    print("putbuf resp",resp.status,data1,file=sys.stderr)
    return url + data1.decode("utf-8")
    
from PIL import Image    
def saveimg( buf, fname ):
  im = Image.fromarray(buf)
  im.save(fname)
  
# https://stackoverflow.com/questions/54897009/look-at-function-returns-a-view-matrix-with-wrong-forward-position-python-im  
def lookAt(center, target, up):
    f = (target - center); f = f/np.linalg.norm(f)
    s = np.cross(f, up); s = s/np.linalg.norm(s)
    u = np.cross(s, f); u = u/np.linalg.norm(u)

    m = np.zeros((4, 4))
    m[0, :-1] = s
    m[1, :-1] = u
    m[2, :-1] = f
    m[-1, -1] = 1.0

    return m  
    
# https://github.com/stemkoski/three.py/blob/master/three.py/mathutils/MatrixFactory.py#L104    
def makeLookAt(position, target, up):
        
        forward = np.subtract(target, position)
        forward = np.divide( forward, np.linalg.norm(forward) )

        right = np.cross( forward, up )
        
        # if forward and up vectors are parallel, right vector is zero; 
        #   fix by perturbing up vector a bit
        if np.linalg.norm(right) < 0.001:
            epsilon = np.array( [0.001, 0, 0] )
            right = np.cross( forward, up + epsilon )
            
        right = np.divide( right, np.linalg.norm(right) )
        
        up = np.cross( right, forward )
        up = np.divide( up, np.linalg.norm(up) )
        
        return np.array([[right[0], up[0], -forward[0], position[0]],
                         [right[1], up[1], -forward[1], position[1]],
                         [right[2], up[2], -forward[2], position[2]],
                         [0, 0, 0, 1]])     
  
############################################  



import trimesh
import pyrender
import numpy as np
#import np

print("program started, args:",sys.argv,file=sys.stderr)

with log_time("make rend"):
  r = pyrender.OffscreenRenderer(viewport_width=int( sys.argv[4] ),
                                viewport_height=int( sys.argv[5] ),
                                point_size=1.0)

print("viewport",r.viewport_width, r.viewport_height,file=sys.stderr)

with log_time("read coords"):
  points = getbuf( sys.argv[1], np.float32 )
  #indices = getbuf( sys.argv[2], np.uint32 )
  
print(points.shape,file=sys.stderr)
points = points.reshape( [-1,3] ) # https://numpy.org/doc/stable/reference/generated/numpy.reshape.html
print(points.shape,file=sys.stderr)
#indices = indices.reshape( [-1,3] )
#print(indices.shape,file=sys.stderr)

#points = trimesh.creation.icosphere(radius=0.05).vertices
#points = np.random.uniform(size=[1000*1000,3])
point_colors = np.random.uniform(size=points.shape)
mesh = pyrender.Mesh.from_points(points, colors=point_colors)
#tmesh = trimesh.Trimesh(vertices=points,faces=indices,process=False, vertex_colors = point_colors)
#mesh = pyrender.Mesh.from_trimesh(tmesh)
#tmesh = None
points = None
indices = None

#tms = [trimesh.creation.icosahedron(), trimesh.creation.cylinder(1,height=0.5)]
#mesh = pyrender.Mesh.from_trimesh(tms)

#cam = pyrender.PerspectiveCamera(yfov=np.pi / 3.0, aspectRatio=1.414)
nm = pyrender.Node(mesh=mesh, matrix=np.eye(4))
#light = pyrender.PointLight(color=[1.0, 1.0, 1.0], intensity=32.0)
#nl = pyrender.Node(light=light, matrix=np.eye(4))
#nc = pyrender.Node(camera=cam, matrix=np.eye(4))

scene = pyrender.Scene(ambient_light=[0.02, 0.02, 0.02],
                        bg_color=[0.20, 0.0, 0.0])

scene.add_node(nm)
#scene.add_node(nl)
#scene.add_node(nc)

camera = pyrender.PerspectiveCamera(yfov=75*np.pi/180.0, 
             aspectRatio=r.viewport_width/r.viewport_height, znear=0.001, zfar=10000.0)
"""
s = np.sqrt(2)/2
camera_pose = np.array([
    [0.0, -s,   s,   0.3],
    [1.0,  0.0, 0.0, 0.0],
    [0.0,  s,   s,   0.35],
    [0.0,  0.0, 0.0, 1.0],
])
"""
#scene.add(camera, pose=camera_pose)
center = np.array([0.0, 2.0, 2.0])
target = np.array([0.5, 0.5, 0.5])
up = np.array([0.0, 1.0, 0.0])
camera_pose = makeLookAt(center,target,up)

bb = pyrender.Node(camera=camera, matrix=camera_pose)
scene.add_node(bb)
#tf = scene.get_pose(bb)
#print(tf)

light2 = pyrender.SpotLight(color=np.ones(3), intensity=33.0, # 3 тоже интригует
                            innerConeAngle=np.pi/16.0,
                            outerConeAngle=np.pi/6.0)
ln2 = scene.add(light2, pose=camera_pose)


#pyrender.Viewer(scene, use_raymond_lighting=True)
sys.stderr.flush()

color = None
depth = None

for line in sys.stdin:
  vals = np.fromstring( line, sep=' ' )
  if len(vals)<6:
    break
  center = vals[0:3]
  target = vals[3:6]
  print("got cam:",center,target,file=sys.stderr)
  camera_pose = makeLookAt(center,target,up)
  scene.set_pose( bb, pose=camera_pose )
  scene.set_pose( ln2, pose=camera_pose )

  with log_time("render"):
    color, depth = r.render(scene, pyrender.RenderFlags.RGBA)
  with log_time("upload"):
    
    cinfo = putbuf( sys.argv[3], color )
    dinfo = putbuf( sys.argv[3], depth )
  #saveimg( color,"1.png")
  print( cinfo + "===" + dinfo )
  #print( "color shape is",color.shape, file=sys.stderr )
  #print( "going to reshape to",[ color.shape[1], color.shape[0], 4], file=sys.stderr)
  # https://github.com/mmatl/pyrender/blob/a59963ef890891656fd17c90e12d663233dcaa99/pyrender/renderer.py#L240
  
  #color = np.flip( color, 0 )
  #depth = np.flip( depth, 0 )
  color = None
  depth = None
  
  #color = color.reshape( [ color.shape[1], color.shape[0], 4] )
  #depth = depth.reshape( [ depth.shape[1], depth.shape[0], 1] )
  #print( "color2 shape is",color.shape, file=sys.stderr )
  sys.stdout.flush()
  sys.stderr.flush()

r.delete()
print("finished",file=sys.stderr)

#print( type(color),color.shape )
#print( "info",cinfo,dinfo )

#saveimg( color,"1.png")