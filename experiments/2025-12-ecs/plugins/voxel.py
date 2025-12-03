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
        self.entities_list = []
        self.entities_list_3d = [[[0 for k in range(self.shape[0])] 
                for j in range(self.shape[1])] 
                   for i in range(self.shape[2])]

    # трехмерный массив
    def entities_3d()
        return self.entities_list_3d

    def entities()
        return self.entities_list

    def deploy( self,workers ):
        total = self.shape[0] * self.shape[1] * self.shape[2]
        #for i in range(total):
        
        i = 0
        for nx in range(self.shape[0]):
            for ny in range(self.shape[1]):
                for nz in range(self.shape[2]):
                    n =  i % len(workers)
                    # todo добавить guid
                    object_id = f"vv_{i:04d}"
                    self.entities_list.append(object_id)
                    self.entities_list_3d[nx][ny][nz] = object_id
                    pos = [nx,ny,nz]
                    print("deploy vv ",dict(pos=pos,
                                shape=self.shape,
                                size=self.size,
                                id=object_id))
                    i = i + 1
                    nodes = gen.node( "entity",
                                maybe_comonents=[
                                    "nx_first","nx_last", "nx_first_income","nx_last_income",
                                    "nz_first","nz_last", "nz_first_income","nz_last_income",
                                    "ny_first","ny_last", "ny_first_income","ny_last_income",
                                    ],
                                components={
                                  "voxel_volume_params": dict(
                                    pos=pos,
                                    shape=self.shape,
                                    size=self.size,
                                  ),
                                  "voxel_random_init": dict(density=0.1)
                                },                              
                                entity_id=object_id
                                )
                    workers[n].put( {"description":nodes,"action":"create"} )

                    # объект канала воркера, id воркера локальный там удаленный
                    d = [ workers[n], object_id ]
                    self.distribution.append( d )
        return self.entities_list_3d



def init(*args):
    pass

################
