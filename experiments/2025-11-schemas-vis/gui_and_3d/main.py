#!/bin/env python3

"""
Скрипт создает 3D сцену и со временем наполняет ее случайными отрезками.
Также вверху окна рисуется несколько элементов интерфейса.
"""

import asyncio
import ppk
#import ppk_main
#import ppk_ws_bridge
#import ppk_ws_repr
#import ppk_web
import os
import time
import sys
import atexit
import subprocess
import numpy as np
import math

import grafix.web
import grafix.dom
import grafix.threejs
import grafix.lib3d

import string
import random

async def main(rapi):
    # todo это надо упростить
    print("starting web server")
    await grafix.web.start(rapi,[grafix.dom,grafix.threejs])

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

        text_id = "info_text1"
        text_id = "info_text"

        tx1 = {"type":"text","params":{"value":"hello!"}}
        tx2 = {"type":"text","params":{"value":"starting..."},"links_in": {"value":["test"]}}
        bt = {"type":"button","params":{"value":"reset"},"links_out": {"click":["reset_cnt"]}}
        fon = {"type":"bgcolor","params":{"value":[1,0,0]}}
        block = {"description":{"type":"column","items":[tx1,tx2,fon,bt]},"target_id":"root"}
        gui_ch.put( block )

        m = {"description":{"type":"view","params":{"bgcolor":[0,0,0.01]},"id":"theview","items":[{"type":"cube"}]},"target_id":"root"}
        print("putting message to create view ",m)
        gui_ch.put( m )

        x = (np.random.rand(3*2*10)*20).tolist()
        y = (np.random.randint(255, size=3*2*10) / 255.0).tolist()
        #lines_id = id_generator()
        m = {"description":{
              "type":"lines",
              "params":{"color":[1,1,1],"positions":x, "colors":y,"radius":5},
              "links_in": {"positions":["linecoords"],"colors":["linecolors"],"patch":[PATCH_LINES_CH_ID]}
              },
              "target_id":"theview"}
        print("putting message to test create3",m)
        gui_ch.put( m )

        grafix.lib3d.big_grid( rapi, gui_ch, step=[10,10], target_id="theview",color=[0,1,0])
        grafix.lib3d.big_grid( rapi, gui_ch, step=[100,100], target_id="theview",color=[0,1,0],rotation=[90 * math.pi / 180,0,0])

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

    i = 0
    def reset_cnt(val):
        print("reset_cnt!")
        nonlocal i
        i = 0
        rapi.channel("linecoords").put([])
        rapi.channel("linecolors").put([])

    rapi.channel("reset_cnt").react(reset_cnt)

    test_channel = rapi.channel("test")
    
    #for i in range(1000):
    while True:
      i = i + 1
      print("python: put to test",i)
      test_channel.put(i)
      await asyncio.sleep( 1 )
      #print("lines_id=",lines_id)
      pos = random.sample(range(1, 20), 3*2*1)
      color = (np.random.randint(255, size=3*2*1) / 255.0).tolist()        
      m = {"p":pos,"c":color}
      print("sending to lines:",m)
      lines_channel.put( m )

    print("range finished, exiting")
    await rapi.exit()

ppk.start( main )
