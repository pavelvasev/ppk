"""
random - генерирует массив случайных чисел
вход:
* count - длина массива
* min max - диапазон для чисел
выход:
* output - результат
"""

import os
import sys

import ppk
import ppk.genesis as gen

import numpy as np

class random:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()        
        #self.positions = rapi.channel(self.id + 'positions').cell()
        self.count = ppk.local.Cell()
        self.min = ppk.local.Cell().put(0)
        self.max = ppk.local.Cell().put(1)
        self.output = ppk.local.Cell()

        self.count.react( self.go )
        self.min.react( self.go )
        self.max.react( self.go )
        
        gen.apply_description( rapi, self, description )

    def go(self,m=None):
        if not self.count.is_set:
            return
        arr = np.random.rand(self.count.value) * (self.max.value - self.min.value) + self.min.value
        print("RANDOM GEN=",len(arr))
        arr = arr.tolist()
        self.output.put( arr )

def init(*args):
	gen.register({"random":random})
