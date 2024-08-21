#!/bin/env python3.9

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

mdir = os.path.join( os.path.dirname(__file__), ".." )
sys.path.insert(0,mdir)
import lib

rapi = ppk.Client()
s = ppk_main.EmbeddedServer()
# s = ppk.RemoteSlurm()
# sw = ppk.LocalServer()

def on_worker_msg(msg):
    print("msg from worker: ",msg)


import lib

import string
import random
def id_generator(size=10, chars=string.ascii_uppercase + string.digits):
    return ''.join(random.choice(chars) for _ in range(size))    

async def main():
    print("starting system")
    s1 = await s.start()
    print("system started, connecting")
    s_urls = s.urls_future.result()
    
    t1 = await rapi.connect( url=s_urls[0] )
    print("connected",t1)


    gui_attached_ch = rapi.channel("gui_attached")
    lines_id = "main_lines"
    lines_id2 = lines_id +"/append_data"
    print("lines_id2=",lines_id2)
    lines_channel = rapi.channel(lines_id2)    

    async def on_gui_attached(msg):
        #global lines_id
        print("on_gui_attached",msg)
        gui_id = msg["id"]
        gui_ch = rapi.channel(gui_id)
        #gui_ch = rapi.channel("gui/create_component")
        m = {"description":{"type":"big_grid","params":{"step":[10,10]},"items":[]},"target_id":"s","id":id_generator()}
        print("putting message to test create",m)
        gui_ch.put( m )
        m = {"description":{"type":"big_grid","params":{"step":[100,100],"color":[0,1,0],"rotation":[90 * math.pi / 180,0,0]},"items":[]},"target_id":"s","id":id_generator()}
        print("putting message to test create2",m)
        gui_ch.put( m )

        x = random.sample(range(1, 100), 3*2*10)
        y = (np.random.randint(255, size=3*2*10) / 255.0).tolist()
        #lines_id = id_generator()
        m = {"description":{"type":"lines","params":{"color":[1,1,1],"positions":x, "colors":y,"radius":5}},"target_id":"s","id":lines_id}
        print("putting message to test create3",m)
        gui_ch.put( m )

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
    await lib.start_visual( s_urls[0] )


    test_channel = rapi.channel("test")
    for i in range(1000):
      print("python: put to test")
      test_channel.put(i)
      await asyncio.sleep( 1 )
      #print("lines_id=",lines_id)
      x = random.sample(range(1, 100), 3*2*1)
      y = (np.random.randint(255, size=3*2*1) / 255.0).tolist()        
      m = {"p":x,"c":y}
      print("sending to lines2:",m)
      lines_channel.put( m )
      
    print("Exiting")
    await c.exit()
    await s.exit()

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
# loop.run_until_complete( c.t1 )
loop.close()
