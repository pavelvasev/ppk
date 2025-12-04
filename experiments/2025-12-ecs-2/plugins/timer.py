import os
import sys

import ppk
import ppk.genesis as gen

import numpy as np
import asyncio

class timer:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()        
        #self.positions = rapi.channel(self.id + 'positions').cell()

        self.output = ppk.local.Cell().put( 0 )
        self.start = ppk.local.Cell().put( 0 )
        self.step = ppk.local.Cell().put( 1 )
        self.period = ppk.local.Cell().put( 1 )

        def on_start(v):
          self.output.put(v)
        self.start.react( on_start )

        gen.apply_description( rapi, self, description )

        start_periodic_task( self.period.value, self.do_step )

    def do_step(self):
        v = self.output.value + self.step.value
        print("TIMER v=",v,flush=True)
        self.output.put( v )

def init(*args):
	gen.register({"timer":timer})

################

async def run_periodic(interval, func, *args, **kwargs):
    """
    Запускает функцию периодически с заданным интервалом
    
    :param interval: интервал в секундах между вызовами
    :param func: функция для периодического вызова
    :param args: позиционные аргументы для функции
    :param kwargs: именованные аргументы для функции
    """
    while True:
        try:
            func(*args, **kwargs)
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Error in periodic function: {e}")
            break

def start_periodic_task(interval, func, *args, **kwargs):
    """
    Создает и запускает периодическую задачу
    
    :param interval: интервал в секундах между вызовами
    :param func: функция для периодического вызова
    :return: объект Task, который можно использовать для управления задачей
    """
    return asyncio.create_task(run_periodic(interval, func, *args, **kwargs))

