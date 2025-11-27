#!/bin/env python3.9

"""
процесс создает объекты по генезис-протоколу.
может использоваться как универсальный исполнитель.

идеи
выразить логику объектом
"""

import asyncio
import ppk
import ppk.genesis as gen
import time
import sys
import os
import matplotlib.pyplot as plt
import io

import plugins.active

rapi = ppk.Client()

async def main():
    url = os.environ["PPK_URL"]
    print("worker connecting to",url)
    await rapi.connect( url=url )
    print("connected")

    input = rapi.channel( os.environ["PPK_INPUT_CHANNEL"] )
    report = rapi.channel( os.environ.get("PPK_REPORT_CHANNEL","genesis-worker-report") )

    print("loading plugins")
    plugins.active.init(rapi)

    # см причем grafix/web/public/app.js будем делать 1 протокол
    # call_tag, put_tag, remove..
    async def qcb(msg):
        print("worker has message! msg=",msg)
        #output.put( msg * 2 )
        #arg = msg["arg"]
        arg = msg # пока так
        if msg["action"] == "create":
            objs = gen.create_objects( rapi, arg["description"],arg.get("target_id",None) )
        elif msg["action"] == "modify":
            object_id = msg["object_id"]
            obj = gen.get_object_by_id( object_id )
            gen.apply_description(rapi,obj,arg["description"])

        #await rapi.reply( msg, {"content_type":"image/png","payload":image} )
        # ну сделаем чтобы можно было посылать запросы.. ну например..
        await rapi.reply( msg, "created" )

    input.react( qcb )

    report.put({"status":"worker-started","input_channel":input.id})

    while True:
        await asyncio.sleep( 1*100000 )
    print("Exiting")
    await c.exit()
    await s.exit()

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
loop.close()
