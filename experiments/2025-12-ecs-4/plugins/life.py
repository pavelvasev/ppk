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
        self.system_id = "voxel_random_init"
        print("random_voxels: ecs.LOCAL_SYSTEMS len=",len(self.local_systems))

    def get_components(self):
        return ["voxel_random_init"]

    def process_ecs(self,i,world):
        print("random_voxels:process_ecs called")
        ents = world.get_entities_with_components("voxel_random_init",marker="voxel_random_init")
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
            e.update_component("voxel_volume_value",{"payload":grid,"iter_num":0})
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

        self.system_id = "life3d"

        #rapi.bind()

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

    def get_components(self):
        return ["voxel_volume_value"]

    def process_ecs(self,i,world):
        print("game_of_life_3d:process_ecs called")

        ents = world.get_entities_with_components("voxel_volume_value","life3d",marker="life3d")
        print("game_of_life_3d:ents=",ents)
        for entity_id in ents:
            #grid = e.components["voxel_volume"]
            e = world.get_entity( entity_id )
            params = e.get_component("voxel_volume_params")
            val = e.get_component("voxel_volume_value")
            
            grid = val["payload"]
            #print("see entity",entity_id,"grid=",grid)
            new_grid = self.step( grid )
            iter_num = val["iter_num"] + 1
            e.update_component("voxel_volume_result",{"payload":new_grid,"iter_num":iter_num})

            #e.update_component("game_of_life_3d_processed",{})
            
            # hack ну видимо пока так - чтобы нельзя было повторять life3d-цикл
            #e.remove_component("voxel_volume_value") 
            # и нельзя было повторно копировать в картинки
            #e.remove_component("voxel_volume_result")

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
        self.continue_ch = rapi.channel("voxel_volume_go") #hack

    def get_entity_id(self,nx,ny,nz):
        return self.entities_list_3d[nx][ny][nz]
        #i = nx * self.shape[1] * self.shape[2] + ny*self.shape[2] + nz
        #return f"vv_{i:04d}"
        # todo мб лучше не мудрить а ввести явную сетку да и все

    def deploy( self,workers ):
        for w in workers:
            print("deploy game_of_life_3d to worker",w.id)
            nodes = gen.node( "voxel_volume_sync_out", tags=["ecs_system"])
            w.put( {"description":nodes,"action":"create"})
            nodes = gen.node( "voxel_volume_sync_in", tags=["ecs_system"])
            w.put( {"description":nodes,"action":"create"})

        # ссылки соседних теневых граней исходящие -> входящие
        # но это как бы сложно почему-то.. может можно проще как-то, алгоритмически
        for nx in range(self.shape[0]):
            for ny in range(self.shape[1]):
                for nz in range(self.shape[2]):
                    #n =  i % len(workers)
                    # todo добавить guid
                    #object_id = f"vv_{i:04d}"
                    object_id = self.get_entity_id( nx, ny, nz )

                    #src = self.continue_ch.id
                    #tgt = f"{object_id}/allow_sync_income/in"
                    #print("ENTITY COMPONENT BIND",src,"----->",tgt)
                    #self.rapi.bind(src,tgt)                    

                    # копируем результат вычислений на вход в эту же сущность
                    src = [object_id,"voxel_volume_result"]
                    tgt = [object_id,"voxel_volume_income"]
                    #print("ENTITY COMPONENT BIND",src,"----->",tgt)
                    self.rapi.bind_entity(src,tgt, workers)

                    # ссылки на грани
                    if nx > 0:
                        other_object_id = self.get_entity_id( nx-1, ny, nz )
                        src = [object_id,"sx_first"]
                        tgt = [other_object_id,"sx_last_income"]
                        #print("ENTITY COMPONENT BIND",src,"----->",tgt)
                        self.rapi.bind_entity(src,tgt, workers)
                    if nx < self.shape[0]-1:
                        other_object_id = self.get_entity_id( nx+1, ny, nz )
                        src = [object_id,"sx_last"]
                        tgt = [other_object_id,"sx_first_income"]                        
                        #print("ENTITY COMPONENT BIND",src,"----->",tgt)
                        self.rapi.bind_entity(src,tgt, workers)
                    if ny > 0:
                        other_object_id = self.get_entity_id( nx, ny-1, nz )
                        src = [object_id,"sy_first"]
                        tgt = [other_object_id,"sy_last_income"]
                        #print("ENTITY COMPONENT BIND",src,"----->",tgt)
                        self.rapi.bind_entity(src,tgt, workers)
                    if ny < self.shape[1]-1:
                        other_object_id = self.get_entity_id( nx, ny+1, nz )
                        src = [object_id,"sy_last"]
                        tgt = [other_object_id,"sy_first_income"]
                        #print("ENTITY COMPONENT BIND",src,"----->",tgt)
                        self.rapi.bind_entity(src,tgt, workers)
                    if nz > 0:
                        other_object_id = self.get_entity_id( nx, ny, nz-1 )
                        src = [object_id,"sz_first"]
                        tgt = [other_object_id,"sz_last_income"]
                        #print("ENTITY COMPONENT BIND",src,"----->",tgt)
                        self.rapi.bind_entity(src,tgt, workers)
                    if nz < self.shape[2]-1:
                        other_object_id = self.get_entity_id( nx, ny, nz+1 )
                        src = [object_id,"sz_last"]
                        tgt = [other_object_id,"sz_first_income"]
                        #print("ENTITY COMPONENT BIND",src,"----->",tgt)
                        self.rapi.bind_entity(src,tgt, workers)


