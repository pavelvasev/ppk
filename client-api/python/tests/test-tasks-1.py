#!/bin/env python3.9

import asyncio
from client_api import Client

import numpy as np
c = Client()

class Summatra:
    def __init__(self,rapi):
        self.rapi = rapi
        rapi.sum = self.sum

    async def sum( self,a,b ):
   	    return await self.rapi.exec_request( c.js("args => args.a + args.b",a=a,b=b) )

async def main():	
	t1 = await c.connect()	

	print("connected",t1)
	
	arr = np.array([1, 2, 3.0])
	print("arr created =",arr)
	handle = await c.add_data( arr )
	print("handle=",handle)
	
	#h2 = await c.exec_request( c.js("args => args.a + args.b",a=1,b=2) )

	c.extend("summatra",Summatra)
	h2 = await c.sum( 10,20 )

	#dat = await c.get_payload( handle )
	dat = await c.get_data( h2 )
	print("result=",dat)

	await c.exit()

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
loop.run_until_complete( c.t1 )
loop.close()

#asyncio.run( main() )