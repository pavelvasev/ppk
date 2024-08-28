"""
todo разобраться с импортированием етой либы.. типа import ppk.gr6.lib надо
т.е. чтобы само ppk его не загружало
"""

import asyncio
import ppk
import ppk_main
import os
import time
import sys
import atexit
import subprocess
import numpy as np
import math

import ppk_ws_repr
import ppk_web

import webbrowser

async def start_visual(rapi):    
    q = ppk_ws_repr.Server()
    w = ppk_web.Server()    

    print("starting ws repr")
    await q.start(rapi)
    #print("ws bridge started, url=",q.url)

    print("starting web server")
    await w.start(os.path.join( os.path.dirname(__file__), "public" ))
    print("webserver started, url=",w.url  )
    # https://docs.python.org/3/library/webbrowser.html
    webbrowser.open(w.url + "/index.html?repr_url="+q.url, new = 2)

# вариант 1 что big_grid вот явная функция
# а вариант 2 что в ответ на то что там нешмогли но это сложнее делать
def big_grid( rapi,gui_ch,target_id,minmax=[0,0,1000,1000],step=[100,100],id=None,**params):
    coords = []
    for x in range(minmax[0],minmax[2]+step[0],step[0]):
        coords.append( x )
        coords.append( minmax[1] )
        coords.append( 0 )
        coords.append( x )
        coords.append( minmax[3] )
        coords.append( 0 )

    for y in range(minmax[1],minmax[3]+step[1],step[1]):
        coords.append( minmax[0] )
        coords.append( y )        
        coords.append( 0 )
        coords.append( minmax[2] )
        coords.append( y )        
        coords.append( 0 )
    
    m = {"description":{
      "type":"lines",
      "params":{"positions":coords, "radius":1,**params}
      },
      "target_id":target_id}
    #print("bigrid m=",m)
    gui_ch.put( m )
    # todo может быть стоит запулить координаты не в разметке а в канал
