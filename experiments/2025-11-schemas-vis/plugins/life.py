import os
import sys

import ppk
import ppk.genesis as gen

import numpy as np
import asyncio

# todo move to voxels?
class RandomVoxels:
    def __init__(self,shape):
        #self.size = size # сторона кубика (кол-во ячеек)
        self.shape = shape # [cx,cy,cz] число кубиков
        self.distribution = []

    def deploy( self,workers ):
        total = self.shape[0] * self.shape[1] * self.shape[2]
        #for i in range(total):
        i = 0
        for nx in range(self.shape[0]):
            for ny in range(self.shape[1]):
                for nz in range(self.shape[2]):                    
                    
                    object_id = f"random_voxels{i}"
                    n =  i % len(workers)                    
                    pos = [nx,ny,nz]
                    print("deploy random_voxels ",dict(pos=pos,
                                shape=self.shape,
                                object_id=object_id
                                ))
                    i = i + 1
                    nodes = gen.node( "random_voxels",
                                pos=pos,
                                shape=self.shape,
                                object_id=object_id                                                                
                                )
                    workers[n].put( {"description":nodes,"action":"create"})


class random_voxels:
    def __init__(self,rapi,description,parent):
        #self.id = gen.id_generator()        
        #self.positions = rapi.channel(self.id + 'positions').cell()

        self.input = ppk.local.Channel()
        self.output = ppk.local.Channel()
        self.pos = ppk.local.Cell()        
        self.shape = ppk.local.Cell()
        self.density = ppk.local.Cell().put(0.1)

        self.input.react( self.on_input )

        print("random_voxels item created")

        gen.apply_description( rapi, self, description )

    def on_input(self,grid):
        print("random_voxels creates random of size",size)
        # пришел такт данных на grid надо сделать шаг
        density = self.density.value
        size = grid.shape[0]
        grid = np.random.random((size, size, size)) < density
        self.output.submit( grid )

class GameOfLife3D:
    def __init__(self,shape):
        #self.size = size # сторона кубика (кол-во ячеек)
        self.shape = shape # [cx,cy,cz] число кубиков
        self.distribution = []

    def deploy( self,workers ):
        total = self.shape[0] * self.shape[1] * self.shape[2]
        #for i in range(total):
        i = 0
        for nx in range(self.shape[0]):
            for ny in range(self.shape[1]):
                for nz in range(self.shape[2]):                    
                    object_id = f"game_of_life_3d_{i}"
                    n =  i % len(workers)
                    pos = [nx,ny,nz]
                    print("deploy game_of_life_3d ",dict(pos=pos,
                                shape=self.shape,
                                object_id=object_id
                                ))
                    i = i + 1
                    nodes = gen.node( "game_of_life_3d",
                                pos=pos,
                                shape=self.shape,
                                object_id=object_id                                
                                )
                    workers[n].put( {"description":nodes,"action":"create"})


class game_of_life_3d:
    def __init__(self,rapi,description,parent):
        #self.id = gen.id_generator()        
        #self.positions = rapi.channel(self.id + 'positions').cell()

        self.input = ppk.local.Channel()
        self.output = ppk.local.Channel()
        self.pos = ppk.local.Cell()        
        self.shape = ppk.local.Cell()

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

        self.input.react( self.on_input )

        print("game_of_life_3d item created")

        gen.apply_description( rapi, self, description )

    def on_input(self,grid):
        print("game_of_life_3d performs step",size)
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


def init(*args):
    gen.register({"random_voxels":random_voxels})
    gen.register({"game_of_life_3d":game_of_life_3d})

################
