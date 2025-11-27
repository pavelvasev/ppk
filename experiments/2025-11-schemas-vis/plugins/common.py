import os
import sys

import ppk
import ppk.genesis as gen

import numpy as np
import asyncio

# todo this is binary.. add type?
class Pass3D:
    def __init__(self,shape,n):
        self.shape = shape # [cx,cy,cz] число кубиков
        self.distribution = []
        self.n = n

    def deploy( self,workers ):
        total = self.shape[0] * self.shape[1] * self.shape[2]
        #for i in range(total):
        i = 0
        for nx in range(self.shape[0]):
            for ny in range(self.shape[1]):
                for nz in range(self.shape[2]):                    
                    n =  i % len(workers)
                    # todo добавить guid
                    object_id = f"pass3d_item_{i}"
                    pos = [nx,ny,nz]
                    print("deploy pass3d_item ",dict(pos=pos,
                                shape=self.shape,
                                n=self.n,
                                id=object_id))
                    i = i + 1
                    nodes = gen.node( "pass3d_item",
                                pos=pos,
                                shape=self.shape,
                                n=self.n,
                                object_id=object_id
                                )
                    workers[n].put( {"description":nodes,"action":"create"} )

                    # объект канала воркера, id воркера локальный там удаленный
                    d = [ workers[n], object_id ]
                    self.distribution.append( d )


class pass3d_item:
    def __init__(self,rapi,description,parent):
        #self.id = gen.id_generator()        
        #self.positions = rapi.channel(self.id + 'positions').cell()

        self.output = ppk.local.Channel()
        self.result = ppk.local.Channel() # итого
        self.input = ppk.local.Channel()
        self.n = ppk.local.Cell()

        self.cnt = 0

        def on_input(v):
            print("pass3d_item input changed: cnt=",self.cnt,"n=",self.n.value)
            if self.cnt < self.n.value:
                self.cnt = self.cnt +1
                self.output.put(v)
            elif self.cnt == self.n.value:
                self.result.put(v)

        self.input.react( on_input )

        print("pass3d_item item created")

        gen.apply_description( rapi, self, description )


def init(*args):
	gen.register({"pass3d_item":pass3d_item})

################
