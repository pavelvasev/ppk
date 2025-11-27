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

	#import grafix_setup
	#grafix_setup.init(*args)

	###################
	sys.path.remove(mdir)