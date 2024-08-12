#!/bin/env python3.9

import asyncio
import ppk
import time
import sys
import os

rapi = ppk.Client()

def qcb(msg):
    print("qcb! msg=",msg)

async def main():
    channel_id = os.environ["PPK_WRK_CHANNEL"]
    url = os.environ["PPK_URL"]
    print("worker",channel_id,": connecting to",url)
    await rapi.connect( url=url )
    print("connected")
    
    # await rapi.reaction( "test", rapi.python( f ))
    print("installing query",channel_id)
    await rapi.query( channel_id,qcb )
    
    await asyncio.sleep( 1*100000 )
    print("Exiting")
    await c.exit()
    await s.exit()

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
# loop.run_until_complete( c.t1 )
loop.close()
