import os
import sys

import ppk
#import grafix
import ppk.genesis as gen

import numpy as np
import asyncio

class load_data:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()
        self.file = ppk.local.Cell()
        self.output = ppk.local.Cell().put([])

        self.file.react( self.do_load )
        
        gen.apply_description( rapi, self, description )

    def do_load(self,filename):
        with open(filename, "r") as file:
            lines = file.readlines()
            arr = []
            for line in lines:
              line_nums = map(float, line.split())
              for num in line_nums:
                arr.append( num )
        self.output.put(arr)

class load_uframe_1:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()
        self.dir = ppk.local.Cell()
        self.N = ppk.local.Cell()
        self.output = ppk.local.Cell().put([])

        self.dir.react( self.do_load )
        self.N.react( self.do_load )
        
        gen.apply_description( rapi, self, description )

    def do_load(self,filename):
        if not (self.N.is_set and self.dir.is_set):
            return
        norm = True
        N = self.N.value
        dir = self.dir.value
        coordinates = [] # координаты точек
        line_segs = [] # номера индексов координат, в семантике PolyData lines

        for i in range(0,N+1):
            # Загрузка данных из файла
            fname = dir+"/" + str(i)+".txt"
            print("loading i=",i,"fname=",fname)
            with open(fname, "r") as file:
              lines = file.readlines()
              if norm and (N > 1):
                  z_value = i / float(N)  # Значение для координаты z

              print("z=",z_value)

              final = len(coordinates)+len(lines) # номер последней вершине в текущей набранной коллекции
              if i == 0: # первый файл не замыкаем ломаную
                  l = [len(lines)] + list(range( len(coordinates), final ))
              else:  # остальные файлы замкнутая ломанаю
                  l = [1+len(lines)] + list(range( len(coordinates), final )) + [len(coordinates)]
              line_segs.extend(l)

              for line in lines:
                  x, y = map(float, line.split())
                  #coordinates.append([x, y, z_value])
                  coordinates.append(x)
                  coordinates.append(y)
                  coordinates.append(z_value)
        #print("coordinates=",coordinates)
        self.output.put( coordinates )

class load_ushakov_frame:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()        
        self.dir = ppk.local.Cell()
        self.N = ppk.local.Cell()
        self.output = ppk.local.Cell().put([])

        self.dir.react( self.do_load )
        self.N.react( self.do_load )
        
        gen.apply_description( rapi, self, description )

    def do_load(self,filename):
        if not (self.N.is_set and self.dir.is_set):
            return
        norm = True
        N = self.N.value
        dir = self.dir.value
        positions = []

        for i in range(0,N+1):
            # Загрузка данных из файла
            fname = dir+"/" + str(i)+".txt"
            print("loading i=",i,"fname=",fname)
            with open(fname, "r") as file:
              lines = file.readlines()
              if norm and (N > 1):
                z_value = i / float(N)  # Значение для координаты z

              coordinates = []
              for line in lines:
                  x, y = map(float, line.split())
                  coordinates.append([x, y, z_value])

              for j in range(len(coordinates)-1):
                positions.append( coordinates[j][0] )
                positions.append( coordinates[j][1] )
                positions.append( coordinates[j][2] )
                positions.append( coordinates[j+1][0] )
                positions.append( coordinates[j+1][1] )
                positions.append( coordinates[j+1][2] )

              if i > 0:
                # замыкаем, для всех кроме первой
                j = len(coordinates)-1
                positions.append( coordinates[j][0] )
                positions.append( coordinates[j][1] )
                positions.append( coordinates[j][2] )
                positions.append( coordinates[0][0] )
                positions.append( coordinates[0][1] )
                positions.append( coordinates[0][2] )

        #print("coordinates=",coordinates)
        self.output.put( positions )        

"""
печатает значение в консоль

* input - входное значение
* text - префикс при печати

при изменении input происходит печать в консоль
"""
class vprint:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()
        self.input = ppk.local.Cell()
        self.text = ppk.local.Cell().put("")
        self.input.react( self.go )

        gen.apply_description( rapi, self, description )

    def go(self,m=None):
        if not self.input.is_set:
            return
        print(self.text.value,self.input.value,flush=True)


def init(*args):
    gen.register({"load_data":load_data})
    gen.register({"load_ushakov_frame":load_ushakov_frame})
    gen.register({"print":vprint})

################
