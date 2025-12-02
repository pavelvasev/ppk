import os
import sys

import ppk
import ppk.genesis as gen

import numpy as np
import asyncio

from scipy.ndimage import convolve

# todo move to voxels?
class RandomVoxels:
    def __init__(self):
        pass

    def deploy( self,workers ):
        cnt = 0
        for w in workers:
            object_id = f"random_voxels"                        
            print("deploy random_voxels to worker",w.id)            
            nodes = gen.node( "random_voxels", tags=["ecs_system"])
            w.put( {"description":nodes,"action":"create"})

import plugins.ecs as ecs

class random_voxels:
    def __init__(self,rapi,description,parent):
        print("random_voxels item created")
        gen.apply_description( rapi, self, description )
        print("random_voxels item adds to ecs.LOCAL_SYSTEMS")
        self.local_systems = description["local_systems"]
        self.local_systems.append(self)
        print("random_voxels: ecs.LOCAL_SYSTEMS len=",len(self.local_systems))

    def process_ecs(self,i,world):
        print("random_voxels:process_ecs called")
        ents = world.get_entities_with_components("voxel_random_init")
        print("random_voxels:ents=",ents)
        for entity_id in ents:
            #grid = e.components["voxel_volume"]
            e = world.get_entity( entity_id )
            params = e.get_component("voxel_volume_params")
            #grid = world.get_component( e, "voxel_volume_params" )
            size = params["size"]
            
            # пришел такт данных на grid надо сделать шаг
            #density = self.density.value
            #density = 0.1
            density = e.get_component("voxel_random_init")["density"]
            print("random_voxels creates random of size",size,"with density",density,"on entity_id",entity_id)
            grid = np.random.random((size, size, size)) < density
            e.update_component("voxel_volume_value",{"payload":grid})
            e.remove_component("voxel_random_init")
            #self.output.put( grid )

class GameOfLife3D:
    def __init__(self):
        #self.size = size # сторона кубика (кол-во ячеек)
        #self.shape = shape # [cx,cy,cz] число кубиков
        self.distribution = []

    def deploy( self,workers ):
        for w in workers:
            print("deploy game_of_life_3d to worker",w.id)
            nodes = gen.node( "game_of_life_3d", tags=["ecs_system"])
            w.put( {"description":nodes,"action":"create"})

class game_of_life_3d:
    def __init__(self,rapi,description,parent):

        self.local_systems = description["local_systems"]
        self.local_systems.append(self)

        rule = "4555"
        # Парсим правила
        if rule == "4555":
            self.birth = [5]
            self.survival = [4, 5]
        elif rule == "5766":
            self.birth = [5]
            self.survival = [7, 6]
        else:
            self.birth = [5]
            self.survival = [4, 5]        
        # Ядро для подсчёта соседей (3x3x3 куб)
        self.kernel = np.ones((3, 3, 3), dtype=int)
        self.kernel[1, 1, 1] = 0  # Не считаем саму клетку
        
        print("game_of_life_3d item created")

        gen.apply_description( rapi, self, description )

    def on_input(self,grid):
        print("game_of_life_3d performs step")
        # пришел такт данных на grid надо сделать шаг
        # в идеале new_grid_val совпадает с grid
        new_grid_val = self.step( grid )
        self.output.put( new_grid_val )

    def step(self,grid):
        """Один шаг симуляции"""
        # Подсчитываем соседей для каждой клетки
        neighbors = convolve(grid.astype(int), self.kernel, mode='constant', cval=0)
        
        # Применяем правила
        new_grid = np.zeros_like(grid)
        
        # Рождение новых клеток
        for n in self.birth:
            new_grid |= (neighbors == n) & ~grid
        
        # Выживание существующих
        for n in self.survival:
            new_grid |= (neighbors == n) & grid
        
        grid = new_grid
        #return np.sum(grid)  # Возвращаем количество живых клеток
        return grid

    def process_ecs(self,i,world):
        print("game_of_life_3d:process_ecs called")
        ents = world.get_entities_with_components("voxel_volume_value")
        print("game_of_life_3d:ents=",ents)
        for entity_id in ents:
            #grid = e.components["voxel_volume"]
            e = world.get_entity( entity_id )
            params = e.get_component("voxel_volume_params")
            grid = e.get_component("voxel_volume_value")["payload"]
            #print("see entity",entity_id,"grid=",grid)
            new_grid = self.step( grid )
            e.update_component("voxel_volume_value",{"payload":new_grid})



def init(*args):
    gen.register({"random_voxels":random_voxels})
    gen.register({"game_of_life_3d":game_of_life_3d})

################
