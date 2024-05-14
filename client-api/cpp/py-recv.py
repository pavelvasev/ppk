#!/bin/env python3.9


import asyncio
import ppk
import time

c = ppk.Client()
#s = ppk.RemoteSlurm()
s = ppk.LocalServer()
# идея - не RemoteSlurm а RemoteServer - ну подумаешь запустили где-то сервер
# а слурм не-слурм дело другое.

def f(msg):
    print("f action ! msg=",msg)

def qcb(msg):
    print("---------------- qcb! msg=",msg)
    
def qcb2(msg):
    print("---------------- qcb2! msg=",msg)

async def main():
    #print("starting system")
    #s1 = await s.start()
    t1 = await c.connect( url=s.url )
    #print("connected",t1)
    
    rapi = c
    # await rapi.reaction( "test", rapi.python( f ))
    print("installed query")
    await c.query( "test",qcb )
    
    await c.query( "test",qcb2 )
    
    await asyncio.sleep( 1*100000 )
    print("Exiting")
    await c.exit()
    await s.exit()
 

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )

loop.run_until_complete( c.t1 )
#shutdown( loop )
#print("loop close")
loop.close()
