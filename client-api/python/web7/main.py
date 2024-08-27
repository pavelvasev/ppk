#!/bin/env python3.9

import asyncio
import ppk
import ppk_main
#import ppk_ws_bridge
import ppk_ws_repr
import ppk_web
import os
import time
import sys
import atexit
import subprocess
import numpy as np
import math

mdir = os.path.join( os.path.dirname(__file__), ".." )
sys.path.insert(0,mdir)
#import lib

rapi = ppk.Client()
s = ppk_main.Server()
#q = ppk_ws_bridge.Server()
q = ppk_ws_repr.Server()
w = ppk_web.Server()
# s = ppk.RemoteSlurm()
# sw = ppk.LocalServer()

def on_worker_msg(msg):
    print("msg from worker: ",msg)


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


#import lib

import string
import random
def id_generator(size=10, chars=string.ascii_uppercase + string.digits):
    return ''.join(random.choice(chars) for _ in range(size))    

import webbrowser

i=0
async def main():
    print("starting system")
    s1 = await s.start()
    print("system started, connecting")
    
    t1 = await rapi.connect( url=s.url )
    print("connected",t1)

    print("starting ws repr")
    await q.start(rapi)
    #print("ws bridge started, url=",q.url)

    print("starting web server")
    await w.start(os.path.join( os.path.dirname(__file__), "public" ))
    print("webserver started, url=",w.url  )
    # https://docs.python.org/3/library/webbrowser.html
    webbrowser.open(w.url + "/index.html?repr_url="+q.url, new = 2)

    gui_attached_ch = rapi.channel("gui_attached")
    lines_id = "main_lines"
    lines_id2 = lines_id +"/append_data"
    #print("lines_id2=",)
    PATCH_LINES_CH_ID = "patch_lines"
    lines_channel = rapi.channel(PATCH_LINES_CH_ID)

    async def on_gui_attached(msg):
        #global lines_id
        print("on_gui_attached",msg)
        gui_id = msg["id"]
        gui_ch = rapi.channel(gui_id)
        #gui_ch = rapi.channel("gui/create_component")

        """
        m = {"description":{"type":"big_grid","params":{"step":[10,10]},"items":[]},"target_id":"s","id":id_generator()}
        print("putting message to test create",m)
        gui_ch.put( m )
        m = {"description":{"type":"big_grid","params":{"step":[100,100],"color":[0,1,0],"rotation":[90 * math.pi / 180,0,0]},"items":[]},"target_id":"s","id":id_generator()}
        print("putting message to test create2",m)
        gui_ch.put( m )
        """

        text_id = "info_text1"
        #m = {"description":{"type":"text","params":{"value":"hello! -- "}},"target_id":"root","id":text_id}
        #gui_ch.put( m )

        text_id = "info_text"
        #m = {"description":{"type":"text","params":{"value":"starting..."},"links_in": {"value":["test"]}},"target_id":"root","id":text_id}
        #gui_ch.put( m )

        tx1 = {"type":"text","params":{"value":"hello! -- "}}
        tx2 = {"type":"text","params":{"value":"starting..."},"links_in": {"value":["test"]}}
        bt = {"type":"button","params":{"value":"reset"},"links_out": {"click":["reset_cnt"]}}
        fon = {"type":"bgcolor","params":{"value":[1,0,0]}}
        block = {"description":{"type":"column","items":[tx1,tx2,fon,bt]},"target_id":"root"}
        gui_ch.put( block )

        m = {"description":{"type":"view","params":{"bgcolor":[0,0,0.01]},"id":"theview","items":[{"type":"cube"}]},"target_id":"root"}
        print("putting message to create view ",m)
        gui_ch.put( m )

        x = random.sample(range(1, 100), 3*2*10)
        y = (np.random.randint(255, size=3*2*10) / 255.0).tolist()
        #lines_id = id_generator()
        m = {"description":{
              "type":"lines",
              "params":{"color":[1,1,1],"positions":x, "colors":y,"radius":5},
              "links_in": {"positions":["linecoords"],"patch":[PATCH_LINES_CH_ID]}
              },
              "target_id":"theview"}
        print("putting message to test create3",m)
        gui_ch.put( m )

        big_grid( rapi, gui_ch, step=[10,10], target_id="theview",color=[0,1,0])
        big_grid( rapi, gui_ch, step=[100,100], target_id="theview",color=[0,1,0],rotation=[90 * math.pi / 180,0,0])

        """
        for i in range(1000):
            x = random.sample(range(1, 100), 3*2*1)
            y = (np.random.randint(255, size=3*2*1) / 255.0).tolist()        
            m = {"p":x,"c":y}
            print("sending to lines2:",m)
            lines_channel.put( m )
            await asyncio.sleep( 1 )
        """

    gui_attached_ch.react( on_gui_attached )

    #print("starting browser..")
    #await start_browser( s_urls[0] )

    print("starting bro..")
    #await lib.start_visual( s_urls[0] )

    def reset_cnt(val):
        print("reset_cnt!")
        global i
        i = 0

    rapi.channel("reset_cnt").react(reset_cnt)

    test_channel = rapi.channel("test")
    global i
    #for i in range(1000):
    while True:
      i = i + 1
      print("python: put to test",i)
      test_channel.put(i)
      await asyncio.sleep( 1 )
      #print("lines_id=",lines_id)
      x = random.sample(range(1, 100), 3*2*1)
      y = (np.random.randint(255, size=3*2*1) / 255.0).tolist()        
      m = {"p":x,"c":y}
      print("sending to lines:",m)
      lines_channel.put( m )
      
    print("range finished, exiting")
    await rapi.exit()

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
# loop.run_until_complete( c.t1 )
loop.close()
