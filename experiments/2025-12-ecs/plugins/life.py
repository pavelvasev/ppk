import os
import sys

import ppk
import ppk.genesis as gen

import numpy as np
import asyncio

from scipy.ndimage import convolve

# размер теневой области
SHADOW=1

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
            size = params["size"] + 2 * SHADOW
            
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

# идея а если я хочу разные варианты одновременно например пробовать?
# ну и видеть их сообразно
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
            e.update_component("voxel_volume_result",{"payload":new_grid})

# передача граничных значений
"""

"""

class VoxelVolumeSync:
    def __init__(self,rapi,shape,entities_list_3d):
        #self.size = size # сторона кубика (кол-во ячеек)
        self.rapi = rapi
        self.shape = shape # [cx,cy,cz] число кубиков
        self.distribution = []
        self.entities_list_3d = entities_list_3d

    def get_entity_id(self,nx,ny,nz):
        return self.entities_list_3d[nx][ny][nz]
        #i = nx * self.shape[1] * self.shape[2] + ny*self.shape[2] + nz
        #return f"vv_{i:04d}"
        # todo мб лучше не мудрить а ввести явную сетку да и все

    def deploy( self,workers ):
        for w in workers:
            print("deploy game_of_life_3d to worker",w.id)
            nodes = gen.node( "voxel_volume_sync", tags=["ecs_system"])
            w.put( {"description":nodes,"action":"create"})

        # ссылки соседних теневых граней исходящие -> входящие
        # но это как бы сложно почему-то.. может можно проще как-то, алгоритмически
        for nx in range(self.shape[0]):
            for ny in range(self.shape[1]):
                for nz in range(self.shape[2]):
                    n =  i % len(workers)
                    # todo добавить guid
                    #object_id = f"vv_{i:04d}"
                    object_id = self.get_entity_id( nx, ny, nz )

                    # копируем результат вычислений на вход в эту же сущность
                    src = f"{object_id}/voxel_volume_result/out"
                    tgt = f"{object_id}/voxel_volume_income/in"
                    self.rapi.bind(src,tgt)

                    # ссылки на грани
                    if nx > 0:
                        other_object_id = self.get_entity_id( nx-1, ny, nz )
                        src = f"{object_id}/nx_first/out"
                        tgt = f"{other_object_id}/nx_first_income/in"
                        #print("ENTITY COMPONENT BIND",src,"----->",tgt)
                        self.rapi.bind(src,tgt)
                    if nx < self.shape[0]-1:
                        other_object_id = self.get_entity_id( nx+1, ny, nz )
                        src = f"{object_id}/nx_last/out"
                        tgt = f"{other_object_id}/nx_last_income/in"
                        #print("ENTITY COMPONENT BIND",src,"----->",tgt)
                        self.rapi.bind(src,tgt)


class voxel_volume_sync:
    def __init__(self,rapi,description,parent):

        self.local_systems = description["local_systems"]
        self.local_systems.append(self)

    def extract_faces_3d(arr):
        """Извлекает 6 граней 3D массива"""
        S = SHADOW
        faces = {
            'nx_first': arr[S, :, :].copy(),      # первая плоскость по оси 0
            'nx_last': arr[-S, :, :].copy(),      # последняя плоскость по оси 0
            'ny_first': arr[:, S, :].copy(),     # первая плоскость по оси 1
            'ny_last': arr[:, -S, :].copy(),      # последняя плоскость по оси 1
            'nz_first': arr[:, :, S].copy(),      # первая плоскость по оси 2
            'nz_last': arr[:, :, -S].copy()     # последняя плоскость по оси 2
        }
        return faces


    def process_ecs(self,i,world):
        print("voxel_volume_sync:process_ecs called")
        # исходящие грани
        ents = world.get_entities_with_components("voxel_volume_result")
        print("voxel_volume_sync: make shadow, ents=",ents)
        for entity_id in ents:
            #grid = e.components["voxel_volume"]
            e = world.get_entity( entity_id )
            params = e.get_component("voxel_volume_params")
            grid = e.get_component("voxel_volume_result")["payload"]

            faces = extract_faces_3d( grid )
            for fname, fvalue in faces.items():            
                e.update_component(f"{fname}",{"payload":fvalue})

def init(*args):
    gen.register({"random_voxels":random_voxels})
    gen.register({"game_of_life_3d":game_of_life_3d})
    gen.register({"voxel_volume_sync":voxel_volume_sync})    

################
