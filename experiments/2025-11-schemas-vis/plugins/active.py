import os
import sys

def init(*args):
	mdir = os.path.dirname(__file__)
	sys.path.insert(0,mdir)
	###################
	#import scene_3d
	#scene_3d.init(*args)

	import random_p
	random_p.init(*args)

	import timer
	timer.init(*args)

	import data_io
	data_io.init(*args)

	import interop
	interop.init(*args)

	import voxel
	voxel.init(*args)

	import life
	life.init(*args)

	import common
	common.init(*args)	

	import voxel_paint_sw
	voxel_paint_sw.init(*args)	

	#import voxel_paint_vispy
	#voxel_paint_vispy.init(*args)	

	#import voxel_paint_open3d
	#voxel_paint_open3d.init(*args)	

	#import voxel_paint_pyvista
	#voxel_paint_pyvista.init(*args)	

	#import grafix_setup
	#grafix_setup.init(*args)

	###################
	sys.path.remove(mdir)