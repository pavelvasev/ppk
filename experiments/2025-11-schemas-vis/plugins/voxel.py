import os
import sys

import ppk
import ppk.genesis as gen

import numpy as np
import asyncio

# todo this is binary.. add type?
class VoxelVolume:
    def __init__(self,size,shape):
        self.size = size # сторона кубика (кол-во ячеек)
        self.shape = shape # [cx,cy,cz] число кубиков
        self.distribution = []

    def deploy( self,workers ):
        total = self.shape[0] * self.shape[1] * self.shape[2]
        #for i in range(total):
        i = 0
        for nx in range(self.shape[0]):
            for ny in range(self.shape[1]):
                for nz in range(self.shape[2]):                    
                    n =  i % len(workers)
                    # todo добавить guid
                    object_id = f"vv_{i}"
                    pos = [nx,ny,nz]
                    print("deploy vv ",dict(pos=pos,
                                shape=self.shape,
                                size=self.size,
                                id=object_id))
                    i = i + 1
                    nodes = gen.node( "voxel_volume_item",
                                pos=pos,
                                shape=self.shape,
                                size=self.size,
                                object_id=object_id
                                )
                    workers[n].put( {"description":nodes,"action":"create"} )

                    # объект канала воркера, id воркера локальный там удаленный
                    d = [ workers[n], object_id ]
                    self.distribution.append( d )


class voxel_volume_item:
    def __init__(self,rapi,description,parent):
        #self.id = gen.id_generator()        
        #self.positions = rapi.channel(self.id + 'positions').cell()

        self.output = ppk.local.Cell()
        self.pos = ppk.local.Cell()
        self.size = ppk.local.Cell()
        self.shape = ppk.local.Cell()
 

        def on_size(v):
          size = v
          print("voxel_volume_item creates volume with side of size",size)
          self.grid = np.zeros((size, size, size), dtype=bool)
          self.output.put(v)

        self.size.react( on_size )

        print("voxel_volume_item item created")

        gen.apply_description( rapi, self, description )


def init(*args):
	gen.register({"voxel_volume_item":voxel_volume_item})

################
