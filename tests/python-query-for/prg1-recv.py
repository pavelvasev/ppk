#!/bin/env python3.9


import asyncio
import ppk
import time

c = ppk.Client()
#s = ppk.RemoteSlurm()
s = ppk.LocalServer()
# идея - не RemoteSlurm а RemoteServer - ну подумаешь запустили где-то сервер
# а слурм не-слурм дело другое.

async def main():
    print("starting system")
    s1 = await s.start()
    t1 = await c.connect( url=s.url )
    #print("connected",t1)
    
    rapi = c

    print("installing query 1")

    async for msg in c.query_for( "test" ):
      print("got test msg",msg)
      
    print("installing query 2")
      
    async for msg in c.query_for( "test42" ):
      print("got test msg",msg)
 
    print("entering sleep")
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
