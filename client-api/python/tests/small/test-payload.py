#!/bin/env python3.9

import asyncio
from client_api import Client

import numpy as np

def f(msg):
	print("f action ! msg=",msg)
	
def qcb(msg):
  print("qcb! msg=",msg)

c = Client()

async def main():	
	t1 = await c.connect()
	print("connected",t1)
	
	arr = np.array([1, 2, 3.0])
	print("arr created =",arr)
	handle = await c.submit_payload( arr )
	print("handle=",handle)

	dat = await c.get_payload( handle )
	print("loaded back=",dat)

	await c.exit()

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
loop.run_until_complete( c.t1 )
loop.close()

#asyncio.run( main() )