#!/bin/env python3.9
# клиент

import asyncio
import ppk
import time

c = ppk.Client()
#s = ppk.RemoteSlurm()
s = ppk.LocalServer()
# идея - не RemoteSlurm а RemoteServer - ну подумаешь запустили где-то сервер
# а слурм не-слурм дело другое.

def qcb(msg):
    print("qcb! msg=",msg)

async def main():
    print("starting system")
    #s1 = await s.start()
    t1 = await c.connect( url=s.url )
    # print("connected",t1)

    def on_m3(msg):
        print("python: reply arrived",msg)

    for i in range(1,100):
        print("calling msg")

        print("sending request test3")
        await c.request({"label":"test","alfa":i}, on_m3)
        await asyncio.sleep( 1 )

    print("Exiting")
    await c.exit()
    await s.exit()
 

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )

loop.run_until_complete( c.t1 )
#shutdown( loop )
#print("loop close")
loop.close()
