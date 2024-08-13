#!/bin/env python3.9

import asyncio
import ppk
import time
import sys
import os

rapi = ppk.Client()

async def main():
    url = os.environ["PPK_URL"]
    print("worker connecting to",url)
    await rapi.connect( url=url )
    print("connected")

    input = rapi.channel( os.environ["PPK_INPUT_CHANNEL"] )
    output = rapi.channel( os.environ["PPK_OUTPUT_CHANNEL"] )

    def qcb(msg):
        print("worker has message! msg=",msg)
        output.put( msg * 2)

    input.react( qcb )

    await asyncio.sleep( 1*100000 )
    print("Exiting")
    await c.exit()
    await s.exit()

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
# loop.run_until_complete( c.t1 )
loop.close()