class voxel_volume_sync_out:
    def __init__(self,rapi,description,parent):

        self.local_systems = description["local_systems"]
        self.local_systems.append(self)

        self.system_id = "sync_out"
        #self.allow_one_step_ch = rapi.channel

    def extract_faces_3d(self,arr):
        """Извлекает 6 граней 3D массива"""
        S = SHADOW
        faces = {
            'sx_first': arr[S, :, :].copy(),      # первая плоскость по оси 0
            'sx_last': arr[-S, :, :].copy(),      # последняя плоскость по оси 0
            'sy_first': arr[:, S, :].copy(),     # первая плоскость по оси 1
            'sy_last': arr[:, -S, :].copy(),      # последняя плоскость по оси 1
            'sz_first': arr[:, :, S].copy(),      # первая плоскость по оси 2
            'sz_last': arr[:, :, -S].copy()     # последняя плоскость по оси 2
        }
        return faces

    def get_components(self):
        return ["voxel_volume_result"]

    def process_ecs(self,i,world):
        print("voxel_volume_sync_out:process_ecs called")
        
        # исходящие теневые грани
        ents = world.get_entities_with_components("voxel_volume_result","sync_out",marker="sync_out")
        print("voxel_volume_sync_out: make shadow, ents=",ents)
        for entity_id in ents:
            #grid = e.components["voxel_volume"]
            e = world.get_entity( entity_id )
            params = e.get_component("voxel_volume_params")
            val = e.get_component("voxel_volume_result")

            grid = val["payload"]

            faces = self.extract_faces_3d( grid )
            for fname, fvalue in faces.items():            
                #print("SHADOW updating component ",fname,"fvalue=",fvalue)
                print("SHADOW updating component ",fname)
                e.update_component(f"{fname}",{"payload":fvalue})

class voxel_volume_sync_in:
    def __init__(self,rapi,description,parent):

        self.local_systems = description["local_systems"]
        self.local_systems.append(self)

        self.system_id = "sync_in"
        #self.allow_one_step_ch = rapi.channel                

    def get_components(self):
        return ["voxel_volume_income",
                "sx_first_income","sx_last_income",
                "sy_first_income","sy_last_income",
                "sz_first_income","sz_last_income"]        

    def process_ecs(self,i,world):
        print("voxel_volume_sync_in:process_ecs called")        
        
        # входящие теневые грани

        ents = world.get_entities_with_components(
                "sync_in", "voxel_volume_income",
                "sx_first_income","sx_last_income",
                "sy_first_income","sy_last_income",
                "sz_first_income","sz_last_income",
                marker="sync_in",
                verbose=True
                )
        # идея в том что мы создадим пустые входящие теневые грани для границ большого вокс куба
        # и будем всегда их тут находить, но пропускать по критерию payload

        print("voxel_volume_sync_in: import shadow, ents=",ents)
        for entity_id in ents:
            #grid = e.components["voxel_volume"]
            e = world.get_entity( entity_id )
            params = e.get_component("voxel_volume_params")
            income = e.get_component("voxel_volume_income")
            grid = income["payload"]

            # заказываем ждать такта явно
            #e.remove_component("allow_sync_income") # т.о. мы ждем явного такта

            S = 0 # вставляем в край
            sx_first = e.get_component("sx_first_income")
            sx_last = e.get_component("sx_last_income")            
            if "payload" in sx_first: # настоящее, не граничное
                grid[S, :, :] = sx_first["payload"]
                e.remove_component("sx_first_income")
            else:
                del sx_first["sync_in"]    
            if "payload" in sx_last: # настоящее, не граничное
                grid[-S, :, :] = sx_last["payload"]
                e.remove_component("sx_last_income")
            else:
                del sx_last["sync_in"]                


            sx_first = e.get_component("sy_first_income")
            sx_last = e.get_component("sy_last_income")            
            if "payload" in sx_first: # настоящее, не граничное
                grid[:, S, :] = sx_first["payload"]
                e.remove_component("sy_first_income")
            else:
                del sx_first["sync_in"]

            if "payload" in sx_last: # настоящее, не граничное
                grid[:, -S, :] = sx_last["payload"]
                e.remove_component("sy_last_income")
            else:
                del sx_last["sync_in"]                

            sx_first = e.get_component("sz_first_income")
            sx_last = e.get_component("sz_last_income")            
            if "payload" in sx_first: # настоящее, не граничное
                grid[:, :, S] = sx_first["payload"]
                e.remove_component("sz_first_income")
            else:
                del sx_first["sync_in"]
            if "payload" in sx_last: # настоящее, не граничное
                grid[:, :, -S] = sx_last["payload"]
                e.remove_component("sz_last_income")
            else:
                del sx_last["sync_in"]

            iter_num = income["iter_num"]

            e.update_component("voxel_volume_value",{"payload":grid,"iter_num":iter_num})
            e.remove_component("voxel_volume_income")



def init(*args):
    gen.register({"random_voxels":random_voxels})
    gen.register({"game_of_life_3d":game_of_life_3d})
    gen.register({"voxel_volume_sync_in":voxel_volume_sync_in})    
    gen.register({"voxel_volume_sync_out":voxel_volume_sync_out})    

################
