#!/bin/env python3.9
# версия с обещаниями

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

    for i in range(1,100):
        print("calling msg")

        m = {"label":"test","alfa":i}
        print("sending request",m)
        k = await c.request_pp(m)
        print("got result=",k)
        """
        k = await c.request_p({"label":"test","alfa":i})
        await k
        print("got k=",k)
        await k
        print("got k2=",k.result())
        """

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
