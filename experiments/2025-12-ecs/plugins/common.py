import os
import sys

import ppk
import ppk.genesis as gen

import numpy as np
import asyncio
import imageio

# сохраняет картинки png из указанного компонента
class ImageSaver:
    def __init__(self):
        self.distribution = []

    def deploy( self,workers ):
        for w in workers:
            print("deploy voxel_volume_paint_sw to worker",w.id)
            nodes = gen.node( "image_saver", tags=["ecs_system"])
            w.put( {"description":nodes,"action":"create"})


# todo 2 варианта просто рисовалка и с учетом сдвига
class image_saver:
    def __init__(self,rapi,description,parent):
        self.local_systems = description["local_systems"]
        self.local_systems.append(self)

        print("image_saver item created")

        gen.apply_description( rapi, self, description )

    def process_ecs(self,i,world):
        print("image_saver:process_ecs called")
        # todo искать указаннный в параметре компонент
        ents = world.get_entities_with_components("image")
        print("image_saver:ents=",ents)
        for entity_id in ents:
            #grid = e.components["voxel_volume"]
            e = world.get_entity( entity_id )
            image = e.get_component("image")
            rgb = image["payload"]["rgb"]
            
            imageio.imwrite(f"{entity_id}_iter_{i:05d}.png", rgb)


# todo voxel-volume-pass назвать
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


class TriggerPass3D:
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
                    nodes = gen.node( "trigger_pass3d_item",
                                pos=pos,
                                shape=self.shape,
                                n=self.n,
                                object_id=object_id
                                )
                    workers[n].put( {"description":nodes,"action":"create"} )

                    # объект канала воркера, id воркера локальный там удаленный
                    d = [ workers[n], object_id ]
                    self.distribution.append( d )


class trigger_pass3d_item:
    def __init__(self,rapi,description,parent):
        #self.id = gen.id_generator()        
        #self.positions = rapi.channel(self.id + 'positions').cell()

        self.output = ppk.local.Channel()
        self.result = ppk.local.Channel() # итого
        self.input = ppk.local.Channel()
        self.trigger = ppk.local.Channel()
        self.n = ppk.local.Cell()

        self.cnt = 0

        self.trigger_pass = False
        self.trigger_value = None

        def on_trigger(v):
            if self.trigger_value is not None:
                self.output.put( self.trigger_value )
                self.trigger_pass = False
            else:
                self.trigger_pass = True

        def on_input(v):
            #print("pass3d_item input changed: cnt=",self.cnt,"n=",self.n.value)
            if self.cnt < self.n.value:
                self.cnt = self.cnt +1
                if self.trigger_pass:
                    self.output.put(v)
                    self.trigger_pass = False
                    self.trigger_value = None                    
                else:
                    self.trigger_value = v
            elif self.cnt == self.n.value:
                self.result.put(v)

        self.input.react( on_input )
        self.trigger.react( on_trigger )

        print("trigger_pass3d_item item created")

        gen.apply_description( rapi, self, description )



def init(*args):
    gen.register({"pass3d_item":pass3d_item})
    gen.register({"trigger_pass3d_item":trigger_pass3d_item})
    gen.register({"image_saver":image_saver})
    

################
