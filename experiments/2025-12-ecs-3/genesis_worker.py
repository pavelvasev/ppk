#!/bin/env python3.9

"""
процесс создает объекты по генезис-протоколу.
может использоваться как универсальный исполнитель.

идеи
выразить логику объектом
"""

# Сначала устанавливаем переменные окружения
import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

# Затем импортируем библиотеки
import numpy as np
############################

import asyncio
import ppk
import ppk.genesis as gen
import time
import sys
import matplotlib.pyplot as plt
import io

import plugins.active
import plugins.ecs

LOCAL_WORLD = plugins.ecs.World()
LOCAL_SYSTEMS = []

rapi = ppk.Client()

async def main():
    url = os.environ["PPK_URL"]
    print("worker connecting to",url)
    await rapi.connect( url=url )
    print("connected")

    #RUN_SYSTEMS = plugins.ecs.LoopComponent(LOCAL_SYSTEMS,LOCAL_WORLD)

    input = rapi.channel( os.environ["PPK_INPUT_CHANNEL"] )
    report = rapi.channel( os.environ.get("PPK_REPORT_CHANNEL","genesis-worker-report") )

    print("loading plugins")
    plugins.active.init(rapi)

    stop_f = asyncio.Future()

    # см причем grafix/web/public/app.js будем делать 1 протокол
    # call_tag, put_tag, remove..
    async def qcb(msg):
        print("worker has message! msg=",msg)
        #output.put( msg * 2 )
        #arg = msg["arg"]
        arg = msg # пока так
        if msg["action"] == "create":
            arg["description"]["local_world"] = LOCAL_WORLD
            arg["description"]["local_systems"] = LOCAL_SYSTEMS
            objs = gen.create_objects( rapi, arg["description"],arg.get("target_id",None) )
        elif msg["action"] == "update":
            object_id = msg["id"]
            obj = gen.get_object_by_id( object_id )
            gen.apply_description(rapi,obj,arg["description"])
        elif msg["action"] == "exit":
            print("got exit message -> exiting")
            stop_f.set_result(1)
            #print("calling rapi.exit")
            #await rapi.exit()
            #await asyncio.sleep(0.0001)
            #print("calling exit(0)")
            #exit(0)
            #return

        #await rapi.reply( msg, {"content_type":"image/png","payload":image} )
        # ну сделаем чтобы можно было посылать запросы.. ну например..
        await rapi.reply( msg, "created" )

    input.react( qcb )

    report.put({"status":"worker-started","input_channel":input.id})

    #while True:
    #    await asyncio.sleep( 1*100000 )
    await stop_f
    print("Exiting")
    print("calling rapi.exit")
    await rapi.exit()    
    print("finishing main")

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
loop.close()
